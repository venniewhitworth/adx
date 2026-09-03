import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, request, type APIResponse, type Browser, type Page } from "playwright";
import {
  defaultRefreshFinalUrlInterval,
  refreshFinalUrlIntervalOptions,
} from "@/lib/final-url-refresh";
import {
  normalizeGoogleAdsCustomerId,
  toGoogleAdsSuffix,
} from "@/lib/google-ads";
import type {
  AdLink,
  AdLinkCreate,
  GoogleAdsPendingSyncFilters,
  GoogleAdsPendingSyncItem,
  GoogleAdsSyncReport,
  AdLinkUpdate,
  AutoSwapTarget,
  LinkFilters,
  RefreshDueLinksResult,
  RefreshFinalUrlIntervalHours,
  ResolveResult,
  ResolveStatus,
  Stats,
  SyncStatus,
} from "@/types/ad-link";

interface LinkStoreFile {
  nextId: number;
  links: AdLink[];
}

function resolveDataDir() {
  const configuredDir = process.env.LINK_STORE_DATA_DIR?.trim();
  if (configuredDir) {
    return path.resolve(configuredDir);
  }

  const railwayVolumeMountPath = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (railwayVolumeMountPath) {
    return path.resolve(railwayVolumeMountPath);
  }

  // Writing under the project directory during `next dev` triggers hot reload loops
  // when the background worker updates `links.json`, so default to the OS temp dir
  // unless the user explicitly configures a persistent path.
  return path.join(tmpdir(), "adx-kit-data");
}

const dataDir = resolveDataDir();
const dataFile = path.join(dataDir, "links.json");
const defaultStore: LinkStoreFile = { nextId: 1, links: [] };
const maxRefreshDueGraceMs = 60 * 1000;
const defaultProxyProviderName = "IPRoyal Residential (US California Streaming)";
const defaultRefererUrl = "https://www.facebook.com/";
const refreshIntervalHoursSet = new Set<number>(
  refreshFinalUrlIntervalOptions.map((option) => option.value),
);
const defaultRequestHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Upgrade-Insecure-Requests": "1",
};

const refererPresetMap: Record<string, string> = {
  facebook: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
  linkedin: "https://www.linkedin.com/",
  pinterest: "https://www.pinterest.com/",
  reddit: "https://www.reddit.com/",
  snapchat: "https://www.snapchat.com/",
  tiktok: "https://www.tiktok.com/",
  twitter: "https://x.com/",
  whatsapp: "https://www.whatsapp.com/",
  youtube: "https://www.youtube.com/",
  google: "https://www.google.com/",
};

interface ProxyConnection {
  protocol: "http" | "https" | "socks5";
  server: string;
  username?: string;
  password?: string;
}

interface ExitGeoInfo {
  resolvedIp: string | null;
  resolvedCountryCode: string | null;
  resolvedCountryName: string | null;
}

const KOOKEEY_RESOLVE_MAX_ATTEMPTS = 3;
const IPROYAL_RESOLVE_MAX_ATTEMPTS = 3;
const IPROYAL_SESSION_ID_LENGTH = 8;
const IPROYAL_DEFAULT_SESSION_LIFETIME = "10m";

let mutationQueue = Promise.resolve<void>(undefined);

function ensurePlaywrightBrowserPath() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH?.trim()) {
    return;
  }

  if (process.env.NODE_ENV === "production") {
    process.env.PLAYWRIGHT_BROWSERS_PATH = "/ms-playwright";
  }
}

function buildError(detail: string, status = 400) {
  return Object.assign(new Error(detail), { status });
}

function buildDefaultProxyRequestHeaders(refererUrl?: string | null) {
  return {
    ...defaultRequestHeaders,
    ...(refererUrl ? { Referer: refererUrl } : {}),
  };
}

function getResponseLocation(response: APIResponse) {
  const headers = response.headers();
  return headers.location || headers.Location || null;
}

function resolveRedirectLocation(location: string, baseUrl: string) {
  try {
    return new URL(location, baseUrl).href;
  } catch {
    return null;
  }
}

function toResolverErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Executable doesn't exist")) {
    return "Server is missing the Playwright Chromium runtime. Redeploy Railway with the Docker image so the browser is installed in production.";
  }

  return message;
}

function isRetryableKookeeyError(error: unknown) {
  const message = toResolverErrorMessage(error);

  return [
    "ERR_PROXY_CONNECTION_FAILED",
    "ERR_TUNNEL_CONNECTION_FAILED",
    "ERR_CONNECTION_CLOSED",
    "ERR_CONNECTION_RESET",
    "ERR_CONNECTION_REFUSED",
    "ERR_TIMED_OUT",
    "ERR_NETWORK_CHANGED",
    "Browser navigation through Kookeey proxy failed",
    "Kookeey API returned",
    "Kookeey did not return any proxy connection info",
    "fetch failed",
    "timed out",
    "Timeout",
    "socket hang up",
    "ECONNRESET",
    "ETIMEDOUT",
  ].some((keyword) => message.includes(keyword));
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeCountryCode(value?: string | null) {
  const trimmed = value?.trim().toUpperCase();
  if (!trimmed) return null;
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
}

const browserGeoProfiles: Record<string, { locale: string; timezoneId: string }> = {
  US: { locale: "en-US", timezoneId: "America/Los_Angeles" },
  CA: { locale: "en-CA", timezoneId: "America/Toronto" },
  GB: { locale: "en-GB", timezoneId: "Europe/London" },
  DE: { locale: "de-DE", timezoneId: "Europe/Berlin" },
  FR: { locale: "fr-FR", timezoneId: "Europe/Paris" },
  IT: { locale: "it-IT", timezoneId: "Europe/Rome" },
  PL: { locale: "pl-PL", timezoneId: "Europe/Warsaw" },
  UA: { locale: "uk-UA", timezoneId: "Europe/Kyiv" },
  HK: { locale: "zh-HK", timezoneId: "Asia/Hong_Kong" },
  AU: { locale: "en-AU", timezoneId: "Australia/Sydney" },
  JP: { locale: "ja-JP", timezoneId: "Asia/Tokyo" },
  SG: { locale: "en-SG", timezoneId: "Asia/Singapore" },
  BR: { locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
};

function getBrowserGeoProfile(countryCode?: string | null) {
  const normalized = normalizeCountryCode(countryCode);
  return (
    (normalized ? browserGeoProfiles[normalized] : null) ?? {
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
    }
  );
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function normalizeAutoSwapTargets(value: unknown): AutoSwapTarget[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (typeof item !== "object" || item === null) return null;
      const target = item as Partial<AutoSwapTarget>;
      const targetUrl = target.target_url?.trim();
      if (!targetUrl) return null;

      return {
        label: target.label?.trim() || `链接 ${index + 1}`,
        target_url: targetUrl,
        is_active: target.is_active ?? true,
      };
    })
    .filter((item): item is AutoSwapTarget => item !== null);
}

function parseBooleanParam(value: string | null) {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw buildError("is_active 参数必须为 true 或 false");
}

function parseNumberOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parsePositiveIntegerOrNull(value: unknown) {
  const number = parseNumberOrNull(value);
  if (number === null) return null;
  return Number.isInteger(number) && number > 0 ? number : null;
}

function parseRefreshIntervalHours(
  value: unknown,
): RefreshFinalUrlIntervalHours | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const rawNumber = Number(value);
  const number =
    rawNumber === 2
      ? 120
      : rawNumber === 6
        ? 360
        : rawNumber === 16
          ? 960
          : rawNumber === 24
            ? 1440
            : rawNumber === 48
              ? 2880
              : rawNumber;
  if (!refreshIntervalHoursSet.has(number)) {
    throw buildError(
      "Refresh interval must be one of: 0.5, 1, 10, 30, 60, 120, 360, 720, 1440, 2880 minutes",
    );
  }

  return number as RefreshFinalUrlIntervalHours;
}

function normalizeGoogleAdsId(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "link";
}

function buildUniqueSlug(preferredSlug: string | null, name: string, links: AdLink[], nextId: number) {
  const existing = new Set(links.map((link) => link.slug.toLowerCase()));
  const base = (preferredSlug || slugify(name) || `link-${nextId}`).slice(0, 48);
  let candidate = base || `link-${nextId}`;
  let suffix = 2;

  while (existing.has(candidate.toLowerCase())) {
    const nextSuffix = `-${suffix}`;
    const trimmedBase = base.slice(0, Math.max(1, 48 - nextSuffix.length));
    candidate = `${trimmedBase}${nextSuffix}`;
    suffix += 1;
  }

  return candidate;
}

function assertValidUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw buildError("链接必须是有效的 http(s) 地址");
  }
}

function toComparableHostname(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const hostname = new URL(candidate).hostname.trim().toLowerCase().replace(/\.$/, "");
    return hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function normalizeOfficialUrl(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertValidOfficialUrl(value: string) {
  if (!toComparableHostname(value)) {
    throw buildError("官网地址/域名必须是有效域名或 http(s) 地址");
  }
}

function normalizeRefererUrl(
  refererUrl?: string | null,
  refererSources?: string[] | null,
) {
  const trimmed = refererUrl?.trim();
  if (trimmed) {
    assertValidUrl(trimmed);
    return trimmed;
  }

  const firstSource = refererSources?.find((value) => value.trim())?.trim().toLowerCase();
  if (!firstSource) {
    return defaultRefererUrl;
  }

  return refererPresetMap[firstSource] ?? defaultRefererUrl;
}

function assertDailyClicksRange(min: number | null, max: number | null) {
  if (min !== null && (!Number.isInteger(min) || min < 0)) {
    throw buildError("每天补点击最小值必须是大于等于 0 的整数");
  }
  if (max !== null && (!Number.isInteger(max) || max < 0)) {
    throw buildError("每天补点击最大值必须是大于等于 0 的整数");
  }
  if (min !== null && max !== null && min > max) {
    throw buildError("每天补点击最小值不能大于最大值");
  }
}

function assertSchedule(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt) return;
  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) {
    throw buildError("持续时间范围无效，请检查开始和结束日期");
  }
}

function createEmptyExitGeoInfo(): ExitGeoInfo {
  return {
    resolvedIp: null,
    resolvedCountryCode: null,
    resolvedCountryName: null,
  };
}

function splitFinalUrl(finalUrl: string, exitGeoInfo?: Partial<ExitGeoInfo>): ResolveResult {
  const url = new URL(finalUrl);
  const finalUrlBase = `${url.origin}${url.pathname}`;
  const finalUrlQuery = url.search ? url.search : null;
  const resolvedIp = normalizeOptionalText(exitGeoInfo?.resolvedIp);
  const resolvedCountryCode = normalizeCountryCode(exitGeoInfo?.resolvedCountryCode);
  const resolvedCountryName = normalizeOptionalText(exitGeoInfo?.resolvedCountryName);

  return {
    finalUrl,
    finalUrlBase,
    finalUrlQuery,
    resolvedIp,
    resolvedCountryCode,
    resolvedCountryName,
  };
}

function hostnameMatchesOrIsSubdomain(hostname: string, expected: string) {
  return hostname === expected || hostname.endsWith(`.${expected}`);
}

function normalizeUrlForContainment(value: string) {
  return value.trim().toLowerCase().replace(/\/+$/, "");
}

function doesResolvedUrlMatchOfficialUrl(resolvedUrl: string, officialUrl: string) {
  const resolvedHostname = toComparableHostname(resolvedUrl);
  const officialHostname = toComparableHostname(officialUrl);

  if (!resolvedHostname || !officialHostname) {
    return false;
  }

  return (
    hostnameMatchesOrIsSubdomain(resolvedHostname, officialHostname) ||
    hostnameMatchesOrIsSubdomain(officialHostname, resolvedHostname)
  );
}

const knownAffiliateTrackingDomains = [
  "linkhaitao.com",
  "fatcoupon.com",
  "partner.fatcoupon.com",
  "redirect.partner.fatcoupon.com",
  "afflat3a2.com",
  "trkta.com",
  "engagevantage.com",
];

function isKnownAffiliateTrackingHostname(hostname: string) {
  const normalizedHostname = hostname.toLowerCase();

  return knownAffiliateTrackingDomains.some((domain) =>
    hostnameMatchesOrIsSubdomain(normalizedHostname, domain),
  );
}

function isKnownAffiliateTrackingUrl(rawUrl: string) {
  try {
    return isKnownAffiliateTrackingHostname(new URL(rawUrl).hostname);
  } catch {
    return false;
  }
}

function isAffiliateTrackingUrl(finalUrl: string, trackingUrl: string) {
  try {
    const final = new URL(finalUrl);
    const tracking = new URL(trackingUrl);
    const finalHostname = final.hostname.toLowerCase();
    const trackingHostname = tracking.hostname.toLowerCase();

    if (hostnameMatchesOrIsSubdomain(finalHostname, trackingHostname)) {
      return true;
    }

    return knownAffiliateTrackingDomains.some((domain) =>
      hostnameMatchesOrIsSubdomain(finalHostname, domain),
    );
  } catch {
    return finalUrl === trackingUrl;
  }
}

function extractHtmlRedirectUrl(html: string, baseUrl: string): string | null {
  // 1. <meta http-equiv="refresh" content="0;url=...">
  const metaMatch =
    html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*http-equiv=["']refresh["'][^>]*>/i);
  if (metaMatch) {
    const urlMatch = metaMatch[1].match(/url=([^"';>\s]+)/i);
    if (urlMatch) {
      try {
        return new URL(urlMatch[1], baseUrl).href;
      } catch {
        /* ignore invalid URL */
      }
    }
  }

  // 2. JS redirect patterns
  const jsPatterns = [
    /location\.replace\((["'])([^"']+)\1\)/i,
    /location\.href\s*=\s*(["'])([^"']+)\2/i,
    /window\.location\s*=\s*(["'])([^"']+)\1/i,
    /window\.location\.replace\((["'])([^"']+)\1\)/i,
    /location\.assign\((["'])([^"']+)\1\)/i,
    /window\.location\.assign\((["'])([^"']+)\1\)/i,
  ];
  for (const pattern of jsPatterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        return new URL(match[2], baseUrl).href;
      } catch {
        /* ignore invalid URL */
      }
    }
  }

  return null;
}

function normalizeBrowserUrl(value?: string | null) {
  if (!value || value === "about:blank" || value.startsWith("chrome-error://")) {
    return null;
  }

  return value;
}

function preserveLandingQuery(landingUrl: string, settledUrl: string, officialUrl?: string | null) {
  if (!landingUrl || !settledUrl || landingUrl === settledUrl) {
    return settledUrl || landingUrl;
  }

  try {
    const landing = new URL(landingUrl);
    const settled = new URL(settledUrl);

    if (landing.origin === settled.origin && landing.search && !settled.search) {
      if (!officialUrl || doesResolvedUrlMatchOfficialUrl(landingUrl, officialUrl)) {
        return landingUrl;
      }

      return settledUrl;
    }
  } catch {
    /* ignore invalid URLs */
  }

  return settledUrl;
}

function alignResolvedUrlToOfficialUrl(resolvedUrl: string, officialUrl?: string | null) {
  if (!officialUrl) {
    return resolvedUrl;
  }

  try {
    const resolved = new URL(resolvedUrl);
    const official = new URL(officialUrl);

    if (
      resolved.protocol === "http:" &&
      official.protocol === "https:" &&
      landingDomainMatchesOfficialUrl(resolved.href, official.href)
    ) {
      resolved.protocol = "https:";
      return resolved.toString();
    }
  } catch {
    /* ignore invalid URLs */
  }

  return resolvedUrl;
}

function scoreOfficialUrlCandidate(rawUrl: string, officialUrl?: string | null) {
  let score = 0;

  try {
    const url = new URL(rawUrl);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const queryCount = countUsefulQueryParams(rawUrl);

    if (officialUrl && landingDomainMatchesOfficialUrl(rawUrl, officialUrl)) {
      score += 10_000;
    }

    if (url.protocol === "https:") {
      score += 500;
    } else if (url.protocol === "http:") {
      score += 150;
    }

    if (pathSegments.length > 0) {
      score += 200 + pathSegments.length * 25;
    }

    if (queryCount > 0) {
      score += 300 + queryCount * 100;
      score += Math.min(url.search.length, 800);
    }

    if (url.hash) {
      score += 10;
    }
  } catch {
    return 0;
  }

  return score;
}

function pickBestOfficialUrlCandidate(
  chain: Array<string | null | undefined>,
  officialUrl?: string | null,
) {
  let bestUrl: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const rawUrl of expandTraceChainCandidates(
    chain.filter((value): value is string => Boolean(value)),
    officialUrl,
  )) {
    if (officialUrl && !landingDomainMatchesOfficialUrl(rawUrl, officialUrl)) {
      continue;
    }

    const score = scoreOfficialUrlCandidate(rawUrl, officialUrl);
    if (score >= bestScore) {
      bestScore = score;
      bestUrl = rawUrl;
    }
  }

  return bestUrl;
}

const embeddedRedirectParamNames = new Set([
  "url",
  "u",
  "target",
  "dest",
  "destination",
  "redirect",
  "redirect_url",
  "redirecturl",
  "go",
  "to",
  "next",
  "return",
  "return_url",
  "out",
  "store_url",
  "storeurl",
  "link",
]);

function decodeRedirectCandidate(value: string) {
  let current = value.trim();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) {
        break;
      }
      current = next;
    } catch {
      break;
    }
  }

  return current.trim();
}

function extractEmbeddedRedirectUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const tryResolveCandidate = (candidate: string) => {
      try {
        return new URL(candidate, url.href).href;
      } catch {
        return null;
      }
    };

    for (const [key, value] of url.searchParams.entries()) {
      if (!embeddedRedirectParamNames.has(key.toLowerCase())) {
        continue;
      }

      const candidate = decodeRedirectCandidate(value);
      if (!candidate) {
        continue;
      }

      const resolved = tryResolveCandidate(candidate);
      if (resolved) {
        return resolved;
      }
    }

    if (isKnownAffiliateTrackingHostname(url.hostname)) {
      for (const value of url.searchParams.values()) {
        const candidate = decodeRedirectCandidate(value);
        if (!candidate) {
          continue;
        }

        const resolved = tryResolveCandidate(candidate);
        if (resolved) {
          return resolved;
        }
      }
    }
  } catch {
    /* ignore invalid URL */
  }

  return null;
}

function unwrapEmbeddedRedirectUrl(rawUrl: string, maxDepth = 5) {
  let currentUrl = rawUrl;
  const visited = new Set<string>();

  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (visited.has(currentUrl)) {
      break;
    }
    visited.add(currentUrl);

    const nextUrl = extractEmbeddedRedirectUrl(currentUrl);
    if (!nextUrl || nextUrl === currentUrl) {
      break;
    }

    currentUrl = nextUrl;
  }

  return currentUrl;
}

function pickBrowserRedirectUrl(
  pageUrl: string,
  responseUrl?: string | null,
  html?: string,
) {
  const candidates: string[] = [];

  const pushCandidate = (value?: string | null) => {
    const normalized = normalizeBrowserUrl(value);
    if (!normalized || normalized === pageUrl || candidates.includes(normalized)) {
      return;
    }

    candidates.push(normalized);
  };

  for (const rawUrl of [responseUrl, pageUrl]) {
    if (!rawUrl) {
      continue;
    }

    pushCandidate(extractEmbeddedRedirectUrl(rawUrl));
  }

  if (html) {
    pushCandidate(extractHtmlRedirectUrl(html, responseUrl ?? pageUrl));

    if (responseUrl && responseUrl !== pageUrl && isKnownAffiliateTrackingUrl(pageUrl)) {
      pushCandidate(extractHtmlRedirectUrl(html, pageUrl));
    }
  }

  return candidates[0] ?? null;
}

function buildEmbeddedRedirectFallback(rawUrl: string, exitGeoInfo?: Partial<ExitGeoInfo>) {
  const fallbackUrl = unwrapEmbeddedRedirectUrl(rawUrl);
  if (!fallbackUrl || fallbackUrl === rawUrl) {
    return null;
  }

  try {
    return splitFinalUrl(fallbackUrl, exitGeoInfo);
  } catch {
    return null;
  }
}

function shouldUseKookeeyProxy(link: Pick<AdLink, "proxy_provider">) {
  return link.proxy_provider?.toLowerCase().includes("kookeey") ?? false;
}

function shouldUseIprroyalProxy(link: Pick<AdLink, "proxy_provider">) {
  return link.proxy_provider?.toLowerCase().includes("iproyal") ?? false;
}

function generateIprroyalSessionId(length = IPROYAL_SESSION_ID_LENGTH) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let sessionId = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    sessionId += chars[randomIndex];
  }

  return sessionId;
}

function normalizeProxyServer(value: string) {
  return /^(https?|socks5):\/\//i.test(value) ? value : `http://${value}`;
}

function getIprroyalProxyConnection() {
  const host = process.env.IPROYAL_PROXY_HOST?.trim();
  const username = process.env.IPROYAL_PROXY_USER?.trim();
  const passwordBase = process.env.IPROYAL_PROXY_PASSWORD_BASE?.trim();
  const sessionLifetime =
    process.env.IPROYAL_PROXY_SESSION_LIFETIME?.trim() || IPROYAL_DEFAULT_SESSION_LIFETIME;

  if (!host || !username || !passwordBase) {
    return null;
  }

  const sessionId = generateIprroyalSessionId();
  return {
    protocol: "http" as const,
    server: normalizeProxyServer(host),
    username,
    password: `${passwordBase}_session-${sessionId}_lifetime-${sessionLifetime}`,
  };
}

function applyCountryToKookeeyApiUrl(apiUrl: string, countryCode?: string | null) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!normalizedCountryCode) {
    return apiUrl;
  }

  const upperCountryCode = normalizedCountryCode;
  const lowerCountryCode = normalizedCountryCode.toLowerCase();

  let resolvedApiUrl = apiUrl;
  const replacements: Array<[string, string]> = [
    ["{{country}}", upperCountryCode],
    ["{country}", upperCountryCode],
    ["__COUNTRY__", upperCountryCode],
    ["{{country_upper}}", upperCountryCode],
    ["{country_upper}", upperCountryCode],
    ["__COUNTRY_UPPER__", upperCountryCode],
    ["{{country_lower}}", lowerCountryCode],
    ["{country_lower}", lowerCountryCode],
    ["__COUNTRY_LOWER__", lowerCountryCode],
  ];

  for (const [searchValue, replaceValue] of replacements) {
    resolvedApiUrl = resolvedApiUrl.replaceAll(searchValue, replaceValue);
  }

  try {
    const url = new URL(resolvedApiUrl);
    url.searchParams.set("gate", lowerCountryCode);
    url.searchParams.set("g", upperCountryCode);
    return url.toString();
  } catch {
    return resolvedApiUrl;
  }
}

function getKookeeyPickApiUrl(link: Pick<AdLink, "country_code">) {
  const value =
    process.env.KOOKEEY_PICK_API_URL?.trim() ??
    process.env.KOOKEEY_DYNAMIC_API_URL?.trim() ??
    "";

  if (!value) {
    return null;
  }

  return applyCountryToKookeeyApiUrl(value, link.country_code);
}

function parseKookeeyProtocol(apiUrl: string): ProxyConnection["protocol"] {
  try {
    const protocol = new URL(apiUrl).searchParams.get("p")?.toLowerCase();
    if (protocol === "socks5" || protocol === "http" || protocol === "https") {
      return protocol;
    }
  } catch {
    /* ignore invalid API URL and use default */
  }

  return "http";
}

function parseKookeeyProxyLine(raw: string, protocol: ProxyConnection["protocol"]) {
  const firstLine = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    throw buildError("Kookeey did not return any proxy connection info", 502);
  }

  const lineWithScheme = firstLine.match(/^(https?|socks5):\/\/(.+)$/i);
  if (lineWithScheme) {
    const lineProtocol = lineWithScheme[1].toLowerCase() as ProxyConnection["protocol"];
    const segments = lineWithScheme[2].split(":");
    if (segments.length < 2) {
      throw buildError("Kookeey returned an unsupported proxy format", 502);
    }

    const host = segments[0];
    const port = segments[1];
    const username = segments[2];
    const password = segments.slice(3).join(":") || undefined;

    return {
      protocol: lineProtocol,
      server: `${lineProtocol}://${host}:${port}`,
      username,
      password,
    };
  }

  const segments = firstLine.split(":");
  if (segments.length < 2) {
    throw buildError("Kookeey returned an unsupported proxy format", 502);
  }

  const host = segments[0];
  const port = segments[1];
  const username = segments[2];
  const password = segments.slice(3).join(":") || undefined;

  return {
    protocol,
    server: `${protocol}://${host}:${port}`,
    username,
    password,
  };
}

async function fetchKookeeyProxyConnection(apiUrl: string) {
  const response = await fetch(apiUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      ...defaultRequestHeaders,
      Accept: "text/plain,application/json;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw buildError(`Kookeey API returned ${response.status}`, 502);
  }

  const content = await response.text();
  return parseKookeeyProxyLine(content, parseKookeeyProtocol(apiUrl));
}

async function detectExitGeoViaFetch(): Promise<ExitGeoInfo> {
  try {
    const response = await fetch("https://ipwho.is/", {
      headers: {
        Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return createEmptyExitGeoInfo();
    }

    const payload = (await response.json()) as {
      ip?: unknown;
      country_code?: unknown;
      country?: unknown;
    };

    return {
      resolvedIp: normalizeOptionalText(typeof payload.ip === "string" ? payload.ip : null),
      resolvedCountryCode: normalizeCountryCode(
        typeof payload.country_code === "string" ? payload.country_code : null,
      ),
      resolvedCountryName: normalizeOptionalText(
        typeof payload.country === "string" ? payload.country : null,
      ),
    };
  } catch {
    return createEmptyExitGeoInfo();
  }
}

async function detectExitGeoViaBrowser(page: Page): Promise<ExitGeoInfo> {
  const geoPage = await page.context().newPage();

  try {
    await geoPage.goto("https://ipwho.is/", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    const bodyText = (await geoPage.textContent("body"))?.trim();
    if (!bodyText) {
      return createEmptyExitGeoInfo();
    }

    const payload = JSON.parse(bodyText) as {
      ip?: unknown;
      country_code?: unknown;
      country?: unknown;
    };

    return {
      resolvedIp: normalizeOptionalText(typeof payload.ip === "string" ? payload.ip : null),
      resolvedCountryCode: normalizeCountryCode(
        typeof payload.country_code === "string" ? payload.country_code : null,
      ),
      resolvedCountryName: normalizeOptionalText(
        typeof payload.country === "string" ? payload.country : null,
      ),
    };
  } catch {
    return createEmptyExitGeoInfo();
  } finally {
    await geoPage.close().catch(() => undefined);
  }
}

type BrowserUrlCapture = {
  finalUrl: string;
  candidates: string[];
};

type RedirectTrace = {
  chain: string[];
  finalUrl: string;
  bodyText: string;
  exitGeoInfo?: Partial<ExitGeoInfo>;
};

type TrackingCandidate = {
  sourceUrl: string;
  landingUrl: string;
  landingDomain: string;
  trackingParams: string;
  hasStrongSignal: boolean;
};

async function waitForStablePageUrl(
  page: Page,
  baselineUrl: string,
  totalWaitMs = 8000,
  idleWaitMs = 1200,
  pollMs = 250,
): Promise<BrowserUrlCapture> {
  const seen = new Set<string>();
  const candidates: string[] = [];
  const record = (value?: string | null) => {
    const normalized = normalizeBrowserUrl(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    candidates.push(normalized);
  };

  let currentUrl = normalizeBrowserUrl(page.url()) ?? baselineUrl;
  let lastChangeAt = Date.now();
  const startedAt = lastChangeAt;

  record(baselineUrl);
  record(page.url());
  record(currentUrl);

  while (Date.now() - startedAt < totalWaitMs) {
    await page.waitForTimeout(pollMs);
    const nextUrl = normalizeBrowserUrl(page.url());

    record(nextUrl);

    if (!nextUrl) {
      continue;
    }

    if (nextUrl !== currentUrl) {
      currentUrl = nextUrl;
      lastChangeAt = Date.now();
      continue;
    }

    if (Date.now() - lastChangeAt >= idleWaitMs) {
      break;
    }
  }

  record(currentUrl);
  return { finalUrl: currentUrl, candidates };
}

function normalizeDomainFromUrl(value: string) {
  try {
    return new URL(value).hostname.trim().toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function landingDomainMatchesOfficialUrl(landingUrl: string, officialUrl: string) {
  const landingDomain = normalizeDomainFromUrl(landingUrl);
  const officialDomain = normalizeDomainFromUrl(officialUrl);
  if (!landingDomain || !officialDomain) {
    return false;
  }

  return (
    landingDomain === officialDomain ||
    landingDomain.endsWith(`.${officialDomain}`) ||
    officialDomain.endsWith(`.${landingDomain}`)
  );
}

function isRedirectPlaceholderParam(paramName: string) {
  return embeddedRedirectParamNames.has(paramName.toLowerCase());
}

function hasUsefulQueryParams(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    for (const [key, value] of url.searchParams.entries()) {
      if (isRedirectPlaceholderParam(key) || !value.trim()) {
        continue;
      }
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function countUsefulQueryParams(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    let count = 0;

    for (const [key, value] of url.searchParams.entries()) {
      if (isRedirectPlaceholderParam(key) || !value.trim()) {
        continue;
      }

      count += 1;
    }

    return count;
  } catch {
    return 0;
  }
}

function hasMeaningfulLandingDetails(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return Boolean((url.pathname && url.pathname !== "/") || url.search);
  } catch {
    return false;
  }
}

const authKeywords = [
  "access denied",
  "captcha",
  "cloudflare",
  "forbidden",
  "human verification",
  "login",
  "sign in",
  "verify you are human",
];

const strongTrackingParamNames = new Set([
  "click",
  "clickid",
  "click_id",
  "clickref",
  "click_ref",
  "dclid",
  "eid",
  "irclickid",
  "mid",
  "pid",
  "cid",
  "reqid",
  "ranmid",
  "raneaid",
  "ransiteid",
  "sid",
  "s1",
  "subid",
  "sub_id",
  "subid1",
  "subid2",
  "subid3",
  "subid4",
  "subid5",
  "sub1",
  "sub2",
  "sub3",
  "sub4",
  "sub5",
  "traceid",
]);

const weakTrackingParamNames = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
]);

function dedupeUrlsPreserveOrder(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeBrowserUrl(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function detectAuthOrChallenge(finalUrl: string, bodyText: string) {
  const path = (() => {
    try {
      return new URL(finalUrl).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();

  if (
    path.includes("/login") ||
    path.includes("/signin") ||
    path.includes("/captcha") ||
    path.includes("/challenge") ||
    path.includes("/access-denied")
  ) {
    return true;
  }

  const loweredBody = bodyText.toLowerCase();
  return authKeywords.some((keyword) => loweredBody.includes(keyword));
}

function assertNotGatewayDomain(landingUrl: string) {
  if (isKnownAffiliateTrackingUrl(landingUrl)) {
    throw buildError("最终仍停留在联盟网关域名。", 502);
  }
}

function isStrongTrackingParamName(name: string) {
  const normalized = name.toLowerCase();
  return strongTrackingParamNames.has(normalized);
}

function isWeakTrackingParamName(name: string) {
  const normalized = name.toLowerCase();
  return weakTrackingParamNames.has(normalized) || normalized.startsWith("utm_");
}

function toTrackingQuery(pairs: Array<[string, string]>) {
  return pairs.map(([key, value]) => `${key}=${value}`).join("&");
}

function expandTraceChainCandidates(chain: string[], officialUrl?: string | null) {
  const expanded: Array<string | null> = [];

  for (const rawUrl of dedupeUrlsPreserveOrder(chain)) {
    expanded.push(rawUrl);

    const unwrappedUrl = unwrapEmbeddedRedirectUrl(rawUrl);
    if (!unwrappedUrl || unwrappedUrl === rawUrl) {
      continue;
    }

    if (
      !officialUrl ||
      landingDomainMatchesOfficialUrl(rawUrl, officialUrl) ||
      landingDomainMatchesOfficialUrl(unwrappedUrl, officialUrl)
    ) {
      expanded.push(unwrappedUrl);
    }
  }

  return dedupeUrlsPreserveOrder(expanded);
}

function findTrackingCandidateFromChain(
  chain: string[],
  officialUrl?: string | null,
): TrackingCandidate | null {
  let bestStrong: TrackingCandidate | null = null;
  let bestWeak: TrackingCandidate | null = null;

  for (const rawUrl of expandTraceChainCandidates(chain, officialUrl)) {
    if (isKnownAffiliateTrackingUrl(rawUrl)) {
      continue;
    }

    if (officialUrl && !landingDomainMatchesOfficialUrl(rawUrl, officialUrl)) {
      continue;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      continue;
    }

    const filteredParams = [...parsed.searchParams.entries()].filter(
      ([key, value]) => !isRedirectPlaceholderParam(key) && value.trim(),
    );

    if (!filteredParams.length) {
      continue;
    }

    const strongPairs = filteredParams.filter(([key]) => isStrongTrackingParamName(key));
    if (strongPairs.length) {
      bestStrong = {
        sourceUrl: rawUrl,
        landingUrl: rawUrl,
        landingDomain: normalizeDomainFromUrl(rawUrl),
        trackingParams: toTrackingQuery(filteredParams),
        hasStrongSignal: true,
      };
    }

    const weakPairs = filteredParams.filter(([key]) => isWeakTrackingParamName(key));
    if (weakPairs.length) {
      bestWeak = {
        sourceUrl: rawUrl,
        landingUrl: rawUrl,
        landingDomain: normalizeDomainFromUrl(rawUrl),
        trackingParams: toTrackingQuery(filteredParams),
        hasStrongSignal: false,
      };
    }
  }

  return bestStrong ?? bestWeak;
}

function extractTrackingCandidateFromChain(
  chain: string[],
  officialUrl?: string | null,
): TrackingCandidate {
  const candidate = findTrackingCandidateFromChain(chain, officialUrl);
  if (!candidate) {
    throw buildError("未发现可用的 tracking 参数。", 502);
  }

  return candidate;
}

function pickLandingUrlFromTrace(trace: RedirectTrace, officialUrl?: string | null) {
  const nonGatewayChain = expandTraceChainCandidates(trace.chain, officialUrl).filter(
    (url) => !isKnownAffiliateTrackingUrl(url),
  );
  const officialChain = officialUrl
    ? nonGatewayChain.filter((url) => landingDomainMatchesOfficialUrl(url, officialUrl))
    : nonGatewayChain;
  const meaningfulChain = officialChain.filter((url) => hasMeaningfulLandingDetails(url));
  const finalUrlMatchesOfficial =
    !officialUrl || landingDomainMatchesOfficialUrl(trace.finalUrl, officialUrl);

  return (
    meaningfulChain.at(-1) ??
    officialChain.at(-1) ??
    (finalUrlMatchesOfficial ? trace.finalUrl : null)
  );
}

function buildResolvedUrl(landingUrl: string, trackingParams: string) {
  const url = new URL(landingUrl);
  url.search = trackingParams ? `?${trackingParams.replace(/^\?/, "")}` : "";
  return url.toString();
}

function pickResolvedFinalUrl(
  trace: RedirectTrace,
  landingUrl: string,
  candidate: TrackingCandidate | null,
  officialUrl?: string | null,
) {
  const selectedOfficialUrl =
    pickBestOfficialUrlCandidate(
      [trace.finalUrl, landingUrl, candidate?.landingUrl ?? null, ...trace.chain],
      officialUrl,
    ) ?? alignResolvedUrlToOfficialUrl(landingUrl, officialUrl);

  if (hasUsefulQueryParams(selectedOfficialUrl)) {
    return alignResolvedUrlToOfficialUrl(selectedOfficialUrl, officialUrl);
  }

  if (candidate?.trackingParams) {
    return alignResolvedUrlToOfficialUrl(
      buildResolvedUrl(selectedOfficialUrl, candidate.trackingParams),
      officialUrl,
    );
  }

  return selectedOfficialUrl;
}

function resolveResultFromTrace(trace: RedirectTrace, officialUrl?: string | null) {
  const landingUrl = pickLandingUrlFromTrace(trace, officialUrl);
  if (!landingUrl) {
    throw buildError("最终品牌官网域名与预期不一致。", 502);
  }

  const candidate = findTrackingCandidateFromChain(trace.chain, officialUrl);
  const resolvedLandingUrl = candidate?.landingUrl || landingUrl;
  const finalUrlLooksBlocked = detectAuthOrChallenge(trace.finalUrl, trace.bodyText);
  const resolvedMatchesOfficial = !officialUrl || landingDomainMatchesOfficialUrl(
    resolvedLandingUrl,
    officialUrl,
  );

  if (finalUrlLooksBlocked && !resolvedMatchesOfficial && !candidate) {
    throw buildError("最终页面为登录页、验证码页或访问受限页面。", 502);
  }

  assertNotGatewayDomain(resolvedLandingUrl);

  if (officialUrl && !landingDomainMatchesOfficialUrl(resolvedLandingUrl, officialUrl)) {
    throw buildError("最终品牌官网域名与预期不一致。", 502);
  }

  if (!candidate) {
    throw buildError("未发现可用的 tracking 参数。", 502);
  }

  const finalUrl = pickResolvedFinalUrl(trace, resolvedLandingUrl, candidate, officialUrl);
  return splitFinalUrl(finalUrl, trace.exitGeoInfo);
}

function mergeRedirectTraces(...traces: Array<RedirectTrace | null | undefined>): RedirectTrace {
  const chain = dedupeUrlsPreserveOrder(traces.flatMap((trace) => trace?.chain ?? []));
  const finalTrace = [...traces].reverse().find((trace) => trace?.finalUrl) ?? null;
  const bodyTrace = [...traces].reverse().find((trace) => trace?.bodyText?.trim()) ?? null;
  const exitGeoTrace = [...traces].reverse().find(
    (trace) =>
      trace?.exitGeoInfo &&
      (trace.exitGeoInfo.resolvedIp ||
        trace.exitGeoInfo.resolvedCountryCode ||
        trace.exitGeoInfo.resolvedCountryName),
  ) ?? null;

  if (!finalTrace?.finalUrl) {
    throw buildError("解析失败，未拿到最终跳转链。", 502);
  }

  return {
    chain,
    finalUrl: finalTrace.finalUrl,
    bodyText: bodyTrace?.bodyText ?? "",
    exitGeoInfo: exitGeoTrace?.exitGeoInfo,
  };
}

async function resolveTraceWithRequestAndBrowser(
  trackingUrl: string,
  proxy: ProxyConnection | null,
  countryCode?: string | null,
  refererUrl?: string | null,
  officialUrl?: string | null,
) {
  let requestTrace: RedirectTrace | null = null;
  let browserTrace: RedirectTrace | null = null;
  let lastError: unknown = null;

  try {
    requestTrace = await followAffiliateRedirectWithRequest(
      trackingUrl,
      proxy,
      refererUrl,
      officialUrl,
    );
  } catch (error) {
    lastError = error;
  }

  try {
    browserTrace = await followAffiliateRedirectWithBrowser(
      trackingUrl,
      proxy,
      countryCode,
      refererUrl,
      officialUrl,
    );
  } catch (error) {
    lastError = error;
  }

  if (!requestTrace && !browserTrace) {
    throw buildError(`解析失败：${toResolverErrorMessage(lastError)}`, 502);
  }

  return mergeRedirectTraces(requestTrace, browserTrace);
}

async function followAffiliateRedirectWithBrowser(
  trackingUrl: string,
  proxy: ProxyConnection | null,
  countryCode?: string | null,
  refererUrl?: string | null,
  officialUrl?: string | null,
) : Promise<RedirectTrace> {
  let browser: Browser;
  try {
    ensurePlaywrightBrowserPath();
    browser = await chromium.launch({
      headless: true,
      ...(proxy
        ? {
            proxy: {
              server: proxy.server,
              username: proxy.username,
              password: proxy.password,
            },
          }
        : {}),
    });
  } catch (error) {
    throw buildError(toResolverErrorMessage(error), 500);
  }

  const browserGeoProfile = getBrowserGeoProfile(countryCode);
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: browserGeoProfile.locale,
    timezoneId: browserGeoProfile.timezoneId,
    userAgent: defaultRequestHeaders["User-Agent"],
    extraHTTPHeaders: {
      "Accept-Language": `${browserGeoProfile.locale},en;q=0.9`,
    },
  });

  const page = await context.newPage();
  const navigationUrls: string[] = [];
  const navigationSeen = new Set<string>();
  const failedNavigationUrls: string[] = [];

  const recordNavigationUrl = (value?: string | null) => {
    const normalized = normalizeBrowserUrl(value);
    if (!normalized || navigationSeen.has(normalized)) {
      return;
    }

    navigationSeen.add(normalized);
    navigationUrls.push(normalized);
  };

  const onFrameNavigated = (frame: { url(): string }) => {
    if (frame === page.mainFrame()) {
      recordNavigationUrl(frame.url());
    }
  };

  const recordFailedNavigationUrl = (value?: string | null) => {
    const normalized = normalizeBrowserUrl(value);
    if (!normalized || failedNavigationUrls.includes(normalized)) {
      return;
    }

    failedNavigationUrls.push(normalized);
    recordNavigationUrl(normalized);
  };

  try {
    page.on("framenavigated", onFrameNavigated);
    page.on("response", (response) => {
      const request = response.request();
      if (request.isNavigationRequest() && request.resourceType() === "document") {
        recordNavigationUrl(response.url());
      }
    });
    page.on("requestfailed", (request) => {
      if (!request.isNavigationRequest() || request.resourceType() !== "document") {
        return;
      }

      recordFailedNavigationUrl(request.url());
    });

    if (refererUrl) {
      await page.setExtraHTTPHeaders({
        Referer: refererUrl,
      });
    }

    const entryUrl = trackingUrl;
    recordNavigationUrl(entryUrl);
    const initialResponse = await page.goto(entryUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
      referer: refererUrl ?? undefined,
    });
    recordNavigationUrl(initialResponse?.url());
    recordNavigationUrl(page.url());

    try {
      await page.waitForLoadState("networkidle", { timeout: 5000 });
    } catch {
      /* some landing pages keep connections open */
    }

    const pageHtml = await page.content().catch(() => "");
    const browserRedirectHint = pickBrowserRedirectUrl(
      normalizeBrowserUrl(page.url()) ?? entryUrl,
      initialResponse?.url(),
      pageHtml,
    );
    recordNavigationUrl(browserRedirectHint);
    recordNavigationUrl(browserRedirectHint ? unwrapEmbeddedRedirectUrl(browserRedirectHint) : null);

    const responseUrl = normalizeBrowserUrl(initialResponse?.url()) ?? entryUrl;
    const settledUrl = normalizeBrowserUrl(page.url()) ?? responseUrl;
    const finalUrl = preserveLandingQuery(responseUrl, settledUrl, officialUrl);
    recordNavigationUrl(finalUrl);

    if (!finalUrl || finalUrl === "about:blank" || finalUrl.startsWith("chrome-error://")) {
      throw buildError("Browser navigation through Kookeey proxy failed", 502);
    }

    const stableCapture = await waitForStablePageUrl(page, finalUrl, 12000, 1500);
    stableCapture.candidates.forEach(recordNavigationUrl);
    failedNavigationUrls.forEach(recordNavigationUrl);
    const redirectChain = [
      ...navigationUrls,
      ...failedNavigationUrls,
      browserRedirectHint,
      browserRedirectHint ? unwrapEmbeddedRedirectUrl(browserRedirectHint) : null,
      ...stableCapture.candidates,
      stableCapture.finalUrl,
      finalUrl,
      settledUrl,
      responseUrl,
    ].filter((value): value is string => Boolean(value));
    const exitGeoInfo = await detectExitGeoViaBrowser(page);
    const preferredFailedOfficialUrl =
      [...failedNavigationUrls]
        .reverse()
        .find((url) => !officialUrl || landingDomainMatchesOfficialUrl(url, officialUrl)) ?? null;
    const resolvedFinalUrl =
      preferredFailedOfficialUrl ||
      preserveLandingQuery(finalUrl, stableCapture.finalUrl, officialUrl);

    return {
      chain: redirectChain,
      finalUrl: resolvedFinalUrl,
      bodyText: pageHtml,
      exitGeoInfo,
    };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function followAffiliateRedirectWithRequest(
  trackingUrl: string,
  proxy: ProxyConnection | null,
  refererUrl?: string | null,
  officialUrl?: string | null,
  maxDepth = 8,
) : Promise<RedirectTrace> {
  const context = await request.newContext({
    proxy: proxy
      ? {
          server: proxy.server,
          username: proxy.username,
          password: proxy.password,
        }
      : undefined,
    ignoreHTTPSErrors: true,
    maxRedirects: 0,
    timeout: 30000,
    extraHTTPHeaders: buildDefaultProxyRequestHeaders(refererUrl),
  });

  try {
    let currentUrl = trackingUrl;
    const visited = new Set<string>();
    const chain: string[] = [];

    const record = (value?: string | null) => {
      const normalized = normalizeBrowserUrl(value);
      if (!normalized || chain.includes(normalized)) {
        return;
      }

      chain.push(normalized);
    };

    for (let depth = 0; depth < maxDepth; depth += 1) {
      if (visited.has(currentUrl)) {
        throw buildError("检测到循环重定向", 502);
      }
      visited.add(currentUrl);
      record(currentUrl);

      const response = await context.get(currentUrl, {
        maxRedirects: 0,
        failOnStatusCode: false,
      });

      const status = response.status();
      const contentType = response.headers()["content-type"] || "";
      const finalUrl = response.url() || currentUrl;
      const embeddedRedirectUrl =
        extractEmbeddedRedirectUrl(finalUrl) ?? extractEmbeddedRedirectUrl(currentUrl);

      if (status >= 300 && status < 400) {
        const location = getResponseLocation(response);
        const nextUrl = location ? resolveRedirectLocation(location, finalUrl) : null;

        if (!nextUrl || nextUrl === currentUrl) {
          const finalChain = dedupeUrlsPreserveOrder([
            ...chain,
            finalUrl,
            embeddedRedirectUrl,
          ]);
          return {
            chain: finalChain,
            finalUrl: embeddedRedirectUrl ?? finalUrl,
            bodyText: "",
          };
        }

        record(finalUrl);
        record(nextUrl);
        currentUrl = nextUrl;
        continue;
      }

      if (!contentType.includes("text/html")) {
        record(finalUrl);
        const finalChain = dedupeUrlsPreserveOrder([
          ...chain,
          finalUrl,
          embeddedRedirectUrl,
        ]);
        return {
          chain: finalChain,
          finalUrl: embeddedRedirectUrl ?? finalUrl,
          bodyText: "",
        };
      }

      const html = await response.text();
      const nextUrl =
        extractHtmlRedirectUrl(html, finalUrl) ??
        (isKnownAffiliateTrackingUrl(finalUrl) || isKnownAffiliateTrackingUrl(currentUrl)
          ? extractEmbeddedRedirectUrl(finalUrl) ?? extractEmbeddedRedirectUrl(currentUrl)
          : null);

      if (!nextUrl || nextUrl === finalUrl) {
        record(finalUrl);
        const finalChain = dedupeUrlsPreserveOrder([
          ...chain,
          finalUrl,
          embeddedRedirectUrl,
        ]);
        return {
          chain: finalChain,
          finalUrl: embeddedRedirectUrl ?? finalUrl,
          bodyText: html,
        };
      }

      record(finalUrl);
      record(nextUrl);
      currentUrl = nextUrl;
    }

    const finalChain = dedupeUrlsPreserveOrder([...chain, currentUrl]);
    return {
      chain: finalChain,
      finalUrl: currentUrl,
      bodyText: "",
    };
  } finally {
    await context.dispose().catch(() => undefined);
  }
}

async function followAffiliateRedirect(
  trackingUrl: string,
  refererUrl?: string | null,
  maxDepth = 5,
) {
  let currentUrl = trackingUrl;
  const visited = new Set<string>();

  for (let depth = 0; depth < maxDepth; depth++) {
    if (visited.has(currentUrl)) {
      throw buildError("检测到循环重定向", 502);
    }
    visited.add(currentUrl);

    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        ...defaultRequestHeaders,
        ...(refererUrl ? { Referer: refererUrl } : {}),
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw buildError(`解析失败，目标站返回 ${response.status}`, 502);
    }

    const contentType = response.headers.get("content-type") || "";
    const finalUrl = response.url || currentUrl;

    // 不是 HTML，大概率已到达最终页面
    if (!contentType.includes("text/html")) {
      return splitFinalUrl(finalUrl);
    }

    const html = await response.text();
    const redirectUrl = extractHtmlRedirectUrl(html, finalUrl);

    if (!redirectUrl || redirectUrl === finalUrl) {
      // 没有检测到 HTML 跳转，当前就是最终页面
      return splitFinalUrl(finalUrl);
    }

    // 继续跟随 HTML 里的跳转
    currentUrl = redirectUrl;
  }

  throw buildError("重定向次数过多", 502);
}

async function resolveTrackingUrl(link: AdLink) {
  if (!link.tracking_url) {
    throw buildError("请先填写联盟跟踪链接", 400);
  }

  const refererUrl = normalizeRefererUrl(link.referer_url, link.referer_sources);

  if (shouldUseIprroyalProxy(link)) {
    const proxyConnection = getIprroyalProxyConnection();
    if (!proxyConnection) {
      throw buildError(
        "IPRoyal proxy is selected but IPROYAL_PROXY_HOST / USER / PASSWORD_BASE is not configured",
        500,
      );
    }

    const trace = await resolveTraceWithRequestAndBrowser(
      link.tracking_url,
      proxyConnection,
      link.country_code,
      refererUrl,
      link.official_url,
    );
    return resolveResultFromTrace(trace, link.official_url);
  }

  if (!shouldUseKookeeyProxy(link)) {
    const trace = await resolveTraceWithRequestAndBrowser(
      link.tracking_url,
      null,
      link.country_code,
      refererUrl,
      link.official_url,
    );
    return resolveResultFromTrace(trace, link.official_url);
  }

  const apiUrl = getKookeeyPickApiUrl(link);
  if (!apiUrl) {
    throw buildError("Kookeey proxy is selected but KOOKEEY_PICK_API_URL is not configured", 500);
  }

  for (let attempt = 1; attempt <= KOOKEEY_RESOLVE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const proxyConnection = await fetchKookeeyProxyConnection(apiUrl);
      if (
        proxyConnection.protocol === "socks5" &&
        (proxyConnection.username || proxyConnection.password)
      ) {
        throw buildError(
          "This Kookeey line is using socks5 auth. Please switch the Kookeey API link to HTTP proxy mode.",
          500,
        );
      }

      const trace = await resolveTraceWithRequestAndBrowser(
        link.tracking_url,
        proxyConnection,
        link.country_code,
        refererUrl,
        link.official_url,
      );
      return resolveResultFromTrace(trace, link.official_url);
    } catch (error) {
      if (attempt >= KOOKEEY_RESOLVE_MAX_ATTEMPTS || !isRetryableKookeeyError(error)) {
        throw error;
      }
    }
  }

  throw buildError("Kookeey proxy retry failed after configured attempts", 502);
}

function getEffectiveTargetUrl(link: AdLink) {
  return link.target_url || link.tracking_url || "";
}

function isLinkDueForFinalUrlRefresh(link: AdLink, now = new Date()) {
  if (
    !link.is_active ||
    !link.tracking_url ||
    link.refresh_final_url_interval_hours === null
  ) {
    return false;
  }

  if (!link.last_resolved_at) {
    return true;
  }

  const lastResolvedAt = new Date(link.last_resolved_at).getTime();
  if (!Number.isFinite(lastResolvedAt)) {
    return true;
  }

  const nextRefreshAt =
    lastResolvedAt + link.refresh_final_url_interval_hours * 60 * 1000;
  const refreshIntervalMs = link.refresh_final_url_interval_hours * 60 * 1000;
  const graceMs = Math.min(
    maxRefreshDueGraceMs,
    Math.max(5 * 1000, Math.floor(refreshIntervalMs / 4)),
  );

  // Railway cron often starts a bit before the exact same second as the previous refresh.
  // A small grace window prevents every-other-run skips for minute-level schedules
  // without making 30-second and 1-minute intervals fire immediately.
  return now.getTime() + graceMs >= nextRefreshAt;
}

function buildPendingGoogleAdsSyncItem(link: AdLink): GoogleAdsPendingSyncItem | null {
  if (
    !link.is_active ||
    link.sync_status !== "pending" ||
    (link.resolve_status !== "resolved" && link.resolve_status !== "changed")
  ) {
    return null;
  }

  const customerId = normalizeGoogleAdsCustomerId(link.google_ads_customer_id);
  const entityId = normalizeGoogleAdsId(link.google_ads_entity_id);
  const finalUrlSuffix = toGoogleAdsSuffix(link.final_url_query);

  if (!customerId || !entityId || !finalUrlSuffix || !link.final_url_base || !link.target_url) {
    return null;
  }

  return {
    link_id: link.id,
    slug: link.slug,
    name: link.name,
    google_ads_account: link.google_ads_account,
    google_ads_customer_id: link.google_ads_customer_id ?? customerId,
    google_ads_entity_type: link.google_ads_entity_type,
    google_ads_entity_id: entityId,
    final_url_base: link.final_url_base,
    final_url_suffix: finalUrlSuffix,
    target_url: link.target_url,
    updated_at: link.updated_at,
  };
}

function resolveTarget(link: AdLink, now = Date.now()) {
  const activeTargets = link.auto_swap_targets.filter((target) => target.is_active);

  if (
    !link.auto_swap_enabled ||
    link.auto_swap_interval_minutes === null ||
    activeTargets.length < 2
  ) {
    return {
      targetUrl: getEffectiveTargetUrl(link),
      targetLabel: link.target_url ? "最终链接" : "联盟跟踪链接",
      source: "manual" as const,
    };
  }

  const startAt = link.auto_swap_started_at
    ? new Date(link.auto_swap_started_at).getTime()
    : new Date(link.updated_at).getTime();
  const safeStartAt = Number.isFinite(startAt) ? startAt : now;
  const stepMs = link.auto_swap_interval_minutes * 60 * 1000;
  const elapsed = Math.max(0, now - safeStartAt);
  const index = Math.floor(elapsed / stepMs) % activeTargets.length;
  const target = activeTargets[index];

  return {
    targetUrl: target.target_url,
    targetLabel: target.label,
    source: "auto-swap" as const,
  };
}

function normalizeStoredLink(raw: Partial<AdLink>, fallbackId: number): AdLink {
  const normalizedSlug = raw.slug?.trim();

  return {
    id: Number.isInteger(raw.id) && raw.id ? raw.id : fallbackId,
    slug: normalizedSlug || `link-${fallbackId}`,
    name: raw.name?.trim() ?? "",
    target_url: raw.target_url?.trim() ?? "",
    official_url: normalizeOfficialUrl(
      (raw as AdLink & { official_url?: string | null }).official_url,
    ),
    tracking_url: normalizeOptionalText(raw.tracking_url),
    referer_url: normalizeRefererUrl(
      (raw as AdLink & { referer_url?: string | null }).referer_url,
      normalizeStringArray(raw.referer_sources),
    ),
    previous_target_url: normalizeOptionalText(raw.previous_target_url),
    final_url_base: normalizeOptionalText(raw.final_url_base),
    final_url_query: raw.final_url_query ?? null,
    resolve_status: (raw.resolve_status as ResolveStatus) ?? "idle",
    sync_status: (raw.sync_status as SyncStatus) ?? "pending",
    last_resolved_at: raw.last_resolved_at ?? null,
    last_resolve_error: normalizeOptionalText(raw.last_resolve_error),
    last_resolved_ip: normalizeOptionalText((raw as AdLink & { last_resolved_ip?: string | null }).last_resolved_ip),
    last_resolved_country_code: normalizeCountryCode((raw as AdLink & { last_resolved_country_code?: string | null }).last_resolved_country_code),
    last_resolved_country_name: normalizeOptionalText((raw as AdLink & { last_resolved_country_name?: string | null }).last_resolved_country_name),
    refresh_final_url_interval_hours: parseRefreshIntervalHours(
      raw.refresh_final_url_interval_hours,
    ),
    offer: normalizeOptionalText(raw.offer),
    offer_id: normalizeOptionalText(raw.offer_id),
    google_ads_account: normalizeOptionalText(raw.google_ads_account),
    google_ads_customer_id: normalizeGoogleAdsId(raw.google_ads_customer_id),
    google_ads_entity_type: "campaign",
    google_ads_entity_id: normalizeGoogleAdsId(raw.google_ads_entity_id),
    google_ads_last_synced_at: raw.google_ads_last_synced_at ?? null,
    google_ads_last_synced_suffix: normalizeOptionalText(raw.google_ads_last_synced_suffix),
    google_ads_last_sync_error: normalizeOptionalText(raw.google_ads_last_sync_error),
    tracking_template: normalizeOptionalText(raw.tracking_template),
    final_url_suffix: normalizeOptionalText(raw.final_url_suffix),
    daily_budget: parseNumberOrNull(raw.daily_budget),
    max_cpc: parseNumberOrNull(raw.max_cpc),
    country_code: normalizeOptionalText(raw.country_code),
    proxy_provider: normalizeOptionalText(raw.proxy_provider) ?? defaultProxyProviderName,
    clicks_per_day_min: parsePositiveIntegerOrNull(raw.clicks_per_day_min),
    clicks_per_day_max: parsePositiveIntegerOrNull(raw.clicks_per_day_max),
    click_time_slots: normalizeStringArray(raw.click_time_slots),
    referer_sources: normalizeStringArray(raw.referer_sources),
    schedule_start_at: raw.schedule_start_at ?? null,
    schedule_end_at: raw.schedule_end_at ?? null,
    is_active: raw.is_active ?? true,
    click_count: Number.isFinite(raw.click_count) ? Number(raw.click_count) : 0,
    auto_swap_enabled: raw.auto_swap_enabled ?? false,
    auto_swap_interval_minutes: parsePositiveIntegerOrNull(raw.auto_swap_interval_minutes),
    auto_swap_started_at: raw.auto_swap_started_at ?? null,
    auto_swap_targets: normalizeAutoSwapTargets(raw.auto_swap_targets),
    created_at: raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at ?? raw.created_at ?? new Date().toISOString(),
  };
}

function validateAutoSwapTargetsInput(value: AutoSwapTarget[] | undefined) {
  if (value === undefined) return undefined;

  const targets = normalizeAutoSwapTargets(value);
  for (const target of targets) {
    assertValidUrl(target.target_url);
  }
  return targets;
}

function validateCreateInput(input: AdLinkCreate) {
  const name = input.name.trim();
  const targetUrl = input.target_url?.trim() ?? "";
  const officialUrl = input.official_url?.trim() ?? "";
  const trackingUrl = input.tracking_url?.trim() ?? "";
  const refererSources = normalizeStringArray(input.referer_sources);
  const dailyBudget = parseNumberOrNull(input.daily_budget);
  const maxCpc = parseNumberOrNull(input.max_cpc);
  const clicksPerDayMin = parsePositiveIntegerOrNull(input.clicks_per_day_min);
  const clicksPerDayMax = parsePositiveIntegerOrNull(input.clicks_per_day_max);

  if (!name) {
    throw buildError("广告系列名称不能为空");
  }
  if (!targetUrl && !trackingUrl) {
    throw buildError("联盟推广链接和最终链接至少要填写一个");
  }
  if (targetUrl) assertValidUrl(targetUrl);
  if (officialUrl) assertValidOfficialUrl(officialUrl);
  if (trackingUrl) assertValidUrl(trackingUrl);

  assertDailyClicksRange(clicksPerDayMin, clicksPerDayMax);

  const autoSwapTargets = validateAutoSwapTargetsInput(input.auto_swap_targets) ?? [];

  const data = {
    name,
    target_url: targetUrl,
    official_url: officialUrl || null,
    tracking_url: trackingUrl || null,
    refresh_final_url_interval_hours: parseRefreshIntervalHours(
      input.refresh_final_url_interval_hours ?? defaultRefreshFinalUrlInterval,
    ),
    offer: normalizeOptionalText(input.offer),
    offer_id: normalizeOptionalText(input.offer_id),
    google_ads_account: normalizeOptionalText(input.google_ads_account),
    google_ads_customer_id: normalizeGoogleAdsId(input.google_ads_customer_id),
    google_ads_entity_type: "campaign" as const,
    google_ads_entity_id: normalizeGoogleAdsId(input.google_ads_entity_id),
    tracking_template: normalizeOptionalText(input.tracking_template),
    final_url_suffix: normalizeOptionalText(input.final_url_suffix),
    daily_budget: dailyBudget,
    max_cpc: maxCpc,
    country_code: normalizeOptionalText(input.country_code),
    proxy_provider: normalizeOptionalText(input.proxy_provider) ?? defaultProxyProviderName,
    clicks_per_day_min: clicksPerDayMin,
    clicks_per_day_max: clicksPerDayMax,
    click_time_slots: normalizeStringArray(input.click_time_slots),
    referer_sources: refererSources,
    referer_url: normalizeRefererUrl(input.referer_url, refererSources),
    schedule_start_at: input.schedule_start_at?.trim() || null,
    schedule_end_at: input.schedule_end_at?.trim() || null,
    is_active: input.is_active ?? true,
    auto_swap_enabled: input.auto_swap_enabled ?? false,
    auto_swap_interval_minutes: parsePositiveIntegerOrNull(input.auto_swap_interval_minutes),
    auto_swap_targets: autoSwapTargets,
  };

  assertSchedule(data.schedule_start_at, data.schedule_end_at);
  return data;
}

function validateUpdateInput(input: AdLinkUpdate) {
  const update: Partial<AdLink> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw buildError("广告系列名称不能为空");
    update.name = name;
  }
  if (input.target_url !== undefined) {
    const targetUrl = input.target_url.trim();
    if (targetUrl) assertValidUrl(targetUrl);
    update.target_url = targetUrl;
  }
  if (input.official_url !== undefined) {
    const officialUrl = input.official_url.trim();
    if (officialUrl) assertValidOfficialUrl(officialUrl);
    update.official_url = officialUrl || null;
  }
  if (input.tracking_url !== undefined) {
    const trackingUrl = input.tracking_url.trim();
    if (trackingUrl) assertValidUrl(trackingUrl);
    update.tracking_url = trackingUrl || null;
  }
  if (input.offer !== undefined) update.offer = normalizeOptionalText(input.offer);
  if (input.offer_id !== undefined) update.offer_id = normalizeOptionalText(input.offer_id);
  if (input.refresh_final_url_interval_hours !== undefined) {
    update.refresh_final_url_interval_hours = parseRefreshIntervalHours(
      input.refresh_final_url_interval_hours,
    );
  }
  if (input.google_ads_account !== undefined) {
    update.google_ads_account = normalizeOptionalText(input.google_ads_account);
  }
  if (input.google_ads_customer_id !== undefined) {
    update.google_ads_customer_id = normalizeGoogleAdsId(input.google_ads_customer_id);
  }
  if (input.google_ads_entity_type !== undefined) {
    update.google_ads_entity_type = "campaign";
  }
  if (input.google_ads_entity_id !== undefined) {
    update.google_ads_entity_id = normalizeGoogleAdsId(input.google_ads_entity_id);
  }
  if (input.tracking_template !== undefined) {
    update.tracking_template = normalizeOptionalText(input.tracking_template);
  }
  if (input.final_url_suffix !== undefined) {
    update.final_url_suffix = normalizeOptionalText(input.final_url_suffix);
  }
  if (input.daily_budget !== undefined) update.daily_budget = parseNumberOrNull(input.daily_budget);
  if (input.max_cpc !== undefined) update.max_cpc = parseNumberOrNull(input.max_cpc);
  if (input.country_code !== undefined) update.country_code = normalizeOptionalText(input.country_code);
  if (input.proxy_provider !== undefined) {
    update.proxy_provider = normalizeOptionalText(input.proxy_provider) ?? defaultProxyProviderName;
  }
  if (input.clicks_per_day_min !== undefined) {
    update.clicks_per_day_min = parsePositiveIntegerOrNull(input.clicks_per_day_min);
  }
  if (input.clicks_per_day_max !== undefined) {
    update.clicks_per_day_max = parsePositiveIntegerOrNull(input.clicks_per_day_max);
  }
  if (input.click_time_slots !== undefined) {
    update.click_time_slots = normalizeStringArray(input.click_time_slots);
  }
  if (input.referer_sources !== undefined) {
    update.referer_sources = normalizeStringArray(input.referer_sources);
  }
  if (input.referer_url !== undefined) {
    update.referer_url = normalizeRefererUrl(input.referer_url);
  }
  if (input.schedule_start_at !== undefined) {
    update.schedule_start_at = input.schedule_start_at?.trim() || null;
  }
  if (input.schedule_end_at !== undefined) {
    update.schedule_end_at = input.schedule_end_at?.trim() || null;
  }
  if (input.is_active !== undefined) update.is_active = input.is_active;
  if (input.auto_swap_enabled !== undefined) update.auto_swap_enabled = input.auto_swap_enabled;
  if (input.auto_swap_interval_minutes !== undefined) {
    update.auto_swap_interval_minutes = parsePositiveIntegerOrNull(input.auto_swap_interval_minutes);
  }
  if (input.auto_swap_targets !== undefined) {
    update.auto_swap_targets = validateAutoSwapTargetsInput(input.auto_swap_targets) ?? [];
  }
  if (input.sync_status !== undefined) update.sync_status = input.sync_status;

  return update;
}

async function ensureStoreFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(defaultStore, null, 2), "utf8");
  }
}

async function readStore(): Promise<LinkStoreFile> {
  await ensureStoreFile();
  const raw = await fs.readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw) as Partial<LinkStoreFile>;
  const links = Array.isArray(parsed.links)
    ? parsed.links.map((link, index) => normalizeStoredLink(link, index + 1))
    : [];
  const maxId = links.reduce((result, link) => Math.max(result, link.id), 0);

  return {
    nextId: parsed.nextId && parsed.nextId > maxId ? parsed.nextId : maxId + 1,
    links,
  };
}

async function writeStore(store: LinkStoreFile) {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), "utf8");
}

async function mutateStore<T>(mutation: (store: LinkStoreFile) => Promise<T> | T) {
  const next = mutationQueue.then(async () => {
    const store = await readStore();
    const result = await mutation(store);
    await writeStore(store);
    return result;
  });

  mutationQueue = next.then(
    () => undefined,
    () => undefined,
  );

  return next;
}

function sortLinks(links: AdLink[]) {
  return [...links].sort((a, b) => b.id - a.id);
}

export function getStorePath() {
  return dataFile;
}

export function parseFiltersFromSearchParams(searchParams: URLSearchParams): LinkFilters {
  return {
    offer: searchParams.get("offer") ?? undefined,
    is_active: parseBooleanParam(searchParams.get("is_active")),
  };
}

export async function listLinks(filters: LinkFilters = {}) {
  const store = await readStore();

  return sortLinks(
    store.links.filter((link) => {
      if (filters.offer && link.offer !== filters.offer) return false;
      if (filters.is_active !== undefined && link.is_active !== filters.is_active) return false;
      return true;
    }),
  );
}

export async function listPendingGoogleAdsSyncItems(
  filters: GoogleAdsPendingSyncFilters = {},
) {
  const store = await readStore();
  const expectedCustomerId = normalizeGoogleAdsCustomerId(filters.customer_id);

  return sortLinks(store.links)
    .map(buildPendingGoogleAdsSyncItem)
    .filter((item): item is GoogleAdsPendingSyncItem => item !== null)
    .filter((item) => {
      if (!expectedCustomerId) {
        return true;
      }

      return normalizeGoogleAdsCustomerId(item.google_ads_customer_id) === expectedCustomerId;
    });
}

export async function listDueFinalUrlRefreshLinks(now = new Date()) {
  const store = await readStore();

  return sortLinks(store.links).filter((link) => isLinkDueForFinalUrlRefresh(link, now));
}

export async function createLink(input: AdLinkCreate) {
  return mutateStore((store) => {
    const data = validateCreateInput(input);
    const now = new Date().toISOString();
    const slug = buildUniqueSlug(null, data.name, store.links, store.nextId);
    let finalUrlBase: string | null = null;
    let finalUrlQuery: string | null = null;
    if (data.target_url) {
      const split = splitFinalUrl(data.target_url);
      finalUrlBase = split.finalUrlBase;
      finalUrlQuery = split.finalUrlQuery;
    }

  const link: AdLink = {
      id: store.nextId,
      slug,
      name: data.name,
      target_url: data.target_url,
      official_url: data.official_url,
      tracking_url: data.tracking_url,
      referer_url: data.referer_url,
      previous_target_url: null,
      final_url_base: finalUrlBase,
      final_url_query: finalUrlQuery,
      resolve_status: data.target_url ? "resolved" : "idle",
      sync_status: data.target_url ? "pending" : "pending",
      last_resolved_at: data.target_url ? now : null,
      last_resolve_error: null,
      last_resolved_ip: null,
      last_resolved_country_code: null,
      last_resolved_country_name: null,
      refresh_final_url_interval_hours: data.refresh_final_url_interval_hours,
      offer: data.offer,
      offer_id: data.offer_id,
      google_ads_account: data.google_ads_account,
      google_ads_customer_id: data.google_ads_customer_id,
      google_ads_entity_type: data.google_ads_entity_type,
      google_ads_entity_id: data.google_ads_entity_id,
      google_ads_last_synced_at: null,
      google_ads_last_synced_suffix: null,
      google_ads_last_sync_error: null,
      tracking_template: data.tracking_template,
      final_url_suffix: data.final_url_suffix,
      daily_budget: data.daily_budget,
      max_cpc: data.max_cpc,
      country_code: data.country_code,
      proxy_provider: data.proxy_provider,
      clicks_per_day_min: data.clicks_per_day_min,
      clicks_per_day_max: data.clicks_per_day_max,
      click_time_slots: data.click_time_slots,
      referer_sources: data.referer_sources,
      schedule_start_at: data.schedule_start_at,
      schedule_end_at: data.schedule_end_at,
      is_active: data.is_active,
      click_count: 0,
      auto_swap_enabled: data.auto_swap_enabled,
      auto_swap_interval_minutes: data.auto_swap_interval_minutes,
      auto_swap_started_at: data.auto_swap_enabled ? now : null,
      auto_swap_targets: data.auto_swap_targets,
      created_at: now,
      updated_at: now,
    };

    store.nextId += 1;
    store.links.push(link);
    return link;
  });
}

export async function updateLink(id: number, input: AdLinkUpdate) {
  return mutateStore((store) => {
    const update = validateUpdateInput(input);
    const link = store.links.find((item) => item.id === id);
    if (!link) throw buildError("链接不存在", 404);

    const nextLink: AdLink = {
      ...link,
      ...update,
      updated_at: new Date().toISOString(),
    };

    if (!nextLink.target_url && !nextLink.tracking_url) {
      throw buildError("联盟推广链接和最终链接至少要填写一个");
    }

    assertDailyClicksRange(nextLink.clicks_per_day_min, nextLink.clicks_per_day_max);
    assertSchedule(nextLink.schedule_start_at, nextLink.schedule_end_at);
    nextLink.referer_url = normalizeRefererUrl(nextLink.referer_url, nextLink.referer_sources);

    if (nextLink.target_url) {
      const split = splitFinalUrl(nextLink.target_url);
      nextLink.final_url_base = split.finalUrlBase;
      nextLink.final_url_query = split.finalUrlQuery;
    } else {
      nextLink.final_url_base = null;
      nextLink.final_url_query = null;
    }

    const autoSwapConfigChanged =
      update.auto_swap_enabled !== undefined ||
      update.auto_swap_interval_minutes !== undefined ||
      update.auto_swap_targets !== undefined;

    if (nextLink.auto_swap_enabled && (autoSwapConfigChanged || !nextLink.auto_swap_started_at)) {
      nextLink.auto_swap_started_at = nextLink.updated_at;
    }
    if (!nextLink.auto_swap_enabled) {
      nextLink.auto_swap_started_at = null;
    }

    const shouldResetSyncStatus =
      input.tracking_url !== undefined ||
      input.target_url !== undefined ||
      input.official_url !== undefined ||
      input.google_ads_customer_id !== undefined ||
      input.google_ads_entity_type !== undefined ||
      input.google_ads_entity_id !== undefined;

    if (shouldResetSyncStatus && nextLink.target_url) {
      nextLink.sync_status = "pending";
      nextLink.google_ads_last_sync_error = null;
    }

    if (input.sync_status === "synced") {
      nextLink.google_ads_last_synced_at = nextLink.updated_at;
      nextLink.google_ads_last_synced_suffix = toGoogleAdsSuffix(nextLink.final_url_query) || null;
      nextLink.google_ads_last_sync_error = null;
    }

    Object.assign(link, nextLink);
    return link;
  });
}

export async function markLinkSynced(id: number) {
  return mutateStore((store) => {
    const link = store.links.find((item) => item.id === id);
    if (!link) throw buildError("链接不存在", 404);

    link.sync_status = "synced";
    link.google_ads_last_synced_at = new Date().toISOString();
    link.google_ads_last_synced_suffix = toGoogleAdsSuffix(link.final_url_query) || null;
    link.google_ads_last_sync_error = null;
    link.updated_at = link.google_ads_last_synced_at;

    return link;
  });
}

export async function reportGoogleAdsSyncResult(input: GoogleAdsSyncReport) {
  return mutateStore((store) => {
    const link = store.links.find((item) => item.id === input.link_id);
    if (!link) {
      throw buildError("Google Ads sync target was not found", 404);
    }

    if (input.google_ads_customer_id) {
      const expectedCustomerId = normalizeGoogleAdsCustomerId(link.google_ads_customer_id);
      const actualCustomerId = normalizeGoogleAdsCustomerId(input.google_ads_customer_id);
      if (expectedCustomerId && actualCustomerId && expectedCustomerId !== actualCustomerId) {
        throw buildError("Google Ads customer ID does not match this record", 409);
      }
    }

    if (
      input.google_ads_entity_type !== undefined &&
      input.google_ads_entity_type !== link.google_ads_entity_type
    ) {
      throw buildError("Google Ads entity type does not match this record", 409);
    }

    if (input.google_ads_entity_id) {
      const expectedEntityId = normalizeGoogleAdsId(link.google_ads_entity_id);
      const actualEntityId = normalizeGoogleAdsId(input.google_ads_entity_id);
      if (expectedEntityId && actualEntityId && expectedEntityId !== actualEntityId) {
        throw buildError("Google Ads entity ID does not match this record", 409);
      }
    }

    const now = new Date().toISOString();
    if (input.status === "synced") {
      const expectedSuffix = toGoogleAdsSuffix(link.final_url_query);
      const appliedSuffix = input.applied_suffix?.trim() || expectedSuffix;

      if (!appliedSuffix) {
        throw buildError("No final URL suffix is available to mark as synced", 409);
      }

      if (expectedSuffix && appliedSuffix !== expectedSuffix) {
        throw buildError(
          "The suffix reported by Google Ads Script is stale. Resolve again before marking synced.",
          409,
        );
      }

      link.sync_status = "synced";
      link.google_ads_last_synced_at = now;
      link.google_ads_last_synced_suffix = appliedSuffix;
      link.google_ads_last_sync_error = null;
      link.updated_at = now;
      return link;
    }

    link.sync_status = "pending";
    link.google_ads_last_sync_error = input.error?.trim() || "Google Ads Script update failed";
    link.updated_at = now;
    return link;
  });
}

export async function deleteLink(id: number) {
  return mutateStore((store) => {
    const index = store.links.findIndex((item) => item.id === id);
    if (index === -1) throw buildError("链接不存在", 404);
    store.links.splice(index, 1);
  });
}

export async function refreshFinalUrl(id: number) {
  return mutateStore(async (store) => {
    const link = store.links.find((item) => item.id === id);
    if (!link) throw buildError("广告系列不存在", 404);
    if (!link.tracking_url) throw buildError("请先填写联盟推广链接", 400);

    try {
      const resolved = await resolveTrackingUrl(link);
      const now = new Date().toISOString();
      const previousFinalUrl = link.target_url || null;
      const changed = previousFinalUrl !== null && previousFinalUrl !== resolved.finalUrl;

      link.previous_target_url = previousFinalUrl;
      link.target_url = resolved.finalUrl;
      link.final_url_base = resolved.finalUrlBase;
      link.final_url_query = resolved.finalUrlQuery;
      link.sync_status = "pending";
      link.last_resolved_at = now;
      link.last_resolve_error = null;
      link.last_resolved_ip = resolved.resolvedIp ?? link.last_resolved_ip;
      link.last_resolved_country_code =
        resolved.resolvedCountryCode ?? link.last_resolved_country_code;
      link.last_resolved_country_name =
        resolved.resolvedCountryName ?? link.last_resolved_country_name;
      link.google_ads_last_sync_error = null;
      link.updated_at = now;

      link.resolve_status = changed ? "changed" : "resolved";

      return link;
    } catch (error) {
      link.resolve_status = "error";
      link.last_resolve_error = error instanceof Error ? error.message : "解析失败";
      link.updated_at = new Date().toISOString();
      throw error;
    }
  });
}

export async function refreshDueFinalUrls(limit?: number): Promise<RefreshDueLinksResult> {
  const dueLinks = await listDueFinalUrlRefreshLinks();
  const queue = typeof limit === "number" && limit > 0 ? dueLinks.slice(0, limit) : dueLinks;

  const result: RefreshDueLinksResult = {
    checked: dueLinks.length,
    refreshed: 0,
    skipped: Math.max(0, dueLinks.length - queue.length),
    failed: 0,
    refreshed_ids: [],
    failed_items: [],
  };

  for (const link of queue) {
    try {
      await refreshFinalUrl(link.id);
      result.refreshed += 1;
      result.refreshed_ids.push(link.id);
    } catch (error) {
      result.failed += 1;
      result.failed_items.push({
        id: link.id,
        name: link.name,
        error: error instanceof Error ? error.message : "Final URL refresh failed",
      });
    }
  }

  return result;
}

export async function getStats(): Promise<Stats> {
  const store = await readStore();
  const activeLinks = store.links.filter((link) => link.is_active);
  const autoSwapLinks = store.links.filter((link) => link.auto_swap_enabled);
  const offers = [
    ...new Set(store.links.map((link) => link.offer).filter((offer): offer is string => offer !== null)),
  ].sort();

  return {
    total_links: store.links.length,
    active_links: activeLinks.length,
    inactive_links: store.links.length - activeLinks.length,
    total_clicks: store.links.reduce((sum, link) => sum + link.click_count, 0),
    auto_swap_links: autoSwapLinks.length,
    offers,
  };
}

export async function resolveRedirectBySlug(slug: string) {
  return mutateStore((store) => {
    const link = store.links.find((item) => item.slug.toLowerCase() === slug.toLowerCase());
    if (!link || !link.is_active) {
      throw buildError("链接不存在或已停用", 404);
    }

    const resolved = resolveTarget(link);
    const targetUrl = resolved.targetUrl;
    if (!targetUrl) {
      throw buildError("当前广告系列没有可跳转的目标链接", 404);
    }

    link.click_count += 1;
    link.updated_at = new Date().toISOString();

    return {
      link,
      targetUrl,
      targetLabel: resolved.targetLabel,
      source: resolved.source,
    };
  });
}

function escapeCsvCell(value: string | number | boolean | null) {
  const stringValue = value === null ? "" : String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

export async function exportLinksCsv(filters: LinkFilters = {}) {
  const links = await listLinks(filters);
  const header = [
    "id",
    "slug",
    "name",
    "tracking_url",
    "referer_url",
    "target_url",
    "official_url",
    "previous_target_url",
    "final_url_base",
    "final_url_query",
    "resolve_status",
    "sync_status",
    "last_resolved_at",
    "last_resolve_error",
    "last_resolved_ip",
    "last_resolved_country_code",
    "last_resolved_country_name",
    "refresh_final_url_interval_hours",
    "offer",
    "offer_id",
    "google_ads_account",
    "google_ads_customer_id",
    "google_ads_entity_type",
    "google_ads_entity_id",
    "google_ads_last_synced_at",
    "google_ads_last_synced_suffix",
    "google_ads_last_sync_error",
    "country_code",
    "proxy_provider",
    "is_active",
    "click_count",
    "created_at",
    "updated_at",
  ];

  const rows = links.map((link) => [
    link.id,
    link.slug,
    link.name,
    link.tracking_url,
    link.referer_url,
    link.target_url,
    link.official_url,
    link.previous_target_url,
    link.final_url_base,
    link.final_url_query,
    link.resolve_status,
    link.sync_status,
    link.last_resolved_at,
    link.last_resolve_error,
    link.last_resolved_ip,
    link.last_resolved_country_code,
    link.last_resolved_country_name,
    link.refresh_final_url_interval_hours,
    link.offer,
    link.offer_id,
    link.google_ads_account,
    link.google_ads_customer_id,
    link.google_ads_entity_type,
    link.google_ads_entity_id,
    link.google_ads_last_synced_at,
    link.google_ads_last_synced_suffix,
    link.google_ads_last_sync_error,
    link.country_code,
    link.proxy_provider,
    link.is_active,
    link.click_count,
    link.created_at,
    link.updated_at,
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}
