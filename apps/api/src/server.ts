import { createApp } from './app.js';
import { createDatabaseClient, runSeed } from '@algions/db';

const port = parseInt(process.env.PORT || '3001', 10);
const db = createDatabaseClient();

runSeed(db)
  .then(() => {
    const app = createApp(db);
    app.listen(port, () => {
      console.log(`🚀 ALGIONS Pharmacy Production API running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
