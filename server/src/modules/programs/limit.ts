import { ClientSession } from "mongoose";
import { Program } from "../../models";

// one atomic update: only succeeds if outstanding + amount stays within the sanctioned limit
export async function reserveLimit(programId: unknown, amount: number, session?: ClientSession) {
  const p = await Program.findOneAndUpdate(
    { _id: programId, $expr: { $lte: [{ $add: ["$outstanding", amount] }, "$sanctioned"] } },
    { $inc: { outstanding: amount, version: 1 } },
    { returnDocument: "after", session },
  );
  return p;
}

export async function releaseLimit(programId: unknown, amount: number, session?: ClientSession) {
  await Program.updateOne({ _id: programId }, { $inc: { outstanding: -amount, version: 1 } }, { session });
}
