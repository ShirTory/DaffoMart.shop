import { db, newId } from "./db";
import type { AdminAccount, AdminRole } from "@/lib/types";
import { ApiError } from "./http";
import { logAudit } from "./audit";
import { hashPassword } from "./riderAuth";

export async function listAdmins(): Promise<AdminAccount[]> {
  return (await db.list<AdminAccount>("admins")).sort((a, b) => a.email.localeCompare(b.email));
}

/** Strip secrets before sending to client */
export function presentAdmin(a: AdminAccount) {
  const { passHash, ...rest } = a;
  return { ...rest, hasPassword: Boolean(passHash) };
}

export async function findAdminByEmail(email: string): Promise<AdminAccount | null> {
  const e = email.trim().toLowerCase();
  const all = await listAdmins();
  return all.find((a) => a.email.toLowerCase() === e && a.active) ?? null;
}

export async function upsertAdmin(input: {
  email: string;
  role: AdminRole;
  fullAccess: boolean;
  active: boolean;
  note?: string;
  password?: string;
  grantedBy: string;
}, existingId?: string): Promise<AdminAccount> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new ApiError(400, "Valid email required");
  const all = await listAdmins();
  const dup = all.find((a) => a.email === email && a.id !== existingId);
  if (dup) throw new ApiError(409, "An admin account with this email already exists");

  const now = new Date().toISOString();
  const prev = existingId ? all.find((a) => a.id === existingId) : undefined;
  if (!existingId && (!input.password || input.password.length < 8)) {
    throw new ApiError(400, "Password must be at least 8 characters for new accounts");
  }
  if (input.password && input.password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const rec: AdminAccount = {
    id: existingId || newId(),
    email,
    role: input.role,
    fullAccess: input.role === "owner" ? true : input.role === "accountant" ? false : !!input.fullAccess, // an Accountant is limited to Finance by design
    active: input.active,
    note: input.note?.slice(0, 200),
    grantedBy: input.grantedBy,
    grantedAt: now,
    passHash: input.password ? hashPassword(input.password) : prev?.passHash,
    pwChangedAt: input.password ? now : prev?.pwChangedAt, // revokes every older session of this account
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };
  await db.put("admins", rec);
  await logAudit({
    actor: input.grantedBy,
    actorRole: "owner",
    action: existingId ? "admin.update" : "admin.create",
    target: email,
    detail: `role=${rec.role} fullAccess=${rec.fullAccess} active=${rec.active}`,
  });
  return rec;
}

export async function deleteAdmin(id: string, actor: string) {
  const a = await db.get<AdminAccount>("admins", id);
  if (!a) throw new ApiError(404, "Admin account not found");
  await db.remove("admins", id);
  await logAudit({ actor, actorRole: "owner", action: "admin.delete", target: a.email });
}
