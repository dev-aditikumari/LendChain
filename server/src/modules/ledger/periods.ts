import { ClientSession } from "mongoose";
import { Period } from "../../models";
import { conflict } from "../../shared/errors";

// periods are calendar months in UTC, keyed like "2026-11"
export const periodKey = (d: Date) => d.toISOString().slice(0, 7);

export function periodStart(key: string) {
  return new Date(`${key}-01T00:00:00.000Z`);
}

// first instant after the period
export function periodEnd(key: string) {
  const s = periodStart(key);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1));
}

export async function assertOpen(date: Date, session?: ClientSession | null) {
  const key = periodKey(date);
  const closed = await Period.findOne({ key, status: "CLOSED" }).session(session ?? null).lean();
  if (closed) throw conflict(`Period ${key} is closed. Post a reversal in the open period instead.`, "PERIOD_CLOSED");
}
