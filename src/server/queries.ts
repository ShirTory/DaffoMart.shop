import { unstable_cache } from "next/cache";
import { db, STORE_TAG } from "./db";
import { getSettings as liveSettings, getZones as liveZones, offerIsLive } from "./services";
import type { Banner, Category, Offer, Product } from "@/lib/types";

/** Storefront reads are cached: pages no longer hit the database on every click.
 *  The cache is cleared instantly when the admin saves anything (see `bust` in db.ts) and also expires every 60 s as a safety net.
 *  Order creation and the admin panel read the live data through `db` / `services` instead. */
const cached = <A extends unknown[], R>(fn: (...a: A) => Promise<R>, key: string) => unstable_cache(fn, [`store-${key}`], { tags: [STORE_TAG], revalidate: 60 });

export const getCategories = cached(async () => (await db.list<Category>("categories")).filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), "categories");
/** Active covers that are inside their optional start/end dates. (Cached for 60 s, so a schedule takes effect within a minute.) */
const bannerIsLive = (b: Banner, at = Date.now()) => b.active && !(b.startsAt && new Date(b.startsAt).getTime() > at) && !(b.endsAt && new Date(b.endsAt).getTime() < at);
export const getBanners = cached(async () => (await db.list<Banner>("banners")).filter((b) => bannerIsLive(b)).sort((a, b) => a.sortOrder - b.sortOrder), "banners");
export const getOffers = cached(async () => (await db.list<Offer>("offers")).filter((o) => offerIsLive(o)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), "offers");
export const getActiveProducts = cached(async () => (await db.list<Product>("products")).filter((p) => p.active).map(({ cost, ...p }) => p as Product), "products"); // `cost` never reaches the storefront
export const getSettings = cached(liveSettings, "settings");
export const getZones = cached(liveZones, "zones");
export const isMedicineCat = (c?: Category) => c?.kind === "medicine";
