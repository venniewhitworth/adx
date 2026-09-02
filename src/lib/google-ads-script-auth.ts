function normalizeScriptToken(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function getAuthorizationBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization) {
    return "";
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return normalizeScriptToken(match?.[1]);
}

export function assertGoogleAdsScriptAuthorized(request: Request) {
  const expectedToken = normalizeScriptToken(process.env.GOOGLE_ADS_SCRIPT_TOKEN);
  if (!expectedToken) {
    return;
  }

  const requestUrl = new URL(request.url);
  const providedTokens = [
    normalizeScriptToken(request.headers.get("x-google-ads-script-token")),
    normalizeScriptToken(requestUrl.searchParams.get("scriptToken")),
    getAuthorizationBearerToken(request),
  ].filter(Boolean);

  if (!providedTokens.includes(expectedToken)) {
    throw Object.assign(new Error("Unauthorized Google Ads Script request"), { status: 401 });
  }
}
