import bcrypt from "bcryptjs";
import { Entity, Program, User } from "./models";
import { publishedRuleSet } from "./modules/rules-engine/service";

export async function seedDemo(uri: string) {
  const password = process.env.DEMO_PASSWORD;
  if (uri.startsWith("mongodb+srv") && !password) {
    throw new Error("Refusing to seed a hosted database without DEMO_PASSWORD");
  }
  const hash = await bcrypt.hash(password || "Demo@1234", 10);
  if (await User.exists({ email: "admin@lendchain.test" })) return;

  const suppliers = await Entity.create([
    { kind: "SUPPLIER", legalName: "Sharma Components Pvt Ltd", pan: "ABCDE1234F", gstin: "27ABCDE1234F1Z5", vintageMonths: 30, kycStatus: "VERIFIED" },
    { kind: "SUPPLIER", legalName: "Rao Textiles", pan: "ABCDE1234G", gstin: "29ABCDE1234G1Z5", vintageMonths: 8, kycStatus: "VERIFIED" },
  ]);
  const buyer = await Entity.create({ kind: "BUYER", legalName: "Tata Motors Ltd", pan: "AAACT1234B", gstin: "27AAACT1234B1Z5", rating: "AA", kycStatus: "VERIFIED" });
  for (const s of suppliers) await Program.create({ supplierId: s._id, buyerId: buyer._id, sanctioned: 2500000 * 100 });

  const people: [string, string, object][] = [
    ["supplier@lendchain.test", "SUPPLIER", { entityId: suppliers[0]._id }],
    ["supplier2@lendchain.test", "SUPPLIER", { entityId: suppliers[1]._id }],
    ["buyer@lendchain.test", "BUYER", { entityId: buyer._id }],
    ["analyst@lendchain.test", "ANALYST", {}],
    ["approver@lendchain.test", "APPROVER", { approvalLimit: 500000 * 100 }],
    ["ops@lendchain.test", "FINANCE_OPS", {}],
    ["collections@lendchain.test", "COLLECTIONS", {}],
    ["risk1@lendchain.test", "RISK_ADMIN", {}],
    ["risk2@lendchain.test", "RISK_ADMIN", {}],
    ["admin@lendchain.test", "ADMIN", {}],
  ];
  for (const [email, role, extra] of people) {
    await User.create({ email, name: email.split("@")[0], role, passwordHash: hash, ...extra });
  }
  await publishedRuleSet();
}
