/** Pure quantity rules for product cards (kept separate so they can be unit-tested). */

/** How many more units can still be added: stock minus what is already in the cart. */
export const remainingStock = (stock: number, inCart: number) => Math.max(0, Math.floor(Number(stock) || 0) - Math.max(0, inCart));

/** Selected quantity: never below 1, never above what is still available; 0 when nothing can be added. */
export const clampQty = (want: number, remaining: number) => (remaining <= 0 ? 0 : Math.min(Math.max(1, Math.floor(Number(want)) || 1), remaining));

/** A cart line is a product AND (when it has variants) the chosen variant: M/Red and L/Red are separate lines. */
export const lineKey = (i: { id: string; vid?: string }) => (i.vid ? `${i.id}~${i.vid}` : i.id);
