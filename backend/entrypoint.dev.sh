#!/bin/sh
set -e

echo "[entrypoint:dev] esperando conexión a MySQL en ${DB_HOST}:${DB_PORT}..."
until node -e "
const mysql = require('mysql2/promise');
mysql
  .createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  })
  .then((c) => c.end())
  .catch((e) => { console.error(e.message); process.exit(1); });
"; do
  echo "[entrypoint:dev] MySQL no disponible todavía, reintentando en 3s..."
  sleep 3
done
echo "[entrypoint:dev] conexión a MySQL establecida."

echo "[entrypoint:dev] corriendo migraciones..."
npm run migration:run

echo "[entrypoint:dev] corriendo seed idempotente..."
npm run seed

echo "[entrypoint:dev] iniciando Nest en modo watch (nest start --watch)..."
exec npm run start:dev
