import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { User } from "../models";
import { HttpError, forbidden } from "../shared/errors";
import { Actor, can, Resource } from "../modules/rbac/policy";
import { Permission } from "../modules/rbac/permissions";

declare global {
  namespace Express {
    interface Request {
      actor: Actor;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies?.access;
  if (!token) throw new HttpError(401, "Not logged in");
  let payload: any;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, "Session expired");
  }
  const user = await User.findById(payload.sub).lean();
  if (!user || !user.active || user.tokenVersion !== payload.tv) throw new HttpError(401, "Session expired");
  req.actor = {
    id: String(user._id),
    role: user.role as Actor["role"],
    entityId: user.entityId ? String(user.entityId) : undefined,
    approvalLimit: user.approvalLimit ?? undefined,
  };
  next();
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const d = can(req.actor, permission);
    if (!d.ok) throw forbidden(d.reason);
    next();
  };
}

export function check(req: Request, permission: Permission, res: Resource) {
  const d = can(req.actor, permission, res);
  if (!d.ok) throw forbidden(d.reason);
}
