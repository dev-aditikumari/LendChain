import { createHash } from "crypto";
import { LedgerEntry, Reversal, Statement, StatementLine } from "../../models";
import { badRequest, conflict } from "../../shared/errors";

const DAY = 86400000;
const HEADER = ["date", "reference", "description", "debit", "credit"];

export interface ParsedLine {
  date: Date;
  reference: string;
  description: string;
  amount: number;
  direction: "IN" | "OUT";
}

// minimal CSV reader: commas, double quotes, CRLF or LF
function rows(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) out.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) out.push(row);
  return out;
}

const rupees = /^\d{1,12}(\.\d{1,2})?$/;
const toPaise = (s: string) => Math.round(Number(s) * 100);

export function parseStatement(csv: string): ParsedLine[] {
  const all = rows(csv.replace(/^﻿/, ""));
  if (all.length === 0) throw badRequest("The file is empty");
  const head = all[0].map((h) => h.trim().toLowerCase());
  if (head.join(",") !== HEADER.join(",")) throw badRequest(`The first row must be: ${HEADER.join(",")}`);
  const body = all.slice(1);
  if (body.length === 0) throw badRequest("The file has no lines");
  if (body.length > 2000) throw badRequest("At most 2000 lines per statement");

  return body.map((r, i) => {
    const n = i + 2;
    if (r.length !== HEADER.length) throw badRequest(`Line ${n}: expected ${HEADER.length} columns`);
    const [date, reference, description, debit, credit] = r.map((x) => x.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime())) throw badRequest(`Line ${n}: date must look like 2026-11-17`);
    const hasDebit = debit !== "" && Number(debit) !== 0;
    const hasCredit = credit !== "" && Number(credit) !== 0;
    if (hasDebit === hasCredit) throw badRequest(`Line ${n}: fill in exactly one of debit or credit`);
    const value = hasDebit ? debit : credit;
    if (!rupees.test(value)) throw badRequest(`Line ${n}: amount must be a positive number with at most 2 decimals`);
    return {
      date: new Date(`${date}T00:00:00.000Z`),
      reference,
      description,
      amount: toPaise(value),
      direction: hasCredit ? "IN" : "OUT",
    };
  });
}

export interface CashTx {
  txId: string;
  reference: string;
  postedOn: Date;
  // money into the pool is positive
  amount: number;
  invoiceId?: unknown;
  memo?: string;
}

// every ledger transaction that moved cash and carries a bank reference
export async function cashTxs(): Promise<CashTx[]> {
  const reversed = (await Reversal.find({}, "txId").lean()).map((r: any) => r.txId);
  const rowsAgg = await LedgerEntry.aggregate([
    { $match: { account: "LENDER_POOL", reference: { $nin: [null, ""] }, txId: { $nin: reversed } } },
    { $group: { _id: "$txId", reference: { $first: "$reference" }, postedOn: { $first: "$postedOn" }, invoiceId: { $first: "$invoiceId" }, memo: { $first: "$memo" }, debit: { $sum: "$debit" }, credit: { $sum: "$credit" } } },
    { $sort: { postedOn: 1, _id: 1 } },
  ]);
  return rowsAgg.map((r) => ({ txId: r._id, reference: r.reference, postedOn: r.postedOn, invoiceId: r.invoiceId, memo: r.memo, amount: r.debit - r.credit }));
}

const money = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const norm = (s: string) => s.trim().toUpperCase();

// Matches each line against ledger cash entries not matched before. A shared reference with the
// same amount is a firm match; failing that, a single entry with the same amount within 3 days.
export async function matchLines(lines: ParsedLine[]) {
  const taken = new Set((await StatementLine.find({ status: "MATCHED" }, "matchedTxId").lean()).map((l: any) => l.matchedTxId));
  const pool = (await cashTxs()).filter((t) => !taken.has(t.txId));
  const used = new Set<string>();

  return lines.map((l) => {
    const signed = l.direction === "IN" ? l.amount : -l.amount;
    const free = pool.filter((t) => !used.has(t.txId));

    const byRef = l.reference ? free.find((t) => norm(t.reference) === norm(l.reference)) : undefined;
    if (byRef) {
      if (byRef.amount === signed) {
        used.add(byRef.txId);
        return { ...l, status: "MATCHED" as const, method: "REFERENCE" as const, matchedTxId: byRef.txId };
      }
      return { ...l, status: "UNMATCHED" as const, note: `Reference ${l.reference} is in the ledger, but the amount differs: bank ${money(l.amount)}, ledger ${money(Math.abs(byRef.amount))}.` };
    }

    const near = free.filter((t) => t.amount === signed && Math.abs(t.postedOn.getTime() - l.date.getTime()) <= 3 * DAY + DAY);
    if (near.length === 1) {
      used.add(near[0].txId);
      return { ...l, status: "MATCHED" as const, method: "AMOUNT_AND_DATE" as const, matchedTxId: near[0].txId };
    }
    if (near.length > 1) return { ...l, status: "UNMATCHED" as const, note: "Several ledger entries have this amount around this date. Match it by reference." };
    return { ...l, status: "UNMATCHED" as const, note: "No ledger entry for this line." };
  });
}

export async function saveStatement(name: string, csv: string, uploadedBy: string) {
  const lines = parseStatement(csv);
  const hash = createHash("sha256").update(csv.replace(/\r\n/g, "\n").trim()).digest("hex");
  if (await Statement.exists({ hash })) throw conflict("This statement was already uploaded", "DUPLICATE_STATEMENT");
  const matched = await matchLines(lines);
  const dates = lines.map((l) => l.date.getTime());
  const st = await Statement.create({
    name, hash, uploadedBy, lineCount: lines.length, from: new Date(Math.min(...dates)), to: new Date(Math.max(...dates)),
  });
  await StatementLine.insertMany(matched.map((m) => ({ ...m, statementId: st._id })));
  return st;
}

// ledger cash entries inside the statement's dates that no bank line has matched
export async function unmatchedLedger(from: Date, to: Date) {
  const taken = new Set((await StatementLine.find({ status: "MATCHED" }, "matchedTxId").lean()).map((l: any) => l.matchedTxId));
  const end = to.getTime() + DAY;
  return (await cashTxs()).filter((t) => !taken.has(t.txId) && t.postedOn.getTime() >= from.getTime() && t.postedOn.getTime() < end);
}

// a demo statement built from the ledger, with a few deliberate differences so there is something to reconcile
export async function sampleStatement() {
  const taken = new Set((await StatementLine.find({ status: "MATCHED" }, "matchedTxId").lean()).map((l: any) => l.matchedTxId));
  const txs = (await cashTxs()).filter((t) => !taken.has(t.txId));
  const lines: string[] = [HEADER.join(",")];
  const fmt = (paise: number) => (paise / 100).toFixed(2);
  const today = new Date().toISOString().slice(0, 10);
  txs.forEach((t, i) => {
    const left = txs.length - i;
    // the last entry is left out, the one before it is short by ₹10 (a bank charge)
    if (txs.length >= 3 && left === 1) return;
    const amount = txs.length >= 3 && left === 2 ? Math.abs(t.amount) - 1000 : Math.abs(t.amount);
    const day = t.postedOn.toISOString().slice(0, 10);
    const desc = t.amount < 0 ? `NEFT payout ${t.reference}` : `Buyer repayment ${t.reference}`;
    lines.push([day, t.reference, desc, t.amount < 0 ? fmt(amount) : "", t.amount > 0 ? fmt(amount) : ""].join(","));
  });
  lines.push([today, "CHG" + today.replace(/-/g, ""), "Account maintenance charges", "118.00", ""].join(","));
  return lines.join("\n") + "\n";
}
