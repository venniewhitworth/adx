import type {
  AdLink,
  AdLinkCreate,
  AdLinkUpdate,
  AutoSwapTarget,
  GoogleAdsPendingSyncItem,
  GoogleAdsSyncReport,
  RefreshDueLinksResult,
  Stats,
} from "@/types/ad-link";

async function request<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = init?.timeoutMs;
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const res = await fetch(path, {
      headers,
      signal: controller?.signal ?? init?.signal,
      ...init,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "请求失败");
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (error) {
    if (controller?.signal.aborted) {
      throw new Error("解析超时，请稍后重试");
    }
    throw error;
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

export const api = {
  getStats: () => request<Stats>("/api/stats"),

  listLinks: (params?: { offer?: string; is_active?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.offer) q.set("offer", params.offer);
    if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
    return request<AdLink[]>(`/api/links${q.toString() ? "?" + q : ""}`);
  },

  createLink: (body: AdLinkCreate) =>
    request<AdLink>("/api/links", { method: "POST", body: JSON.stringify(body) }),

  updateLink: (id: number, body: AdLinkUpdate) =>
    request<AdLink>(`/api/links/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteLink: (id: number) =>
    request<void>(`/api/links/${id}`, { method: "DELETE" }),

  resolveFinalUrl: (id: number) =>
    request<AdLink>(`/api/links/${id}/resolve`, { method: "POST", timeoutMs: 60000 }),

  refreshDueFinalUrls: (limit?: number) => {
    const q = typeof limit === "number" ? `?limit=${encodeURIComponent(String(limit))}` : "";
    return request<RefreshDueLinksResult>(`/api/links/refresh-due${q}`, { method: "POST" });
  },

  listPendingGoogleAdsSync: (customerId?: string) => {
    const q = customerId ? `?customerId=${encodeURIComponent(customerId)}` : "";
    return request<GoogleAdsPendingSyncItem[]>(`/api/google-ads/pending${q}`);
  },

  reportGoogleAdsSync: (body: GoogleAdsSyncReport) =>
    request<AdLink>("/api/google-ads/report", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  exportCsvUrl: (offer?: string) => {
    const q = offer ? `?offer=${encodeURIComponent(offer)}` : "";
    return `/api/links/export/csv${q}`;
  },
};

export type {
  AdLink,
  AdLinkCreate,
  AdLinkUpdate,
  AutoSwapTarget,
  GoogleAdsPendingSyncItem,
  GoogleAdsSyncReport,
  RefreshDueLinksResult,
  Stats,
};
