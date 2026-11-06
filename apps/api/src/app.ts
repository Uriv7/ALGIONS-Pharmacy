import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createDatabaseClient, IDatabase } from '@algions/db';
import { errorHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.routes.js';
import { storeRouter } from './routes/store.routes.js';
import { productsRouter } from './routes/products.routes.js';
import { posRouter } from './routes/pos.routes.js';
import { purchasesRouter } from './routes/purchases.routes.js';
import { inventoryRouter } from './routes/inventory.routes.js';
import { accountingRouter } from './routes/accounting.routes.js';
import { syncRouter } from './routes/sync.routes.js';
import { ownerRouter } from './routes/owner.routes.js';

export function createApp(db?: IDatabase): express.Express {
  const app = express();
  const dbClient = db || createDatabaseClient();

  // Basic Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  // Attach Database to Request context
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.db = dbClient;
    next();
  });

  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const store = await req.db.queryOne<{ id: string; name: string; active_mode: string }>(
        'SELECT id, name, active_mode FROM stores LIMIT 1'
      );
      res.json({
        status: 'ok',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'production',
        storeId: store?.id ?? null,
        storeName: store?.name ?? null,
        activeMode: store?.active_mode ?? 'UNKNOWN',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(503).json({ status: 'unhealthy', error: err.message });
    }
  });

  // Mount API Modules
  app.use('/auth', authRouter);
  app.use('/store', storeRouter);
  app.use('/devices', storeRouter);
  app.use('/products', productsRouter);
  app.use('/catalog', productsRouter);
  app.use('/pos', posRouter);
  app.use('/returns', posRouter);
  app.use('/purchases', purchasesRouter);
  app.use('/suppliers', purchasesRouter);
  app.use(['/stock', '/inventory'], inventoryRouter);
  app.use('/accounting', accountingRouter);
  app.use('/gst', accountingRouter);
  app.use('/customers', accountingRouter);
  app.use('/doctors', accountingRouter);
  app.use('/sync', syncRouter);
  app.use('/owner', ownerRouter);
  app.use('/users', ownerRouter);
  app.use('/audit', ownerRouter);

  // Global RFC 7807 Error Handler
  app.use(errorHandler);

  return app;
}
