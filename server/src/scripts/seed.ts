import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/orgx';

// ── Inline model definitions (avoid loading full app bootstrap) ──────────────

const TenantSchema = new mongoose.Schema({}, { strict: false, collection: 'tenants' });
const Tenant = mongoose.models.Tenant ?? mongoose.model('Tenant', TenantSchema);

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.models.User ?? mongoose.model('User', UserSchema);

const EventClientSchema = new mongoose.Schema(
  {
    tenantId: mongoose.Schema.Types.ObjectId,
    name: String, type: String, industry: String, vatId: String,
    address: mongoose.Schema.Types.Mixed,
    paymentTermsDays: { type: Number, default: 14 },
    contacts: [mongoose.Schema.Types.Mixed],
    notes: String, status: { type: String, default: 'active' },
    createdBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true, collection: 'eventclients' }
);
const EventClient = mongoose.models.EventClient ?? mongoose.model('EventClient', EventClientSchema);

const VenueSchema = new mongoose.Schema(
  {
    tenantId: mongoose.Schema.Types.ObjectId,
    name: String, type: String, capacity: Number,
    address: mongoose.Schema.Types.Mixed,
    facilities: [String], notes: String, status: { type: String, default: 'active' },
    createdBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true, collection: 'venues' }
);
const Venue = mongoose.models.Venue ?? mongoose.model('Venue', VenueSchema);

const StaffProfileSchema = new mongoose.Schema(
  {
    tenantId: mongoose.Schema.Types.ObjectId,
    firstName: String, lastName: String, email: String, phone: String,
    skills: [String],
    certifications: [mongoose.Schema.Types.Mixed],
    rating: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
    totalEventsWorked: { type: Number, default: 0 },
    totalHoursWorked: { type: Number, default: 0 },
    status: { type: String, default: 'active' },
    notes: String, poolIds: [mongoose.Schema.Types.ObjectId],
    createdBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true, collection: 'staffprofiles' }
);
const StaffProfile = mongoose.models.StaffProfile ?? mongoose.model('StaffProfile', StaffProfileSchema);

const EventSchema = new mongoose.Schema(
  {
    tenantId: mongoose.Schema.Types.ObjectId,
    name: String, eventNumber: String,
    clientId: mongoose.Schema.Types.ObjectId, clientName: String,
    venueId: mongoose.Schema.Types.ObjectId, venueName: String,
    type: String, startDate: Date, endDate: Date,
    description: String, budget: Number, plannedRevenue: Number,
    status: { type: String, default: 'draft' },
    positions: [mongoose.Schema.Types.Mixed],
    notes: [mongoose.Schema.Types.Mixed],
    documents: [mongoose.Schema.Types.Mixed],
    createdBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true, collection: 'events' }
);
const Event = mongoose.models.Event ?? mongoose.model('Event', EventSchema);

// ── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function setTime(date: Date, hours: number, minutes = 0): Date {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function makeSlot(baseDate: Date, startH: number, endH: number, breakMin = 30) {
  return {
    _id: new Types.ObjectId(),
    startTime: setTime(baseDate, startH),
    endTime: setTime(baseDate, endH),
    breakMinutes: breakMin,
  };
}

async function nextEventNumber(tenantId: Types.ObjectId): Promise<string> {
  const count = await Event.countDocuments({ tenantId });
  return `EVT-${String(count + 1).padStart(5, '0')}`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB:', MONGODB_URI);

  // Find demo tenant
  const tenant = await Tenant.findOne({ loginCode: 'demo' }).lean() as { _id: Types.ObjectId } | null;
  if (!tenant) {
    console.error('Demo tenant not found. Run m1/server seed first (cd m1/server && npx tsx src/scripts/seed.ts)');
    process.exit(1);
  }
  const tenantId = tenant._id;
  console.log('Tenant ID:', tenantId.toString());

  // Find admin user for this tenant (createdBy)
  const adminUser = await User.findOne({ tenantId, role: 'agency_admin' }).lean() as { _id: Types.ObjectId } | null;
  if (!adminUser) {
    console.error('No agency_admin found for demo tenant.');
    process.exit(1);
  }
  const createdBy = adminUser._id;

  // ── Clear existing M2 data for this tenant ──────────────────────────────
  await Promise.all([
    EventClient.deleteMany({ tenantId }),
    Venue.deleteMany({ tenantId }),
    StaffProfile.deleteMany({ tenantId }),
    Event.deleteMany({ tenantId }),
  ]);
  console.log('Cleared existing M2 seed data.');

  // ── Clients ──────────────────────────────────────────────────────────────
  const clients = await EventClient.insertMany([
    {
      tenantId, createdBy, name: 'Messe Frankfurt GmbH', type: 'company',
      industry: 'Messewirtschaft', vatId: 'DE114103563',
      address: { street: 'Ludwig-Erhard-Anlage 1', city: 'Frankfurt am Main', postalCode: '60327', country: 'DE' },
      paymentTermsDays: 30,
      contacts: [
        { _id: new Types.ObjectId(), name: 'Sandra Keller', email: 'sandra.keller@messe-frankfurt.de', phone: '+49 69 75750', jobTitle: 'Veranstaltungsleiterin', isPrimary: true },
        { _id: new Types.ObjectId(), name: 'Thomas Bauer', email: 'thomas.bauer@messe-frankfurt.de', phone: '+49 69 75751', jobTitle: 'Projektmanager', isPrimary: false },
      ],
    },
    {
      tenantId, createdBy, name: 'BMW Group Deutschland', type: 'company',
      industry: 'Automobilindustrie', vatId: 'DE129274202',
      address: { street: 'Petuelring 130', city: 'München', postalCode: '80788', country: 'DE' },
      paymentTermsDays: 14,
      contacts: [
        { _id: new Types.ObjectId(), name: 'Julia Meier', email: 'julia.meier@bmw.de', phone: '+49 89 3820', jobTitle: 'Event Manager', isPrimary: true },
      ],
    },
    {
      tenantId, createdBy, name: 'Eventwerk Rhein-Main GmbH', type: 'company',
      industry: 'Eventmanagement', vatId: 'DE278430192',
      address: { street: 'Gutleutstraße 82', city: 'Frankfurt am Main', postalCode: '60329', country: 'DE' },
      paymentTermsDays: 21,
      contacts: [
        { _id: new Types.ObjectId(), name: 'Markus Schneider', email: 'm.schneider@eventwerk.de', phone: '+49 69 24240', jobTitle: 'Geschäftsführer', isPrimary: true },
        { _id: new Types.ObjectId(), name: 'Lisa Wagner', email: 'l.wagner@eventwerk.de', phone: '+49 69 24241', jobTitle: 'Projektleiterin', isPrimary: false },
      ],
    },
    {
      tenantId, createdBy, name: 'Stadthalle Offenbach', type: 'company',
      industry: 'Veranstaltungsstätte', vatId: 'DE114200841',
      address: { street: 'Straße der Republik 8', city: 'Offenbach am Main', postalCode: '63065', country: 'DE' },
      paymentTermsDays: 30,
      contacts: [
        { _id: new Types.ObjectId(), name: 'Andreas Wolf', email: 'a.wolf@stadthalle-of.de', phone: '+49 69 80450', jobTitle: 'Veranstaltungsleiter', isPrimary: true },
      ],
    },
  ]);
  console.log(`Created ${clients.length} clients.`);

  const [messeClient, bmwClient, eventwerkClient, stadthalle] = clients;

  // ── Venues ───────────────────────────────────────────────────────────────
  const venues = await Venue.insertMany([
    {
      tenantId, createdBy, name: 'Messe Frankfurt – Halle 3', type: 'indoor', capacity: 5000,
      address: { street: 'Ludwig-Erhard-Anlage 1', city: 'Frankfurt am Main', postalCode: '60327', country: 'DE' },
      facilities: ['Bühne', 'Ton & Licht', 'Catering-Küche', 'Parkplatz', 'Barrierefreiheit', 'WLAN', 'Klimaanlage'],
    },
    {
      tenantId, createdBy, name: 'BMW Welt München', type: 'indoor', capacity: 800,
      address: { street: 'Am Olympiapark 1', city: 'München', postalCode: '80809', country: 'DE' },
      facilities: ['Bühne', 'Ton & Licht', 'Catering-Küche', 'Garderobe', 'WLAN', 'Klimaanlage'],
    },
    {
      tenantId, createdBy, name: 'Sachsenhausen Riverpark', type: 'outdoor', capacity: 3000,
      address: { street: 'Deutschherrnufer 10', city: 'Frankfurt am Main', postalCode: '60594', country: 'DE' },
      facilities: ['Bühne', 'Parkplatz', 'Barrierefreiheit'],
    },
    {
      tenantId, createdBy, name: 'Stadthalle Offenbach – Großer Saal', type: 'indoor', capacity: 1200,
      address: { street: 'Straße der Republik 8', city: 'Offenbach am Main', postalCode: '63065', country: 'DE' },
      facilities: ['Bühne', 'Ton & Licht', 'Catering-Küche', 'Garderobe', 'Klimaanlage', 'Beamer'],
    },
  ]);
  console.log(`Created ${venues.length} venues.`);

  const [messeVenue, bmwVenue, riverVenue, stadthalleVenue] = venues;

  // ── Staff Profiles ────────────────────────────────────────────────────────
  const staffData = [
    { firstName: 'Leon', lastName: 'Müller', email: 'leon.mueller@staff.demo', phone: '+49 151 11110001', skills: ['Einlass', 'Garderobe', 'Deutsch', 'Englisch'], rating: { average: 4.8, count: 12 }, totalEventsWorked: 12 },
    { firstName: 'Sophia', lastName: 'Koch', email: 'sophia.koch@staff.demo', phone: '+49 151 11110002', skills: ['Bar', 'Catering', 'Deutsch', 'Englisch', 'Spanisch'], rating: { average: 4.9, count: 20 }, totalEventsWorked: 20 },
    { firstName: 'Tobias', lastName: 'Becker', email: 'tobias.becker@staff.demo', phone: '+49 151 11110003', skills: ['Sicherheit', 'Einlass', 'Ersthelfer'], rating: { average: 4.5, count: 8 }, totalEventsWorked: 8 },
    { firstName: 'Lena', lastName: 'Fischer', email: 'lena.fischer@staff.demo', phone: '+49 151 11110004', skills: ['Hostess', 'Anmeldung', 'Deutsch', 'Englisch', 'Französisch'], rating: { average: 4.7, count: 15 }, totalEventsWorked: 15 },
    { firstName: 'Jonas', lastName: 'Weber', email: 'jonas.weber@staff.demo', phone: '+49 151 11110005', skills: ['Aufbau', 'Abbau', 'Technik', 'Beleuchtung'], rating: { average: 4.3, count: 6 }, totalEventsWorked: 6 },
    { firstName: 'Mia', lastName: 'Wagner', email: 'mia.wagner@staff.demo', phone: '+49 151 11110006', skills: ['Bar', 'Catering', 'Deutsch', 'Englisch'], rating: { average: 4.6, count: 10 }, totalEventsWorked: 10 },
    { firstName: 'Felix', lastName: 'Schulz', email: 'felix.schulz@staff.demo', phone: '+49 151 11110007', skills: ['Sicherheit', 'Einlass', 'Fahrerlaubnis Klasse B'], rating: { average: 4.4, count: 9 }, totalEventsWorked: 9 },
    { firstName: 'Hannah', lastName: 'Richter', email: 'hannah.richter@staff.demo', phone: '+49 151 11110008', skills: ['Hostess', 'Garderobe', 'Deutsch', 'Englisch'], rating: { average: 4.8, count: 18 }, totalEventsWorked: 18 },
    { firstName: 'Lukas', lastName: 'Klein', email: 'lukas.klein@staff.demo', phone: '+49 151 11110009', skills: ['Catering', 'Aufbau', 'Deutsch'], rating: { average: 4.2, count: 4 }, totalEventsWorked: 4 },
    { firstName: 'Anna', lastName: 'Hoffmann', email: 'anna.hoffmann@staff.demo', phone: '+49 151 11110010', skills: ['Hostess', 'Anmeldung', 'Bar', 'Deutsch', 'Englisch', 'Arabisch'], rating: { average: 5.0, count: 22 }, totalEventsWorked: 22 },
  ];

  const staff = await StaffProfile.insertMany(
    staffData.map((s) => ({ ...s, tenantId, createdBy, totalHoursWorked: s.totalEventsWorked * 8 }))
  );
  console.log(`Created ${staff.length} staff profiles.`);

  // ── Events ────────────────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Event 1 — Upcoming trade show, status: staffing, with positions + slots
  const ev1Date = addDays(today, 14);
  const ev1End = addDays(today, 16);
  const event1 = await Event.create({
    tenantId, createdBy,
    name: 'Frankfurter Automobil-Messe 2026',
    eventNumber: await nextEventNumber(tenantId),
    clientId: messeClient._id, clientName: messeClient.name,
    venueId: messeVenue._id, venueName: messeVenue.name,
    type: 'trade_show',
    startDate: setTime(ev1Date, 9),
    endDate: setTime(ev1End, 18),
    description: 'Internationale Automobilmesse mit 150 Ausstellern. Drei Tage, täglich ca. 8.000 Besucher.',
    budget: 45000, plannedRevenue: 68000,
    status: 'staffing',
    positions: [
      {
        _id: new Types.ObjectId(), title: 'Einlasshelfer/in', roleType: 'Einlass',
        headcount: 4, payRatePerHour: 14.5, billingRatePerHour: 22,
        skills: ['Einlass'], dresscode: 'Schwarze Kleidung',
        slots: [
          makeSlot(ev1Date, 8, 18, 60),
          makeSlot(addDays(ev1Date, 1), 8, 18, 60),
          makeSlot(addDays(ev1Date, 2), 8, 18, 60),
        ],
      },
      {
        _id: new Types.ObjectId(), title: 'Garderobenkraft', roleType: 'Garderobe',
        headcount: 2, payRatePerHour: 13.5, billingRatePerHour: 20,
        skills: ['Garderobe'],
        slots: [
          makeSlot(ev1Date, 8, 19, 60),
          makeSlot(addDays(ev1Date, 1), 8, 19, 60),
          makeSlot(addDays(ev1Date, 2), 8, 19, 60),
        ],
      },
      {
        _id: new Types.ObjectId(), title: 'Hostess / Host', roleType: 'Hostess',
        headcount: 6, payRatePerHour: 15, billingRatePerHour: 24,
        skills: ['Hostess', 'Englisch'], dresscode: 'Business Attire',
        slots: [
          makeSlot(ev1Date, 9, 18, 60),
          makeSlot(addDays(ev1Date, 1), 9, 18, 60),
          makeSlot(addDays(ev1Date, 2), 9, 17, 60),
        ],
      },
    ],
    notes: [{ _id: new Types.ObjectId(), text: 'Parken für Personal: Parkhaus P4, Einfahrt Gallusanlage. Ausweis mitbringen.', createdBy, createdByName: 'Admin Demo', createdAt: new Date() }],
  });

  // Event 2 — BMW product launch, status: confirmed, next week
  const ev2Date = addDays(today, 5);
  const event2 = await Event.create({
    tenantId, createdBy,
    name: 'BMW 5er Launch Night',
    eventNumber: await nextEventNumber(tenantId),
    clientId: bmwClient._id, clientName: bmwClient.name,
    venueId: bmwVenue._id, venueName: bmwVenue.name,
    type: 'corporate',
    startDate: setTime(ev2Date, 18),
    endDate: setTime(ev2Date, 23, 30),
    description: 'Exklusive Produktpräsentation des neuen BMW 5er für Händler und VIP-Gäste. 400 Gäste erwartet.',
    budget: 18000, plannedRevenue: 27500,
    status: 'confirmed',
    positions: [
      {
        _id: new Types.ObjectId(), title: 'Bar-Personal', roleType: 'Bar',
        headcount: 4, payRatePerHour: 15.5, billingRatePerHour: 23,
        skills: ['Bar'], dresscode: 'Schwarz formell',
        slots: [makeSlot(ev2Date, 17, 24, 30)],
      },
      {
        _id: new Types.ObjectId(), title: 'Empfangs-Hostess', roleType: 'Hostess',
        headcount: 3, payRatePerHour: 16, billingRatePerHour: 25,
        skills: ['Hostess', 'Englisch'], dresscode: 'BMW Corporate Outfit',
        slots: [makeSlot(ev2Date, 17, 23, 30)],
      },
      {
        _id: new Types.ObjectId(), title: 'Security', roleType: 'Sicherheit',
        headcount: 2, payRatePerHour: 17, billingRatePerHour: 26,
        skills: ['Sicherheit'],
        slots: [makeSlot(ev2Date, 16, 24, 0)],
      },
    ],
  });

  // Event 3 — Summer festival, status: planning, next month
  const ev3Date = addDays(today, 32);
  const ev3End = addDays(today, 33);
  const event3 = await Event.create({
    tenantId, createdBy,
    name: 'Rhein-Main Sommerfest 2026',
    eventNumber: await nextEventNumber(tenantId),
    clientId: eventwerkClient._id, clientName: eventwerkClient.name,
    venueId: riverVenue._id, venueName: riverVenue.name,
    type: 'festival',
    startDate: setTime(ev3Date, 14),
    endDate: setTime(ev3End, 2),
    description: 'Zweitägiges Open-Air-Sommerfest mit Live-Musik, Foodtrucks und Bar-Bereichen. Ca. 3.000 Besucher pro Tag.',
    budget: 32000, plannedRevenue: 55000,
    status: 'planning',
    positions: [
      {
        _id: new Types.ObjectId(), title: 'Einlass & Bändchen', roleType: 'Einlass',
        headcount: 6, payRatePerHour: 13.5, billingRatePerHour: 20,
        skills: ['Einlass'],
        slots: [],
      },
      {
        _id: new Types.ObjectId(), title: 'Bar-Kraft', roleType: 'Bar',
        headcount: 8, payRatePerHour: 14, billingRatePerHour: 21,
        skills: ['Bar'],
        slots: [],
      },
    ],
  });

  // Event 4 — Charity gala, status: draft
  const ev4Date = addDays(today, 60);
  const event4 = await Event.create({
    tenantId, createdBy,
    name: 'Charity-Gala Offenbach 2026',
    eventNumber: await nextEventNumber(tenantId),
    clientId: stadthalle._id, clientName: stadthalle.name,
    venueId: stadthalleVenue._id, venueName: stadthalleVenue.name,
    type: 'other',
    startDate: setTime(ev4Date, 19),
    endDate: setTime(ev4Date, 24),
    description: 'Benefizveranstaltung zugunsten der Offenbacher Tafel. Gala-Dinner mit Livemusik, 250 geladene Gäste.',
    budget: 8000, plannedRevenue: 12000,
    status: 'draft',
    positions: [],
  });

  // Event 5 — Completed event (last month) for invoice/timesheet testing
  const ev5Date = addDays(today, -10);
  const event5 = await Event.create({
    tenantId, createdBy,
    name: 'Frühjahrsempfang IHK Frankfurt',
    eventNumber: await nextEventNumber(tenantId),
    clientId: messeClient._id, clientName: messeClient.name,
    venueId: messeVenue._id, venueName: messeVenue.name,
    type: 'corporate',
    startDate: setTime(ev5Date, 17),
    endDate: setTime(ev5Date, 22),
    description: 'Jahresempfang der Industrie- und Handelskammer. 600 Gäste.',
    budget: 9500, plannedRevenue: 14200,
    status: 'completed',
    completedAt: addDays(ev5Date, 1),
    positions: [
      {
        _id: new Types.ObjectId(), title: 'Service-Personal', roleType: 'Catering',
        headcount: 5, payRatePerHour: 14, billingRatePerHour: 21,
        slots: [makeSlot(ev5Date, 15, 23, 30)],
      },
    ],
  });

  console.log('Created events:');
  console.log(`  1. ${event1.name} (${event1.status}) — ${event1.eventNumber}`);
  console.log(`  2. ${event2.name} (${event2.status}) — ${event2.eventNumber}`);
  console.log(`  3. ${event3.name} (${event3.status}) — ${event3.eventNumber}`);
  console.log(`  4. ${event4.name} (${event4.status}) — ${event4.eventNumber}`);
  console.log(`  5. ${event5.name} (${event5.status}) — ${event5.eventNumber}`);

  console.log('\n✓ M2 seed complete.');
  console.log('\nSummary:');
  console.log(`  Clients:       ${clients.length}`);
  console.log(`  Venues:        ${venues.length}`);
  console.log(`  Staff:         ${staff.length}`);
  console.log(`  Events:        5 (draft, planning, staffing, confirmed, completed)`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
