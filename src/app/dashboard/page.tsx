"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  ExternalLink,
  FileDown,
  Pencil,
  Plus,
  RefreshCcw,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  defaultRefreshFinalUrlInterval,
  refreshFinalUrlIntervalOptions,
} from "@/lib/final-url-refresh";
import {
  buildGoogleAdsScriptTemplate,
  getGoogleAdsEntityLabel,
  toGoogleAdsSuffix,
} from "@/lib/google-ads";
import {
  api,
  type AdLink,
  type AdLinkCreate,
  type AdLinkUpdate,
  type Stats,
} from "@/lib/api";
import type { RefreshFinalUrlIntervalHours } from "@/types/ad-link";

type QuickFormState = {
  name: string;
  trackingUrl: string;
  countryCode: string;
  refererPreset: string;
  refererUrl: string;
  refreshFinalUrlIntervalHours: string;
  targetUrl: string;
  offer: string;
  offerId: string;
  googleAdsAccount: string;
  googleAdsCustomerId: string;
  googleAdsEntityId: string;
  isActive: boolean;
};

const countryOptions = ["US", "CA", "GB", "DE", "FR", "IT", "PL", "UA", "HK", "AU", "JP", "SG", "BR"];
const defaultProxyProviderName = "IPRoyal Residential (US California Streaming)";
const defaultRefererPreset = "facebook";
const defaultRefererUrl = "https://www.facebook.com/";

const refererPresets = [
  { value: "facebook", label: "Facebook", url: "https://www.facebook.com/" },
  { value: "google", label: "Google", url: "https://www.google.com/" },
  { value: "instagram", label: "Instagram", url: "https://www.instagram.com/" },
  { value: "reddit", label: "Reddit", url: "https://www.reddit.com/" },
  { value: "tiktok", label: "TikTok", url: "https://www.tiktok.com/" },
  { value: "youtube", label: "YouTube", url: "https://www.youtube.com/" },
  { value: "custom", label: "自定义", url: "" },
];

const fieldClassName =
  "w-full rounded-2xl border border-[#E7E1DB] bg-white px-4 py-3 text-sm text-[#3D3530] placeholder:text-[#B3A59D] transition-colors focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/20";

const panelClassName =
  "rounded-[28px] border border-[#E7E1DB] bg-white shadow-[0_18px_44px_rgba(15,23,42,0.05)]";

function createEmptyFormState(): QuickFormState {
  return {
    name: "",
    trackingUrl: "",
    countryCode: "US",
    refererPreset: defaultRefererPreset,
    refererUrl: defaultRefererUrl,
    refreshFinalUrlIntervalHours: String(defaultRefreshFinalUrlInterval),
    targetUrl: "",
    offer: "",
    offerId: "",
    googleAdsAccount: "",
    googleAdsCustomerId: "",
    googleAdsEntityId: "",
    isActive: true,
  };
}

function createFormStateFromLink(link: AdLink): QuickFormState {
  const matchedPreset = refererPresets.find(
    (preset) => preset.url && preset.url === (link.referer_url ?? ""),
  );

  return {
    name: link.name,
    trackingUrl: link.tracking_url ?? "",
    countryCode: link.country_code ?? "US",
    refererPreset: matchedPreset?.value ?? (link.referer_url ? "custom" : defaultRefererPreset),
    refererUrl: link.referer_url ?? matchedPreset?.url ?? defaultRefererUrl,
    refreshFinalUrlIntervalHours: String(
      link.refresh_final_url_interval_hours ?? defaultRefreshFinalUrlInterval,
    ),
    targetUrl: link.target_url,
    offer: link.offer ?? "",
    offerId: link.offer_id ?? "",
    googleAdsAccount: link.google_ads_account ?? "",
    googleAdsCustomerId: link.google_ads_customer_id ?? "",
    googleAdsEntityId: link.google_ads_entity_id ?? "",
    isActive: link.is_active,
  };
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "暂无";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.replace("T", " ").slice(0, 19);
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function trimOrUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeRefererPayload(form: QuickFormState) {
  if (form.refererPreset === "custom") {
    return trimOrUndefined(form.refererUrl);
  }

  const preset = refererPresets.find((item) => item.value === form.refererPreset);
  return preset?.url ?? trimOrUndefined(form.refererUrl);
}

function buildPayload(form: QuickFormState): AdLinkCreate | AdLinkUpdate {
  const refreshInterval = form.refreshFinalUrlIntervalHours
    ? (Number(form.refreshFinalUrlIntervalHours) as RefreshFinalUrlIntervalHours)
    : null;

  return {
    name: form.name.trim(),
    tracking_url: trimOrUndefined(form.trackingUrl),
    target_url: trimOrUndefined(form.targetUrl),
    country_code: trimOrUndefined(form.countryCode),
    proxy_provider: defaultProxyProviderName,
    referer_url: normalizeRefererPayload(form),
    refresh_final_url_interval_hours: refreshInterval,
    offer: trimOrUndefined(form.offer),
    offer_id: trimOrUndefined(form.offerId),
    google_ads_account: trimOrUndefined(form.googleAdsAccount),
    google_ads_customer_id: trimOrUndefined(form.googleAdsCustomerId),
    google_ads_entity_type: "campaign",
    google_ads_entity_id: trimOrUndefined(form.googleAdsEntityId),
    is_active: form.isActive,
  };
}

function hasFinalUrlChanged(link: AdLink) {
  const previous = link.previous_target_url?.trim();
  const current = link.target_url?.trim();
  return Boolean(previous && current && previous !== current);
}

function getFinalUrlChangeSummary(link: AdLink) {
  if (!link.target_url) {
    return "还没有解析出最终 URL。";
  }

  if (hasFinalUrlChanged(link)) {
    return "这次解析结果和上一次不一样，说明最终链接或参数已经变了。";
  }

  if (link.previous_target_url) {
    return "这次解析结果和上一次一致，目前没有发现变化。";
  }

  return "这是当前保存的第一版最终 URL，后续有变化会直接显示在这里。";
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-[#D8E6DA] bg-[#F3F8F3] text-[#6B8F71]"
      : tone === "warning"
        ? "border-[#E8C7AC] bg-[#FDF2E9] text-[#C47A4A]"
        : tone === "danger"
          ? "border-[#F0D7C2] bg-[#FFF4EA] text-[#A85F2F]"
          : "border-[#E7E1DB] bg-[#FAFAFA] text-[#9A8E87]";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-medium ${toneClass}`}>
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className={`${panelClassName} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#9A8E87]">{label}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#ECE7E2] bg-[#F8F8F8] text-[#C4956A]">
          {icon}
        </div>
      </div>
      <div className={`mt-4 text-4xl font-light tracking-[-0.04em] ${accent}`}>{value}</div>
    </div>
  );
}

function ResultCard({
  link,
  copiedKey,
  onCopy,
}: {
  link: AdLink | null;
  copiedKey: string | null;
  onCopy: (text: string | null, key: string) => Promise<void>;
}) {
  if (!link) {
    return (
      <section className={`${panelClassName} flex min-h-[360px] items-center justify-center p-8`}>
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FBF6F1] text-[#C4956A]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-light text-[#3D3530]">先新建一条链接任务</h2>
          <p className="mt-3 text-sm leading-7 text-[#7D6E65]">
            填联盟链接、国家和 Referer，点一次“保存并解析”，右侧就会直接显示最终 URL 和 Google Ads 后缀。
          </p>
        </div>
      </section>
    );
  }

  const finalUrlSuffix = toGoogleAdsSuffix(link.final_url_query);
  const previousFinalUrl = link.previous_target_url || "暂无上一次记录";
  const lastSyncedSuffix = link.google_ads_last_synced_suffix || "还没有同步过";
  const finalUrlChanged = hasFinalUrlChanged(link);
  const suffixChangedSinceLastSync =
    Boolean(link.google_ads_last_synced_suffix) &&
    Boolean(finalUrlSuffix) &&
    link.google_ads_last_synced_suffix !== finalUrlSuffix;
  const resolveTone =
    link.resolve_status === "resolved"
      ? "success"
      : link.resolve_status === "changed"
        ? "warning"
        : link.resolve_status === "error"
          ? "danger"
          : "default";
  const syncTone = link.sync_status === "synced" ? "success" : "warning";

  return (
    <section className={`${panelClassName} p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E8DDD2] bg-[#FBF6F1] px-3 py-1 text-xs font-medium text-[#9A8E87]">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#C4956A]" />
            当前结果
          </div>
          <h2 className="mt-3 text-2xl font-light text-[#3D3530]">{link.name}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge
              label={
                link.resolve_status === "idle"
                  ? "未解析"
                  : link.resolve_status === "resolved"
                    ? "已解析"
                    : link.resolve_status === "changed"
                      ? "参数已变化"
                      : "解析失败"
              }
              tone={resolveTone}
            />
            <StatusBadge label={link.sync_status === "synced" ? "已同步" : "待同步"} tone={syncTone} />
            <StatusBadge label={link.is_active ? "启用中" : "已停用"} tone={link.is_active ? "success" : "default"} />
          </div>
        </div>
        <div className="rounded-2xl border border-[#E8DDD2] bg-[#FFFDFB] px-4 py-3 text-sm text-[#7D6E65]">
          <div>国家：{link.country_code || "未设置"}</div>
          <div className="mt-1">Referer：{link.referer_url || "未设置"}</div>
          <div className="mt-1">代理：{link.proxy_provider || defaultProxyProviderName}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {[
          {
            key: "final-url",
            label: "最终 URL",
            value: link.target_url || "还没解析出最终 URL",
          },
          {
            key: "ads-suffix",
            label: "Google Ads 后缀",
            value: finalUrlSuffix || "还没有可用后缀",
          },
        ].map((item) => (
          <div key={item.key} className="rounded-2xl border border-[#E8DDD2] bg-[#FFFCF8] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[#5E514A]">{item.label}</p>
              <button
                type="button"
                onClick={() => void onCopy(item.value, item.key)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#E8DDD2] bg-white px-3 py-2 text-xs font-medium text-[#5E514A] transition-colors hover:bg-[#FBF3EC]"
              >
                <Copy className="h-3.5 w-3.5" />
                {copiedKey === item.key ? "已复制" : "复制"}
              </button>
            </div>
            <p className="mt-3 break-all font-mono text-xs leading-6 text-[#6D5B50]">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#E8DDD2] bg-white p-4 text-sm text-[#7D6E65]">
          <p className="font-medium text-[#5E514A]">最近一次链接变化</p>
          <p className="mt-2 leading-7 text-[#6D5B50]">{getFinalUrlChangeSummary(link)}</p>
          <p className="mt-3 text-xs text-[#AA9E96]">当前最终 URL</p>
          <p className="mt-1 break-all font-mono text-xs leading-6 text-[#5E514A]">
            {link.target_url || "还没解析出最终 URL"}
          </p>
          <p className="mt-3 text-xs text-[#AA9E96]">上一次最终 URL</p>
          <p className="mt-1 break-all font-mono text-xs leading-6 text-[#7D6E65]">
            {previousFinalUrl}
          </p>
          <p className="mt-3 text-xs text-[#AA9E96]">
            变化判断：{finalUrlChanged ? "已变化" : "暂无变化"}
          </p>
        </div>

        <div className="rounded-2xl border border-[#E8DDD2] bg-white p-4 text-sm text-[#7D6E65]">
          <p className="font-medium text-[#5E514A]">Google Ads 同步对比</p>
          <p className="mt-2 text-xs text-[#AA9E96]">当前后缀</p>
          <p className="mt-1 break-all font-mono text-xs leading-6 text-[#5E514A]">
            {finalUrlSuffix || "还没有可用后缀"}
          </p>
          <p className="mt-3 text-xs text-[#AA9E96]">上次已同步后缀</p>
          <p className="mt-1 break-all font-mono text-xs leading-6 text-[#7D6E65]">
            {lastSyncedSuffix}
          </p>
          <p className="mt-3 text-xs text-[#AA9E96]">
            同步判断：
            {suffixChangedSinceLastSync
              ? "当前后缀和上次同步的不一样，脚本下次运行会继续更新。"
              : link.google_ads_last_synced_suffix
                ? "当前后缀和上次同步一致。"
                : "还没有成功同步记录。"}
          </p>
          <p className="mt-2 text-xs text-[#AA9E96]">
            最近同步时间：{formatDateTime(link.google_ads_last_synced_at)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#E8DDD2] bg-white p-4 text-sm text-[#7D6E65]">
          <p className="font-medium text-[#5E514A]">解析记录</p>
          <p className="mt-2">最近解析：{formatDateTime(link.last_resolved_at)}</p>
          <p className="mt-1">出口 IP：{link.last_resolved_ip || "暂无"}</p>
          <p className="mt-1">
            出口地区：
            {[link.last_resolved_country_code, link.last_resolved_country_name].filter(Boolean).join(" / ") || "暂无"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#E8DDD2] bg-white p-4 text-sm text-[#7D6E65]">
          <p className="font-medium text-[#5E514A]">投放信息</p>
          <p className="mt-2">同步层级：{getGoogleAdsEntityLabel(link.google_ads_entity_type)}</p>
          <p className="mt-1">Customer ID：{link.google_ads_customer_id || "未填写"}</p>
          <p className="mt-1">
            目标 ID：
            {link.google_ads_entity_id || "未填写"}
          </p>
        </div>
      </div>

      {link.last_resolve_error ? (
        <div className="mt-4 rounded-2xl border border-[#F0D7C2] bg-[#FFF4EA] px-4 py-3 text-sm text-[#A85F2F]">
          解析错误：{link.last_resolve_error}
        </div>
      ) : null}
    </section>
  );
}

function ScriptSetupCard({
  baseUrl,
  onBaseUrlChange,
  onCopy,
  copiedKey,
  readyCount,
}: {
  baseUrl: string;
  onBaseUrlChange: (value: string) => void;
  onCopy: (text: string | null, key: string) => Promise<void>;
  copiedKey: string | null;
  readyCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const scriptTemplate = buildGoogleAdsScriptTemplate(baseUrl || "https://your-domain.com");

  return (
    <section className={`${panelClassName} p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E8DDD2] bg-[#FBF6F1] px-3 py-1 text-xs font-medium text-[#9A8E87]">
            <Bot className="h-3.5 w-3.5 text-[#C4956A]" />
            Google Ads Script
          </div>
          <h2 className="mt-3 text-xl font-medium text-[#3D3530]">Google Ads 后缀怎么同步，看这里就够了</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[#7D6E65]">
            这里同步的不是完整最终网址，而是 Google Ads 里的 <code className="rounded bg-white px-1 py-0.5 text-xs text-[#5E514A]">Final URL suffix</code>。
            你在上面看到的“Google Ads 后缀”，就是等会儿要自动写进 Google Ads 的那一段参数。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#D8E6DA] bg-[#F3F8F3] px-4 py-3 text-sm text-[#6B8F71]">
            可同步记录：<span className="font-semibold">{readyCount}</span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#E8DDD2] bg-white px-4 py-3 text-sm font-medium text-[#5E514A] transition-colors hover:bg-[#FBF3EC]"
          >
            {expanded ? "收起" : "展开"}
            {expanded ? <ChevronUp className="h-4 w-4 text-[#C4956A]" /> : <ChevronDown className="h-4 w-4 text-[#C4956A]" />}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#E8DDD2] bg-[#FDF8F3] p-4">
              <p className="text-sm font-medium text-[#5E514A]">大白话流程</p>
              <ol className="mt-3 space-y-2 text-sm leading-7 text-[#7D6E65]">
                <li>1. 你先在这个后台保存链接，并把最终落地页解析出来。</li>
                <li>2. 系统会自动从最终 URL 里提取问号后面的参数，生成“Google Ads 后缀”。</li>
                <li>3. 你把下面这份脚本复制到 Google Ads Script 里，它会自己回后台拿“待同步”的后缀。</li>
                <li>4. 脚本拿到后缀后，会直接写到你填写的广告系列 Final URL suffix 里。</li>
                <li>5. 写成功后，脚本会回传结果，这条记录就会从“待同步”变成“已同步”。</li>
              </ol>
            </div>

            <div className="rounded-2xl border border-[#E8DDD2] bg-white p-4">
              <p className="text-sm font-medium text-[#5E514A]">你实际要做的事</p>
              <ol className="mt-3 space-y-2 text-sm leading-7 text-[#7D6E65]">
                <li>1. 先把站点部署到公网，下面这个“后台公网地址”要能被 Google Ads Script 访问到。</li>
                <li>2. 在环境变量里加上 `GOOGLE_ADS_SCRIPT_TOKEN`，用来保护两个同步接口。</li>
                <li>3. 在每条记录里填好 `Google Ads Customer ID`。</li>
                <li>4. 再填好广告系列 ID。</li>
                <li>5. 复制脚本，把里面的 `REPLACE_ME` 换成你的 `GOOGLE_ADS_SCRIPT_TOKEN`。</li>
                <li>6. 这份脚本已经是兼容版，会同时用请求头和 URL 参数带上 token，专门避免部分 Google Ads Script 环境下只传 header 还会 401 的问题。</li>
                <li>7. 先在 Google Ads Script 里点“预览”测试，确认能拉到待同步数据，再设置定时运行。</li>
              </ol>
            </div>

            <div className="rounded-2xl border border-[#E8DDD2] bg-white p-4">
              <p className="text-sm font-medium text-[#5E514A]">Google Ads 脚本执行时间怎么设</p>
              <ol className="mt-3 space-y-2 text-sm leading-7 text-[#7D6E65]">
                <li>1. 打开 Google Ads 后台。</li>
                <li>2. 进入“工具”或“批量操作”里的 `Scripts`。</li>
                <li>3. 新建一个脚本，把右边复制出来的模板粘进去。</li>
                <li>4. 把脚本里的 `REPLACE_ME` 改成你的 `GOOGLE_ADS_SCRIPT_TOKEN`。</li>
                <li>5. 保存后先点一次“预览”或“运行”，如果日志出现 `No pending suffix updates for ...`，说明鉴权已经通了，只是当前没有待同步记录。</li>
                <li>6. 再在 Google Ads 里给这个脚本设置执行时间，比如每 15 分钟一次。</li>
              </ol>
              <p className="mt-3 text-xs leading-6 text-[#AA9E96]">
                这个执行时间需要你在 Google Ads 那边单独设置一次，后台这里负责生成脚本和提供同步接口，不能替你去 Google Ads 里自动点计划任务。
              </p>
            </div>

            <div className="rounded-2xl border border-[#E8DDD2] bg-white p-4">
              <p className="text-sm font-medium text-[#5E514A]">高频自动刷新怎么开</p>
              <ol className="mt-3 space-y-2 text-sm leading-7 text-[#7D6E65]">
                <li>1. 如果你在链接里选了 `每 30 秒` 或 `每 1 分钟`，需要单独启动高频刷新 worker。</li>
                <li>2. 本地直接运行 `npm run worker:refresh-due`。</li>
                <li>3. 默认是每 30 秒轮询一次，如果想改成 1 分钟，把 `REFRESH_DUE_POLL_INTERVAL_MS=60000` 写进环境变量。</li>
                <li>4. 这个高频 worker 负责重新解析联盟链接，和 Google Ads Script 不是一回事。</li>
              </ol>
              <div className="mt-3 rounded-2xl border border-[#E8DDD2] bg-[#FFFCF8] p-3 font-mono text-xs leading-6 text-[#6D5B50]">
                npm run worker:refresh-due
              </div>
            </div>

            <div className="rounded-2xl border border-[#E8DDD2] bg-[#FFFDFB] p-4 text-sm leading-7 text-[#7D6E65]">
              <p className="font-medium text-[#5E514A]">你会看到什么结果</p>
              <p className="mt-2">
                如果脚本成功，这条链接的同步状态会变成“已同步”，并记录最近一次同步时间。
              </p>
              <p className="mt-2">
                如果脚本没找到对应的广告系列，或者 Token 不对，这条记录会继续停留在“待同步”。
              </p>
              <p className="mt-2">
                如果你 later 又重新解析出新的最终参数，这条记录会自动回到“待同步”，等下一次脚本继续更新。
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#5E514A]">后台公网地址</label>
              <input
                value={baseUrl}
                onChange={(event) => onBaseUrlChange(event.target.value)}
                placeholder="https://your-domain.com"
                className={fieldClassName}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#5E514A]">可直接复制的脚本模板</p>
                <p className="mt-1 text-xs text-[#AA9E96]">
                  把 `REPLACE_ME` 换成你的 `GOOGLE_ADS_SCRIPT_TOKEN`。这份是兼容版脚本，会同时走 header 和 URL 参数鉴权。
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onCopy(scriptTemplate, "script-template")}
                className="rounded-xl bg-[#C4956A] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#B37A52]"
              >
                {copiedKey === "script-template" ? "脚本已复制" : "复制脚本"}
              </button>
            </div>

            <textarea
              value={scriptTemplate}
              readOnly
              rows={22}
              className="w-full rounded-2xl border border-[#443730] bg-[#2D2622] px-4 py-4 font-mono text-xs leading-6 text-[#F5EDE6] focus:outline-none"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function DashboardPage() {
  const [links, setLinks] = useState<AdLink[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [form, setForm] = useState<QuickFormState>(createEmptyFormState);
  const [selectedLinkId, setSelectedLinkId] = useState<number | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [refreshingDue, setRefreshingDue] = useState(false);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  async function load(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

    try {
      if (!silent) {
        setLoading(true);
      }
      const [linksData, statsData] = await Promise.all([api.listLinks(), api.getStats()]);
      setLinks(linksData);
      setStats(statsData);
      setError("");

      setSelectedLinkId((current) => {
        if (current && linksData.some((link) => link.id === current)) {
          return current;
        }
        return linksData[0]?.id ?? null;
      });
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "无法连接后台服务");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void load({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const selectedLink = useMemo(
    () => links.find((link) => link.id === selectedLinkId) ?? null,
    [links, selectedLinkId],
  );

  const filteredLinks = useMemo(() => {
    if (!deferredSearch) {
      return links;
    }

    return links.filter((link) =>
      [
        link.name,
        link.offer ?? "",
        link.target_url,
        link.tracking_url ?? "",
        link.google_ads_customer_id ?? "",
      ].some((value) => value.toLowerCase().includes(deferredSearch)),
    );
  }, [deferredSearch, links]);

  const pendingSyncCount = links.filter((link) => link.sync_status === "pending").length;
  const scriptReadyCount = links.filter(
    (link) =>
      link.is_active &&
      Boolean(link.final_url_base) &&
      Boolean(toGoogleAdsSuffix(link.final_url_query)) &&
      Boolean(link.google_ads_customer_id) &&
      Boolean(link.google_ads_entity_id),
  ).length;

  function resetForm() {
    setForm(createEmptyFormState());
    setEditingLinkId(null);
    setShowAdvanced(false);
  }

  function handlePresetChange(value: string) {
    const preset = refererPresets.find((item) => item.value === value);
    setForm((current) => ({
      ...current,
      refererPreset: value,
      refererUrl: value === "custom" ? current.refererUrl : (preset?.url ?? current.refererUrl),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      const payload = buildPayload(form);
      let saved: AdLink;
      if (editingLinkId) {
        saved = await api.updateLink(editingLinkId, payload);
      } else {
        saved = await api.createLink(payload as AdLinkCreate);
      }

      const resolved = await api.resolveFinalUrl(saved.id);
      await load();
      setSelectedLinkId(resolved.id);
      setEditingLinkId(resolved.id);
      setForm(createFormStateFromLink(resolved));
      setShowAdvanced(false);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve(link: AdLink) {
    try {
      setResolvingId(link.id);
      setError("");
      const resolved = await api.resolveFinalUrl(link.id);
      await load();
      setSelectedLinkId(resolved.id);
      if (editingLinkId === resolved.id) {
        setForm(createFormStateFromLink(resolved));
      }
    } catch (resolveError: unknown) {
      setError(resolveError instanceof Error ? resolveError.message : "解析最终 URL 失败");
    } finally {
      setResolvingId(null);
    }
  }

  async function handleDelete(link: AdLink) {
    if (!window.confirm(`确认删除“${link.name}”吗？此操作不可恢复。`)) {
      return;
    }

    try {
      await api.deleteLink(link.id);
      await load();
      if (editingLinkId === link.id) {
        resetForm();
      }
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    }
  }

  async function handleToggle(link: AdLink) {
    try {
      const updated = await api.updateLink(link.id, { is_active: !link.is_active });
      await load();
      if (editingLinkId === updated.id) {
        setForm(createFormStateFromLink(updated));
      }
    } catch (toggleError: unknown) {
      setError(toggleError instanceof Error ? toggleError.message : "状态更新失败");
    }
  }

  async function handleRefreshDueLinks() {
    try {
      setRefreshingDue(true);
      setError("");
      const result = await api.refreshDueFinalUrls();
      await load();

      if (result.refreshed === 0 && result.failed === 0) {
        setError("当前没有到期需要刷新的记录。");
        return;
      }

      if (result.failed > 0) {
        const firstError = result.failed_items[0]?.error ?? "部分记录刷新失败";
        setError(`已刷新 ${result.refreshed} 条，到期失败 ${result.failed} 条。首个错误：${firstError}`);
      }
    } catch (refreshError: unknown) {
      setError(refreshError instanceof Error ? refreshError.message : "批量刷新失败");
    } finally {
      setRefreshingDue(false);
    }
  }

  async function copyToClipboard(text: string | null, key: string) {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setError("复制失败，请手动复制");
    }
  }

  function startEditing(link: AdLink) {
    setEditingLinkId(link.id);
    setSelectedLinkId(link.id);
    setForm(createFormStateFromLink(link));
    setShowAdvanced(Boolean(link.offer || link.offer_id || link.google_ads_customer_id || link.google_ads_entity_id));
  }

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#3D3530]">
      <header className="sticky top-0 z-40 border-b border-[#ECE7E2] bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between px-6 py-4 lg:px-8">
          <div>
            <div className="text-2xl font-medium tracking-[-0.03em]">AdX Kit</div>
            <p className="mt-1 text-sm text-[#9A8E87]">填链接，点解析，直接拿结果</p>
          </div>
          <Link href="/" className="text-sm text-[#8B7A70] transition-colors hover:text-[#C4956A]">
            返回官网
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1480px] space-y-6 px-6 py-8 lg:px-8">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="链接总数" value={stats?.total_links ?? "-"} icon={<Sparkles className="h-4 w-4" />} accent="text-[#3D3530]" />
          <MetricCard label="启用中" value={stats?.active_links ?? "-"} icon={<CheckCircle2 className="h-4 w-4" />} accent="text-[#C4956A]" />
          <MetricCard label="待同步" value={pendingSyncCount} icon={<Clock3 className="h-4 w-4" />} accent="text-[#C47A4A]" />
          <MetricCard label="可脚本同步" value={scriptReadyCount} icon={<Settings2 className="h-4 w-4" />} accent="text-[#6B8F71]" />
        </section>

        <div className="rounded-2xl border border-[#E8DDD2] bg-[#FFFDFB] px-4 py-3 text-sm leading-7 text-[#7D6E65]">
          这个页面现在会每 5 秒自动拉一次最新数据。你选了 `每 30 秒` 或 `每 1 分钟` 自动刷新后，只要后台 worker 已经在跑，链接一变这里就会自己显示出来。
        </div>

        {error ? (
          <div className="rounded-2xl border border-[#F0D7C2] bg-[#FFF4EA] px-4 py-3 text-sm text-[#A85F2F]">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <section className={`${panelClassName} p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E8DDD2] bg-[#FBF6F1] px-3 py-1 text-xs font-medium text-[#9A8E87]">
                  <Plus className="h-3.5 w-3.5 text-[#C4956A]" />
                  快速新建
                </div>
                <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-[#3D3530]">
                  {editingLinkId ? "编辑并重新解析" : "保存并解析一条新链接"}
                </h1>
                <p className="mt-3 text-sm leading-7 text-[#7D6E65]">
                  第一次使用时只管填名字、联盟链接、国家和 Referer。短码会在系统内部自动生成，保存后系统会马上解析，右侧直接给你结果。
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-[#E8DDD2] bg-white px-4 py-2.5 text-sm font-medium text-[#5E514A] transition-colors hover:bg-[#FBF3EC]"
              >
                新建空白
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#5E514A]">任务名称</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="例如：COSMO-US"
                  required
                  className={fieldClassName}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#5E514A]">联盟跟踪链接</label>
                <textarea
                  value={form.trackingUrl}
                  onChange={(event) => setForm((current) => ({ ...current, trackingUrl: event.target.value }))}
                  placeholder="https://www.linkhaitao.com/index.php?mod=lhdeal&track=..."
                  rows={4}
                  required
                  className={fieldClassName}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5E514A]">国家</label>
                  <select
                    value={form.countryCode}
                    onChange={(event) => setForm((current) => ({ ...current, countryCode: event.target.value }))}
                    className={fieldClassName}
                  >
                    {countryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5E514A]">
                    自动刷新（默认每 1 小时）
                  </label>
                  <select
                    value={form.refreshFinalUrlIntervalHours}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, refreshFinalUrlIntervalHours: event.target.value }))
                    }
                    className={fieldClassName}
                  >
                    <option value="">手动刷新</option>
                    {refreshFinalUrlIntervalOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E8DDD2] bg-[#FFFCF8] p-4">
                <div className="grid gap-4 md:grid-cols-[0.44fr_0.56fr]">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#5E514A]">Referer 来源</label>
                    <select
                      value={form.refererPreset}
                      onChange={(event) => handlePresetChange(event.target.value)}
                      className={fieldClassName}
                    >
                      {refererPresets.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#5E514A]">Referer URL</label>
                    <input
                      value={form.refererUrl}
                      onChange={(event) => setForm((current) => ({ ...current, refererUrl: event.target.value, refererPreset: "custom" }))}
                      placeholder={defaultRefererUrl}
                      className={fieldClassName}
                    />
                  </div>
                </div>
                <p className="mt-3 text-xs leading-6 text-[#AA9E96]">
                  这个值会像 `jing-link-rotation` 那样真正作为 `Referer` 请求头带出去，不只是做标签记录。
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8DDD2] bg-[#FBF6F1] px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-[#5E514A]">高级设置</p>
                  <p className="mt-1 text-xs leading-6 text-[#AA9E96]">
                    默认代理已固定为 IPRoyal，Google Ads 同步层级也固定为广告系列。这里只有投放和覆盖项需要补充。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E8DDD2] bg-white px-4 py-2.5 text-sm font-medium text-[#5E514A] transition-colors hover:bg-[#FBF3EC]"
                >
                  {showAdvanced ? "收起高级设置" : "展开高级设置"}
                  {showAdvanced ? <ChevronUp className="h-4 w-4 text-[#C4956A]" /> : <ChevronDown className="h-4 w-4 text-[#C4956A]" />}
                </button>
              </div>

              {showAdvanced ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#5E514A]">手动覆盖最终 URL</label>
                    <input
                      value={form.targetUrl}
                      onChange={(event) => setForm((current) => ({ ...current, targetUrl: event.target.value }))}
                      placeholder="不填就走自动解析"
                      className={fieldClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#5E514A]">Offer</label>
                    <input
                      value={form.offer}
                      onChange={(event) => setForm((current) => ({ ...current, offer: event.target.value }))}
                      className={fieldClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#5E514A]">Offer ID</label>
                    <input
                      value={form.offerId}
                      onChange={(event) => setForm((current) => ({ ...current, offerId: event.target.value }))}
                      className={fieldClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#5E514A]">Google Ads 账户备注</label>
                    <input
                      value={form.googleAdsAccount}
                      onChange={(event) => setForm((current) => ({ ...current, googleAdsAccount: event.target.value }))}
                      className={fieldClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#5E514A]">Google Ads Customer ID</label>
                    <input
                      value={form.googleAdsCustomerId}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, googleAdsCustomerId: event.target.value }))
                      }
                      placeholder="123-456-7890"
                      className={fieldClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#5E514A]">默认代理</label>
                    <input
                      value={defaultProxyProviderName}
                      readOnly
                      className={`${fieldClassName} bg-[#F7F4F0] text-[#7D6E65]`}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#5E514A]">同步层级</label>
                    <input value="广告系列" readOnly className={`${fieldClassName} bg-[#F7F4F0] text-[#7D6E65]`} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#5E514A]">广告系列 ID</label>
                    <input
                      value={form.googleAdsEntityId}
                      onChange={(event) => setForm((current) => ({ ...current, googleAdsEntityId: event.target.value }))}
                      className={fieldClassName}
                    />
                  </div>
                  <label className="inline-flex items-center gap-3 rounded-2xl border border-[#E8DDD2] bg-white px-4 py-3 text-sm text-[#5E514A] md:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                      className="h-4 w-4 rounded border-[#DCCABB] text-[#C4956A] focus:ring-[#C4956A]"
                    />
                    启用这条记录
                  </label>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#C4956A] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#B37A52] disabled:opacity-50"
                >
                  <RefreshCcw className={`h-4 w-4 ${submitting ? "animate-spin" : ""}`} />
                  {submitting ? "保存并解析中..." : editingLinkId ? "保存并重新解析" : "保存并解析"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRefreshDueLinks()}
                  disabled={refreshingDue}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#E8DDD2] bg-white px-5 py-3 text-sm font-medium text-[#5E514A] transition-colors hover:bg-[#FBF3EC] disabled:opacity-50"
                >
                  <Clock3 className="h-4 w-4" />
                  {refreshingDue ? "刷新到期记录中..." : "执行到期刷新"}
                </button>
                <a
                  href={api.exportCsvUrl()}
                  download
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#E8DDD2] bg-white px-5 py-3 text-sm font-medium text-[#5E514A] transition-colors hover:bg-[#FBF3EC]"
                >
                  <FileDown className="h-4 w-4" />
                  导出 CSV
                </a>
              </div>
            </form>
          </section>

          <ResultCard link={selectedLink} copiedKey={copiedKey} onCopy={copyToClipboard} />
        </section>

        <section className={`${panelClassName} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE3D8] px-6 py-5">
            <div>
              <h2 className="text-xl font-medium text-[#3D3530]">链接列表</h2>
              <p className="mt-1 text-sm text-[#9A8E87]">点一条记录就能直接查看结果，也可以继续编辑或重新解析。</p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索名称、Offer 或链接"
              className="w-full max-w-sm rounded-2xl border border-[#E8DDD2] bg-[#FFFDFB] px-4 py-3 text-sm text-[#3D3530] placeholder:text-[#B3A59D] focus:border-[#C4956A] focus:outline-none focus:ring-2 focus:ring-[#C4956A]/20"
            />
          </div>

          {loading ? (
            <div className="px-6 py-20 text-center text-[#AA9E96]">加载中...</div>
          ) : filteredLinks.length === 0 ? (
            <div className="px-6 py-20 text-center text-[#AA9E96]">还没有记录，先创建一条链接任务。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#FAFAFA] text-left text-[#9A8E87]">
                  <tr>
                    <th className="px-6 py-4 font-medium">任务</th>
                    <th className="px-6 py-4 font-medium">Referer / 投放</th>
                    <th className="px-6 py-4 font-medium">最终结果</th>
                    <th className="px-6 py-4 font-medium">状态</th>
                    <th className="px-6 py-4 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1E7DD]">
                  {filteredLinks.map((link) => {
                    const adsSuffix = toGoogleAdsSuffix(link.final_url_query);
                    const isSelected = selectedLinkId === link.id;

                    return (
                      <tr
                        key={link.id}
                        className={`cursor-pointer transition-colors ${isSelected ? "bg-[#FFFCF8]" : "hover:bg-[#FAFAFA]"}`}
                        onClick={() => setSelectedLinkId(link.id)}
                      >
                        <td className="px-6 py-5 align-top">
                          <div className="font-semibold text-[#1D2129]">{link.name}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#9A8E87]">
                            <span>{link.offer || "未填写 Offer"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 align-top">
                          <div className="break-all text-xs leading-6 text-[#5E514A]">{link.referer_url || "未设置 Referer"}</div>
                          <div className="mt-2 text-xs leading-6 text-[#AA9E96]">Customer ID：{link.google_ads_customer_id || "未填写"}</div>
                          <div className="mt-1 text-xs leading-6 text-[#AA9E96]">广告系列 ID：{link.google_ads_entity_id || "未填写"}</div>
                        </td>
                        <td className="px-6 py-5 align-top">
                          <div className="break-all font-mono text-xs leading-6 text-[#5E514A]">
                            {link.target_url || "尚未解析出最终 URL"}
                          </div>
                          <div className="mt-2 break-all text-xs leading-6 text-[#C47A4A]">
                            上一次：{link.previous_target_url || "暂无上一次记录"}
                          </div>
                          <div className="mt-2 break-all text-xs leading-6 text-[#AA9E96]">
                            Ads 后缀：{adsSuffix || "暂无"}
                          </div>
                          <div className="mt-1 break-all text-xs leading-6 text-[#AA9E96]">
                            上次已同步后缀：{link.google_ads_last_synced_suffix || "还没有同步过"}
                          </div>
                          <div className="mt-2 text-xs text-[#AA9E96]">最近解析：{formatDateTime(link.last_resolved_at)}</div>
                        </td>
                        <td className="px-6 py-5 align-top">
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge
                              label={
                                link.resolve_status === "idle"
                                  ? "未解析"
                                  : link.resolve_status === "resolved"
                                    ? "已解析"
                                    : link.resolve_status === "changed"
                                      ? "参数已变化"
                                      : "解析失败"
                              }
                              tone={
                                link.resolve_status === "resolved"
                                  ? "success"
                                  : link.resolve_status === "changed"
                                    ? "warning"
                                    : link.resolve_status === "error"
                                      ? "danger"
                                      : "default"
                              }
                            />
                            <StatusBadge
                              label={link.sync_status === "synced" ? "已同步" : "待同步"}
                              tone={link.sync_status === "synced" ? "success" : "warning"}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-5 align-top">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                startEditing(link);
                              }}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E8DDD2] bg-white text-[#9A8E87] transition-colors hover:bg-[#FBF3EC] hover:text-[#C4956A]"
                              title="编辑"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleResolve(link);
                              }}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E8DDD2] bg-white text-[#9A8E87] transition-colors hover:bg-[#FBF3EC] hover:text-[#C4956A]"
                              title="重新解析"
                              disabled={resolvingId === link.id}
                            >
                              <RefreshCcw className={`h-4 w-4 ${resolvingId === link.id ? "animate-spin" : ""}`} />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleToggle(link);
                              }}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E8DDD2] bg-white text-[#9A8E87] transition-colors hover:bg-[#FBF3EC] hover:text-[#C4956A]"
                              title={link.is_active ? "停用" : "启用"}
                            >
                              {link.is_active ? <Settings2 className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDelete(link);
                              }}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E8DDD2] bg-white text-[#C47A4A] transition-colors hover:bg-[#FFF4EB] hover:text-[#B96E41]"
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <ScriptSetupCard
          baseUrl={baseUrl}
          onBaseUrlChange={setBaseUrl}
          onCopy={copyToClipboard}
          copiedKey={copiedKey}
          readyCount={scriptReadyCount}
        />
      </main>
    </div>
  );
}
