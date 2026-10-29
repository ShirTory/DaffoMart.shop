// NOT real cryptography: tokens are base64 JSON. The suite tests *authorization decisions* made after a token is
// accepted; token signing/verification itself is the `jose` library's job.
export class SignJWT {
  constructor(p) { this.p = { ...p }; }
  setProtectedHeader() { return this; }
  setSubject(s) { this.p.sub = s; return this; }
  setIssuedAt() { this.p.iat = Math.floor(Date.now() / 1000); return this; } // like real jose
  setExpirationTime() { return this; }
  async sign() { return Buffer.from(JSON.stringify(this.p)).toString("base64"); }
}
export async function jwtVerify(token) {
  try { return { payload: JSON.parse(Buffer.from(token, "base64").toString("utf8")) }; } catch { throw new Error("bad token"); }
}
