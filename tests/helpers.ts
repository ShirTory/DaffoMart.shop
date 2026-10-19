import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Point the local JSON driver at a throw-away folder. Call BEFORE importing any server module. */
export function isolatedDataDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "daffomart-test-"));
  process.env.DATA_DIR = dir;
  delete process.env.FIREBASE_CLIENT_EMAIL; delete process.env.FIREBASE_PRIVATE_KEY;
  return dir;
}
