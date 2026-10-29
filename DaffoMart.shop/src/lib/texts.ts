/**
 * Every piece of storefront wording the admin can change (Admin → Website Text).
 * `def` is what the site shows until the admin types something else. Empty field in the admin = back to default.
 */
export interface TextDef { key: string; group: string; label: string; def: string; long?: boolean }
const T = (key: string, group: string, label: string, def: string, long = false): TextDef => ({ key, group, label, def, long });

export const TEXT_DEFS: TextDef[] = [
  T("header.search", "Header & menu", "Search box (desktop)", "Search groceries, medicine, vegetables…"),
  T("header.searchMobile", "Header & menu", "Search box (mobile)", "Search products…"),
  T("header.medicine", "Header & menu", "Medicine button", "Medicine"),
  T("header.orders", "Header & menu", "My orders link", "My orders"),
  T("header.track", "Header & menu", "Track order link", "Track order"),
  T("header.contact", "Header & menu", "Contact link", "Contact"),
  T("header.cart", "Header & menu", "Cart button", "Cart"),
  T("header.all", "Header & menu", "“All” category chip", "All"),
  T("header.offers", "Header & menu", "“Offers” category chip", "Offers"),
  T("nav.home", "Mobile bottom bar", "Home", "Home"),
  T("nav.wishlist", "Mobile bottom bar", "Wishlist", "Wishlist"),
  T("nav.cart", "Mobile bottom bar", "Cart", "Cart"),
  T("nav.orders", "Mobile bottom bar", "Orders", "Orders"),

  T("home.categories", "Home page", "Category section title", "Shop by category"),
  T("home.deals", "Home page", "Image offers title", "Special deals"),
  T("home.hot", "Home page", "Discount products title", "Hot deals"),
  T("home.featured", "Home page", "Featured products title", "Recommended for you"),
  T("home.trending", "Home page", "Best sellers title", "Hot & trending"),
  T("home.new", "Home page", "New arrivals title", "New arrivals"),
  T("home.viewAll", "Home page", "“View all” link", "View all →"),
  T("home.soon", "Home page", "Shown when the shop has no products", "Products are coming soon."),

  T("card.add", "Product card & buttons", "Add to cart button", "+ Add to bag"),
  T("card.added", "Product card & buttons", "After adding", "Added ✓"),
  T("card.out", "Product card & buttons", "Out of stock", "Out of stock"),
  T("card.buyNow", "Product card & buttons", "Buy now button", "Buy now"),
  T("card.whatsapp", "Product card & buttons", "Order on WhatsApp button", "WhatsApp"),
  T("card.delivery", "Product card & buttons", "Small delivery note on cards", "Delivery 1–2 hours"),
  T("card.off", "Product card & buttons", "Discount badge suffix", "OFF"),

  T("products.all", "Products & categories page", "Page title (all products)", "All Products"),
  T("products.sale", "Products & categories page", "Page title (offers)", "Offers & Discounts"),
  T("products.featured", "Products & categories page", "Page title (featured)", "Featured Products"),
  T("products.categories", "Products & categories page", "Filter: Categories", "Categories"),
  T("products.price", "Products & categories page", "Filter: Max price", "Max price"),
  T("products.sort", "Products & categories page", "Filter: Sort by", "Sort by"),
  T("products.filters", "Products & categories page", "Filters button (mobile)", "Filters"),
  T("products.showResults", "Products & categories page", "Filters: apply button (mobile)", "Show results"),
  T("products.clear", "Products & categories page", "Clear filters button", "Clear filters"),
  T("products.categoryLabel", "Products & categories page", "Small label above category title", "Category"),

  T("empty.none.title", "Empty states", "No products at all – title", "No products available right now"),
  T("empty.none.text", "Empty states", "No products at all – message", "Fresh stock arrives daily. Please check back soon.", true),
  T("empty.search.title", "Empty states", "No search / filter results – title", "No products found"),
  T("empty.search.text", "Empty states", "No search / filter results – message", "Try a different search or filter.", true),
  T("empty.category.title", "Empty states", "Empty category – title", "This category is empty for now"),
  T("empty.category.text", "Empty states", "Empty category – message", "New products are added regularly. Browse other categories meanwhile.", true),

  T("cart.title", "Cart & checkout", "Cart page title", "Shopping cart"),
  T("cart.checkout", "Cart & checkout", "Proceed to checkout button", "Proceed to checkout"),
  T("checkout.details", "Cart & checkout", "Checkout: delivery heading", "Delivery details"),
  T("checkout.summary", "Cart & checkout", "Checkout: order summary heading", "Order summary"),
  T("checkout.place", "Cart & checkout", "Place order button", "Place order"),
  T("checkout.placing", "Cart & checkout", "Place order button (working)", "Placing order…"),
  T("checkout.thanks", "Cart & checkout", "Order placed heading", "Thank you! Order placed."),
  T("checkout.thanksText", "Cart & checkout", "Order placed message", "We will call you shortly to confirm your order. Please keep the order number to track your delivery.", true),
  T("checkout.trackBtn", "Cart & checkout", "Track order button", "Track order"),
  T("checkout.invoiceBtn", "Cart & checkout", "Invoice button", "View invoice"),
  T("checkout.continue", "Cart & checkout", "Continue shopping button", "Continue shopping"),

  T("track.title", "Order tracking", "Page title", "Track your order"),
  T("track.hint", "Order tracking", "Page hint", "Enter the order number and the mobile number you used at checkout.", true),
  T("track.button", "Order tracking", "Track button", "Track"),
  T("track.pay", "Order tracking", "Pay now button", "💳 Pay now"),
  T("track.cancel", "Order tracking", "Cancel order button", "Cancel order"),
  T("track.invoice", "Order tracking", "Download invoice button", "🧾 Invoice"),
  T("track.reorder", "Order tracking", "Reorder button", "Reorder items"),

  T("footer.shop", "Footer", "Column: Shop", "Shop"),
  T("footer.help", "Footer", "Column: Help", "Help"),
  T("footer.contact", "Footer", "Column: Contact", "Contact"),
  T("footer.all", "Footer", "Link: all products", "All products"),
  T("footer.track", "Footer", "Link: track", "Track your order"),
  T("footer.contactInfo", "Footer", "Link: contact page", "Contact & delivery info"),
  T("footer.policy", "Footer", "Link: return & exchange", "Return & Exchange"),
  T("footer.cart", "Footer", "Link: cart", "My cart"),
  T("footer.checkout", "Footer", "Link: checkout", "Checkout"),
  T("footer.rights", "Footer", "Copyright line", "All rights reserved."),

  T("policy.title", "Return & exchange page", "Page title", "Return & Exchange Policy"),
  T("policy.returns", "Return & exchange page", "Returns heading", "Returns"),
  T("policy.exchanges", "Return & exchange page", "Exchanges heading", "Exchanges"),
  T("policy.help", "Return & exchange page", "Help line", "Need help?"),
];

export const TEXT_DEFAULTS: Record<string, string> = Object.fromEntries(TEXT_DEFS.map((d) => [d.key, d.def]));
export type TextFn = (key: string) => string;
/** Builds the translator used everywhere on the storefront. */
export const makeT = (texts?: Record<string, string> | null): TextFn => (key) => {
  const v = texts?.[key];
  return typeof v === "string" && v.trim() ? v : TEXT_DEFAULTS[key] ?? key;
};
