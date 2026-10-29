export class ZodError extends Error { constructor(issues = []) { super("zod"); this.issues = issues; } }
// Chainable no-op schema builder: lets modules that declare zod schemas at import time load in tests.
// Validation itself is NOT exercised by these tests (parse() returns its input unchanged).
const chain = () => new Proxy(function () {}, {
  get: (_t, k) => (k === "parse" ? (v) => v : k === "then" || typeof k === "symbol" ? undefined : chain()),
  apply: () => chain(),
});
export const z = chain();
