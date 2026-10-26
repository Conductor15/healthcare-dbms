// Loads the repo-root .env. Import this FIRST in any demo script that also imports server modules,
// because server/src/config.js reads process.env when it is evaluated.
import path from 'node:path';

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '../../.env'));
} catch {
  // no .env: fall back to defaults / real environment
}
