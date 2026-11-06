import { Router, Request, Response, NextFunction } from 'express';
import {
  authenticateToken,
  requireOwner,
} from '../middleware/auth.js';
import { CustomerSchema, DoctorSchema, CreateExpenseSchema } from '@algions/contracts';
import { generateUUIDv7 } from '@algions/domain';
import { AppError } from '../middleware/error.js';

export const accountingRouter = Router();

// GET /accounting/day-book (Owner only)
accountingRouter.get('/day-book', authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const entries = await req.db.query(
      `SELECT id, entry_date as "date", account_code as "accountCode",
              account_name as "accountName", category, debit_paise as "debitPaise",
              credit_paise as "creditPaise", narration, reference_document_type as "referenceDocumentType",
              reference_document_id as "referenceDocumentId", created_at as "createdAt"
       FROM ledger_entries
       WHERE store_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [storeId]
    );

    res.json({ dayBook: entries.rows });
  } catch (err) {
    next(err);
  }
});

// GET /accounting/ledgers (Owner only)
accountingRouter.get('/ledgers', authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const summary = await req.db.query<{
      account_code: string;
      account_name: string;
      category: string;
      total_debit: number;
      total_credit: number;
    }>(
      `SELECT account_code, account_name, category,
              SUM(debit_paise) as total_debit,
              SUM(credit_paise) as total_credit
       FROM ledger_entries
       WHERE store_id = $1
       GROUP BY account_code, account_name, category
       ORDER BY account_code ASC`,
      [storeId]
    );

    const accounts = summary.rows.map((a) => {
      const debit = Number(a.total_debit || 0);
      const credit = Number(a.total_credit || 0);
      const isDebitNature = a.category === 'ASSET' || a.category === 'EXPENSE';
      const balancePaise = isDebitNature ? debit - credit : credit - debit;

      return {
        accountCode: a.account_code,
        accountName: a.account_name,
        category: a.category,
        totalDebitPaise: debit,
        totalCreditPaise: credit,
        balancePaise,
      };
    });

    res.json({ accounts });
  } catch (err) {
    next(err);
  }
});

// GET /gst/summary (GSTR-1 & 3B data)
accountingRouter.get('/gst-summary', authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;

    // Aggregate GST from sales lines
    const totals = await req.db.queryOne<{
      total_taxable: number;
      total_cgst: number;
      total_sgst: number;
      total_igst: number;
      total_invoice: number;
    }>(
      `SELECT SUM(taxable_total_paise) as total_taxable,
              SUM(cgst_total_paise) as total_cgst,
              SUM(sgst_total_paise) as total_sgst,
              SUM(igst_total_paise) as total_igst,
              SUM(grand_total_paise) as total_invoice
       FROM sales_invoices
       WHERE store_id = $1 AND status = 'POSTED'`,
      [storeId]
    );

    const hsnRows = await req.db.query<{
      hsn_code: string;
      generic_name: string;
      units: number;
      taxable: number;
      cgst: number;
      sgst: number;
      igst: number;
      total: number;
    }>(
      `SELECT p.hsn_code, p.generic_name,
              SUM(l.quantity) as units,
              SUM(l.taxable_amount_paise) as taxable,
              SUM(l.cgst_paise) as cgst,
              SUM(l.sgst_paise) as sgst,
              SUM(l.igst_paise) as igst,
              SUM(l.final_line_total_paise) as total
       FROM sales_lines l
       JOIN products p ON l.product_id = p.id
       JOIN sales_invoices i ON l.sales_invoice_id = i.id
       WHERE i.store_id = $1 AND i.status = 'POSTED'
       GROUP BY p.hsn_code, p.generic_name
       ORDER BY taxable DESC`,
      [storeId]
    );

    res.json({
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      totalTaxablePaise: Number(totals?.total_taxable || 0),
      totalCGSTPaise: Number(totals?.total_cgst || 0),
      totalSGSTPaise: Number(totals?.total_sgst || 0),
      totalIGSTPaise: Number(totals?.total_igst || 0),
      totalTaxPaise: Number(totals?.total_cgst || 0) + Number(totals?.total_sgst || 0) + Number(totals?.total_igst || 0),
      totalInvoiceValuePaise: Number(totals?.total_invoice || 0),
      hsnSummary: hsnRows.rows.map((r) => ({
        hsnCode: r.hsn_code || '3004',
        description: r.generic_name,
        totalUnits: Number(r.units),
        taxablePaise: Number(r.taxable),
        cgstPaise: Number(r.cgst),
        sgstPaise: Number(r.sgst),
        igstPaise: Number(r.igst),
        totalAmountPaise: Number(r.total),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /customers
accountingRouter.get(['/customers', '/'], authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const query = ((req.query.q as string) || '').trim().toLowerCase();

    let sql = 'SELECT * FROM customers WHERE store_id = $1 AND is_active = 1';
    const params: unknown[] = [storeId];

    if (query) {
      sql += ' AND (LOWER(name) LIKE $2 OR phone LIKE $2)';
      params.push(`%${query}%`);
    }

    sql += ' ORDER BY name ASC LIMIT 30';
    const result = await req.db.query(sql, params);
    res.json({ customers: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /customers
accountingRouter.post(['/customers', '/'], authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CustomerSchema.parse(req.body);
    const storeId = req.user!.storeId;
    const newId = generateUUIDv7();
    const nowIso = new Date().toISOString();

    await req.db.execute(
      `INSERT INTO customers (id, store_id, name, phone, email, address, credit_limit_paise, outstanding_balance_paise, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        newId,
        storeId,
        body.name,
        body.phone,
        body.email ?? null,
        body.address ?? null,
        body.creditLimitPaise,
        0,
        1,
        nowIso,
      ]
    );

    res.status(201).json({ id: newId, ...body });
  } catch (err) {
    next(err);
  }
});

// GET /doctors
accountingRouter.get(['/doctors', '/'], authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const result = await req.db.query('SELECT * FROM doctors WHERE store_id = $1 AND is_active = 1 ORDER BY name ASC', [
      storeId,
    ]);
    res.json({ doctors: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /doctors
accountingRouter.post(['/doctors', '/'], authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = DoctorSchema.parse(req.body);
    const storeId = req.user!.storeId;
    const newId = generateUUIDv7();
    const nowIso = new Date().toISOString();

    await req.db.execute(
      `INSERT INTO doctors (id, store_id, name, reg_number, specialization, hospital_clinic, phone, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        newId,
        storeId,
        body.name,
        body.regNumber ?? null,
        body.specialization ?? null,
        body.hospitalClinic ?? null,
        body.phone ?? null,
        1,
        nowIso,
      ]
    );

    res.status(201).json({ id: newId, ...body });
  } catch (err) {
    next(err);
  }
});

// POST /customers/:id/payments (Customer credit receipt settlement - ACC-003, CUS-003)
accountingRouter.post(['/customers/:id/payments', '/:id/payments'], authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
    const { amountPaise, mode, notes } = req.body;
    if (!amountPaise || amountPaise <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Amount', 'Payment amount must be greater than zero.');
    }
    const storeId = req.user!.storeId;
    const nowIso = new Date().toISOString();
    const paymentId = generateUUIDv7();

    const customer = await req.db.queryOne<{ id: string; name: string; outstanding_balance_paise: number }>(
      'SELECT id, name, outstanding_balance_paise FROM customers WHERE id = $1 AND store_id = $2',
      [customerId, storeId]
    );
    if (!customer) throw new AppError(404, 'NOT_FOUND', 'Customer Not Found', 'Customer not found.');

    await req.db.transaction(async (tx) => {
      // 1. Reduce outstanding balance
      await tx.execute(
        'UPDATE customers SET outstanding_balance_paise = MAX(0, outstanding_balance_paise - $1) WHERE id = $2',
        [amountPaise, customerId]
      );

      // 2. Post Ledger Entries (Debit Cash/Bank, Credit Customer Receivable)
      const accountCode = mode === 'BANK' || mode === 'UPI' ? '1010' : '1000';
      const accountName = mode === 'BANK' || mode === 'UPI' ? 'Bank Account' : 'Cash in Hand';

      // Debit Asset (Cash/Bank)
      await tx.execute(
        `INSERT INTO ledger_entries (
          id, store_id, transaction_id, entry_date, account_code, account_name,
          category, debit_paise, credit_paise, narration, reference_document_type,
          reference_document_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          generateUUIDv7(),
          storeId,
          paymentId,
          nowIso.slice(0, 10),
          accountCode,
          accountName,
          'ASSET',
          amountPaise,
          0,
          `Credit Receipt from ${customer.name}: ${notes || 'Customer settlement'}`,
          'CUSTOMER_PAYMENT',
          paymentId,
          nowIso,
        ]
      );

      // Credit Asset (Receivables)
      await tx.execute(
        `INSERT INTO ledger_entries (
          id, store_id, transaction_id, entry_date, account_code, account_name,
          category, debit_paise, credit_paise, narration, reference_document_type,
          reference_document_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          generateUUIDv7(),
          storeId,
          paymentId,
          nowIso.slice(0, 10),
          '1200',
          'Customer Receivables',
          'ASSET',
          0,
          amountPaise,
          `Credit Receipt from ${customer.name}: ${notes || 'Customer settlement'}`,
          'CUSTOMER_PAYMENT',
          paymentId,
          nowIso,
        ]
      );
    });

    res.json({ success: true, message: 'Customer payment recorded and ledger posted.' });
  } catch (err) {
    next(err);
  }
});

// POST /accounting/expenses (Record Operating Expenses - Owner only, ACC-004)
accountingRouter.post('/expenses', authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateExpenseSchema.parse(req.body);
    const storeId = req.user!.storeId;
    const expenseId = generateUUIDv7();
    const nowIso = new Date().toISOString();

    const categoryMap: Record<string, { code: string; name: string }> = {
      RENT: { code: '5001', name: 'Shop Rent Expense' },
      ELECTRICITY: { code: '5002', name: 'Electricity & Utilities Expense' },
      PACKAGING: { code: '5003', name: 'Packaging & Materials Expense' },
      SALARY_ADVANCE: { code: '5004', name: 'Salary & Staff Advance' },
      TEA_REFRESHMENTS: { code: '5005', name: 'Refreshments & Pantry Expense' },
      MAINTENANCE: { code: '5006', name: 'Repairs & Store Maintenance' },
      OTHER: { code: '5000', name: 'General Operating Expenses' },
    };

    const expAccount = categoryMap[body.category] || categoryMap.OTHER;
    const paymentAccountCode = body.paymentMode === 'CASH' ? '1000' : '1010';
    const paymentAccountName = body.paymentMode === 'CASH' ? 'Cash in Hand' : 'Bank Account';

    await req.db.transaction(async (tx) => {
      // 1. Debit Expense Account (EXPENSE increases with Debit)
      await tx.execute(
        `INSERT INTO ledger_entries (
          id, store_id, transaction_id, entry_date, account_code, account_name,
          category, debit_paise, credit_paise, narration, reference_document_type,
          reference_document_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          generateUUIDv7(),
          storeId,
          expenseId,
          nowIso.slice(0, 10),
          expAccount.code,
          expAccount.name,
          'EXPENSE',
          body.amountPaise,
          0,
          `Paid ${body.payeeName}: ${body.narration || expAccount.name}`,
          'EXPENSE_VOUCHER',
          expenseId,
          nowIso,
        ]
      );

      // 2. Credit Cash/Bank (ASSET decreases with Credit)
      await tx.execute(
        `INSERT INTO ledger_entries (
          id, store_id, transaction_id, entry_date, account_code, account_name,
          category, debit_paise, credit_paise, narration, reference_document_type,
          reference_document_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          generateUUIDv7(),
          storeId,
          expenseId,
          nowIso.slice(0, 10),
          paymentAccountCode,
          paymentAccountName,
          'ASSET',
          0,
          body.amountPaise,
          `Paid ${body.payeeName} (${body.paymentMode}): ${body.narration || expAccount.name}`,
          'EXPENSE_VOUCHER',
          expenseId,
          nowIso,
        ]
      );
    });

    res.status(201).json({
      success: true,
      expenseId,
      message: 'Expense voucher posted to double-entry ledger.',
    });
  } catch (err) {
    next(err);
  }
});

// GET /accounting/expenses (List Expenses - Owner only)
accountingRouter.get('/expenses', authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const expenses = await req.db.query(
      `SELECT id, entry_date as "date", account_code as "accountCode",
              account_name as "accountName", debit_paise as "amountPaise",
              narration, created_at as "createdAt"
       FROM ledger_entries
       WHERE store_id = $1 AND category = 'EXPENSE' AND debit_paise > 0
       ORDER BY created_at DESC LIMIT 50`,
      [storeId]
    );

    res.json({ expenses: expenses.rows });
  } catch (err) {
    next(err);
  }
});

// GET /accounting/registers/schedule-h1 (Statutory Schedule H1 & Antibiotic Drug Register - CUS-006 / QA-011)
accountingRouter.get('/registers/schedule-h1', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const query = `
      SELECT i.full_invoice_number as "invoiceNumber",
             i.created_at as "date",
             COALESCE(i.customer_name, c.name, 'Walk-in Patient') as "patientName",
             COALESCE(i.customer_phone, c.phone, '-') as "patientPhone",
             COALESCE(c.address, 'Local') as "patientAddress",
             COALESCE(i.doctor_name, d.name, 'Consulting Physician') as "doctorName",
             COALESCE(d.reg_number, 'Reg/State/2026') as "doctorRegNumber",
             COALESCE(d.hospital_clinic, 'Clinic') as "doctorClinic",
             l.product_name as "drugName",
             l.generic_name as "genericName",
             l.batch_number as "batchNumber",
             l.expiry_date as "expiryDate",
             l.quantity as "quantityDispensed",
             u.name as "pharmacistName"
      FROM sales_lines l
      JOIN sales_invoices i ON l.sales_invoice_id = i.id
      JOIN users u ON i.user_id = u.id
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN doctors d ON i.doctor_id = d.id
      WHERE i.store_id = $1 AND i.status = 'POSTED'
        AND (
          LOWER(l.generic_name) LIKE '%amoxicillin%' OR
          LOWER(l.generic_name) LIKE '%azithromycin%' OR
          LOWER(l.generic_name) LIKE '%cefixime%' OR
          LOWER(l.generic_name) LIKE '%moxifloxacin%' OR
          LOWER(l.generic_name) LIKE '%levofloxacin%' OR
          LOWER(l.generic_name) LIKE '%ciprofloxacin%' OR
          LOWER(l.generic_name) LIKE '%meropenem%' OR
          LOWER(l.generic_name) LIKE '%ceftriaxone%' OR
          LOWER(l.generic_name) LIKE '%alprazolam%' OR
          LOWER(l.generic_name) LIKE '%clonazepam%' OR
          LOWER(l.generic_name) LIKE '%tramadol%' OR
          LOWER(l.product_name) LIKE '%augmentin%' OR
          LOWER(l.product_name) LIKE '%moxikind%' OR
          LOWER(l.product_name) LIKE '%azee%'
        )
      ORDER BY i.created_at DESC LIMIT 100
    `;

    const register = await req.db.query(query, [storeId]);
    res.json({ register: register.rows });
  } catch (err) {
    next(err);
  }
});

// GET /accounting/profit-and-loss (Financial Statement: Profit & Loss - ACC-009)
accountingRouter.get('/profit-and-loss', authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const startDate = (req.query.startDate as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate = (req.query.endDate as string) || new Date().toISOString().slice(0, 10);

    // 1. Sales & Revenue
    const salesAgg = await req.db.queryOne<{
      gross_sales: number;
      discounts: number;
      taxable_sales: number;
      tax_collected: number;
    }>(
      `SELECT SUM(gross_total_paise) as gross_sales,
              SUM(total_discount_paise) as discounts,
              SUM(taxable_total_paise) as taxable_sales,
              SUM(tax_total_paise) as tax_collected
       FROM sales_invoices
       WHERE store_id = $1 AND status = 'POSTED'
         AND created_at >= $2 AND created_at <= $3`,
      [storeId, `${startDate}T00:00:00`, `${endDate}T23:59:59`]
    );

    const grossSalesPaise = Number(salesAgg?.gross_sales || 0);
    const discountsPaise = Number(salesAgg?.discounts || 0);
    const taxableSalesPaise = Number(salesAgg?.taxable_sales || 0);

    // 2. Cost of Goods Sold (COGS)
    const cogsAgg = await req.db.queryOne<{ total_cogs: number }>(
      `SELECT SUM(l.quantity * COALESCE(b.purchase_rate_paise, 0)) as total_cogs
       FROM sales_lines l
       JOIN batches b ON l.batch_id = b.id
       JOIN sales_invoices i ON l.sales_invoice_id = i.id
       WHERE i.store_id = $1 AND i.status = 'POSTED'
         AND i.created_at >= $2 AND i.created_at <= $3`,
      [storeId, `${startDate}T00:00:00`, `${endDate}T23:59:59`]
    );
    const cogsPaise = Number(cogsAgg?.total_cogs || 0);

    const grossProfitPaise = taxableSalesPaise - cogsPaise;
    const grossMarginPercent = taxableSalesPaise > 0 ? Number(((grossProfitPaise / taxableSalesPaise) * 100).toFixed(2)) : 0;

    // 3. Operating Expenses by Head
    const expRows = await req.db.query<{
      account_code: string;
      account_name: string;
      total_expense: number;
    }>(
      `SELECT account_code, account_name, SUM(debit_paise) as total_expense
       FROM ledger_entries
       WHERE store_id = $1 AND category = 'EXPENSE'
         AND entry_date >= $2 AND entry_date <= $3
       GROUP BY account_code, account_name
       ORDER BY account_code ASC`,
      [storeId, startDate, endDate]
    );

    const expensesList = expRows.rows.map((r) => ({
      accountCode: r.account_code,
      accountName: r.account_name,
      amountPaise: Number(r.total_expense || 0),
    }));

    const totalOperatingExpensesPaise = expensesList.reduce((acc, curr) => acc + curr.amountPaise, 0);
    const netOperatingProfitPaise = grossProfitPaise - totalOperatingExpensesPaise;

    res.json({
      startDate,
      endDate,
      grossSalesPaise,
      discountsPaise,
      taxableSalesPaise,
      cogsPaise,
      grossProfitPaise,
      grossMarginPercent,
      operatingExpenses: expensesList,
      totalOperatingExpensesPaise,
      netOperatingProfitPaise,
    });
  } catch (err) {
    next(err);
  }
});

// GET /accounting/balance-sheet (Financial Statement: Balance Sheet - ACC-010)
accountingRouter.get('/balance-sheet', authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const asOf = new Date().toISOString();

    // 1. Cash in Hand (Account 1000)
    const cash = await req.db.queryOne<{ debit: number; credit: number }>(
      `SELECT SUM(debit_paise) as debit, SUM(credit_paise) as credit
       FROM ledger_entries WHERE store_id = $1 AND account_code = '1000'`,
      [storeId]
    );
    const cashInHandPaise = Number(cash?.debit || 0) - Number(cash?.credit || 0);

    // 2. Bank Balance (Account 1010)
    const bank = await req.db.queryOne<{ debit: number; credit: number }>(
      `SELECT SUM(debit_paise) as debit, SUM(credit_paise) as credit
       FROM ledger_entries WHERE store_id = $1 AND account_code = '1010'`,
      [storeId]
    );
    const bankBalancePaise = Number(bank?.debit || 0) - Number(bank?.credit || 0);

    // 3. Trade Receivables (Account 1200 / Customer Khata)
    const cus = await req.db.queryOne<{ total_receivables: number }>(
      'SELECT SUM(outstanding_balance_paise) as total_receivables FROM customers WHERE store_id = $1 AND is_active = 1',
      [storeId]
    );
    const customerReceivablesPaise = Number(cus?.total_receivables || 0);

    // 4. Closing Inventory Valuation at Purchase Cost (Account 1300)
    const stock = await req.db.queryOne<{ valuation: number }>(
      'SELECT SUM(quantity * purchase_rate_paise) as valuation FROM batches WHERE store_id = $1 AND quantity > 0',
      [storeId]
    );
    const inventoryValuationPaise = Number(stock?.valuation || 0);

    const totalAssetsPaise = Math.max(0, cashInHandPaise) + Math.max(0, bankBalancePaise) + customerReceivablesPaise + inventoryValuationPaise;

    // 5. Trade Payables (Account 2000 / Supplier Ledgers)
    const sup = await req.db.queryOne<{ total_payables: number }>(
      `SELECT COALESCE(SUM(p.total_amount_paise), 0) - COALESCE(
        (SELECT SUM(l.debit_paise) FROM ledger_entries l WHERE l.store_id = $1 AND l.account_code = '2000'), 0
      ) as total_payables
       FROM purchase_invoices p WHERE p.store_id = $1`,
      [storeId]
    );
    const supplierPayablesPaise = Math.max(0, Number(sup?.total_payables || 0));

    // 6. GST Output Payable (Account 2200)
    const gstOut = await req.db.queryOne<{ output_gst: number }>(
      'SELECT SUM(tax_total_paise) as output_gst FROM sales_invoices WHERE store_id = $1 AND status = \'POSTED\'',
      [storeId]
    );
    const gstPayablePaise = Number(gstOut?.output_gst || 0);

    const totalLiabilitiesPaise = supplierPayablesPaise + gstPayablePaise;
    const retainedEarningsPaise = totalAssetsPaise - totalLiabilitiesPaise;

    res.json({
      asOf,
      assets: {
        cashInHandPaise: Math.max(0, cashInHandPaise),
        bankBalancePaise: Math.max(0, bankBalancePaise),
        customerReceivablesPaise,
        inventoryValuationPaise,
        totalAssetsPaise,
      },
      liabilities: {
        supplierPayablesPaise,
        gstPayablePaise,
        totalLiabilitiesPaise,
      },
      equity: {
        retainedEarningsPaise,
        totalEquityAndLiabilitiesPaise: totalLiabilitiesPaise + retainedEarningsPaise,
      },
    });
  } catch (err) {
    next(err);
  }
});


