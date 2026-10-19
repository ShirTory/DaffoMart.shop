import { z } from "zod";
import { normPhone } from "./format";

const url = z.string().max(1000).refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) || /^https?:\/\//.test(v), "Must be a valid URL or path");
const colorRe = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})?$/;
const color = z.string().trim().max(9).regex(colorRe, "Use a colour like #1E3A8A").optional();
const pick = (...v: [string, ...string[]]) => z.enum(v).optional();
const btnLook = z.object({
  style: z.enum(["solid", "soft", "outline", "plain"]), bg: color, color,
  size: z.enum(["sm", "md", "lg"]), weight: z.enum(["medium", "semibold", "bold", "black"]), radius: z.enum(["none", "md", "lg", "full"]),
  anim: z.enum(["none", "lift", "pulse", "shine", "bounce", "glow"]), shadow: z.enum(["none", "soft", "strong"]), uppercase: z.boolean(),
}).partial().optional();
const optionalDate = z.string().optional().transform((v) => (v ? v : undefined));

export const productSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  slug: z.string().trim().max(140).optional(),
  /** Unique SKU — required when active/published. Letters, numbers, - and _ only. */
  sku: z.string().trim().max(64).regex(/^[A-Z0-9_-]*$/i, "SKU: letters, numbers, - and _ only").optional().transform((v) => (v ? v.toUpperCase() : undefined)),
  description: z.string().trim().max(5000).default(""),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  oldPrice: z.coerce.number().min(0).optional().transform((v) => (v ? v : undefined)),
  unit: z.string().trim().max(40).default("1 pc"),
  emoji: z.string().trim().max(8).default("🛒"),
  image: url.optional().transform((v) => v || undefined),
  images: z.array(url).max(8).default([]),
  genericName: z.string().trim().max(160).optional().transform((v) => v || undefined),
  manufacturer: z.string().trim().max(120).optional().transform((v) => v || undefined),
  prescriptionRequired: z.boolean().default(false),
  categoryId: z.string().trim().min(1, "Choose a category"),
  stock: z.coerce.number().int().min(0).default(0),
  rating: z.coerce.number().min(0).max(5).default(0),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.active && !data.sku) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SKU is required for published products", path: ["sku"] });
  }
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(60),
  slug: z.string().trim().max(80).optional(),
  emoji: z.string().trim().max(8).default("🛍️"),
  image: url.optional().transform((v) => v || undefined),
  coverImage: url.optional().transform((v) => v || undefined),
  description: z.string().trim().max(300).optional().transform((v) => v || undefined),
  coverOverlay: z.enum(["dark", "medium", "light", "none"]).optional(),
  coverHeight: z.enum(["sm", "md", "lg"]).optional(),
  coverTextColor: color, coverBg: color, coverPosition: pick("top", "center", "bottom"),
  coverTitle: z.string().trim().max(80).optional().transform((v) => v || undefined),
  hideOnHome: z.boolean().optional(), iconBg: color,
  kind: z.enum(["grocery", "medicine"]).default("grocery"),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const bannerSchema = z.object({
  title: z.string().trim().max(120).default(""),
  subtitle: z.string().trim().max(240).default(""),
  image: url.refine((v) => v.length > 0, "Cover image is required"),
  mobileImage: url.optional().transform((v) => v || undefined),
  ctaLabel: z.string().trim().max(40).default(""),
  ctaHref: z.string().trim().max(300).default("/products"),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  alt: z.string().trim().max(160).optional().transform((v) => v || undefined),
  fit: pick("cover", "contain"), bg: color,
  overlay: pick("auto", "none", "dark", "light"), textColor: color, align: pick("left", "center", "right"),
  ctaBg: color, ctaColor: color, newTab: z.boolean().optional(),
  startsAt: optionalDate, endsAt: optionalDate,
});

export const offerSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(120),
  description: z.string().trim().max(400).default(""),
  image: url.optional().transform((v) => v || undefined),
  badge: z.string().trim().max(24).default(""),
  code: z.string().trim().toUpperCase().max(24).regex(/^[A-Z0-9_-]*$/, "Letters, numbers, - and _ only").optional().transform((v) => v || undefined),
  discountType: z.enum(["percent", "flat"]).default("percent"),
  discountValue: z.coerce.number().min(0).default(0),
  minOrder: z.coerce.number().min(0).default(0),
  startsAt: optionalDate,
  endsAt: optionalDate,
  active: z.boolean().default(true),
}).refine((o) => o.discountType !== "percent" || o.discountValue <= 100, { message: "Percent cannot exceed 100", path: ["discountValue"] });

export const settingsSchema = z.object({
  storeName: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(30).default(""),
  whatsapp: z.string().trim().max(30).default(""),
  email: z.string().trim().max(120).default(""),
  address: z.string().trim().max(240).default(""),
  facebook: z.string().trim().max(240).default(""),
  hours: z.string().trim().max(160).default(""),
  mapUrl: z.string().trim().max(600).default(""),
  announcement: z.string().trim().max(600).default(""),
  announcementIcon: z.string().trim().max(8).optional(), announcementLink: z.string().trim().max(400).optional(),
  announcementBg: color, announcementColor: color, announcementStyle: pick("static", "marquee", "bounce", "rotate"), announcementSpeed: pick("slow", "normal", "fast"), announcementWeight: pick("normal", "semibold", "bold", "black"), announcementDirection: pick("left", "right"), announcementSep: z.string().trim().max(4).optional(), announcementSize: pick("sm", "md", "lg"),
  announcementDismissible: z.boolean().optional(), announcementCta: z.string().trim().max(30).optional(),
  headerTheme: pick("light", "brand"), headerBg: color, headerText: color, headerSticky: pick("bar", "all", "none"),
  headerShowCategories: z.boolean().optional(), headerShowOrders: z.boolean().optional(), headerShowTrack: z.boolean().optional(), headerShowContact: z.boolean().optional(),
  headerSearchStyle: pick("pill", "box"), headerCartStyle: pick("accent", "primary", "outline"), headerMedicineStyle: pick("soft", "solid", "plain"),
  headerCartBtn: btnLook, headerMedicineBtn: btnLook, headerLinkBtn: btnLook,
  buttonWeight: pick("medium", "semibold", "bold", "black"), buttonAnim: pick("none", "lift", "pulse", "shine", "bounce", "glow"), buttonShadow: pick("none", "soft", "strong"),
  medCtaShow: z.boolean().optional(), medCtaDevices: pick("mobile", "all"), medCtaStyle: pick("banner", "button"),
  medCtaTitle: z.string().trim().max(60).optional(), medCtaSubtitle: z.string().trim().max(120).optional(), medCtaLabel: z.string().trim().max(30).optional(),
  medCtaBg: color, medCtaBg2: color, medCtaText: color, medCtaBtn: btnLook,
  catLayout: pick("scroll", "grid"), catStyle: pick("card", "circle", "tile"), catCardBg: color, catShowSeeAll: z.boolean().optional(),
  cardImageRatio: pick("square", "wide", "tall"), cardStyle: pick("flat", "soft", "outlined"), cardRadius: pick("md", "lg", "xl"),
  cardShowUnit: z.boolean().optional(), cardShowQtyStepper: z.boolean().optional(), cardPriceColor: color, cardGap: pick("sm", "md", "lg"),
  pageBg: color, pageWidth: pick("normal", "wide"),
  minOrder: z.coerce.number().min(0).default(0),
  serviceCharge: z.coerce.number().min(0).max(100000).optional(),
  deliveryInside: z.coerce.number().min(0),
  deliveryOutside: z.coerce.number().min(0),
  freeDeliveryOver: z.coerce.number().min(0).default(0),
  logo: url.default(""),
  footerText: z.string().trim().max(300).default(""),
  heroTitle: z.string().trim().max(120).default(""),
  heroSubtitle: z.string().trim().max(240).default(""),
  heroCta: z.string().trim().max(40).default(""),
  features: z.array(z.object({ icon: z.string().trim().max(32).default("check"), title: z.string().trim().max(40), text: z.string().trim().max(80), image: url.optional() })).max(8),
  positions: z.array(z.object({ id: z.string().trim().min(1).max(40), title: z.string().trim().min(1).max(40), kind: z.enum(["rider", "staff"]).default("staff"), description: z.string().trim().max(240).optional(), active: z.boolean().default(true) })).max(30).optional(),
  joinTitle: z.string().trim().max(80).optional(), joinIntro: z.string().trim().max(300).optional(),
  payCod: z.boolean(), payBkash: z.boolean(), bkashNumber: z.string().trim().max(30).default(""),
  payNagad: z.boolean(), nagadNumber: z.string().trim().max(30).default(""), payOnline: z.boolean(),
  payInstructions: z.string().trim().max(400).default(""),
  showMedicine: z.boolean(),
  medicineTitle: z.string().trim().max(80).default(""),
  medicineSubtitle: z.string().trim().max(200).default(""),
  medicineNotice: z.string().trim().max(300).default(""),
  emptyStateTitle: z.string().trim().max(80).optional(),
  emptyStateText: z.string().trim().max(240).optional(),
  emptyStateIcon: z.string().trim().max(8).optional(),
  returnPolicy: z.string().trim().max(2000).optional(),
  exchangePolicy: z.string().trim().max(2000).optional(),
  primaryColor: color, accentColor: color, secondaryColor: color,
  buttonColor: color, buttonTextColor: color, buttonStyle: pick("solid", "outline", "soft"),
  showBuyNow: z.boolean().optional(), showWishlist: z.boolean().optional(), showCardWhatsapp: z.boolean().optional(), showCardDelivery: z.boolean().optional(),
  supportCallColor: color, supportWaColor: color, supportPosition: pick("right", "left"), supportWaMessage: z.string().trim().max(200).optional(),
  navAllImage: url.optional(), navMedicineImage: url.optional(), navOffersImage: url.optional(), showCatSection: z.boolean().optional(), catIconSize: pick("sm", "md", "lg"), catIconShape: pick("rounded", "circle", "square"), catIconBg: color, catIconFit: pick("cover", "contain"),
  catShowLabels: z.boolean().optional(), catGap: pick("sm", "md", "lg"), catLabelColor: color,
  emptyStateImage: url.optional(), emptyStateBg: color, emptyStateColor: color, emptyStateAlign: pick("center", "left"),
  footerPromoShow: z.boolean().optional(), footerPromoHeight: pick("sm", "md", "lg"), footerPromoBg: color, footerPromoAlt: z.string().trim().max(120).optional(), footerPromoFit: pick("cover", "contain"),
  footerShowPayments: z.boolean().optional(), footerShowCategories: z.boolean().optional(),
  texts: z.record(z.string().regex(/^[a-zA-Z0-9._-]{1,60}$/), z.string().max(400)).refine((o) => Object.keys(o).length <= 300, "Too many text entries").optional(),
  payDisplay: z.record(z.enum(["cod", "bkash", "nagad", "online"]), z.object({
    label: z.string().trim().max(40).optional(), hint: z.string().trim().max(120).optional(), logo: url.optional(), color: color,
    order: z.coerce.number().int().min(0).max(99).optional(), visible: z.boolean().optional(),
  })).optional(),
  appPromptEnabled: z.boolean().optional(),
  appPromptTitle: z.string().trim().max(80).optional(),
  appPromptText: z.string().trim().max(240).optional(),
  appPromptImage: url.optional(),
  appPromptBtnLabel: z.string().trim().max(40).optional(),
  appPromptDismissLabel: z.string().trim().max(40).optional(),
  appPromptDelayMs: z.coerce.number().min(0).max(60000).optional(),
  appPromptHideDays: z.coerce.number().min(0).max(365).optional(),
  seoTitle: z.string().trim().max(70).optional(), seoDescription: z.string().trim().max(200).optional(), ogImage: url.optional(), favicon: url.optional(),
  invoice: z.object({
    title: z.string().trim().max(40).optional(), prefix: z.string().trim().max(12).optional(), companyName: z.string().trim().max(80).optional(), logo: url.optional(), showLogo: z.boolean().optional(),
    address: z.string().trim().max(240).optional(), phone: z.string().trim().max(40).optional(), email: z.string().trim().max(120).optional(), website: z.string().trim().max(120).optional(),
    taxId: z.string().trim().max(60).optional(), taxLabel: z.string().trim().max(30).optional(), accent: color, paper: pick("A4", "A5", "thermal"), layout: pick("classic", "modern"),
    showItemImage: z.boolean().optional(), showUnit: z.boolean().optional(), showPaymentInfo: z.boolean().optional(), showCourier: z.boolean().optional(), showCustomerPhone: z.boolean().optional(), showPaidStamp: z.boolean().optional(),
    notes: z.string().trim().max(400).optional(), terms: z.string().trim().max(800).optional(), footer: z.string().trim().max(300).optional(),
    signatureLabel: z.string().trim().max(40).optional(), showSignature: z.boolean().optional(),
  }).optional(),
  buttonRadius: z.enum(["none", "sm", "md", "lg", "full"]).optional(),
  buttonSize: z.enum(["sm", "md", "lg"]).optional(),
  supportCallLabel: z.string().trim().max(40).optional(),
  supportWaLabel: z.string().trim().max(40).optional(),
  showSupportCall: z.boolean().optional(),
  showSupportWa: z.boolean().optional(),
  invoiceFooter: z.string().trim().max(300).optional(),
  metaPixelId: z.string().trim().max(40).optional().or(z.literal("")),
  courierOutsideNote: z.string().trim().max(300).optional(),
  footerPromoImage: url.optional().or(z.literal("")).optional(),
  footerPromoLink: z.string().trim().max(400).optional(),


  labelRules: z.object({
    showBestSeller: z.boolean().default(true),
    bestSellerMinSold: z.coerce.number().int().min(1).max(100000).default(5),
    showNewArrival: z.boolean().default(true),
    newArrivalDays: z.coerce.number().int().min(1).max(365).default(14),
    showOffer: z.boolean().default(true),
    showOutOfStock: z.boolean().default(true),
    bestSellerLabel: z.string().trim().max(20).optional(),
    bestSellerColor: color,
    newLabel: z.string().trim().max(20).optional(),
    newColor: color,
  }).optional(),
  fx: z.object({
    enabled: z.boolean(), entrance: z.boolean(), cardLift: z.boolean(), categoryFloat: z.boolean(), badgeShine: z.boolean(),
    heroFloat: z.boolean(), heroAutoplay: z.boolean(), heroIntervalSec: z.coerce.number().min(2).max(30), speed: z.enum(["slow", "normal", "fast"]),
  }).partial().optional(),
  dealBadges: z.object({
    enabled: z.boolean(), onOffers: z.boolean(),
    minDiscount: z.coerce.number().min(0).max(99), megaPct: z.coerce.number().min(1).max(99), hotPct: z.coerce.number().min(1).max(99), valuePct: z.coerce.number().min(1).max(99),
    limitedStock: z.coerce.number().int().min(1).max(1000),
    kinds: z.object(Object.fromEntries((["hot", "value", "mega", "limited", "exclusive"] as const).map((k) => [k, z.object({ on: z.boolean(), label: z.string().trim().max(24), color }).partial().optional()]))).partial(),
  }).partial().optional(),
  heroBanner: z.object({
    show: z.boolean(), ctaLabel: z.string().trim().max(30), ctaHref: url, showBrowse: z.boolean(), emojis: z.string().trim().max(60),
    bgFrom: color, bgTo: color, textColor: color, ctaBg: color, ctaColor: color, bgImage: url, overlay: z.coerce.number().min(0).max(90),
    height: z.enum(["sm", "md", "lg"]), align: z.enum(["left", "center"]), showEyebrow: z.boolean(), showShapes: z.boolean(),
    transition: z.enum(["slide", "fade"]), showArrows: z.boolean(), showDots: z.boolean(), rounded: z.boolean(),
  }).partial().optional(),
  customerNidEnabled: z.boolean().optional(),
  homeSections: z.array(z.object({
    id: z.enum(["hero","features","categories","best","daily","fresh","household","offers","sale","medicine","new","buyAgain"]),
    visible: z.boolean(),
  })).max(20).optional(),
  homeDailyCatIds: z.array(z.string().min(1).max(40)).max(20).optional(),
  homeFreshCatIds: z.array(z.string().min(1).max(40)).max(20).optional(),
  homeHouseholdCatIds: z.array(z.string().min(1).max(40)).max(20).optional(),
  homeDailyTitle: z.string().trim().max(80).optional(),
  homeFreshTitle: z.string().trim().max(80).optional(),
  homeHouseholdTitle: z.string().trim().max(80).optional(),
  homeBestTitle: z.string().trim().max(80).optional(),

});
/** Admin pages save only the fields they edit; the server merges them into the stored settings. */
export const settingsPatchSchema = settingsSchema.partial();

export const zoneSchema = z.object({
  name: z.string().trim().min(2, "Area name is required").max(60),
  charge: z.coerce.number().min(0, "Charge must be 0 or more"),
  freeOver: z.coerce.number().min(0).default(0),
  eta: z.string().trim().max(60).default(""),
  viaCourier: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const riderSchema = z.object({
  name: z.string().trim().min(2, "Rider name is required").max(80),
  phone: z.string().trim().regex(/^01[3-9]\d{8}$/, "Enter a valid mobile number (01XXXXXXXXX)"),
  vehicle: z.string().trim().max(40).default(""),
  area: z.string().trim().max(80).default(""),
  note: z.string().trim().max(200).default(""),
  active: z.boolean().default(true),
  image: url.optional().transform((v) => v || undefined),
  password: z.string().max(60).optional().transform((v) => v || undefined).refine((v) => !v || v.length >= 6, "Password must be at least 6 characters"),
});

export const inventorySchema = z.object({
  productId: z.string().min(1),
  mode: z.enum(["add", "remove", "set"]),
  qty: z.coerce.number().int().min(0, "Quantity must be 0 or more").max(1_000_000),
  reason: z.string().trim().max(80).default(""),
});

export const orderCreateSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z.string().transform(normPhone).pipe(z.string().regex(/^01[3-9]\d{8}$/, "Enter a valid mobile number (01XXXXXXXXX)")),
  address: z.string().trim().min(8, "Enter your full address").max(300),
  zone: z.string().trim().min(1, "Choose a delivery area").max(60),
  payment: z.string().trim().min(1).max(40).default("cod"),
  paymentRef: z.string().trim().max(40).optional(),
  paymentFrom: z.string().max(24).transform(normPhone).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  note: z.string().trim().max(300).optional().default(""),
  couponCode: z.string().trim().toUpperCase().max(24).optional(),
  /** client-generated random key for one checkout attempt; makes retries and double-taps idempotent */
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "Invalid request key").optional(),
  items: z.array(z.object({ id: z.string().min(1), qty: z.coerce.number().int().min(1).max(100) })).min(1, "Your cart is empty").max(60),
});

export const orderPatchSchema = z.object({
  status: z.enum(["pending", "confirmed", "processing", "assigned", "picked_up", "on_the_way", "delivered", "cancelled", "returned"]).optional(),
  riderId: z.string().max(60).optional(),
  paymentStatus: z.enum(["unpaid", "pending", "paid", "failed", "refunded"]).optional(),
  courierId: z.string().max(60).optional(), trackingNo: z.string().trim().max(60).optional(),
}).refine((v) => v.status !== undefined || v.riderId !== undefined || v.paymentStatus !== undefined || v.courierId !== undefined || v.trackingNo !== undefined, { message: "Nothing to update" });

export const loginSchema = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });

const bdMobile = (msg = "Enter a valid mobile number (01XXXXXXXXX)") => z.string().trim().regex(/^01[3-9]\d{8}$/, msg);

/** Public rider application (fields arrive as multipart text parts, the two NID photos as files). */
export const riderApplySchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: bdMobile(),
  password: z.string().min(6, "Password must be at least 6 characters").max(60),
  nidNumber: z.string().trim().regex(/^(\d{10}|\d{13}|\d{17})$/, "NID number must be 10, 13 or 17 digits"),
  permanentAddress: z.string().trim().min(8, "Enter your permanent address").max(300),
  presentAddress: z.string().trim().min(8, "Enter your present address").max(300),
  vehicle: z.string().trim().max(40).default(""),
  area: z.string().trim().max(80).default(""),
  referrerName: z.string().trim().min(2, "Enter the referrer's name").max(80),
  referrerPhone: bdMobile("Enter a valid mobile number for the referrer (01XXXXXXXXX)"),
  referrerRelation: z.string().trim().max(40).default(""),
  // CV / hiring
  dateOfBirth: z.string().trim().max(20).optional().transform((v) => v || undefined),
  gender: z.string().trim().max(20).optional().transform((v) => v || undefined),
  bloodGroup: z.string().trim().max(10).optional().transform((v) => v || undefined),
  fatherName: z.string().trim().max(80).optional().transform((v) => v || undefined),
  motherName: z.string().trim().max(80).optional().transform((v) => v || undefined),
  education: z.string().trim().max(120).optional().transform((v) => v || undefined),
  experienceYears: z.coerce.number().min(0).max(50).optional().transform((v) => (v === undefined || Number.isNaN(v) ? undefined : v)),
  previousJobs: z.string().trim().max(500).optional().transform((v) => v || undefined),
  skills: z.string().trim().max(300).optional().transform((v) => v || undefined),
  languages: z.string().trim().max(120).optional().transform((v) => v || undefined),
  emergencyContact: z.string().trim().max(80).optional().transform((v) => v || undefined),
  emergencyPhone: z.string().trim().max(20).optional().transform((v) => v || undefined),
  drivingLicense: z.boolean().optional(),
  licenseNumber: z.string().trim().max(40).optional().transform((v) => v || undefined),
  expectedSalary: z.coerce.number().min(0).max(10_000_000).optional().transform((v) => (v ? v : undefined)),
  availableFrom: z.string().trim().max(20).optional().transform((v) => v || undefined),
  preferredShift: z.string().trim().max(40).optional().transform((v) => v || undefined),
});
/** Admin decision on an application. A reason is required when rejecting. */
export const riderReviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(3, "Write the reason for rejecting").max(200) }),
]);

export const riderLoginSchema = z.object({ phone: z.string().trim().min(5).max(20), password: z.string().min(1).max(60) });
export const riderStatusSchema = z.object({ status: z.enum(["picked_up", "on_the_way", "delivered", "returned"]) });

/** Rider app → live GPS ping. `stop` clears the shared position (rider went offline). */
export const riderLocationSchema = z.union([
  z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  z.object({ stop: z.literal(true) }),
]);

/* ---------- operations: employees, attendance, couriers ---------- */
const bdOrBlank = z.string().trim().max(20).regex(/^(\+?[0-9][0-9\s-]{5,18})?$/, "Enter a valid phone number").default("");
export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  role: z.string().trim().min(2, "Choose a role").max(40),
  phone: bdOrBlank,
  email: z.string().trim().max(120).default(""),
  department: z.string().trim().max(60).optional().transform((v) => v || undefined),
  joinedAt: optionalDate,
  salary: z.coerce.number().min(0).max(10_000_000).optional().transform((v) => (v ? v : undefined)),
  note: z.string().trim().max(300).default(""),
  active: z.boolean().default(true),
  image: url.optional().transform((v) => v || undefined),
  riderId: z.string().max(60).optional().transform((v) => v || undefined),
});
export const courierSchema = z.object({
  name: z.string().trim().min(2, "Courier name is required").max(60),
  phone: bdOrBlank,
  trackingUrl: z.string().trim().max(300).refine((v) => v === "" || /^https?:\/\//.test(v), "Must start with http:// or https://").default(""),
  note: z.string().trim().max(300).default(""),
  charge: z.coerce.number().min(0).max(100000).default(0),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM").optional().or(z.literal("")).transform((v) => v || undefined);
export const attendanceStatus = z.enum(["present", "late", "half", "leave", "absent", "off"]);
export const attendanceUpsertSchema = z.object({ employeeId: z.string().min(1), date: dateStr, status: attendanceStatus, checkIn: hhmm, checkOut: hhmm, note: z.string().trim().max(200).optional() });
export const attendanceBulkSchema = z.object({ date: dateStr, status: attendanceStatus.default("present"), overwrite: z.boolean().default(false), employeeIds: z.array(z.string()).max(500).optional() });

/** Custom payment methods (Rocket, Upay, bank transfer, etc.) managed from Admin → Payments. */
export const paymentMethodSchema = z.object({
  label: z.string().trim().min(2, "Label required").max(60),
  hint: z.string().trim().max(200).default(""),
  number: z.string().trim().max(40).optional().or(z.literal("")),
  icon: z.string().trim().max(8).optional().or(z.literal("")),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  requireTrx: z.boolean().default(true),
});

/** Customer rates a rider after delivery (1–5 stars + optional text). */
export const riderRatingSchema = z.object({
  orderId: z.string().min(1),
  stars: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(400).optional().transform((v) => v || undefined),
  customerName: z.string().trim().max(80).optional(),
  customerPhone: z.string().trim().max(20).optional(),
});

/** Raise an issue on an order (customer or rider). Photos/video arrive via multipart. */
export const issueCreateSchema = z.object({
  orderId: z.string().min(1),
  raisedBy: z.enum(["customer", "rider"]),
  text: z.string().trim().min(5, "Describe the issue").max(1000),
  raiserName: z.string().trim().max(80).optional(),
  raiserPhone: z.string().trim().max(20).optional(),
});

export const issuePatchSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  adminNote: z.string().trim().max(500).optional(),
}).refine((v) => v.status !== undefined || v.adminNote !== undefined, { message: "Nothing to update" });

/** Public employee application (self-register). */
export const employeeApplySchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: bdMobile(),
  password: z.string().min(6, "Password must be at least 6 characters").max(60),
  email: z.string().trim().email("Enter a valid email").max(120).or(z.literal("")).optional(),
  role: z.string().trim().min(2, "Choose a position/role").max(40),
  department: z.string().trim().max(60).optional().transform((v) => v || undefined),
  note: z.string().trim().max(300).default(""),
  // CV / hiring
  nidNumber: z.string().trim().max(20).optional().transform((v) => v || undefined),
  permanentAddress: z.string().trim().max(300).optional().transform((v) => v || undefined),
  presentAddress: z.string().trim().max(300).optional().transform((v) => v || undefined),
  dateOfBirth: z.string().trim().max(20).optional().transform((v) => v || undefined),
  gender: z.string().trim().max(20).optional().transform((v) => v || undefined),
  bloodGroup: z.string().trim().max(10).optional().transform((v) => v || undefined),
  fatherName: z.string().trim().max(80).optional().transform((v) => v || undefined),
  motherName: z.string().trim().max(80).optional().transform((v) => v || undefined),
  education: z.string().trim().max(120).optional().transform((v) => v || undefined),
  experienceYears: z.coerce.number().min(0).max(50).optional().transform((v) => (v === undefined || Number.isNaN(v) ? undefined : v)),
  previousJobs: z.string().trim().max(500).optional().transform((v) => v || undefined),
  skills: z.string().trim().max(300).optional().transform((v) => v || undefined),
  languages: z.string().trim().max(120).optional().transform((v) => v || undefined),
  emergencyContact: z.string().trim().max(80).optional().transform((v) => v || undefined),
  emergencyPhone: z.string().trim().max(20).optional().transform((v) => v || undefined),
  expectedSalary: z.coerce.number().min(0).max(10_000_000).optional().transform((v) => (v ? v : undefined)),
  availableFrom: z.string().trim().max(20).optional().transform((v) => v || undefined),
  preferredShift: z.string().trim().max(40).optional().transform((v) => v || undefined),
});

export const employeeReviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(3, "Write the reason for rejecting").max(200) }),
]);

export const employeeLoginSchema = z.object({ phone: z.string().trim().min(5).max(20), password: z.string().min(1).max(60) });
