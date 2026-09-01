function getForwardedValue(headerValue: string | null) {
  if (!headerValue) {
    return null;
  }

  const firstValue = headerValue.split(",")[0]?.trim();
  return firstValue || null;
}

export function getRequestOrigin(request: Request) {
  const forwardedHost = getForwardedValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = getForwardedValue(request.headers.get("x-forwarded-proto"));

  if (forwardedHost && forwardedProto) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

export function createRedirectUrl(request: Request, path: string) {
  return new URL(path, getRequestOrigin(request));
}