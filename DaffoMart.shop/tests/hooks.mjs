// Resolves the project's "@/..." alias and extension-less TypeScript imports, and swaps framework packages that are
// irrelevant to business-logic tests (Next.js runtime, zod, jose) for tiny stubs in tests/stubs.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stubs = {
  "next/cache": "next-cache.mjs",
  "next/headers": "next-headers.mjs",
  "next/server": "next-server.mjs",
  zod: "zod.mjs",
  jose: "jose.mjs",
  sharp: "sharp.mjs",
};

function tryFile(base) {
  for (const c of [base, base + ".ts", base + ".tsx", path.join(base, "index.ts")]) {
    if (existsSync(c) && statSync(c).isFile()) return pathToFileURL(c).href;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (stubs[specifier]) return { url: pathToFileURL(path.join(root, "tests/stubs", stubs[specifier])).href, shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const hit = tryFile(path.join(root, "src", specifier.slice(2)));
    if (hit) return { url: hit, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const hit = tryFile(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (hit) return { url: hit, shortCircuit: true };
  }
  return next(specifier, context);
}
