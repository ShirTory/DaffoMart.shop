import { requireOwner } from "@/server/auth";
import { listAdmins, presentAdmin, upsertAdmin } from "@/server/adminAccounts";
import { handle, ok, readJson } from "@/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(120),
  role: z.enum(["owner", "it_support", "accountant"]).default("it_support"),
  fullAccess: z.boolean().default(false),
  active: z.boolean().default(true),
  note: z.string().max(200).optional(),
  password: z.string().min(8).max(60).optional(),
});

export const GET = handle(async () => {
  await requireOwner();
  const list = await listAdmins();
  return ok(list.map(presentAdmin));
});

export const POST = handle(async (req) => {
  const owner = await requireOwner();
  const body = schema.parse(await readJson(req));
  const rec = await upsertAdmin({ ...body, grantedBy: owner.email });
  return ok(presentAdmin(rec), 201);
});
