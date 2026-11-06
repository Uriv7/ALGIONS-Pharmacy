import { Router, Request, Response, NextFunction } from 'express';
import { ProductSchema } from '@algions/contracts';
import { authenticateToken, requireOwner } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { generateUUIDv7, formatPackQuantity } from '@algions/domain';

export const productsRouter = Router();

// GET /products/search
productsRouter.get('/search', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ((req.query.q as string) || '').trim().toLowerCase();
    const storeId = req.user!.storeId;

    let productsQuery = `
      SELECT id, brand_name, generic_name, strength, dosage_form, manufacturer,
             barcodes, hsn_code, tax_category, tax_rate_percent, units_per_pack,
             pack_unit_label, loose_unit_label, rack_location, reorder_level, is_active
      FROM products
      WHERE store_id = $1 AND is_active = 1
    `;
    const params: unknown[] = [storeId];

    if (query) {
      productsQuery += ` AND (
        LOWER(brand_name) LIKE $2 OR
        LOWER(generic_name) LIKE $2 OR
        LOWER(manufacturer) LIKE $2 OR
        barcodes LIKE $2
      )`;
      params.push(`%${query}%`);
    }

    productsQuery += ' ORDER BY brand_name ASC LIMIT 50';

    const productsResult = await req.db.query<{
      id: string;
      brand_name: string;
      generic_name: string;
      strength: string;
      dosage_form: string;
      manufacturer: string;
      barcodes: string;
      hsn_code: string;
      tax_category: string;
      tax_rate_percent: number;
      units_per_pack: number;
      pack_unit_label: string;
      loose_unit_label: string;
      rack_location: string;
      reorder_level: number;
      is_active: number;
    }>(productsQuery, params);

    // Fetch batches for each product
    const productResults = [];
    for (const p of productsResult.rows) {
      const batchesResult = await req.db.query<{
        id: string;
        batch_number: string;
        mfg_date: string;
        expiry_date: string;
        mrp_paise: number;
        sale_rate_paise: number;
        purchase_rate_paise: number;
        quantity: number;
        rack_location: string;
      }>(
        `SELECT id, batch_number, mfg_date, expiry_date, mrp_paise, sale_rate_paise, purchase_rate_paise, quantity, rack_location
         FROM batches
         WHERE product_id = $1 AND quantity > 0
         ORDER BY expiry_date ASC`,
        [p.id]
      );

      const totalStock = batchesResult.rows.reduce((sum, b) => sum + Number(b.quantity), 0);
      const nearestExpiry = batchesResult.rows[0]?.expiry_date ?? null;

      // Staff view: hide purchase rate per SAD 2.2 / FES I1
      const isOwner = req.user?.accountType === 'OWNER';
      const sanitizedBatches = batchesResult.rows.map((b) => ({
        id: b.id,
        productId: p.id,
        batchNumber: b.batch_number,
        mfgDate: b.mfg_date,
        expiryDate: b.expiry_date,
        mrpPaise: Number(b.mrp_paise),
        saleRatePaise: Number(b.sale_rate_paise),
        purchaseRatePaise: isOwner ? Number(b.purchase_rate_paise) : undefined,
        quantity: Number(b.quantity),
        rackLocation: b.rack_location,
      }));

      // Find substitutes with identical generic name and strength
      let substitutes = undefined;
      if (query && sanitizedBatches.length === 0) {
        const subResult = await req.db.query(
          `SELECT id, brand_name, strength, manufacturer FROM products
           WHERE store_id = $1 AND generic_name = $2 AND id != $3 AND is_active = 1 LIMIT 3`,
          [storeId, p.generic_name, p.id]
        );
        substitutes = subResult.rows;
      }

      productResults.push({
        product: {
          id: p.id,
          brandName: p.brand_name,
          genericName: p.generic_name,
          strength: p.strength,
          dosageForm: p.dosage_form,
          manufacturer: p.manufacturer,
          barcodes: JSON.parse(p.barcodes || '[]'),
          hsnCode: p.hsn_code,
          taxCategory: p.tax_category,
          taxRatePercent: Number(p.tax_rate_percent),
          unitsPerPack: Number(p.units_per_pack),
          packUnitLabel: p.pack_unit_label,
          looseUnitLabel: p.loose_unit_label,
          rackLocation: p.rack_location,
          reorderLevel: Number(p.reorder_level),
          isActive: Boolean(p.is_active),
        },
        totalStockUnits: totalStock,
        totalStockPacksFormatted: formatPackQuantity(totalStock, p.units_per_pack, p.pack_unit_label, p.loose_unit_label),
        nearestExpiryDate: nearestExpiry,
        batches: sanitizedBatches,
        substitutes,
      });
    }

    res.json({ results: productResults });
  } catch (err) {
    next(err);
  }
});

// GET /catalog/snapshot (For Primary Offline Workstation initial download)
productsRouter.get('/catalog/snapshot', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const products = await req.db.query('SELECT * FROM products WHERE store_id = $1 AND is_active = 1', [storeId]);
    const batches = await req.db.query(
      'SELECT * FROM batches WHERE store_id = $1 AND quantity > 0',
      [storeId]
    );

    res.json({
      snapshotTimestamp: new Date().toISOString(),
      storeId,
      products: products.rows,
      batches: batches.rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /products (Owner only)
productsRouter.post('/', authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ProductSchema.parse(req.body);
    const storeId = req.user!.storeId;
    const newId = generateUUIDv7();
    const nowIso = new Date().toISOString();

    await req.db.execute(
      `INSERT INTO products (id, store_id, brand_name, generic_name, strength, dosage_form, manufacturer, barcodes, hsn_code, tax_category, tax_rate_percent, units_per_pack, pack_unit_label, loose_unit_label, rack_location, reorder_level, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        newId,
        storeId,
        body.brandName,
        body.genericName,
        body.strength,
        body.dosageForm,
        body.manufacturer,
        JSON.stringify(body.barcodes),
        body.hsnCode,
        body.taxCategory,
        body.taxRatePercent,
        body.unitsPerPack,
        body.packUnitLabel,
        body.looseUnitLabel,
        body.rackLocation ?? null,
        body.reorderLevel,
        1,
        nowIso,
        nowIso,
      ]
    );

    res.status(201).json({ id: newId, ...body });
  } catch (err) {
    next(err);
  }
});

// GET /products (List all products for Master table)
productsRouter.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const query = ((req.query.q as string) || '').trim().toLowerCase();

    let sql = `
      SELECT p.*,
             COALESCE((SELECT SUM(quantity) FROM batches WHERE product_id = p.id AND quantity > 0), 0) as total_stock,
             (SELECT MIN(expiry_date) FROM batches WHERE product_id = p.id AND quantity > 0) as nearest_expiry
      FROM products p
      WHERE p.store_id = $1 AND p.is_active = 1
    `;
    const params: unknown[] = [storeId];

    if (query) {
      sql += ` AND (LOWER(p.brand_name) LIKE $2 OR LOWER(p.generic_name) LIKE $2 OR LOWER(p.manufacturer) LIKE $2)`;
      params.push(`%${query}%`);
    }

    sql += ' ORDER BY p.brand_name ASC LIMIT 100';
    const result = await req.db.query(sql, params);

    const formatted = result.rows.map((p: any) => ({
      id: p.id,
      brandName: p.brand_name,
      genericName: p.generic_name,
      strength: p.strength,
      dosageForm: p.dosage_form,
      manufacturer: p.manufacturer,
      barcodes: JSON.parse(p.barcodes || '[]'),
      hsnCode: p.hsn_code,
      taxCategory: p.tax_category,
      taxRatePercent: Number(p.tax_rate_percent),
      unitsPerPack: Number(p.units_per_pack),
      packUnitLabel: p.pack_unit_label,
      looseUnitLabel: p.loose_unit_label,
      rackLocation: p.rack_location,
      reorderLevel: Number(p.reorder_level),
      totalStock: Number(p.total_stock),
      nearestExpiry: p.nearest_expiry,
      isActive: Boolean(p.is_active),
    }));

    res.json({ products: formatted });
  } catch (err) {
    next(err);
  }
});

// PUT /products/:id (Update product details - Owner only, MED-004)
productsRouter.put('/:id', authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
    const storeId = req.user!.storeId;
    const body = ProductSchema.partial().parse(req.body);
    const nowIso = new Date().toISOString();

    const existing = await req.db.queryOne<{ id: string }>('SELECT id FROM products WHERE id = $1 AND store_id = $2', [
      productId,
      storeId,
    ]);
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Product Not Found', 'Product does not exist.');

    await req.db.execute(
      `UPDATE products SET
         brand_name = COALESCE($1, brand_name),
         generic_name = COALESCE($2, generic_name),
         strength = COALESCE($3, strength),
         dosage_form = COALESCE($4, dosage_form),
         manufacturer = COALESCE($5, manufacturer),
         hsn_code = COALESCE($6, hsn_code),
         tax_rate_percent = COALESCE($7, tax_rate_percent),
         units_per_pack = COALESCE($8, units_per_pack),
         rack_location = COALESCE($9, rack_location),
         reorder_level = COALESCE($10, reorder_level),
         updated_at = $11
       WHERE id = $12 AND store_id = $13`,
      [
        body.brandName ?? null,
        body.genericName ?? null,
        body.strength ?? null,
        body.dosageForm ?? null,
        body.manufacturer ?? null,
        body.hsnCode ?? null,
        body.taxRatePercent ?? null,
        body.unitsPerPack ?? null,
        body.rackLocation ?? null,
        body.reorderLevel ?? null,
        nowIso,
        productId,
        storeId,
      ]
    );

    res.json({ success: true, message: 'Product updated successfully.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /products/:id (Deactivate product - Owner only, MED-001)
productsRouter.delete('/:id', authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
    const storeId = req.user!.storeId;
    const nowIso = new Date().toISOString();

    await req.db.execute(
      'UPDATE products SET is_active = 0, updated_at = $1 WHERE id = $2 AND store_id = $3',
      [nowIso, productId, storeId]
    );

    res.json({ success: true, message: 'Product deactivated successfully.' });
  } catch (err) {
    next(err);
  }
});

// GET /products/export/csv (Bulk Medicine Master CSV Export - MED-008)
productsRouter.get('/export/csv', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const products = await req.db.query(
      `SELECT p.brand_name, p.generic_name, p.strength, p.dosage_form,
              p.manufacturer, p.barcodes, p.hsn_code, p.tax_rate_percent,
              p.units_per_pack, p.rack_location, p.reorder_level,
              COALESCE((SELECT SUM(quantity) FROM batches WHERE product_id = p.id AND quantity > 0), 0) as current_stock
       FROM products p
       WHERE p.store_id = $1 AND p.is_active = 1
       ORDER BY p.brand_name ASC`,
      [storeId]
    );

    const headers = [
      'Brand Name',
      'Generic Name',
      'Strength',
      'Dosage Form',
      'Manufacturer',
      'Barcodes',
      'HSN Code',
      'Tax Rate %',
      'Units Per Pack',
      'Rack Location',
      'Reorder Level',
      'Current Stock',
    ];

    const csvRows = [headers.join(',')];

    for (const r of products.rows as any[]) {
      const escape = (val: any) => {
        const str = String(val ?? '').replace(/"/g, '""');
        return `"${str}"`;
      };

      const barcodes = JSON.parse(r.barcodes || '[]').join(';');

      csvRows.push(
        [
          escape(r.brand_name),
          escape(r.generic_name),
          escape(r.strength),
          escape(r.dosage_form),
          escape(r.manufacturer),
          escape(barcodes),
          escape(r.hsn_code),
          r.tax_rate_percent,
          r.units_per_pack,
          escape(r.rack_location || ''),
          r.reorder_level,
          r.current_stock,
        ].join(',')
      );
    }

    const csvString = csvRows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="algions_medicine_catalogue.csv"');
    res.send(csvString);
  } catch (err) {
    next(err);
  }
});

// POST /products/import/csv (Bulk Medicine Master CSV Import - MED-008)
productsRouter.post('/import/csv', authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'No Rows Provided', 'Payload must contain a non-empty rows array.');
    }

    const storeId = req.user!.storeId;
    const nowIso = new Date().toISOString();
    let imported = 0;
    const errors: string[] = [];

    await req.db.transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r.brandName || !r.genericName) {
          errors.push(`Row ${i + 1}: Missing Brand Name or Generic Name.`);
          continue;
        }

        const newId = generateUUIDv7();
        const barcodesJson = JSON.stringify(
          Array.isArray(r.barcodes) ? r.barcodes : r.barcode ? [r.barcode] : []
        );

        await tx.execute(
          `INSERT INTO products (
            id, store_id, brand_name, generic_name, strength, dosage_form, manufacturer,
            barcodes, hsn_code, tax_category, tax_rate_percent, units_per_pack,
            pack_unit_label, loose_unit_label, rack_location, reorder_level, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 1, $17, $18)`,
          [
            newId,
            storeId,
            r.brandName.trim(),
            r.genericName.trim(),
            r.strength?.trim() || '',
            r.dosageForm || 'TABLET',
            r.manufacturer?.trim() || 'Generic Lab',
            barcodesJson,
            r.hsnCode || '3004',
            r.taxCategory || 'GST_12',
            Number(r.taxRatePercent) || 12,
            Number(r.unitsPerPack) || 10,
            r.packUnitLabel || 'Strip',
            r.looseUnitLabel || 'Tablet',
            r.rackLocation?.trim() || 'Shelf',
            Number(r.reorderLevel) || 10,
            nowIso,
            nowIso,
          ]
        );
        imported++;
      }
    });

    res.json({
      success: true,
      imported,
      errorsCount: errors.length,
      errors,
      message: `Successfully imported ${imported} formulations.`,
    });
  } catch (err) {
    next(err);
  }
});
