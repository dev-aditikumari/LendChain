import mongoose from "mongoose";
import { User } from "./models";
import { seedDemo } from "./seed";

export type SeedOutcome = "seeded" | "users-exist" | "disabled" | "another-instance";

const LOCK = "demo-seed";
const meta = () => mongoose.connection.collection<{ _id: string }>("meta");

// Loads the demo data when the database has no users. Several instances starting together are
// serialised by a lock document, so the data is only created once.
export async function ensureDemoData(opts: { enabled: boolean; password: string }): Promise<SeedOutcome> {
  if (!opts.enabled) return "disabled";
  if ((await User.estimatedDocumentCount()) > 0) return "users-exist";
  try {
    await meta().insertOne({ _id: LOCK });
  } catch (e: any) {
    if (e?.code === 11000) return "another-instance";
    throw e;
  }
  try {
    await seedDemo(opts.password);
  } catch (e) {
    // do not leave the lock behind a half-finished seed
    await meta().deleteOne({ _id: LOCK });
    throw e;
  }
  return "seeded";
}

// Empties every collection and loads the demo data again. This is destructive: callers must have asked for it.
export async function resetDemo(password: string): Promise<{ cleared: number }> {
  const db = mongoose.connection.db!;
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const c of collections) await db.collection(c.name).deleteMany({});
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  await seedDemo(password);
  await meta().insertOne({ _id: LOCK });
  return { cleared: collections.length };
}
