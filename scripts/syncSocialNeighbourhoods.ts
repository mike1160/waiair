/**
 * Writes proxy/data/neighbourhoods.json from lib/neighbourhoods.ts: the Railway proxy deploys from proxy/ only,
 * so the social poster reads its own copy. Run after editing the city list:
 *   node --experimental-strip-types scripts/syncSocialNeighbourhoods.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { curatedCities } from '../lib/neighbourhoods.ts';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'proxy', 'data', 'neighbourhoods.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(curatedCities(), null, 1)}\n`);
console.log(`wrote ${curatedCities().length} cities to ${out}`);
