// AI-COST-01 - the deterministic cost / Credit simulator, from the command line.
//
//   npm run simulate:ai-cost -- <scenario.json> [<scenario.json> ...]
//
// Each file holds one scenario or an array of scenarios (normalized usage, versioned Price Cards with their source,
// an optional Credit Policy, a label). Prices are INPUT, never fetched: the simulator reads no website and no
// database, touches no balance and writes nothing but its answer on stdout. Every money and Credit value is an exact
// decimal string. It runs the same compiled module the real-PostgreSQL verifier proves equal to the database.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const compiled = join(root, 'apps/api/dist/ai-usage/ai-cost-simulation.js');
if (!existsSync(compiled)) {
  console.error('Build the API first: npm run build:api');
  process.exit(1);
}
const { simulateAiCost } = createRequire(import.meta.url)(compiled);

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: npm run simulate:ai-cost -- <scenario.json> [<scenario.json> ...]');
  process.exit(1);
}
const results = [];
for (const file of files) {
  const parsed = JSON.parse(readFileSync(resolve(file), 'utf8'));
  for (const scenario of Array.isArray(parsed) ? parsed : [parsed]) results.push(simulateAiCost(scenario));
}
console.log(JSON.stringify(results, null, 2));
