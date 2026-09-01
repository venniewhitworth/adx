export interface AutoSwapTarget {
  label: string;
  target_url: string;
  is_active: boolean;
}

export type ResolveStatus = "idle" | "resolved" | "changed" | "error";
export type SyncStatus = "pending" | "synced";
export type GoogleAdsEntityType = "campaign";
export type RefreshFinalUrlIntervalHours =
  | 0.5
  | 1
  | 10
  | 30
  | 60
  | 120
  | 360
  | 720
  | 1440
  | 2880;

export interface AdLink {
  id: number;
  slug: string;
  name: string;
  target_url: string;
  tracking_url: string | null;
  referer_url: string | null;
  previous_target_url: string | null;
  final_url_base: string | null;
  final_url_query: string | null;
  resolve_status: ResolveStatus;
  sync_status: SyncStatus;
  last_resolved_at: string | null;
  last_resolve_error: string | null;
  last_resolved_ip: string | null;
  last_resolved_country_code: string | null;
  last_resolved_country_name: string | null;
  refresh_final_url_interval_hours: RefreshFinalUrlIntervalHours | null;
  offer: string | null;
  offer_id: string | null;
  google_ads_account: string | null;
  google_ads_customer_id: string | null;
  google_ads_entity_type: GoogleAdsEntityType;
  google_ads_entity_id: string | null;
  google_ads_last_synced_at: string | null;
  google_ads_last_synced_suffix: string | null;
  google_ads_last_sync_error: string | null;
  tracking_template: string | null;
  final_url_suffix: string | null;
  daily_budget: number | null;
  max_cpc: number | null;
  country_code: string | null;
  proxy_provider: string | null;
  clicks_per_day_min: number | null;
  clicks_per_day_max: number | null;
  click_time_slots: string[];
  referer_sources: string[];
  schedule_start_at: string | null;
  schedule_end_at: string | null;
  is_active: boolean;
  click_count: number;
  auto_swap_enabled: boolean;
  auto_swap_interval_minutes: number | null;
  auto_swap_started_at: string | null;
  auto_swap_targets: AutoSwapTarget[];
  created_at: string;
  updated_at: string;
}

export interface AdLinkCreate {
  name: string;
  target_url?: string;
  tracking_url?: string;
  referer_url?: string;
  offer?: string;
  offer_id?: string;
  refresh_final_url_interval_hours?: RefreshFinalUrlIntervalHours | null;
  google_ads_account?: string;
  google_ads_customer_id?: string;
  google_ads_entity_type?: GoogleAdsEntityType;
  google_ads_entity_id?: string;
  tracking_template?: string;
  final_url_suffix?: string;
  daily_budget?: number;
  max_cpc?: number;
  country_code?: string;
  proxy_provider?: string;
  clicks_per_day_min?: number;
  clicks_per_day_max?: number;
  click_time_slots?: string[];
  referer_sources?: string[];
  schedule_start_at?: string;
  schedule_end_at?: string;
  is_active?: boolean;
  auto_swap_enabled?: boolean;
  auto_swap_interval_minutes?: number;
  auto_swap_targets?: AutoSwapTarget[];
}

export interface AdLinkUpdate {
  name?: string;
  target_url?: string;
  tracking_url?: string;
  referer_url?: string;
  offer?: string;
  offer_id?: string;
  refresh_final_url_interval_hours?: RefreshFinalUrlIntervalHours | null;
  google_ads_account?: string;
  google_ads_customer_id?: string;
  google_ads_entity_type?: GoogleAdsEntityType;
  google_ads_entity_id?: string;
  tracking_template?: string;
  final_url_suffix?: string;
  daily_budget?: number;
  max_cpc?: number;
  country_code?: string;
  proxy_provider?: string;
  clicks_per_day_min?: number;
  clicks_per_day_max?: number;
  click_time_slots?: string[];
  referer_sources?: string[];
  schedule_start_at?: string;
  schedule_end_at?: string;
  is_active?: boolean;
  note?: string;
  auto_swap_enabled?: boolean;
  auto_swap_interval_minutes?: number;
  auto_swap_targets?: AutoSwapTarget[];
  sync_status?: SyncStatus;
}

export interface ResolveResult {
  finalUrl: string;
  finalUrlBase: string;
  finalUrlQuery: string | null;
  resolvedIp: string | null;
  resolvedCountryCode: string | null;
  resolvedCountryName: string | null;
}

export interface GoogleAdsPendingSyncItem {
  link_id: number;
  slug: string;
  name: string;
  google_ads_account: string | null;
  google_ads_customer_id: string;
  google_ads_entity_type: GoogleAdsEntityType;
  google_ads_entity_id: string;
  final_url_base: string;
  final_url_suffix: string;
  target_url: string;
  updated_at: string;
}

export interface GoogleAdsPendingSyncFilters {
  customer_id?: string;
}

export interface GoogleAdsSyncReport {
  link_id: number;
  status: "synced" | "failed";
  applied_suffix?: string;
  error?: string;
  google_ads_customer_id?: string;
  google_ads_entity_type?: GoogleAdsEntityType;
  google_ads_entity_id?: string;
}

export interface RefreshDueLinksResult {
  checked: number;
  refreshed: number;
  skipped: number;
  failed: number;
  refreshed_ids: number[];
  failed_items: Array<{
    id: number;
    name: string;
    error: string;
  }>;
}

export interface Stats {
  total_links: number;
  active_links: number;
  inactive_links: number;
  total_clicks: number;
  auto_swap_links: number;
  offers: string[];
}

export interface LinkFilters {
  offer?: string;
  is_active?: boolean;
}
