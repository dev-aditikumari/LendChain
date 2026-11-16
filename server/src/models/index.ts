import mongoose, { Schema } from "mongoose";

const opts = { timestamps: true };

export const User = mongoose.model("User", new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true },
  entityId: { type: Schema.Types.ObjectId, ref: "Entity" },
  approvalLimit: Number,
  active: { type: Boolean, default: true },
  failedLogins: { type: Number, default: 0 },
  lockedUntil: Date,
  tokenVersion: { type: Number, default: 0 },
}, opts));

export const Entity = mongoose.model("Entity", new Schema({
  kind: { type: String, enum: ["SUPPLIER", "BUYER"], required: true },
  legalName: { type: String, required: true },
  pan: { type: String, required: true },
  gstin: { type: String, required: true },
  bankAccount: String,
  rating: { type: String, default: "A" },
  vintageMonths: { type: Number, default: 0 },
  kycStatus: { type: String, enum: ["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED"], default: "PENDING" },
  kycRemarks: String,
}, opts));

export const Program = mongoose.model("Program", new Schema({
  supplierId: { type: Schema.Types.ObjectId, ref: "Entity", required: true },
  buyerId: { type: Schema.Types.ObjectId, ref: "Entity", required: true },
  sanctioned: { type: Number, required: true },
  outstanding: { type: Number, default: 0 },
  maxTenureDays: { type: Number, default: 90 },
  baseRate: { type: Number, default: 10 },
  validTill: Date,
  version: { type: Number, default: 0 },
}, opts));

const invoiceSchema = new Schema({
  number: { type: String, required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: "Entity", required: true, index: true },
  buyerId: { type: Schema.Types.ObjectId, ref: "Entity", required: true, index: true },
  programId: { type: Schema.Types.ObjectId, ref: "Program", required: true },
  amount: { type: Number, required: true },
  gst: { type: Number, default: 0 },
  issueDate: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, default: "DRAFT", index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  disputeReason: String,
  advancePercent: Number,
  tenureDays: Number,
  financedAmount: Number,
  recommendedBy: { type: Schema.Types.ObjectId, ref: "User" },
  recommendation: String,
  approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  disbursedAt: Date,
  version: { type: Number, default: 0 },
}, opts);
invoiceSchema.index({ buyerId: 1, number: 1, amount: 1, issueDate: 1 });
export const Invoice = mongoose.model("Invoice", invoiceSchema);

export const InvoiceEvent = mongoose.model("InvoiceEvent", new Schema({
  invoiceId: { type: Schema.Types.ObjectId, index: true },
  from: String,
  to: String,
  actor: { type: Schema.Types.ObjectId, ref: "User" },
  note: String,
}, opts));

export const RuleSet = mongoose.model("RuleSet", new Schema({
  version: { type: Number, required: true, unique: true },
  status: { type: String, enum: ["DRAFT", "PUBLISHED", "ARCHIVED"], default: "DRAFT" },
  rules: { type: [Schema.Types.Mixed], default: [] },
  pricing: { type: Schema.Types.Mixed, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, opts));

export const RuleEvaluation = mongoose.model("RuleEvaluation", new Schema({
  invoiceId: { type: Schema.Types.ObjectId, index: true },
  ruleSetVersion: { type: Number, required: true },
  facts: Schema.Types.Mixed,
  result: Schema.Types.Mixed,
}, opts));

export const Disbursement = mongoose.model("Disbursement", new Schema({
  invoiceId: { type: Schema.Types.ObjectId, unique: true },
  amount: Number,
  fee: Number,
  upfrontInterest: Number,
  net: Number,
  rate: Number,
  status: { type: String, enum: ["PENDING_AUTH", "SUCCESS", "FAILED"], default: "PENDING_AUTH" },
  reference: String,
  initiatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  authorisedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, opts));

export const LedgerEntry = mongoose.model("LedgerEntry", new Schema({
  txId: { type: String, required: true, index: true },
  invoiceId: { type: Schema.Types.ObjectId, index: true },
  account: { type: String, required: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  memo: String,
}, { timestamps: { createdAt: true, updatedAt: false } }));

export const Repayment = mongoose.model("Repayment", new Schema({
  invoiceId: { type: Schema.Types.ObjectId, index: true },
  amount: Number,
  utr: { type: String, required: true },
  allocation: Schema.Types.Mixed,
  recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, opts));

export const IdempotencyKey = mongoose.model("IdempotencyKey", new Schema({
  key: { type: String, required: true, unique: true },
  response: Schema.Types.Mixed,
}, opts));

export const AuditLog = mongoose.model("AuditLog", new Schema({
  actor: { type: Schema.Types.ObjectId, ref: "User" },
  action: String,
  target: String,
  before: Schema.Types.Mixed,
  after: Schema.Types.Mixed,
  ip: String,
  requestId: String,
}, { timestamps: { createdAt: true, updatedAt: false } }));
