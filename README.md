# LendChain

Supply chain finance platform. A supplier raises an invoice against a large buyer, the buyer confirms it, a rule engine scores and prices it, a credit officer approves it, finance disburses the money, and the buyer repays on the due date. Every step is role checked, audited and posted to a double-entry ledger.

Stack: Node.js, Express 5, TypeScript, MongoDB (Mongoose), React with Vite.

## Run locally

Needs Node 20.

```
cd server
npm install
npm run dev
```

With no `MONGO_URI` set, the server starts an in-memory MongoDB replica set and loads demo data. Demo users are `supplier@`, `buyer@`, `analyst@`, `approver@`, `ops@`, `collections@`, `risk1@`, `risk2@` and `admin@` `lendchain.test`, all with the password `Demo@1234`.

```
cd client
npm install
npm run dev
```

The client expects the API at `http://localhost:5000` (override with `VITE_API_URL`).

## Client

React 19, Vite, TypeScript and Tailwind. Run it with:

```
cd client
npm install
npm run dev
```

All 26 screens run on sample data in `src/data/sample.ts`. The API at `http://localhost:5000` is not built yet, so sign-in goes through a mock in `src/api/client.ts`.

Demo logins (password `Demo@1234`; internal roles also need the 2-step code `123456`). The password and code are demo-only and live in the mock login.

| Role | Email |
|---|---|
| Supplier | `supplier@lendchain.test` |
| Buyer | `buyer@lendchain.test` |
| Analyst | `analyst@lendchain.test` |
| Approver | `approver@lendchain.test` |
| Finance Ops | `finance@lendchain.test` |
| Operations | `ops@lendchain.test` |
| Accounts | `accounts@lendchain.test` |
| Collections | `collections@lendchain.test` |
| Risk Admin | `risk1@lendchain.test` |
| Admin | `admin@lendchain.test` |

Menus, routes and buttons follow `src/lib/permissions.ts`. These checks only change what the UI shows. They are not security: the server must enforce every permission and every maker-checker rule itself, whatever the client hides.

These menu items open a "coming soon" page because they have no design yet: Repayments, Payables, KYC checks, Decisions, Approved, Rejected, Limits, Payout monitor, Master data, Settlements, Tax & GST, Follow-ups, Overdue and Settings.

## Tests

```
cd server
npm test
```

Covers the rule engine, ledger, state machine, permission policy and the main workflow rules: supplier scoping, maker-checker, idempotent disbursement, balanced ledger, reproducible decisions and the concurrent limit check.

## Design notes

- Money is stored as integer paise.
- The rule engine is a pure module. Rules live in the database as JSON and are versioned; every evaluation stores the rule set version, the facts and the full trace.
- Program limits are reserved with a single conditional update so parallel requests cannot go over the limit.
- Disbursement, ledger posting and the status change run in one MongoDB transaction.
- The ledger repository only inserts. Corrections are reversals.
