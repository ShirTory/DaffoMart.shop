import { rawDb, newId } from "./db";
import type { Category, DeliveryZone, Product, StoreSettings } from "@/lib/types";

export const defaultSettings: StoreSettings = {
  storeName: "DaffoMart", tagline: "Everyday Essentials, Delivered with Care.",
  phone: "", whatsapp: "", email: "", address: "Dhaka, Bangladesh", facebook: "",
  announcement: "Everyday essentials, delivered with care · Cash on delivery available",
  deliveryInside: 60, deliveryOutside: 120, freeDeliveryOver: 0,
  serviceCharge: 0,
  hours: "Every day, 8:00 AM – 10:00 PM", mapUrl: "", minOrder: 0, logo: "",
  footerText: "",
  heroTitle: "Groceries & medicine,\ndelivered to your door.", heroSubtitle: "Fresh food, daily needs and trusted medicine — order online, pay on delivery.", heroCta: "Shop now",
  features: [
    { icon: "truck", title: "Fast delivery", text: "Same-day in Dhaka" },
    { icon: "leaf", title: "Always fresh", text: "Quality checked" },
    { icon: "cash", title: "Cash on delivery", text: "Pay when you receive" },
    { icon: "tag", title: "Best prices", text: "Daily offers" },
  ],
  positions: [
    { id: "rider", title: "Delivery Rider", kind: "rider", description: "Deliver orders in your area. Own bike or bicycle preferred.", active: true },
    { id: "support", title: "Customer Support", kind: "staff", description: "Help customers by phone, WhatsApp and Facebook.", active: true },
    { id: "warehouse", title: "Warehouse / Packer", kind: "staff", description: "Pack and prepare orders for delivery.", active: true },
    { id: "operations", title: "Operations", kind: "staff", description: "Manage orders, stock and daily operations.", active: true },
    { id: "marketing", title: "Marketing", kind: "staff", description: "Social media, offers and promotions.", active: true },
  ],
  joinTitle: "Join our team", joinIntro: "Choose the position you want to apply for. Our team will review your application and contact you.",
  payCod: true, payBkash: false, bkashNumber: "", payNagad: false, nagadNumber: "", payOnline: true,
  payInstructions: "Send the total amount using “Send Money”, then enter the Transaction ID (TrxID) at checkout. We confirm your order after verifying the payment.",
  showMedicine: true, medicineTitle: "Medicine & Healthcare", medicineSubtitle: "Trusted medicines and health products, delivered fast.",
  emptyStateTitle: "No products found",
  emptyStateText: "Try a different search or category. Fresh stock arrives daily.",
  emptyStateIcon: "🔍",
  returnPolicy: "Unopened items can be returned within 24 hours of delivery with proof of purchase. Perishable goods may not be eligible. Contact support for assistance.",
  exchangePolicy: "Damaged or wrong items can be exchanged within 24 hours. Please keep the original packaging and invoice.",
  primaryColor: "#1E3A8A",
  accentColor: "#F7941D",
  secondaryColor: "",
  buttonRadius: "lg",
  buttonSize: "md",
  supportCallLabel: "Call Now",
  supportWaLabel: "WhatsApp",
  showSupportCall: true,
  showSupportWa: true,
  metaPixelId: "",
  invoiceFooter: "Thank you for shopping with DaffoMart.",
  courierOutsideNote: "Outside Dhaka: delivery via courier partners. Timing may vary by location.",
  medicineNotice: "Prescription (Rx) medicines are delivered only after our pharmacist confirms your prescription by phone.",
  appPromptEnabled: true,
  appPromptTitle: "Install DaffoMart App",
  appPromptText: "Add DaffoMart to your home screen for faster shopping, order tracking and exclusive offers.",
  appPromptBtnLabel: "Add to Home Screen",
  appPromptDismissLabel: "Not now",
  appPromptDelayMs: 2500,
  appPromptHideDays: 7,
};

const now = () => new Date().toISOString();

async function seedZones(s: StoreSettings) {
  const z: DeliveryZone[] = [
    { id: "inside", name: "Inside Dhaka", charge: s.deliveryInside ?? 60, freeOver: s.freeDeliveryOver ?? 0, eta: "Same day", active: true, sortOrder: 1 },
    { id: "outside", name: "Outside Dhaka", charge: s.deliveryOutside ?? 120, freeOver: 0, eta: "1–3 days", active: true, sortOrder: 2, viaCourier: true },
  ];
  for (const x of z) await rawDb.put("zones", x.id, x);
}

async function seedMedicine() {
  const cats: [string, string, string][] = [["med-otc", "Medicine (OTC)", "💊"], ["med-health", "Healthcare", "🩺"]];
  for (const [i, [id, name, emoji]] of cats.entries()) {
    const c: Category = { id, name, slug: id, emoji, kind: "medicine", active: true, sortOrder: 50 + i };
    await rawDb.put("categories", id, c);
  }
  // name, generic, maker, price, unit, emoji, category, stock, rx
  const M: [string, string, string, number, string, string, string, number, boolean][] = [
    ["Napa 500mg", "Paracetamol", "Beximco Pharma", 12, "10 tablets", "💊", "med-otc", 200, false],
    ["Saline Oral (ORS)", "Oral rehydration salt", "Radiant Pharma", 5, "1 sachet", "🧂", "med-otc", 300, false],
    ["Antiseptic Liquid", "Antiseptic", "ACI", 120, "100 ml", "🧴", "med-health", 60, false],
    ["Vitamin C 500mg", "Ascorbic acid", "Square", 150, "30 tablets", "🍊", "med-health", 80, false],
    ["Digital Thermometer", "", "", 250, "1 pc", "🌡️", "med-health", 40, false],
    ["Amoxicillin 500mg", "Amoxicillin", "Square", 90, "10 capsules", "💊", "med-otc", 100, true],
  ];
  for (const [name, genericName, manufacturer, price, unit, emoji, categoryId, stock, rx] of M) {
    const id = newId();
    const p: Product = { id, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + id.slice(0, 4), name, description: `${name} — genuine medicine/health product. Please read the label and use as directed.`, price, unit, emoji, images: [], categoryId, stock, rating: 0, sold: 0, featured: false, active: true, prescriptionRequired: rx, ...(genericName ? { genericName } : {}), ...(manufacturer ? { manufacturer } : {}), createdAt: now(), updatedAt: now() };
    await rawDb.put("products", id, p);
  }
}

export async function seedIfEmpty() {
  const st = (await rawDb.get("settings", "store")) as (StoreSettings & { zonesSeeded?: boolean; medicineSeeded?: boolean }) | null;
  if (st) { // existing store: add the newer features once
    let next = st; let changed = false;
    if (!st.zonesSeeded) { await seedZones({ ...defaultSettings, ...st }); next = { ...next, zonesSeeded: true }; changed = true; }
    if (!st.medicineSeeded) { await seedMedicine(); next = { ...next, medicineSeeded: true }; changed = true; }
    if (changed) await rawDb.put("settings", "store", next);
    return;
  }
  const cats: [string, string, string][] = [["veg", "Vegetables", "🥦"], ["fruit", "Fruits", "🍎"], ["meat", "Fish & Meat", "🐟"], ["dairy", "Dairy & Eggs", "🥛"], ["grocery", "Groceries", "🍚"], ["snacks", "Snacks", "🍪"]];
  for (const [i, [id, name, emoji]] of cats.entries()) {
    const c: Category = { id, name, slug: id, emoji, kind: "grocery", active: true, sortOrder: i };
    await rawDb.put("categories", id, c);
  }
  const P: [string, string, number, number | undefined, string, string, string, number, number, number, boolean][] = [
    ["fresh-tomato", "Fresh Tomato", 80, 100, "1 kg", "🍅", "veg", 50, 4.5, 320, true],
    ["potato", "Potato", 45, undefined, "1 kg", "🥔", "veg", 120, 4.3, 540, false],
    ["apple", "Apple", 280, 320, "1 kg", "🍎", "fruit", 30, 4.7, 210, true],
    ["banana", "Banana", 70, undefined, "1 dozen", "🍌", "fruit", 60, 4.4, 400, false],
    ["rohu-fish", "Rohu Fish", 420, undefined, "1 kg", "🐟", "meat", 15, 4.6, 150, true],
    ["fresh-milk", "Fresh Liquid Milk", 90, undefined, "1 L", "🥛", "dairy", 80, 4.8, 610, true],
    ["eggs", "Farm Eggs", 150, 165, "12 pcs", "🥚", "dairy", 0, 4.5, 480, false],
    ["miniket-rice", "Miniket Rice", 78, undefined, "1 kg", "🍚", "grocery", 200, 4.6, 900, false],
  ];
  for (const [slug, name, price, oldPrice, unit, emoji, categoryId, stock, rating, sold, featured] of P) {
    const id = newId();
    const p: Product = { id, slug, name, description: `Fresh, quality-checked ${name.toLowerCase()} delivered to your door.`, price, ...(oldPrice ? { oldPrice } : {}), unit, emoji, images: [], categoryId, stock, rating, sold, featured, active: true, createdAt: now(), updatedAt: now() };
    await rawDb.put("products", id, p);
  }
  await seedZones(defaultSettings);
  await seedMedicine();
  await rawDb.put("settings", "store", { ...defaultSettings, id: "store", zonesSeeded: true, medicineSeeded: true });
}
