export function assertGoogleAdsScriptAuthorized(request: Request) {
  const expectedToken = process.env.GOOGLE_ADS_SCRIPT_TOKEN?.trim();
  if (!expectedToken) {
    return;
  }

  const providedToken = request.headers.get("x-google-ads-script-token")?.trim();
  if (!providedToken || providedToken !== expectedToken) {
    throw Object.assign(new Error("Unauthorized Google Ads Script request"), { status: 401 });
  }
}
