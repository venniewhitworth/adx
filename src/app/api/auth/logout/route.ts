import { NextResponse } from "next/server";

import {
  DASHBOARD_AUTH_COOKIE_NAME,
  getDashboardSessionCookieOptions,
  normalizeDashboardNextPath,
} from "@/lib/dashboard-auth";
import { createRedirectUrl } from "@/lib/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clearDashboardSession(nextPath: string, request: Request) {
  const response = NextResponse.redirect(createRedirectUrl(request, nextPath), 303);
  response.cookies.set({
    name: DASHBOARD_AUTH_COOKIE_NAME,
    value: "",
    ...getDashboardSessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return clearDashboardSession(
    normalizeDashboardNextPath(searchParams.get("next") ?? "/login"),
    request,
  );
}

export async function POST(request: Request) {
  return clearDashboardSession("/login", request);
}