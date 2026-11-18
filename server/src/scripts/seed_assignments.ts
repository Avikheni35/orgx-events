/**
 * Seeds a "today" event with confirmed assignments for testing check-in/check-out.
 * Requires: seed.ts + seed_event_staff.ts already run.
 *
 * Usage: cd m2/server && npx tsx src/scripts/seed_assignments.ts
 */
import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/orgx';

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  const db = mongoose.connection.db!;

  // ── Find demo tenant ─────────────────────────────────────────────────────────
  const tenant = await db.collection('tenants').findOne({ loginCode: 'demo' });
  if (!tenant) { console.error('Demo tenant not found — run seed.ts first'); process.exit(1); }
  const tenantId = tenant._id;

  const adminUser = await db.collection('users').findOne({ tenantId, role: 'agency_admin' });
  if (!adminUser) { console.error('No agency_admin found — run m1 seed first'); process.exit(1); }

  // ── Staff profiles that have user accounts (from seed_event_staff.ts) ────────
  const staffWithUsers = await db.collection('staffprofiles')
    .find({ tenantId, userId: { $exists: true } })
    .toArray();

  if (staffWithUsers.length === 0) {
    console.error('No staff profiles with user accounts found — run seed_event_staff.ts first');
    process.exit(1);
  }
  console.log(`Found ${staffWithUsers.length} staff with user accounts.`);

  // ── Venue ────────────────────────────────────────────────────────────────────
  const venue = await db.collection('venues').findOne({ tenantId });
  if (!venue) { console.error('No venue found — run seed.ts first'); process.exit(1); }

  // ── Client ───────────────────────────────────────────────────────────────────
  const client = await db.collection('eventclients').findOne({ tenantId });
  if (!client) { console.error('No client found — run seed.ts first'); process.exit(1); }

  // ── Delete previous "today" test event + assignments ─────────────────────────
  const existing = await db.collection('events').findOne({ tenantId, name: 'Test-Event Heute' });
  if (existing) {
    await db.collection('eventstaffassignments').deleteMany({ eventId: existing._id });
    await db.collection('events').deleteOne({ _id: existing._id });
    console.log('Deleted previous test event and assignments.');
  }

  // ── Build slot times relative to now ─────────────────────────────────────────
  const now = new Date();

  // Morning slot: started 2h ago → check-in window open, not yet over
  const morningStart = new Date(now); morningStart.setHours(now.getHours() - 2, 0, 0, 0);
  const morningEnd   = new Date(now); morningEnd.setHours(now.getHours() + 4, 0, 0, 0);

  // Afternoon slot: starts in 10 minutes → check-in window just opened (15 min rule)
  const afternoonStart = new Date(now.getTime() + 10 * 60_000);
  const afternoonEnd   = new Date(afternoonStart.getTime() + 4 * 60 * 60_000);

  // Evening slot: starts in 3h → check-in not yet available
  const eveningStart = new Date(now.getTime() + 3 * 60 * 60_000);
  const eveningEnd   = new Date(eveningStart.getTime() + 5 * 60 * 60_000);

  const positionId   = new Types.ObjectId();
  const slot1Id      = new Types.ObjectId();
  const slot2Id      = new Types.ObjectId();
  const slot3Id      = new Types.ObjectId();

  // ── Event count for number ────────────────────────────────────────────────────
  const count = await db.collection('events').countDocuments({ tenantId });
  const eventNumber = `EVT-${String(count + 1).padStart(5, '0')}`;

  // ── Create event ──────────────────────────────────────────────────────────────
  const event = await db.collection('events').insertOne({
    tenantId,
    createdBy: adminUser._id,
    name: 'Test-Event Heute',
    eventNumber,
    clientId: client._id,
    clientName: client.name,
    venueId: venue._id,
    venueName: venue.name,
    type: 'corporate',
    startDate: morningStart,
    endDate: eveningEnd,
    description: 'Testveranstaltung für Check-in / Check-out-Tests.',
    budget: 5000,
    plannedRevenue: 8000,
    status: 'confirmed',
    positions: [
      {
        _id: positionId,
        title: 'Service-Personal',
        roleType: 'Catering',
        headcount: staffWithUsers.length,
        payRatePerHour: 14.5,
        billingRatePerHour: 22,
        skills: [],
        slots: [
          { _id: slot1Id, startTime: morningStart,   endTime: morningEnd,   breakMinutes: 30 },
          { _id: slot2Id, startTime: afternoonStart, endTime: afternoonEnd, breakMinutes: 0  },
          { _id: slot3Id, startTime: eveningStart,   endTime: eveningEnd,   breakMinutes: 30 },
        ],
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`Created event: Test-Event Heute (${eventNumber})`);
  console.log(`  Slot 1 (active now):      ${fmt(morningStart)} – ${fmt(morningEnd)}`);
  console.log(`  Slot 2 (check-in open):   ${fmt(afternoonStart)} – ${fmt(afternoonEnd)}`);
  console.log(`  Slot 3 (not yet):         ${fmt(eveningStart)} – ${fmt(eveningEnd)}`);

  // ── Assignments: distribute staff across slots ───────────────────────────────
  const assignments = [];
  const slotMap = [
    { slotId: slot1Id, slotStart: morningStart,   slotEnd: morningEnd   },
    { slotId: slot2Id, slotStart: afternoonStart, slotEnd: afternoonEnd },
    { slotId: slot3Id, slotStart: eveningStart,   slotEnd: eveningEnd   },
  ];

  for (let i = 0; i < staffWithUsers.length; i++) {
    const s = staffWithUsers[i];
    const slot = slotMap[i % slotMap.length]; // round-robin across slots
    assignments.push({
      tenantId,
      eventId:        event.insertedId,
      eventName:      'Test-Event Heute',
      positionId,
      positionTitle:  'Service-Personal',
      slotId:         slot.slotId,
      slotStart:      slot.slotStart,
      slotEnd:        slot.slotEnd,
      staffProfileId: s._id,
      staffName:      `${s.firstName} ${s.lastName}`,
      staffEmail:     s.email,
      payRatePerHour: 14.5,
      billingRatePerHour: 22,
      status:         'confirmed',
      actualBreakMinutes: 0,
      createdBy:      adminUser._id,
      createdAt:      new Date(),
      updatedAt:      new Date(),
    });
  }

  await db.collection('eventstaffassignments').insertMany(assignments);
  console.log(`\nCreated ${assignments.length} confirmed assignments:`);
  for (let i = 0; i < staffWithUsers.length; i++) {
    const s = staffWithUsers[i];
    const slot = slotMap[i % slotMap.length];
    console.log(`  ${s.firstName} ${s.lastName} (${s.email}) → ${fmt(slot.slotStart)}–${fmt(slot.slotEnd)}`);
  }

  console.log('\n✓ Done.');
  console.log('\nLog in as any staff member to test check-in:');
  staffWithUsers.slice(0, 3).forEach((s) => console.log(`  ${s.email}  /  Staff1234!`));

  await mongoose.disconnect();
}

function fmt(d: Date) {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

main().catch((e) => { console.error(e); process.exit(1); });
