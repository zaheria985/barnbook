import pool from '../lib/db';
import bcrypt from 'bcryptjs';

async function seed() {
  const hash = await bcrypt.hash('barnbook123', 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`,
    ['rider@barnbook.local', hash, 'Test Rider']
  );
  console.log('Dev seed complete: rider@barnbook.local / barnbook123');
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
