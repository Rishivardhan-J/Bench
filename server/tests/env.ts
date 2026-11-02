import fs from 'node:fs';
import path from 'node:path';

// Load server/.env for TEST_DATABASE_URL without needing a dotenv dependency.
const file = path.resolve(__dirname, '../.env');
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#\n]*)"?/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}
