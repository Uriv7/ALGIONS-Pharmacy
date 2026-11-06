import { Router, Request, Response, NextFunction } from 'express';
import {
  authenticateToken,
  requireOwner,
} from '../middleware/auth.js';
import { CustomerSchema, DoctorSchema } from '@algions/contracts';
import { generateUUIDv7 } from '@algions/domain';

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
accountingRouter.get('/customers', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
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
accountingRouter.post('/customers', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
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
accountingRouter.get('/doctors', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
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
accountingRouter.post('/doctors', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
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
