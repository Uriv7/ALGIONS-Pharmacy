import { z } from 'zod';

export type DosageForm =
  | 'TABLET'
  | 'CAPSULE'
  | 'SYRUP'
  | 'INJECTION'
  | 'CREAM'
  | 'DROPS'
  | 'INHALER'
  | 'POWDER'
  | 'OTHER';

export const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  brandName: z.string().min(1),
  genericName: z.string().min(1),
  strength: z.string().default(''),
  dosageForm: z.enum([
    'TABLET',
    'CAPSULE',
    'SYRUP',
    'INJECTION',
    'CREAM',
    'DROPS',
    'INHALER',
    'POWDER',
    'OTHER',
  ]),
  manufacturer: z.string().min(1),
  barcodes: z.array(z.string()).default([]),
  hsnCode: z.string().default('3004'),
  taxCategory: z.enum(['EXEMPT', 'GST_5', 'GST_12', 'GST_18', 'GST_28']).default('GST_12'),
  taxRatePercent: z.number().default(12),
  unitsPerPack: z.number().int().positive().default(10), // e.g. 10 tablets per strip
  packUnitLabel: z.string().default('Strip'),
  looseUnitLabel: z.string().default('Tablet'),
  rackLocation: z.string().optional(),
  reorderLevel: z.number().int().nonnegative().default(10),
  isActive: z.boolean().default(true),
});
export type ProductDTO = z.infer<typeof ProductSchema>;

export const BatchSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  batchNumber: z.string().min(1),
  mfgDate: z.string().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry must be YYYY-MM-DD'),
  mrpPaise: z.number().int().positive(),
  saleRatePaise: z.number().int().positive(),
  purchaseRatePaise: z.number().int().positive().optional(),
  quantity: z.number().int().default(0), // loose units
  supplierId: z.string().uuid().optional(),
  rackLocation: z.string().optional(),
});
export type BatchDTO = z.infer<typeof BatchSchema>;

export interface ProductSearchResult {
  product: ProductDTO;
  totalStockUnits: number;
  totalStockPacksFormatted: string;
  nearestExpiryDate: string | null;
  batches: BatchDTO[];
  substitutes?: ProductDTO[];
}
