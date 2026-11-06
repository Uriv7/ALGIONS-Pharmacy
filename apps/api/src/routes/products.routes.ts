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
