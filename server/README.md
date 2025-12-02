# Quetzal Server (MVP)

Backend Node.js + TypeScript + Express + Socket.io + PostgreSQL (pg). Uses integer units for money (QZ halves, COP cents) and a double-entry ledger.

## Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Windows PowerShell 5.1 (default shell)

## Setup

```powershell
# In project root
Copy-Item .env.example .env

# Install deps
npm install

# Start dev (ts-node)
npm run dev
```

## Env Vars (.env)
- `PORT`: server port
- `PG*`: Postgres connection
- `JWT_SECRET`: token signing secret

## Scripts
- `dev`: run TS directly with ts-node
- `build`: compile TS to `dist`
- `start`: run built JS
- `migrate`: run simple SQL migration runner

## Structure
```
server/
  src/
    app.ts
    lib/
      db.ts
      logger.ts
      auth.ts
      migrate.ts
    modules/
      auth/
      users/
      services/
      messaging/
      wallet/
      escrow/
```

## Health Check
- `GET /health` returns `{ ok: true }` and DB connectivity status.

## Notes
- Ledger is authoritative; wallet balances are cache updated via DB triggers.
- WebSocket (`/ws`) provides real-time messaging and notifications.
