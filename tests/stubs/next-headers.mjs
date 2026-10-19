// In-memory cookie jar the tests can control: globalThis.__testCookies = { dm_admin: "<token>" }
export async function cookies() {
  const jar = (globalThis.__testCookies ??= {});
  return { get: (n) => (jar[n] ? { value: jar[n] } : undefined), set: (n, v) => { jar[n] = v; }, delete: (n) => { delete jar[n]; } };
}
export async function headers() { return new Headers(); }
