export type CategoryKind = "grocery" | "medicine";
export interface Category {
  id: string; name: string; slug: string; emoji: string; image?: string;
  coverImage?: string; description?: string;
  coverOverlay?: string; coverHeight?: string;
  coverTextColor?: string; coverBg?: string; coverPosition?: string; coverTitle?: string;
  /** circle icon on the home page: hide / own background colour */
  hideOnHome?: boolean; iconBg?: string;
  kind?: CategoryKind; active: boolean; sortOrder: number;
}

/** One purchasable size / weight / colour combination of a product, with its own price and stock (see lib/variants.ts). */
export interface ProductVariant {
  id: string; size?: string; weight?: string; color?: string;
  /** optional colour swatch shown on the storefront (#RRGGBB) */
  colorHex?: string;
  price: number; oldPrice?: number; stock: number; sku?: string;
}

export interface Product {
  id: string; slug: string; name: string; description: string;
  /** Optional variants. When present, price / oldPrice / stock below are derived from them and the customer must pick one. */
  variants?: ProductVariant[];
  /** Unique stock-keeping unit. Required for published (active) products. Not the document id. */
  sku?: string;
  /** Average purchase cost per unit, maintained by received purchases. Used for cost of goods sold. */
  cost?: number;
  price: number; oldPrice?: number; unit: string; emoji: string;
  image?: string; images: string[];
  genericName?: string; manufacturer?: string; prescriptionRequired?: boolean;
  categoryId: string; stock: number; rating: number; sold: number;
  featured: boolean; active: boolean; createdAt: string; updatedAt: string;
  /** Optional offer window for a discounted product (oldPrice > price). Empty = no time limit. YYYY-MM-DD, end date inclusive. */
  offerStartsAt?: string; offerEndsAt?: string;
}

export interface Banner {
  id: string; title: string; subtitle: string; image: string; mobileImage?: string;
  ctaLabel: string; ctaHref: string; active: boolean; sortOrder: number; createdAt: string;
  /** Optional per-slide look (Admin → Cover Images). Empty = sensible defaults. */
  alt?: string; fit?: "cover" | "contain"; bg?: string;
  overlay?: "auto" | "none" | "dark" | "light"; textColor?: string; align?: "left" | "center" | "right";
  ctaBg?: string; ctaColor?: string; newTab?: boolean;
  /** Show only between these dates (ISO). */
  startsAt?: string; endsAt?: string;
}

export type DiscountType = "percent" | "flat";
export interface Offer {
  id: string; title: string; description: string; image?: string; badge: string;
  code?: string; discountType: DiscountType; discountValue: number; minOrder: number;
  startsAt?: string; endsAt?: string; active: boolean; createdAt: string;
}

/** A job opening shown on the public /join page. kind "rider" -> rider application form, "staff" -> staff application form */
export interface JobPosition { id: string; title: string; kind: "rider" | "staff"; description?: string; active: boolean }

/** Homepage section keys — order & visibility controlled from Admin */
export type HomeSectionId =
  | "hero"
  | "features"
  | "categories"
  | "best"
  | "daily"
  | "fresh"
  | "household"
  | "offers"
  | "offerProducts"
  | "sale"
  | "medicine"
  | "new"
  | "buyAgain";
export interface HomeSectionConfig { id: HomeSectionId; visible: boolean }

/** Look of one customisable button (Admin → Appearance → button designer). Every field is optional; empty = the built-in look. */
export interface BtnLook {
  style?: "solid" | "soft" | "outline" | "plain"; bg?: string; color?: string;
  size?: "sm" | "md" | "lg"; weight?: "medium" | "semibold" | "bold" | "black"; radius?: "none" | "md" | "lg" | "full";
  anim?: "none" | "lift" | "pulse" | "shine" | "bounce" | "glow"; shadow?: "none" | "soft" | "strong"; uppercase?: boolean;
}

export interface Feature { icon: string; title: string; text: string; image?: string }

/** Product card label rules — Admin configurable, based on real data only */
export interface LabelRules {
  showBestSeller: boolean;
  bestSellerMinSold: number;
  showNewArrival: boolean;
  newArrivalDays: number;
  showOffer: boolean;
  showOutOfStock: boolean;
  /** optional custom wording / colour (empty = built-in) */
  bestSellerLabel?: string; bestSellerColor?: string;
  newLabel?: string; newColor?: string;
}

/** Animation switches (Admin → Website content → Animations). Every field optional; see lib/fx.ts for defaults. */
export interface FxSettings {
  enabled: boolean; entrance: boolean; cardLift: boolean; categoryFloat: boolean; badgeShine: boolean;
  heroFloat: boolean; heroAutoplay: boolean; heroIntervalSec: number; speed: "slow" | "normal" | "fast";
}
export type DealKindId = "hot" | "value" | "mega" | "limited" | "exclusive";
export interface DealKindSettings { on: boolean; label: string; color: string }
/** Super Deals badges: thresholds, wording, colour and on/off per badge. */
export interface DealBadgeSettings {
  enabled: boolean; onOffers: boolean;
  minDiscount: number; megaPct: number; hotPct: number; valuePct: number; limitedStock: number;
  kinds: Record<DealKindId, DealKindSettings>;
}
/** Built-in animated grocery banner on the home page. */
export interface HeroBannerSettings {
  show: boolean; ctaLabel: string; ctaHref: string; showBrowse: boolean; emojis: string;
  /** look of the built-in banner */
  bgFrom: string; bgTo: string; textColor: string; ctaBg: string; ctaColor: string;
  bgImage: string; overlay: number; height: "sm" | "md" | "lg"; align: "left" | "center";
  showEyebrow: boolean; showShapes: boolean;
  /** slider behaviour */
  transition: "slide" | "fade"; showArrows: boolean; showDots: boolean; rounded: boolean;
}

/** accountant: Finance & Accounts only (no products, orders, settings, NID or staff data) */
export type AdminRole = "owner" | "it_support" | "accountant";
export interface AdminAccount {
  id: string;
  email: string;
  role: AdminRole;
  /** Owner may grant IT Support full admin panel access */
  fullAccess: boolean;
  active: boolean;
  note?: string;
  grantedBy?: string;
  grantedAt?: string;
  /** scrypt hash — never returned to clients */
  passHash?: string;
  /** sessions issued before this moment are rejected (set whenever the password changes) */
  pwChangedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  at: string;
  actor: string;
  actorRole: string;
  action: string;
  target?: string;
  detail?: string;
  ip?: string;
}

/** Optional customer record (phone-keyed). NID only if business enables it. */
export interface CustomerProfile {
  id: string;
  phone: string;
  name?: string;
  nidNumber?: string;
  nidStatus?: "pending" | "approved" | "rejected" | "none";
  nidRejectReason?: string;
  hasNid?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreSettings {
  storeName: string; tagline: string; phone: string; email: string; address: string;
  announcement: string; facebook: string; whatsapp: string;
  /** announcement bar look (Admin → Appearance) */
  announcementIcon?: string; announcementLink?: string; announcementBg?: string; announcementColor?: string;
  announcementStyle?: "static" | "marquee" | "bounce" | "rotate"; announcementSpeed?: "slow" | "normal" | "fast"; announcementWeight?: "normal" | "semibold" | "bold" | "black"; announcementDirection?: "left" | "right"; announcementSep?: string; announcementSize?: "sm" | "md" | "lg"; announcementDismissible?: boolean; announcementCta?: string;
  /** header look (Admin → Appearance) */
  headerTheme?: "light" | "brand"; headerBg?: string; headerText?: string; headerSticky?: "bar" | "all" | "none";
  headerShowCategories?: boolean; headerShowOrders?: boolean; headerShowTrack?: boolean; headerShowContact?: boolean; headerSearchStyle?: "pill" | "box";
  headerCartStyle?: "accent" | "primary" | "outline"; headerMedicineStyle?: "soft" | "solid" | "plain";
  /** full button designer for header buttons (overrides the presets above when set) */
  headerCartBtn?: BtnLook; headerMedicineBtn?: BtnLook; headerLinkBtn?: BtnLook;
  /** global button extras + the highlighted medicine button on the home page */
  buttonWeight?: "medium" | "semibold" | "bold" | "black"; buttonAnim?: "none" | "lift" | "pulse" | "shine" | "bounce" | "glow"; buttonShadow?: "none" | "soft" | "strong";
  medCtaShow?: boolean; medCtaDevices?: "mobile" | "all"; medCtaStyle?: "banner" | "button"; medCtaTitle?: string; medCtaSubtitle?: string; medCtaLabel?: string; medCtaBg?: string; medCtaBg2?: string; medCtaText?: string; medCtaBtn?: BtnLook;
  catLayout?: "scroll" | "grid"; catStyle?: "card" | "circle" | "tile"; catCardBg?: string; catShowSeeAll?: boolean;
  /** product card look (Admin → Appearance) */
  cardImageRatio?: "square" | "wide" | "tall"; cardStyle?: "flat" | "soft" | "outlined"; cardRadius?: "md" | "lg" | "xl";
  cardShowUnit?: boolean; cardShowQtyStepper?: boolean; cardPriceColor?: string; cardGap?: "sm" | "md" | "lg";
  /** page background + width */
  pageBg?: string; pageWidth?: "normal" | "wide";
  /** legacy defaults, used only to create the first delivery zones */
  deliveryInside: number; deliveryOutside: number; freeDeliveryOver: number;
  /** Flat service / packaging charge applied at checkout (0 = off) */
  serviceCharge: number;
  hours: string; mapUrl: string; minOrder: number; logo: string; footerText: string;
  heroTitle: string; heroSubtitle: string; heroCta: string; features: Feature[];
  payCod: boolean; payBkash: boolean; bkashNumber: string; payNagad: boolean; nagadNumber: string; payOnline: boolean; payInstructions: string;
  showMedicine: boolean; medicineTitle: string; medicineSubtitle: string; medicineNotice: string;
  emptyStateTitle?: string; emptyStateText?: string; emptyStateIcon?: string;
  returnPolicy?: string; exchangePolicy?: string;
  primaryColor?: string; accentColor?: string; secondaryColor?: string;
  buttonRadius?: string; buttonSize?: string;
  supportCallLabel?: string; supportWaLabel?: string; showSupportCall?: boolean; showSupportWa?: boolean;
  invoiceFooter?: string; courierOutsideNote?: string;
  /** Meta (Facebook) Pixel ID — only loaded when non-empty */
  metaPixelId?: string;
  footerPromoImage?: string; footerPromoLink?: string;
  footerPromoShow?: boolean; footerPromoHeight?: string; footerPromoBg?: string; footerPromoAlt?: string; footerPromoFit?: string;
  footerShowPayments?: boolean; footerShowCategories?: boolean;
  /** editable website wording: key -> text (see lib/texts.ts) */
  texts?: Record<string, string>;
  /** buttons */
  buttonColor?: string; buttonTextColor?: string; buttonStyle?: string;
  showBuyNow?: boolean; showWishlist?: boolean; showCardWhatsapp?: boolean; showCardDelivery?: boolean;
  /** floating support buttons */
  supportCallColor?: string; supportWaColor?: string; supportPosition?: string; supportWaMessage?: string;
  /** Homepage section order + visibility (Admin-editable). Missing = defaults. */
  homeSections?: HomeSectionConfig[];
  /** Optional category IDs feeding Daily Essentials / Fresh / Household sections */
  homeDailyCatIds?: string[];
  homeFreshCatIds?: string[];
  homeHouseholdCatIds?: string[];
  homeDailyTitle?: string;
  homeFreshTitle?: string;
  homeHouseholdTitle?: string;
  homeBestTitle?: string;
  /** Product card label rules */
  labelRules?: LabelRules;
  /** UI animation switches, deal badges and the animated hero banner (all optional; defaults in lib/fx.ts) */
  fx?: Partial<FxSettings>;
  dealBadges?: Partial<Omit<DealBadgeSettings, "kinds">> & { kinds?: Partial<Record<DealKindId, Partial<DealKindSettings>>> };
  heroBanner?: Partial<HeroBannerSettings>;
  /** When true, checkout may collect optional customer NID (privacy-sensitive) */
  customerNidEnabled?: boolean;

  /** category icon section on the home page */
  navAllImage?: string; navMedicineImage?: string; navOffersImage?: string; showCatSection?: boolean; catIconSize?: string; catIconShape?: string; catIconBg?: string; catIconFit?: string; catShowLabels?: boolean; catGap?: string; catLabelColor?: string;
  /** empty states */
  emptyStateImage?: string; emptyStateBg?: string; emptyStateColor?: string; emptyStateAlign?: string;
  /** payment methods: how each one is displayed */
  payDisplay?: Record<string, PayDisplay>;
  /** PWA / Add to Home Screen install popup */
  appPromptEnabled?: boolean;
  appPromptTitle?: string;
  appPromptText?: string;
  appPromptImage?: string;
  appPromptBtnLabel?: string;
  appPromptDismissLabel?: string;
  /** Delay before showing (ms). Default 2500 */
  appPromptDelayMs?: number;
  /** Don't show again for N days after dismiss. Default 7 */
  appPromptHideDays?: number;

  /** SEO / sharing */
  seoTitle?: string; seoDescription?: string; ogImage?: string; favicon?: string;
  /** invoice look & content */
  invoice?: InvoiceSettings;
  /** careers: open positions + /join page wording (all editable in admin → Website content) */
  positions?: JobPosition[]; joinTitle?: string; joinIntro?: string;
  /** Storefront theme / layout (Admin → Website Theme). Public data: never put secrets here. */
  storeTheme?: StoreThemeSettings;
}
export interface PayDisplay { label?: string; hint?: string; logo?: string; color?: string; order?: number; visible?: boolean }
export interface InvoiceSettings {
  title?: string; prefix?: string; companyName?: string; logo?: string; showLogo?: boolean;
  address?: string; phone?: string; email?: string; website?: string; taxId?: string; taxLabel?: string;
  accent?: string; paper?: string; layout?: string; showItemImage?: boolean; showUnit?: boolean; showPaymentInfo?: boolean; showCourier?: boolean; showCustomerPhone?: boolean; showPaidStamp?: boolean;
  notes?: string; terms?: string; footer?: string; signatureLabel?: string; showSignature?: boolean;
}

export interface DeliveryZone { id: string; name: string; charge: number; freeOver: number; eta: string; active: boolean; sortOrder: number; /** delivered by a courier company (outside Dhaka) instead of a rider */ viaCourier?: boolean }
export type RiderStatus = "pending" | "approved" | "rejected";
/** Riders created before the application flow have no `status` and count as approved. */
export interface RiderApplication {
  nidNumber?: string; permanentAddress?: string; presentAddress?: string;
  referrerName?: string; referrerPhone?: string; referrerRelation?: string;
  hasNid?: boolean; appliedAt?: string; reviewedAt?: string; rejectReason?: string;
  /** CV / hiring profile */
  dateOfBirth?: string; gender?: string; bloodGroup?: string;
  fatherName?: string; motherName?: string;
  education?: string; experienceYears?: number;
  previousJobs?: string; skills?: string; languages?: string;
  emergencyContact?: string; emergencyPhone?: string;
  drivingLicense?: boolean; licenseNumber?: string;
  expectedSalary?: number; availableFrom?: string; preferredShift?: string;
}
export interface Rider extends RiderApplication { payTerms?: RateTerm[]; id: string; name: string; phone: string; vehicle: string; area: string; note: string; active: boolean; createdAt: string; status?: RiderStatus; passHash?: string; pwChangedAt?: string; hasPassword?: boolean;
  /** profile photo URL */
  image?: string;
  /** aggregated customer ratings */
  ratingAvg?: number; ratingCount?: number;
  /** last GPS position shared by the rider app (cleared when the rider stops sharing) */
  lat?: number; lng?: number; locAt?: string }

/** Customer rating of a rider after delivery */
export interface RiderRating {
  id: string; orderId: string; orderNo: string; riderId: string; riderName?: string;
  stars: number; comment?: string; customerName?: string; customerPhone?: string;
  createdAt: string;
}

/** Issue raised by customer or rider on an order */
export type IssueStatus = "open" | "in_progress" | "resolved" | "closed";
export interface OrderIssue {
  id: string; orderId: string; orderNo: string;
  raisedBy: "customer" | "rider"; raiserName?: string; raiserPhone?: string;
  text: string; photos: string[]; video?: string;
  status: IssueStatus; adminNote?: string;
  createdAt: string; updatedAt: string;
}
/** A GPS point plus how old it is, as shown on maps. */
export interface GeoPoint { lat: number; lng: number }
export interface StockLog { id: string; productId: string; productName: string; before: number; after: number; change: number; reason: string; createdAt: string }

export type OrderStatus = "pending" | "confirmed" | "processing" | "assigned" | "picked_up" | "on_the_way" | "delivered" | "cancelled" | "returned";
export const ORDER_STATUSES: OrderStatus[] = ["pending", "confirmed", "processing", "assigned", "picked_up", "on_the_way", "delivered", "cancelled", "returned"];

/** Built-in methods plus any custom id from Admin → Payments (e.g. "rocket", "upay", "bank"). */
export type PaymentMethod = string;
export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "refunded";
export const PAYMENT_LABEL: Record<string, string> = { cod: "Cash on delivery", bkash: "bKash", nagad: "Nagad", online: "Online payment" };
export interface PaymentOption { id: PaymentMethod; label: string; hint: string; number?: string; logo?: string; color?: string; icon?: string; /** custom methods: customer must enter TrxID + payer number */ requireTrx?: boolean; /** shown but cannot be chosen yet (e.g. gateway not connected) */ disabled?: boolean }
/** Admin-managed extra payment methods (Rocket, Upay, bank transfer, etc.). */
export interface CustomPaymentMethod { id: string; label: string; hint: string; number?: string; icon?: string; active: boolean; sortOrder: number; requireTrx: boolean; createdAt: string }

export interface OrderItem { /** unit cost at the time of sale (only when the product had a cost) */ cost?: number; /** chosen variant (size / weight / colour); `unit` then holds its label */ variantId?: string; variantLabel?: string; id: string; name: string; unit: string; price: number; qty: number; image?: string; emoji?: string }
export interface Order {
  id: string; orderNo: string; name: string; phone: string; address: string; zone: string; zoneName?: string;
  riderId?: string; riderName?: string; riderPhone?: string; hasRx?: boolean;
  payment: PaymentMethod; /** display name of a custom payment method */ paymentLabel?: string; paymentStatus?: PaymentStatus; paymentRef?: string; paymentFrom?: string; lat?: number; lng?: number; note: string;
  items: OrderItem[]; subtotal: number; delivery: number; serviceCharge?: number; discount: number; couponCode?: string; total: number;
  status: OrderStatus; stockRestored?: boolean; /** set when the order first reaches "delivered"; finance dates revenue by it */ deliveredAt?: string; createdAt: string; updatedAt: string;
  /** courier shipment (outside Dhaka) */
  courierId?: string; courierName?: string; trackingNo?: string; courierUrl?: string; courierAt?: string;
  /** CRM link: id of the customer record (the normalized phone number). Set automatically when the order is placed. */
  customerId?: string;
}

export interface Courier { id: string; name: string; phone: string; /** tracking link template, {tracking} is replaced by the tracking number */ trackingUrl: string; note: string; charge: number; active: boolean; sortOrder: number; createdAt: string }

export const EMPLOYEE_ROLES = ["CEO / Owner", "Manager", "Accountant", "Operations", "Customer Support", "Warehouse / Packer", "Marketing", "Rider", "Other"] as const;
export type EmployeeStatus = "pending" | "approved" | "rejected";
export interface Employee { pwChangedAt?: string; salaryHistory?: SalaryTerm[]; id: string; name: string; role: string; phone: string; email: string; department?: string; joinedAt?: string; salary?: number; note: string; active: boolean; riderId?: string; createdAt: string;
  /** profile photo */
  image?: string;
  /** application flow (self-registration) */
  status?: EmployeeStatus; passHash?: string; hasPassword?: boolean;
  appliedAt?: string; reviewedAt?: string; rejectReason?: string;
  /** CV / hiring profile */
  nidNumber?: string; permanentAddress?: string; presentAddress?: string;
  dateOfBirth?: string; gender?: string; bloodGroup?: string;
  fatherName?: string; motherName?: string;
  education?: string; experienceYears?: number;
  previousJobs?: string; skills?: string; languages?: string;
  emergencyContact?: string; emergencyPhone?: string;
  expectedSalary?: number; availableFrom?: string; preferredShift?: string;
}
export type AttendanceStatus = "present" | "late" | "half" | "leave" | "absent" | "off";
export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["present", "late", "half", "leave", "absent", "off"];
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = { present: "Present", late: "Late", half: "Half day", leave: "On leave", absent: "Absent", off: "Day off" };
export interface Attendance { id: string; employeeId: string; date: string; status: AttendanceStatus; checkIn?: string; checkOut?: string; note?: string; updatedAt: string }

export interface CartItem { /** chosen variant; the same product with a different variant is a separate cart line */ vid?: string; vlabel?: string; id: string; slug: string; name: string; price: number; unit: string; emoji: string; image?: string; qty: number; stock?: number; rx?: boolean }


/* ---------- Finance & Accounts ---------- */
export const EXPENSE_CATEGORIES = [
  "Purchase", "Delivery Cost",
  "Rent", "Utility", "Marketing", "Packaging", "Other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number] | string;

export const INCOME_CATEGORIES = [
  "Sales", "Other Income", "Refund Reversal", "Investment", "Other",
] as const;

export interface FinanceExpense {
  id: string;
  category: string;
  amount: number;
  date: string; // YYYY-MM-DD
  paymentMethod: string;
  note: string;
  receiptUrl?: string;
  orderId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Manual income only — order revenue is derived from delivered orders */
export interface FinanceIncome {
  id: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  note: string;
  orderId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Accounting extension (additive: new collections + optional fields only) ---------- */
/** Salary agreed from `from` (YYYY-MM-DD) onward. History is append-only so old periods keep the amount that applied then. */
export interface SalaryTerm { from: string; amount: number }
/** Rider pay terms from `from` onward: fixed amount per delivered order plus a % of the delivery charge the customer paid. */
export interface RateTerm { from: string; perDelivery: number; commissionPct: number }

export interface Supplier { id: string; name: string; phone: string; address: string; note: string; active: boolean; createdAt: string; updatedAt: string }
export interface PurchaseItem { productId?: string; /** which size / weight / colour was bought (products with options only) */ variantId?: string; name: string; qty: number; unitCost: number }
export interface Purchase {
  id: string; supplierId: string; supplierName: string; invoiceNo: string; date: string;
  items: PurchaseItem[]; total: number; note: string;
  /** stock from this purchase has been added to inventory (happens at most once) */
  received: boolean; receivedAt?: string;
  createdBy: string; createdAt: string; updatedAt: string;
}
/** salary = one row per employee per month (id = employeeId:period, so it cannot be duplicated). rider_adjustment = signed bonus/deduction/fixed pay for a rider. */
export interface PayrollEntry {
  id: string; kind: "salary" | "rider_adjustment"; subjectId: string; subjectName: string; period: string; date: string;
  base: number; allowances: number; bonus: number; overtime: number; deductions: number; advances: number;
  /** salary: net payable for the period. rider_adjustment: signed amount (+ owed to rider, - deducted). */
  amount: number; reason?: string; note: string;
  createdBy: string; createdAt: string; updatedBy?: string; updatedAt: string; revision: number;
}
export type PaymentKind = "salary" | "rider" | "supplier" | "receivable";
/** Money actually paid out (salary / rider / supplier) or collected (receivable). Never deleted: a mistake is reversed, which keeps the trail. */
export interface FinancePayment {
  id: string; kind: PaymentKind; refId: string; subjectId?: string; amount: number; date: string; method: string; reference: string; note: string;
  createdBy: string; createdAt: string; reversedAt?: string; reversedBy?: string; reverseReason?: string;
}
/** Opening balance of one money account. id = normalized payment method (cash, bkash, bank ...). */
export interface FinanceAccount { id: string; label: string; openingBalance: number; openingDate: string; updatedBy: string; updatedAt: string }


/* ---------- Website theme (additive) ---------- */
export type ThemePresetId = "fresh" | "minimal" | "bold" | "elegant";
export type FontKey = "system" | "humanist" | "rounded" | "serif";
export interface StoreThemeSettings {
  preset?: ThemePresetId;
  /** true = use the colours from Admin → Appearance instead of the preset palette (default: only when the admin already chose a colour there) */
  useCustomColors?: boolean;
  fontHeading?: FontKey; fontBody?: FontKey; baseSize?: "sm" | "md" | "lg";
  radius?: "sharp" | "soft" | "round";
  cardStyle?: "shadow" | "border" | "flat";
  sectionHeader?: "plain" | "underline" | "pill";
  pageBg?: string;
  /** how product rows are laid out on desktop (mobile always scrolls sideways) */
  productLayout?: "scroll" | "grid";
  /** hero / cover sizing. Desktop height in px (recommended 180–240). Mobile height only when set; empty keeps the existing mobile cover. */
  heroDesktopHeight?: number; heroMobileHeight?: number | null; heroFit?: "cover" | "contain";
  /** category ticker */
  catStyle?: "circle" | "square" | "pill";
  catTicker?: boolean; catTickerSpeed?: "slow" | "normal" | "fast";
  /** dedicated offers carousel */
  offersSpeed?: "slow" | "normal" | "fast"; offersLimit?: number;
  /** custom section headings, e.g. { offerProducts: "Today's Deals" } */
  titles?: Partial<Record<HomeSectionId, string>>;
}

/* ---------- Customer Database / CRM (additive; collection `customers`, document id = normalized phone) ---------- */
export type CustomerStatus = "active" | "inactive" | "blocked";
export type CustomerSegment = "new" | "regular" | "vip" | "inactive";
export type CustomerSource = "order" | "manual" | "import";
export interface CustomerFollowUp { id: string; text: string; dueAt?: string; done: boolean; by: string; at: string }
export interface Customer {
  /** equals `phone` (01XXXXXXXXX): this is what makes duplicates impossible */
  id: string; phone: string; name: string;
  whatsapp?: string; email?: string; address?: string; area?: string; notes?: string;
  followUps: CustomerFollowUp[];
  status: CustomerStatus; source: CustomerSource;
  /** admin-chosen segment; empty = computed automatically */
  segmentOverride?: CustomerSegment;
  /** maintained from the customer's orders (cancelled / returned orders are not counted) */
  orderCount: number; totalSpent: number; firstOrderAt?: string; lastOrderAt?: string;
  createdAt: string; updatedAt: string;
}

/* ---------- Integrations (admin-only collection `integrations`; secrets live in environment variables only) ---------- */
export type WaTemplateKind = "orderPlaced" | "adminNewOrder" | "statusUpdate";
export interface WaTemplateRef { name: string; language: string; /** order fields mapped to {{1}}, {{2}} … */ params: string[] }
export interface WhatsAppConfig {
  id: "whatsapp"; enabled: boolean; provider: "meta_cloud"; phoneNumberId: string; businessAccountId?: string; apiVersion: string;
  defaultCountryCode: string; adminNotifyNumber: string;
  notifyAdminOnOrder: boolean; notifyCustomerOnOrder: boolean; notifyCustomerOnStatus: boolean; statusesToNotify: OrderStatus[];
  /** template = business-initiated (needs templates approved by Meta); text = free text, only deliverable inside the 24 h customer-service window */
  messageMode: "template" | "text";
  templates: Record<WaTemplateKind, WaTemplateRef>;
  textTemplates: Record<WaTemplateKind, string>;
  updatedAt?: string; updatedBy?: string;
}
export interface CallingConfig {
  id: "calling"; enabled: boolean;
  /** only "none" is implemented; the others are reserved placeholders for future activation */
  provider: "none" | "twilio" | "exotel" | "custom";
  displayNumber: string; callerId: string; hours: string; note: string;
  updatedAt?: string; updatedBy?: string;
}
export type MessageStatus = "queued" | "skipped" | "accepted" | "sent" | "delivered" | "read" | "failed";
export interface MessageLog {
  id: string; channel: "whatsapp"; kind: WaTemplateKind | "test"; orderId?: string; orderNo?: string;
  to: string; status: MessageStatus; providerMessageId?: string; httpStatus?: number; error?: string; reason?: string;
  createdAt: string; updatedAt: string;
}
