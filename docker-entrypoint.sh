#!/bin/sh
set -e
# Migrasi (idempotent), lalu seed dasar (admin pertama, skema, pengaturan; idempotent), lalu jalankan server.
npx tsx server/database/migrate.ts
npx tsx server/database/seed.ts
exec node .output/server/index.mjs
