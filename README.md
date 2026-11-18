# LendChain

Supply chain finance platform. A supplier raises an invoice against a large buyer, the buyer confirms it, a rule engine scores and prices it, a credit officer approves it, finance disburses the money, and the buyer repays on the due date. Every step is role checked, audited and posted to a double-entry ledger.

Stack: Node.js, Express 5, TypeScript, MongoDB (Mongoose), React with Vite.

## Screenshots

Taken from the running app with the demo data. Each screen is shown for the role that uses it.

| | |
|---|---|
| ![Sign in](docs/screenshots/01-login.jpg) | ![Supplier dashboard](docs/screenshots/02-supplier-dashboard.jpg) |
| Sign in | Supplier dashboard: limit, financed amount and recent invoices |
| ![Invoices](docs/screenshots/03-invoices.jpg) | ![Buyer inbox](docs/screenshots/05-buyer-inbox.jpg) |
| Supplier invoice list | Buyer inbox: accept or dispute an invoice |
| ![Analyst queue](docs/screenshots/07-analyst-queue.jpg) | ![Payables](docs/screenshots/06-buyer-payables.jpg) |
| Analyst review queue | Buyer payables and repayment |

**Invoice detail with the engine trace.** Every decision stores the rule set version, the facts and each rule that fired.

![Invoice detail with engine trace](docs/screenshots/04-invoice-detail-engine-trace.jpg)

**Approver review.** The approver sees the engine result and the analyst recommendation. The server refuses an approval by the person who recommended it, or above their limit.

![Approver review](docs/screenshots/08-approver-review.jpg)

**Payouts with dual control.** One Finance Ops user queues a payout and a different one releases it.

![Payouts](docs/screenshots/09-payouts-dual-control.jpg)

**Rule engine.** Rule sets are versioned. A Risk Admin edits a draft and back-tests it against recent requests, and a second Risk Admin publishes it.

![Rule sets](docs/screenshots/10-rule-sets.jpg)
![Rule draft and back-test](docs/screenshots/11-rule-draft-backtest.jpg)
![Pricing grid](docs/screenshots/12-pricing-grid.jpg)

**Ledger and accounts.** Entries are append-only. The trial balance has no difference after every flow, interest taken at payout is earned day by day, and a month is closed by one accountant and signed off by another.

![Ledger](docs/screenshots/15-ledger.jpg)
![Trial balance](docs/screenshots/16-trial-balance.jpg)
![Accruals](docs/screenshots/17-accruals.jpg)
![Period close](docs/screenshots/18-period-close.jpg)

**Operations.** A payout the bank refuses goes to the exception queue and can be retried. Bank statements are uploaded as CSV and matched against the ledger.

![Exceptions](docs/screenshots/19-exceptions.jpg)
![Reconciliation](docs/screenshots/20-reconciliation.jpg)
![Payout monitor](docs/screenshots/21-payout-monitor.jpg)

**Audit log and access map.**

![Audit log](docs/screenshots/13-audit-log.jpg)
![Access map](docs/screenshots/14-access-map.jpg)

## Run locally

Needs Node 20.

```
cd server
npm install
npm run dev
```

With no `MONGO_URI` set, the server starts an in-memory MongoDB replica set and loads demo data. Demo users are `supplier@`, `buyer@`, `analyst@`, `approver@`, `finance@`, `finance2@`, `ops@` (Operations), `accounts@`, `accounts2@`, `collections@`, `risk1@`, `risk2@` and `admin@` `lendchain.test`, all with the password `Demo@1234`.

```
cd client
npm install
npm run dev
```

The client expects the API at `http://localhost:5000` (override with `VITE_API_URL`).

## Client

React 19, Vite, TypeScript and Tailwind. Start the server first, then:

```
cd client
npm install
npm run dev
```

The dev server forwards `/api/*` to the API at `http://localhost:5000`. Set `API_TARGET` to point the proxy somewhere else, or `VITE_API_URL` to call an API directly.

Sign-in and the invoice flow use the real API: onboarding and KYC, programs, invoices, financing, buyer confirm or dispute, credit review, the two-step payout, repayment, notifications, rule sets (drafts, back-test, publish by a second reviewer) and the pricing grid, the ledger, trial balance, accruals and period close, exceptions, payout monitor and bank reconciliation, users and roles, access map and audit log. Collections ageing and the admin overview still show sample data from `src/data/sample.ts` and are marked "Sample data" in the page title.

Demo logins (password `Demo@1234`). The server has no second sign-in step yet.

| Role | Email |
|---|---|
| Supplier | `supplier@lendchain.test` |
| Buyer | `buyer@lendchain.test` |
| Analyst | `analyst@lendchain.test` |
| Approver | `approver@lendchain.test` |
| Finance Ops | `finance@lendchain.test` |
| Operations | `ops@lendchain.test` |
| Accounts | `accounts@lendchain.test` and `accounts2@lendchain.test` (period close needs two) |
| Collections | `collections@lendchain.test` |
| Risk Admin | `risk1@lendchain.test` |
| Admin | `admin@lendchain.test` |

Menus, routes and buttons follow the permission list the server returns at login. `src/lib/access.ts` holds the one small mapping from permission keys to the sections a role sees in full or read-only. These checks only change what the UI shows. They are not security: the server must enforce every permission and every maker-checker rule itself, whatever the client hides.

These menu items open a "coming soon" page: Repayments (buyer), Decisions, Approved, Rejected, Limits, Master data, Settlements, Tax & GST, Follow-ups, Overdue and Settings.

## Tests

```
cd server
npm test
```

Covers the rule engine, ledger, state machine, permission policy and the main workflow rules: supplier scoping, maker-checker, idempotent disbursement, balanced ledger, reproducible decisions and the concurrent limit check.

To run the whole invoice flow (draft to repaid, plus an overdue invoice, an escalation above the approver's limit, dual control and the audit log) against a fresh in-memory server:

```
cd server
npm run e2e
```

## Design notes

- Money is stored as integer paise.
- The ledger is append-only (updates and deletes are refused). Every transaction must balance, and the trial balance also checks each transaction on its own.
- Interest taken at payout is booked as unearned interest and moved to income one day at a time. A day can only be accrued once (its run record is unique and is written in the same transaction as the postings), and what is left is released when the invoice is repaid.
- A period is a calendar month. One accountant requests the close, a different one signs it off, and the month must have ended with a balanced trial balance. After that nothing can be posted into it: corrections are reversal entries dated in the open period.
- Payouts go through a mock bank that refuses accounts ending in `0000` (the seeded Rao Textiles account is one, so a failed payout can be shown). A refusal marks the payout failed, leaves the invoice approved, and creates an exception. Retrying queues a new payout that a different person still has to authorise.
- The bank webhook (`POST /webhooks/bank`) checks an HMAC signature over the raw body with `BANK_WEBHOOK_SECRET`. A bad signature, an unreadable body or an unknown payout reference becomes an exception instead of being trusted.
- Reconciliation takes a CSV (`date,reference,description,debit,credit`). A line matches a ledger cash entry by reference and amount, or by amount and date when there is a single candidate, and no entry is matched twice. A demo statement with a few deliberate differences can be generated from the ledger.
- The rule engine is a pure module. Rules live in the database as JSON and are versioned; every evaluation stores the rule set version, the facts and the full trace.
- Program limits are reserved with a single conditional update so parallel requests cannot go over the limit.
- Disbursement, ledger posting and the status change run in one MongoDB transaction.
