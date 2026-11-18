/**
 * Creates event_staff User accounts with password login for seeded StaffProfiles.
 * Default password: Staff1234!
 * Usage: cd m2/server && npx tsx src/scripts/seed_event_staff.ts
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/orgx';
const DEFAULT_PASSWORD = 'Staff1234!';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  const db = mongoose.connection.db!;

  const tenant = await db.collection('tenants').findOne({ loginCode: 'demo' });
  if (!tenant) { console.error('Demo tenant not found — run seed.ts first'); process.exit(1); }

  const profiles = await db.collection('staffprofiles')
    .find({ tenantId: tenant._id })
    .limit(5)
    .toArray();

  if (profiles.length === 0) { console.error('No staff profiles found — run seed.ts first'); process.exit(1); }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  let created = 0;

  for (const p of profiles) {
    const existing = await db.collection('users').findOne({ email: p.email, tenantId: tenant._id });
    if (existing) {
      await db.collection('users').updateOne(
        { _id: existing._id },
        { $set: { role: 'event_staff', passwordHash, status: 'active' } }
      );
      await db.collection('staffprofiles').updateOne({ _id: p._id }, { $set: { userId: existing._id } });
      console.log(`  updated: ${p.email}`);
      continue;
    }

    const userId = new mongoose.Types.ObjectId();
    await db.collection('users').insertOne({
      _id: userId,
      email: p.email,
      firstName: p.firstName,
      lastName: p.lastName,
      role: 'event_staff',
      tenantId: tenant._id,
      passwordHash,
      status: 'active',
      emailVerified: true,
      refreshTokenHashes: [],
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.collection('staffprofiles').updateOne({ _id: p._id }, { $set: { userId } });
    console.log(`  created: ${p.email}`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${profiles.length - created} updated.`);
  console.log(`\nLogin at http://localhost:3001/event-staff/login`);
  console.log(`Password for all: ${DEFAULT_PASSWORD}`);
  console.log('\nAccounts:');
  profiles.forEach((p) => console.log(`  ${p.email}`));

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
