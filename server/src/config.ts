export const config = {
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  accessTtl: "15m",
  refreshTtlMs: 7 * 24 * 3600 * 1000,
  mongoUri: process.env.MONGO_URI || "",
  port: Number(process.env.PORT) || 5000,
  bankWebhookSecret: process.env.BANK_WEBHOOK_SECRET || "dev-bank-secret",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
};
