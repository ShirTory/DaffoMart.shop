import { collectionRoutes, itemRoutes } from "./crud";
import { db } from "./db";
import { hashPassword } from "./riderAuth";
import { ApiError } from "./http";
import { offerIsLive } from "./services";
import { slugify } from "@/lib/format";
import type { Attendance, Banner, Category, Courier, CustomPaymentMethod, DeliveryZone, Employee, Offer, Product, Rider } from "@/lib/types";
import { bannerSchema, categorySchema, courierSchema, employeeSchema, offerSchema, paymentMethodSchema, productSchema, riderSchema, zoneSchema } from "@/lib/validators";

const now = () => new Date().toISOString();

async function uniqueSlug(base: string, selfId?: string) {
  const all = await db.list<Product>("products");
  const taken = new Set(all.filter((p) => p.id !== selfId).map((p) => p.slug));
  let s = slugify(base), n = 2;
  while (taken.has(s)) s = `${slugify(base)}-${n++}`;
  return s;
}

/** A reservation with no saved product behind it is "in progress" for this long before another save may take it over. */
const SKU_HOLD_MS = 120_000;
/** Atomically reserve `sku` for product `owner` (unique key document). Fails with 409 if another product holds it. */
export async function claimSku(sku: string, owner: string) {
  const mine = { id: sku, owner, at: new Date().toISOString() };
  if (await db.create("sku_index", mine)) return;
  const cur = await db.get<{ id: string; owner: string; at?: string }>("sku_index", sku);
  if (!cur) { if (await db.create("sku_index", mine)) return; throw new ApiError(409, `SKU "${sku}" was just taken. Please try again.`); }
  if (cur.owner === owner) return; // retry of the same save
  const holder = await db.get<Product>("products", cur.owner);
  const holderUsesIt = holder && holder.sku?.toUpperCase() === sku;
  const inProgress = !holder && cur.at && Date.now() - Date.parse(cur.at) < SKU_HOLD_MS; // the other save has not been written yet
  if (holderUsesIt || inProgress) throw new ApiError(409, `SKU "${sku}" is already used by another product`);
  await db.put("sku_index", mine); // stale: its product was deleted, moved to another SKU, or the save never completed
}
export async function releaseSku(sku: string | undefined, owner: string) {
  if (!sku) return;
  const cur = await db.get<{ owner: string }>("sku_index", sku.toUpperCase());
  if (cur?.owner === owner) await db.remove("sku_index", sku.toUpperCase());
}

/** Purchase cost is a business secret: only full-access admins may see it. */
export const stripCost = <T extends { cost?: unknown }>(p: T): T => { const { cost, ...rest } = p; return rest as T; };

export const productCfg = {
  col: "products" as const, schema: productSchema,
  publicPresent: (p: Product): Product => stripCost(p),
  visible: (p: Product) => p.active,
  beforeDelete: async (id: string) => { const p = await db.get<Product>("products", id); if (p) await releaseSku(p.sku, id); },
  prepare: async (d: any, prev: Product | null, id?: string): Promise<Omit<Product, "id">> => {
    const sku = (d.sku || "").trim().toUpperCase() || undefined;
    if (d.active && !sku) throw new ApiError(400, "SKU is required for published products");
    const owner = prev?.id ?? id;
    if (sku) {
      // 1) products saved before the index existed have no reservation: check them directly
      const all = await db.list<Product>("products");
      const dup = all.find((p) => p.sku && p.sku.toUpperCase() === sku && p.id !== owner);
      if (dup) throw new ApiError(409, `SKU "${sku}" is already used by another product`);
      // 2) atomic reservation: two simultaneous saves of the same SKU cannot both succeed
      if (owner) await claimSku(sku, owner);
    }
    if (owner && prev?.sku && prev.sku.toUpperCase() !== sku) await releaseSku(prev.sku, owner);
    return {
      ...d,
      sku,
      cost: prev?.cost, // maintained by purchases; an ordinary product edit must not wipe it
      slug: await uniqueSlug(d.slug || d.name, prev?.id),
      images: (d.images ?? []).filter(Boolean),
      sold: prev?.sold ?? 0,
      createdAt: prev?.createdAt ?? now(), updatedAt: now(),
    };
  },
};

export const categoryCfg = {
  col: "categories" as const, schema: categorySchema,
  visible: (c: Category) => c.active,
  sort: (a: Category, b: Category) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  prepare: (d: any): Omit<Category, "id"> => ({ ...d, slug: slugify(d.slug || d.name) }),
  beforeDelete: async (id: string) => {
    const used = (await db.list<Product>("products")).filter((p) => p.categoryId === id).length;
    if (used) throw new ApiError(409, `This category has ${used} product(s). Move or delete them first.`);
  },
};

export const bannerCfg = {
  col: "banners" as const, schema: bannerSchema,
  visible: (b: Banner) => b.active,
  sort: (a: Banner, b: Banner) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt),
  prepare: (d: any, prev: Banner | null): Omit<Banner, "id"> => ({ ...d, createdAt: prev?.createdAt ?? now() }),
};

export const offerCfg = {
  col: "offers" as const, schema: offerSchema,
  visible: (o: Offer) => offerIsLive(o),
  sort: (a: Offer, b: Offer) => b.createdAt.localeCompare(a.createdAt),
  prepare: async (d: any, prev: Offer | null): Promise<Omit<Offer, "id">> => {
    if (d.code) {
      const dup = (await db.list<Offer>("offers")).find((o) => o.code === d.code && o.id !== prev?.id);
      if (dup) throw new ApiError(409, "This coupon code is already used by another offer");
    }
    return { ...d, createdAt: prev?.createdAt ?? now() };
  },
};

export const zoneCfg = {
  col: "zones" as const, schema: zoneSchema,
  visible: (z: DeliveryZone) => z.active,
  sort: (a: DeliveryZone, b: DeliveryZone) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  prepare: (d: any): Omit<DeliveryZone, "id"> => d,
  beforeDelete: async (id: string) => {
    const all = (await db.list<DeliveryZone>("zones")).filter((z) => z.active && z.id !== id);
    if (!all.length) throw new ApiError(409, "Keep at least one active delivery area so customers can check out.");
  },
};

/** Riders hold phone numbers: never visible to the public (non-admin GET returns an empty list). */
export const riderCfg = {
  col: "riders" as const, schema: riderSchema,
  visible: () => false,
  sort: (a: Rider, b: Rider) => a.name.localeCompare(b.name),
  prepare: async (d: any, prev: Rider | null): Promise<Omit<Rider, "id">> => {
    const { password, ...rest } = d;
    const dup = (await db.list<Rider>("riders")).find((x) => x.phone === d.phone && x.id !== prev?.id);
    if (dup) throw new ApiError(409, "Another rider already uses this phone number (it is the login ID)");
    const passHash = password ? hashPassword(password) : prev?.passHash;
    const pwChangedAt = password ? now() : prev?.pwChangedAt;
    if (!passHash && !prev) throw new ApiError(400, "Set a login password for the rider (min 6 characters)");
    const live = prev?.locAt ? { lat: prev.lat, lng: prev.lng, locAt: prev.locAt } : {}; // GPS is written by the rider app, never by the admin form
    // application data + review result are written by the apply/review routes only, never by the admin form
    const app: Partial<Rider> = prev ? {
      status: prev.status, nidNumber: prev.nidNumber, permanentAddress: prev.permanentAddress, presentAddress: prev.presentAddress,
      referrerName: prev.referrerName, referrerPhone: prev.referrerPhone, referrerRelation: prev.referrerRelation,
      hasNid: prev.hasNid, appliedAt: prev.appliedAt, reviewedAt: prev.reviewedAt, rejectReason: prev.rejectReason,
      // preserve CV + ratings + profile image unless admin form sends a new image
      dateOfBirth: prev.dateOfBirth, gender: prev.gender, bloodGroup: prev.bloodGroup,
      fatherName: prev.fatherName, motherName: prev.motherName, education: prev.education,
      experienceYears: prev.experienceYears, previousJobs: prev.previousJobs, skills: prev.skills, languages: prev.languages,
      emergencyContact: prev.emergencyContact, emergencyPhone: prev.emergencyPhone,
      drivingLicense: prev.drivingLicense, licenseNumber: prev.licenseNumber,
      expectedSalary: prev.expectedSalary, availableFrom: prev.availableFrom, preferredShift: prev.preferredShift,
      ratingAvg: prev.ratingAvg, ratingCount: prev.ratingCount,
      image: rest.image !== undefined ? rest.image : prev.image,
    } : { status: "approved" };
    return { ...rest, ...live, ...app, passHash, pwChangedAt, createdAt: prev?.createdAt ?? now() };
  },
  beforeDelete: async (id: string) => { await db.remove("nid", `${id}-front`); await db.remove("nid", `${id}-back`); },
  present: (r: Rider): Rider => { const { passHash, ...rest } = r; return { ...rest, hasPassword: Boolean(passHash) } as Rider; },
};

/** Staff list (CEO … rider). Private: contains phone numbers and salary, so the public gets an empty list. */
export const employeeCfg = {
  col: "employees" as const, schema: employeeSchema,
  visible: () => false,
  sort: (a: Employee, b: Employee) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
  prepare: (d: any, prev: Employee | null): Omit<Employee, "id"> => {
    const { password, ...rest } = d;
    const passHash = password ? hashPassword(password) : prev?.passHash;
    return {
      ...rest,
      passHash,
      pwChangedAt: password ? now() : prev?.pwChangedAt,
      hasPassword: Boolean(passHash),
      ...(prev ? {
        status: prev.status,
        appliedAt: prev.appliedAt, reviewedAt: prev.reviewedAt, rejectReason: prev.rejectReason,
        image: rest.image !== undefined ? rest.image : prev.image,
        // CV fields
        nidNumber: rest.nidNumber ?? prev.nidNumber, permanentAddress: rest.permanentAddress ?? prev.permanentAddress,
        presentAddress: rest.presentAddress ?? prev.presentAddress, dateOfBirth: rest.dateOfBirth ?? prev.dateOfBirth,
        gender: rest.gender ?? prev.gender, bloodGroup: rest.bloodGroup ?? prev.bloodGroup,
        fatherName: rest.fatherName ?? prev.fatherName, motherName: rest.motherName ?? prev.motherName,
        education: rest.education ?? prev.education, experienceYears: rest.experienceYears ?? prev.experienceYears,
        previousJobs: rest.previousJobs ?? prev.previousJobs, skills: rest.skills ?? prev.skills, languages: rest.languages ?? prev.languages,
        emergencyContact: rest.emergencyContact ?? prev.emergencyContact, emergencyPhone: rest.emergencyPhone ?? prev.emergencyPhone,
        expectedSalary: rest.expectedSalary ?? prev.expectedSalary, availableFrom: rest.availableFrom ?? prev.availableFrom,
        preferredShift: rest.preferredShift ?? prev.preferredShift,
      } : {}),
      createdAt: prev?.createdAt ?? now(),
    };
  },
  present: (e: Employee): Employee => { const { passHash, ...rest } = e; return { ...rest, hasPassword: Boolean(passHash) } as Employee; }, // never send the password hash to the browser
  beforeDelete: async (id: string) => { for (const a of (await db.list<Attendance>("attendance")).filter((x) => x.employeeId === id)) await db.remove("attendance", a.id); },
};

/** Courier companies for deliveries outside Dhaka (Pathao, Steadfast, RedX, Sundarban …). Admin only. */
export const courierCfg = {
  col: "couriers" as const, schema: courierSchema,
  visible: () => false,
  sort: (a: Courier, b: Courier) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  prepare: (d: any, prev: Courier | null): Omit<Courier, "id"> => ({ ...d, createdAt: prev?.createdAt ?? now() }),
  beforeDelete: async (id: string) => {
    const used = (await db.list<{ courierId?: string; status: string }>("orders")).filter((o) => o.courierId === id && !["delivered", "cancelled", "returned"].includes(o.status)).length;
    if (used) throw new ApiError(409, `${used} open order(s) are with this courier. Deactivate it instead of deleting.`);
  },
};

/** Extra payment options (Rocket, Upay, bank transfer …). Only active ones are public. */
export const paymentMethodCfg = {
  col: "payment_methods" as const, schema: paymentMethodSchema,
  visible: (m: CustomPaymentMethod) => m.active,
  sort: (a: CustomPaymentMethod, b: CustomPaymentMethod) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  prepare: (d: any, prev: CustomPaymentMethod | null): Omit<CustomPaymentMethod, "id"> => ({
    label: d.label, hint: d.hint || "", number: d.number || undefined, icon: d.icon || undefined,
    active: d.active !== false, sortOrder: d.sortOrder ?? 0, requireTrx: d.requireTrx !== false,
    createdAt: prev?.createdAt ?? now(),
  }),
};

export const resource = {
  payment_methods: { c: collectionRoutes<CustomPaymentMethod>(paymentMethodCfg), i: itemRoutes<CustomPaymentMethod>(paymentMethodCfg) },
  employees: { c: collectionRoutes<Employee>(employeeCfg), i: itemRoutes<Employee>(employeeCfg) },
  couriers: { c: collectionRoutes<Courier>(courierCfg), i: itemRoutes<Courier>(courierCfg) },
  zones: { c: collectionRoutes<DeliveryZone>(zoneCfg), i: itemRoutes<DeliveryZone>(zoneCfg) },
  riders: { c: collectionRoutes<Rider>(riderCfg), i: itemRoutes<Rider>(riderCfg) },
  products: { c: collectionRoutes<Product>(productCfg), i: itemRoutes<Product>(productCfg) },
  categories: { c: collectionRoutes<Category>(categoryCfg), i: itemRoutes<Category>(categoryCfg) },
  banners: { c: collectionRoutes<Banner>(bannerCfg), i: itemRoutes<Banner>(bannerCfg) },
  offers: { c: collectionRoutes<Offer>(offerCfg), i: itemRoutes<Offer>(offerCfg) },
};
