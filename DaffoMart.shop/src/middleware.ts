import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_NAME, RIDER_COOKIE, EMPLOYEE_COOKIE, getSecret } from "@/server/authConfig";

async function hasRole(req: NextRequest, cookie: string, role: string) {
  const secret = getSecret(); const token = req.cookies.get(cookie)?.value;
  if (!secret || !token) return false;
  try { return (await jwtVerify(token, secret)).payload.role === role; } catch { return false; }
}
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/rider/register" || pathname === "/employee/register") return NextResponse.next();

  let zone: { base: string; cookie: string; role: string } | null = null;
  if (pathname.startsWith("/rider")) zone = { base: "/rider", cookie: RIDER_COOKIE, role: "rider" };
  else if (pathname.startsWith("/employee")) zone = { base: "/employee", cookie: EMPLOYEE_COOKIE, role: "employee" };
  else if (pathname.startsWith("/admin")) zone = { base: "/admin", cookie: COOKIE_NAME, role: "admin" };
  if (!zone) return NextResponse.next();

  const authed = await hasRole(req, zone.cookie, zone.role);
  const isLogin = pathname === `${zone.base}/login`;
  if (!authed && !isLogin) { const u = req.nextUrl.clone(); u.pathname = `${zone.base}/login`; u.search = ""; return NextResponse.redirect(u); }
  if (authed && isLogin) { const u = req.nextUrl.clone(); u.pathname = zone.base; return NextResponse.redirect(u); }
  return NextResponse.next();
}
export const config = { matcher: ["/admin/:path*", "/rider/:path*", "/employee/:path*"] };
