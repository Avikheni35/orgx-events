# Contributing to OrgX Event Management

## Development Setup

### Prerequisites
- Node.js 20+
- MongoDB running at `mongodb://localhost:27017`
- OrgX Staffing (M1) seeded first — M2 shares `tenants` and `users` collections

### Install
```bash
npm install
```

### Run in development mode
```bash
npm run dev
# Server: http://localhost:5001
# Client: http://localhost:3001
```

### Seed demo data
```bash
cd server
npx tsx src/scripts/seed.ts
npx tsx src/scripts/seed_assignments.ts   # optional
npx tsx src/scripts/seed_event_staff.ts  # optional
```

---

## Project Structure

```
client/   React + Vite frontend (port 3001)
server/   Express API           (port 5001)
```

The Vite dev server proxies `/api/*` and `/uploads/*` to the Express server.

---

## Running Tests

```bash
npm test               # run once
npm run test:watch     # watch mode
```

---

## TypeScript

```bash
npm run build -w server      # check server types
npm run typecheck -w client  # check client types
```

Both must pass with zero errors before submitting a PR.

---

## Code Style

- TypeScript strict mode throughout
- Zod schemas for all request body validation
- All UI strings go in `client/src/i18n/de.json`, then `en.json`
- Drag-and-drop scheduling uses `@dnd-kit/core` — keep this consistent

---

## Submitting a Pull Request

1. Fork the repo and create a branch from `master`
2. Make your changes with focused, atomic commits
3. Ensure `npm test` and both typecheck commands pass
4. Open a PR with a clear description of what and why

---

## Reporting Bugs

Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) issue template.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
