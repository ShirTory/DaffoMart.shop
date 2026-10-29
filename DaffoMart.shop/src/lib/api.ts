export class ApiClientError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string> = {}) { super(message); }
}

export async function api<T = unknown>(url: string, init: Omit<RequestInit, "body"> & { body?: unknown } = {}): Promise<T> {
  const { body, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest, credentials: "same-origin",
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || !json?.ok) {
    if (res.status === 401 && typeof window !== "undefined" && window.location.pathname.startsWith("/admin") && !url.includes("/auth/")) window.location.href = "/admin/login";
    throw new ApiClientError(json?.error ?? `Request failed (${res.status})`, res.status, json?.details && typeof json.details === "object" ? json.details : {});
  }
  return json.data as T;
}

export async function uploadImage(file: File, kind: "product" | "banner" | "category" | "offer" | "general" = "general") {
  const fd = new FormData(); fd.append("file", file); fd.append("kind", kind);
  const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "same-origin" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new ApiClientError(json?.error ?? "Upload failed", res.status);
  return json.data.url as string;
}
