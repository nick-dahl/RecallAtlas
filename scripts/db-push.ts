import fs from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { Client } from 'pg';

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error('Missing SUPABASE_DB_URL in .env.local');

  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(
      'create schema if not exists private; ' +
        'create table if not exists private.migrations (name text primary key, applied_at timestamptz not null default now())',
    );
    const { rows } = await client.query<{ name: string }>('select name from private.migrations');
    const applied = new Set(rows.map((r) => r.name));
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip    ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into private.migrations (name) values ($1)', [file]);
        await client.query('commit');
        console.log(`applied ${file}`);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
