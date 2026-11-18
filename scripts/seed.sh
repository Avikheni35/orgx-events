#!/usr/bin/env bash
# Seed the M2 database with demo data.
# Requires MongoDB running at localhost:27017 and M1 already seeded.
set -e

echo "Seeding M2 — Event Management..."
cd "$(dirname "$0")/.."

npm run seed -w server

echo "Seeding optional extended data..."
npx tsx server/src/scripts/seed_assignments.ts
npx tsx server/src/scripts/seed_event_staff.ts

echo "Done. Use M1 agency_admin or disponent credentials to log in."
