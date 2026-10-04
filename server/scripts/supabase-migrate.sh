#!/bin/sh
# Apply pending Prisma migrations to Supabase (session pooler, :5432),
# re-run the lockdown, then show the migration status.
# Run from anywhere: sh server/scripts/supabase-migrate.sh
set -e
cd "$(dirname "$0")/.."
DATABASE_URL="$(grep '^SUPABASE_DIRECT_URL=' .env | cut -d= -f2- | tr -d '"\r')"
[ -n "$DATABASE_URL" ] || { echo "SUPABASE_DIRECT_URL missing in server/.env"; exit 1; }
export DATABASE_URL
npx prisma migrate deploy
npm run -s supabase:lockdown
npx prisma migrate status
