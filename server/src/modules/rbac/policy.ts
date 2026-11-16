import { Permission, Role, rolePermissions } from "./permissions";

export interface Actor {
  id: string;
  role: Role;
  entityId?: string;
  approvalLimit?: number;
}

export interface Resource {
  supplierId?: string;
  buyerId?: string;
  amount?: number;
  createdBy?: string;
  recommendedBy?: string;
  approvedBy?: string;
  initiatedBy?: string;
}

export type Decision = { ok: true } | { ok: false; reason: string };

const deny = (reason: string): Decision => ({ ok: false, reason });

export function can(actor: Actor, permission: Permission, res: Resource = {}): Decision {
  if (!rolePermissions[actor.role].includes(permission)) return deny("ROLE_NOT_ALLOWED");

  if (permission === "invoice:read" || permission === "invoice:create" || permission === "invoice:submit" || permission === "financing:request") {
    if (actor.role === "SUPPLIER" && res.supplierId && res.supplierId !== actor.entityId) return deny("NOT_YOUR_INVOICE");
  }
  if (permission === "invoice:read" && actor.role === "BUYER" && res.buyerId && res.buyerId !== actor.entityId) {
    return deny("NOT_YOUR_INVOICE");
  }
  if (permission === "invoice:confirm" && res.buyerId !== actor.entityId) return deny("NOT_YOUR_INVOICE");

  if (permission === "invoice:approve") {
    if (res.createdBy === actor.id || res.recommendedBy === actor.id) return deny("MAKER_CHECKER");
    if (actor.approvalLimit !== undefined && res.amount !== undefined && res.amount > actor.approvalLimit) {
      return deny("ABOVE_APPROVAL_LIMIT");
    }
  }
  if ((permission === "disbursement:initiate" || permission === "disbursement:authorise") && res.approvedBy === actor.id) {
    return deny("SEGREGATION_OF_DUTIES");
  }
  if (permission === "disbursement:authorise" && res.initiatedBy === actor.id) return deny("DUAL_CONTROL");
  if (permission === "rule:publish" && res.createdBy === actor.id) return deny("MAKER_CHECKER");

  return { ok: true };
}

// mongo filter that limits a query to what the actor may see
export function invoiceScope(actor: Actor): Record<string, unknown> {
  if (actor.role === "SUPPLIER") return { supplierId: actor.entityId };
  if (actor.role === "BUYER") return { buyerId: actor.entityId };
  return {};
}
