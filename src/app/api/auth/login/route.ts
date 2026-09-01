import { NextResponse } from "next/server";

import {
  DASHBOARD_AUTH_COOKIE_NAME,
  createDashboardSessionToken,
  getDashboardSessionCookieOptions,
  isDashboardAuthEnabled,
  isDashboardPasswordValid,
  normalizeDashboardNextPath,
} from "@/lib/dashboard-auth";
import { createRedirectUrl } from "@/lib/request-origin";

function getFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();
  const nextPath = normalizeDashboardNextPath(getFormValue(formData.get("next")));

  if (!isDashboardAuthEnabled()) {
    return NextResponse.redirect(createRedirectUrl(request, nextPath), 303);
  }

  const password = getFormValue(formData.get("password"));
  const isValidPassword = await isDashboardPasswordValid(password);

  if (!isValidPassword) {
    const loginUrl = createRedirectUrl(request, "/login");
    loginUrl.searchParams.set("error", "1");
    if (nextPath !== "/dashboard") {
      loginUrl.searchParams.set("next", nextPath);
    }

    return NextResponse.redirect(loginUrl, 303);
  }

  const response = NextResponse.redirect(createRedirectUrl(request, nextPath), 303);
  response.cookies.set({
    name: DASHBOARD_AUTH_COOKIE_NAME,
    value: await createDashboardSessionToken(),
    ...getDashboardSessionCookieOptions(),
  });

  return response;
}