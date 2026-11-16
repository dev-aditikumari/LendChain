import { Request } from "express";
import { AuditLog } from "../models";

export async function audit(req: Request, action: string, target: string, before?: unknown, after?: unknown) {
  await AuditLog.create({ actor: req.actor?.id, action, target, before, after, ip: req.ip, requestId: String(req.headers["x-request-id"] ?? "") });
}
