import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/orgx');

  const TS = mongoose.model('EventTimesheet', new mongoose.Schema({}, { strict: false, collection: 'eventtimesheets' }));
  const Pay = mongoose.model('Payment', new mongoose.Schema({}, { strict: false, collection: 'payments' }));

  // Find all payments that came from M3 (source: 'm3')
  const payments = await (Pay as any).find({ source: 'm3' }).lean();
  console.log(`Found ${payments.length} M3 payments`);

  let fixed = 0;
  for (const p of payments) {
    const from = new Date(Number(p.year), Number(p.month) - 1, 1);
    const to   = new Date(Number(p.year), Number(p.month),     1);
    const result = await (TS as any).updateMany(
      {
        tenantId: p.tenantId,
        staffProfileId: p.staffProfileId,
        status: 'approved',
        syncStatus: { $ne: 'synced' },
        approvedAt: { $gte: from, $lt: to },
      },
      { $set: { syncStatus: 'synced' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`Fixed ${result.modifiedCount} timesheet(s) for staffProfile ${p.staffProfileId} (${p.staffName}) ${p.month}/${p.year}`);
      fixed += result.modifiedCount;
    }
  }

  // Also try without approvedAt in case some timesheets lack that field
  for (const p of payments) {
    const result2 = await (TS as any).updateMany(
      {
        tenantId: p.tenantId,
        staffProfileId: p.staffProfileId,
        status: 'approved',
        syncStatus: { $ne: 'synced' },
      },
      { $set: { syncStatus: 'synced' } }
    );
    if (result2.modifiedCount > 0) {
      console.log(`(no-date fallback) Fixed ${result2.modifiedCount} timesheet(s) for ${p.staffName}`);
      fixed += result2.modifiedCount;
    }
  }

  console.log(`Total fixed: ${fixed}`);
  await mongoose.disconnect();
}

run().catch(console.error);
