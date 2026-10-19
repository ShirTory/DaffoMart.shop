import { db, newId } from "./db";
import type { AuditLog } from "@/lib/types";

/** Append-only security/ops audit trail. Never throws to callers. */
export async function logAudit(input: {
  actor: string;
  actorRole: string;
  action: string;
  target?: string;
  detail?: string;
  ip?: string;
}) {
  try {
    const rec: AuditLog = {
      id: newId(),
      at: new Date().toISOString(),
      actor: input.actor.slice(0, 120),
      actorRole: input.actorRole.slice(0, 40),
      action: input.action.slice(0, 80),
      target: input.target?.slice(0, 120),
      detail: input.detail?.slice(0, 400),
      ip: input.ip?.slice(0, 64),
    };
    await db.put("audit_logs", rec);
  } catch (e) {
    console.error("[audit] write failed", e);
  }
}

export async function listAudit(limit = 100): Promise<AuditLog[]> {
  const all = await db.list<AuditLog>("audit_logs");
  return all.sort((a, b) => b.at.localeCompare(a.at)).slice(0, Math.min(limit, 500));
}
