import { buildApp } from './app.ts';
import { config } from './config.ts';
import { pool } from './db/client.ts';
import { migrate } from './db/migrate.ts';
import { hub } from './lib/hub.ts';
import { startJobs } from './lib/jobs.ts';

const applied = await migrate();
if (applied.length) console.log(`Applied migrations: ${applied.join(', ')}`);

const app = await buildApp();
await hub.start();
const stopJobs = startJobs();

const shutdown = async () => {
  stopJobs();
  await hub.stop();
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.port, host: config.host });
