const mysql = require('mysql2/promise');

let pool = null;

async function findSellerByPhone(phone) {
  if (!dbEnabled()) {
    return null;
  }

  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone === '') {
    return null;
  }

  const [rows] = await db().execute(
    `SELECT id, code, name, email, phone, public_token
     FROM sellers
     WHERE is_active = 1
       AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), '-', ''), ' ', ''), '(', ''), ')', '') = ?
     LIMIT 1`,
    [normalizedPhone]
  );

  return rows[0] || null;
}

function dbEnabled() {
  return Boolean(
    process.env.DB_HOST
      && process.env.DB_NAME
      && process.env.DB_USER
  );
}

function db() {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 3),
    namedPlaceholders: false,
  });

  return pool;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D+/g, '');
}

module.exports = {
  findSellerByPhone,
};
