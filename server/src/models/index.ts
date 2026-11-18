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

const disbursementSchema = new Schema({
  invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true },
  amount: Number,
  fee: Number,
  upfrontInterest: Number,
  net: Number,
  rate: Number,
  status: { type: String, enum: ["PENDING_AUTH", "SUCCESS", "FAILED"], default: "PENDING_AUTH" },
  reference: String,
  failureReason: String,
  bankStatus: { type: String, enum: ["CONFIRMED", "FAILED"] },
  disbursedOn: Date,
  // upfront interest is booked as unearned and recognised evenly over accrualDays
  accrualDays: Number,
  accruedInterest: { type: Number, default: 0 },
  initiatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  authorisedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, opts);
// one live payout per invoice; a failed one can be queued again
disbursementSchema.index(
  { invoiceId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["PENDING_AUTH", "SUCCESS"] } } },
);
export const Disbursement = mongoose.model("Disbursement", disbursementSchema);

const ledgerSchema = new Schema({
  txId: { type: String, required: true, index: true },
  invoiceId: { type: Schema.Types.ObjectId, index: true },
  disbursementId: { type: Schema.Types.ObjectId },
  account: { type: String, required: true },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  memo: String,
  // bank reference or UTR on cash entries, used by reconciliation
  reference: { type: String, index: true },
  // accounting date; decides which period the entry belongs to
  postedOn: { type: Date, required: true, default: Date.now, index: true },
  reverses: String,
}, { timestamps: { createdAt: true, updatedAt: false } });

// the ledger is append-only: corrections are new reversal entries
const blocked = () => { throw new Error("Ledger entries cannot be changed or deleted"); };
ledgerSchema.pre(
  ["updateOne", "updateMany", "deleteOne", "deleteMany", "findOneAndUpdate", "findOneAndDelete", "findOneAndReplace", "replaceOne"],
  blocked,
);
ledgerSchema.pre("save", function () {
  if (!this.isNew) blocked();
});
export const LedgerEntry = mongoose.model("LedgerEntry", ledgerSchema);

// one row per reversed transaction, so a transaction can only be reversed once
export const Reversal = mongoose.model("Reversal", new Schema({
  txId: { type: String, required: true, unique: true },
  reversalTxId: String,
  reason: String,
  by: { type: Schema.Types.ObjectId, ref: "User" },
}, opts));

export const Period = mongoose.model("Period", new Schema({
  key: { type: String, required: true, unique: true },
  status: { type: String, enum: ["CLOSE_REQUESTED", "CLOSED"], required: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
  requestedAt: Date,
  closedBy: { type: Schema.Types.ObjectId, ref: "User" },
  closedAt: Date,
  snapshot: Schema.Types.Mixed,
}, opts));

export const AccrualRun = mongoose.model("AccrualRun", new Schema({
  date: { type: String, required: true, unique: true },
  count: Number,
  amount: Number,
  runBy: { type: Schema.Types.ObjectId, ref: "User" },
  source: { type: String, enum: ["MANUAL", "SCHEDULE"], default: "MANUAL" },
}, opts));

export const ExceptionItem = mongoose.model("ExceptionItem", new Schema({
  kind: { type: String, enum: ["PAYOUT_FAILED", "WEBHOOK_PROBLEM"], required: true },
  severity: { type: String, enum: ["HIGH", "MEDIUM", "LOW"], default: "MEDIUM" },
  status: { type: String, enum: ["OPEN", "RESOLVED"], default: "OPEN", index: true },
  title: { type: String, required: true },
  detail: String,
  invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice" },
  disbursementId: { type: Schema.Types.ObjectId, ref: "Disbursement" },
  owner: { type: Schema.Types.ObjectId, ref: "User" },
  retryDisbursementId: { type: Schema.Types.ObjectId, ref: "Disbursement" },
  resolution: String,
  resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  resolvedAt: Date,
}, opts));

export const Statement = mongoose.model("Statement", new Schema({
  name: { type: String, required: true },
  hash: { type: String, required: true, unique: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  from: Date,
  to: Date,
  lineCount: Number,
}, opts));

export const StatementLine = mongoose.model("StatementLine", new Schema({
  statementId: { type: Schema.Types.ObjectId, ref: "Statement", index: true, required: true },
  date: { type: Date, required: true },
  reference: String,
  description: String,
  amount: { type: Number, required: true },
  direction: { type: String, enum: ["IN", "OUT"], required: true },
  status: { type: String, enum: ["MATCHED", "UNMATCHED"], required: true },
  method: { type: String, enum: ["REFERENCE", "AMOUNT_AND_DATE"] },
  matchedTxId: { type: String, index: true },
  note: String,
}, opts));

export const Repayment = mongoose.model("Repayment", new Schema({
  invoiceId: { type: Schema.Types.ObjectId, index: true },
  amount: Number,
  utr: { type: String, required: true },
  allocation: Schema.Types.Mixed,
  recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, opts));

export const IdempotencyKey = mongoose.model("IdempotencyKey", new Schema({
  key: { type: String, required: true, unique: true },
  scope: String,
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
