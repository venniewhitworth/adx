import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  DASHBOARD_AUTH_COOKIE_NAME,
  isDashboardAuthEnabled,
  normalizeDashboardNextPath,
  verifyDashboardSessionToken,
} from "@/lib/dashboard-auth";

const proxyBypassPaths = new Set([
  "/api/links/refresh-due",
  "/api/google-ads/pending",
  "/api/google-ads/report",
]);

function buildNextPath(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  return normalizeDashboardNextPath(`${pathname}${search}`);
}

function shouldBypassDashboardAuth(pathname: string) {
  return proxyBypassPaths.has(pathname);
}

export async function proxy(request: NextRequest) {
  if (!isDashboardAuthEnabled() || shouldBypassDashboardAuth(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(DASHBOARD_AUTH_COOKIE_NAME)?.value;
  const isAuthorized = await verifyDashboardSessionToken(token);
  if (isAuthorized) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  const nextPath = buildNextPath(request);
  if (nextPath !== "/dashboard") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/stats", "/api/links/:path*"],
};