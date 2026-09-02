import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const SCHEMA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'schema');
const NAMES = ['version', 'app', 'news', 'meta', 'source'];
let cache = null;

/** { meta, app, news, source, version } ajv validate functions (fn(data) → boolean, fn.errors). */
export function getValidators() {
  if (cache) return cache;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const ids = {};
  for (const name of NAMES) {
    const schema = JSON.parse(readFileSync(path.join(SCHEMA_DIR, `${name}.schema.json`), 'utf8'));
    ajv.addSchema(schema);
    ids[name] = schema.$id;
  }
  cache = Object.fromEntries(NAMES.map((name) => [name, ajv.getSchema(ids[name])]));
  return cache;
}

export function formatAjvError(err) {
  const where = err.instancePath || '/';
  let detail = err.message;
  if (err.keyword === 'enum') detail += `, allowed: ${err.params.allowedValues.join(', ')}`;
  if (err.keyword === 'required') detail += ` (${err.params.missingProperty})`;
  if (err.keyword === 'additionalProperties') detail += ` (${err.params.additionalProperty})`;
  return `${where}: ${detail}`;
}
