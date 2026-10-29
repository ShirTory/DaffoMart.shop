import { requireOwner } from "@/server/auth";
import { deleteAdmin, listAdmins, presentAdmin, upsertAdmin } from "@/server/adminAccounts";
import { ApiError, handle, ok, readJson } from "@/server/http";
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

export const PUT = handle(async (req, ctx) => {
  const owner = await requireOwner();
  const { id } = await ctx.params;
  const exists = (await listAdmins()).find((a) => a.id === id);
  if (!exists) throw new ApiError(404, "Not found");
  const body = schema.parse(await readJson(req));
  const rec = await upsertAdmin({ ...body, grantedBy: owner.email }, id);
  return ok(presentAdmin(rec));
});

export const DELETE = handle(async (_req, ctx) => {
  const owner = await requireOwner();
  const { id } = await ctx.params;
  await deleteAdmin(id, owner.email);
  return ok({ id });
});
