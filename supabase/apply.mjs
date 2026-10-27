import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return env;
}

const env = readEnv(path.join(root, '.env.local'));
const sqlPath = path.resolve(root, process.argv[2] || path.join('supabase', 'migrations', '20261028000000_init.sql'));
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new pg.Client({
  host: env.SUPABASE_DB_HOST,
  port: Number(env.SUPABASE_DB_PORT || 5432),
  database: env.SUPABASE_DB_NAME,
  user: env.SUPABASE_DB_USER,
  password: env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

await client.connect();
try {
  await client.query(sql);
  const tables = await client.query(
    `select tablename
     from pg_tables
     where schemaname = 'public'
       and tablename in (
         'profiles','customers','quotations','jobs','payments',
         'material_spends','employees','attendance'
       )
     order by tablename`
  );
  console.log(tables.rows.map((row) => row.tablename).join('\n'));
} finally {
  await client.end();
}
