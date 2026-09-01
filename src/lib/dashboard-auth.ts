const DASHBOARD_AUTH_COOKIE_NAME = "adx_dashboard_session";
const DASHBOARD_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const textEncoder = new TextEncoder();

function getDashboardPassword() {
  const value = process.env.DASHBOARD_PASSWORD?.trim();
  return value ? value : null;
}

function getDashboardSessionSecret() {
  const value = process.env.DASHBOARD_SESSION_SECRET?.trim();
  return value ? value : getDashboardPassword();
}

function toBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqual(left: string, right: string) {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);

  let mismatch = leftBytes.length === rightBytes.length ? 0 : 1;
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
}

async function createSignature(payload: string) {
  const secret = getDashboardSessionSecret();
  if (!secret) {
    throw new Error("Dashboard auth is not configured");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return toBase64Url(signature);
}

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const segments = cookieHeader.split(";");
  for (const segment of segments) {
    const separatorIndex = segment.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = segment.slice(0, separatorIndex).trim();
    if (key !== name) {
      continue;
    }

    return decodeURIComponent(segment.slice(separatorIndex + 1));
  }

  return null;
}

export function isDashboardAuthEnabled() {
  return Boolean(getDashboardPassword());
}

export function normalizeDashboardNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export async function isDashboardPasswordValid(input: string) {
  const expectedPassword = getDashboardPassword();
  if (!expectedPassword) {
    return true;
  }

  return timingSafeEqual(input.trim(), expectedPassword);
}

export async function createDashboardSessionToken(now = Date.now()) {
  const expiresAt = now + DASHBOARD_SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `v1.${expiresAt}`;
  const signature = await createSignature(payload);

  return `${payload}.${signature}`;
}

export async function verifyDashboardSessionToken(
  token: string | null | undefined,
  now = Date.now(),
) {
  if (!isDashboardAuthEnabled()) {
    return true;
  }

  if (!token) {
    return false;
  }

  const segments = token.split(".");
  if (segments.length !== 3) {
    return false;
  }

  const [version, expiresRaw, signature] = segments;
  if (version !== "v1" || !expiresRaw || !signature) {
    return false;
  }

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return false;
  }

  const expectedSignature = await createSignature(`${version}.${expiresRaw}`);
  return timingSafeEqual(signature, expectedSignature);
}

export function getDashboardSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DASHBOARD_SESSION_MAX_AGE_SECONDS,
    priority: "high" as const,
  };
}

export async function assertDashboardAuthorized(request: Request) {
  if (!isDashboardAuthEnabled()) {
    return;
  }

  const token = getCookieValue(request.headers.get("cookie"), DASHBOARD_AUTH_COOKIE_NAME);
  const isAuthorized = await verifyDashboardSessionToken(token);

  if (!isAuthorized) {
    throw Object.assign(new Error("Unauthorized dashboard request"), { status: 401 });
  }
}

export {
  DASHBOARD_AUTH_COOKIE_NAME,
  DASHBOARD_SESSION_MAX_AGE_SECONDS,
};