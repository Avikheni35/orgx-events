# OrgX Event Management

A full-stack event staffing platform for coordinating staff at large-scale events — from brief to close-out report. Handles staff pools, drag-and-drop scheduling, mobile check-in, automated timesheets, client portals, and invoicing.

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## Features

### Events & Venues
- Full event lifecycle: Draft → Briefed → Staffed → Live → Closed
- Venue management with location details and capacity tracking
- Event brief documents and requirement specifications
- Automated PDF close-out reports

### Staff Scheduling
- **Drag-and-drop scheduler** with real-time availability grid
- Skill-based pool matching — assign only qualified staff to each slot
- Multi-role slot definitions per event
- Conflict detection across overlapping events

### Staff Communication
- Instant SMS and push notifications for shift invitations
- In-app notification centre
- Mobile-optimised staff portal for self-service

### Timesheets & Attendance
- Mobile check-in / check-out portal with GPS timestamp
- Auto-generated timesheets from attendance records
- Approval workflow: staff submits → coordinator approves

### Client Portal
- Branded portal for event clients
- Real-time staff roster visibility
- One-click roster approval before go-live
- Post-event summary with attendance statistics

### Billing & Integration
- Automated invoice generation from approved timesheets
- SEPA payment links with overdue tracking
- **OrgX ERP sync** — timesheets push to M3 payroll, invoices sync to M3 sales ledger

### Staff Management
- Staff profile with skills, certifications, and ratings
- Post-event star ratings by coordinators
- Staff availability calendar with self-declaration
- Application flow for open positions

---

## Tech Stack

| Layer | Technology |
|---|---|
| **API** | Express.js 4, TypeScript, Zod validation |
| **Database** | MongoDB 7 + Mongoose 8 (shares `tenants`/`users` with M1) |
| **Auth** | JWT (Bearer access token + HttpOnly refresh cookie) |
| **Frontend** | React 18, Vite, MUI v5, Zustand, React Query v5 |
| **i18n** | react-i18next (German + English) |
| **Scheduling UI** | @dnd-kit/core drag-and-drop |
| **PDF** | Puppeteer |
| **Email** | Nodemailer |
| **Monitoring** | Sentry |
| **Testing** | Vitest |

---

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB running at `mongodb://localhost:27017`
- **OrgX Staffing (M1) must be seeded first** — M2 reuses M1's `tenants` and `users` collections

### Install & run
```bash
npm install
npm run dev
# Server: http://localhost:5001
# Client: http://localhost:3001
```

### Seed demo data
```bash
# Run M1 seed first to create the demo tenant:
# cd ../orgx-staffing && cd server && npx tsx src/scripts/seed.ts

cd server && npx tsx src/scripts/seed.ts
# Optional extended data:
npx tsx src/scripts/seed_assignments.ts
npx tsx src/scripts/seed_event_staff.ts
```

### Login
M2 reuses M1 credentials. Any `agency_admin` or `disponent` user from M1 automatically gets coordinator access in M2.

---

## Portals

| Portal | Role | Path |
|---|---|---|
| Coordinator dashboard | `agency_admin`, `disponent` | `/coordinator/` |
| Event staff portal | `event_staff` | `/event-staff/` |
| Event client portal | `event_client` | `/client/` |

---

## Configuration

Copy `server/.env.example` to `server/.env`:

```bash
cp server/.env.example server/.env
```

| Variable | Description | Required in prod |
|---|---|---|
| `JWT_ACCESS_SECRET` | 64-char random string | ✅ |
| `JWT_REFRESH_SECRET` | 64-char random string | ✅ |
| `MONGODB_URI` | Same MongoDB instance as M1 | ✅ |
| `CLIENT_URL` | Frontend origin (CORS) | ✅ |
| `M3_SERVICE_TOKEN` | Shared token for M2→M3 integration | if using ERP sync |
| `M3_URL` | OrgX ERP server URL | if using ERP sync |
| `SMTP_HOST` | SMTP server (blank → console) | optional |

---

## Project Structure

```
m2/
├── client/          # React + Vite frontend
│   └── src/
│       ├── api/     # Axios API clients
│       ├── pages/   # Route-level page components
│       ├── stores/  # Zustand state
│       └── i18n/    # de.json / en.json translations
└── server/          # Express API
    └── src/
        ├── config/  # env.ts, db.ts
        ├── middleware/  # auth, rbac, tenant, upload
        ├── models/  # Event, StaffProfile, Timesheet, Invoice…
        ├── routes/  # Express routers
        ├── utils/   # pdf, email, notify, outbox
        └── scripts/ # seed, seed_assignments, seed_event_staff
```

---

## ERP Integration

When both M2 and M3 are running, timesheets and invoices are automatically synchronised:

```
Timesheet approved → POST /api/internal/event-timesheets (M3)
Invoice created   → POST /api/internal/event-invoices (M3)
Payroll posted    → PUT  /api/internal/event-payments (M2 writeback)
```

Requests are authenticated via `X-Service-Token` header using the shared `M3_SERVICE_TOKEN`.

---

## License

MIT
