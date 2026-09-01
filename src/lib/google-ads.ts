import type { GoogleAdsEntityType } from "@/types/ad-link";

export const googleAdsEntityOptions: Array<{
  value: GoogleAdsEntityType;
  label: string;
  description: string;
}> = [
  {
    value: "campaign",
    label: "广告系列",
    description: "把 Final URL suffix 更新到广告系列层级。",
  },
];

export function toGoogleAdsSuffix(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/^\?/, "");
}

export function normalizeGoogleAdsCustomerId(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function getGoogleAdsEntityLabel(_entityType: GoogleAdsEntityType) {
  return "广告系列";
}

export function buildGoogleAdsScriptTemplate(baseUrl: string) {
  const sanitizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return [
    "var BASE_URL = '" + sanitizedBaseUrl + "';",
    "var SCRIPT_TOKEN = 'REPLACE_ME';",
    "",
    "function main() {",
    "  var customerId = AdsApp.currentAccount().getCustomerId();",
    "  var items = fetchPendingItems(customerId);",
    "",
    "  if (!items.length) {",
    "    Logger.log('No pending suffix updates for ' + customerId);",
    "    return;",
    "  }",
    "",
    "  items.forEach(function (item) {",
    "    try {",
    "      applySuffixUpdate(item);",
    "      reportResult(item, 'synced', '');",
    "      Logger.log('Synced link #' + item.link_id + ' -> ' + item.final_url_suffix);",
    "    } catch (error) {",
    "      var message = error && error.message ? error.message : String(error);",
    "      reportResult(item, 'failed', message);",
    "      Logger.log('Failed link #' + item.link_id + ': ' + message);",
    "    }",
    "  });",
    "}",
    "",
    "function fetchPendingItems(customerId) {",
    "  var response = UrlFetchApp.fetch(",
    "    BASE_URL + '/api/google-ads/pending?customerId=' + encodeURIComponent(customerId),",
    "    {",
    "      method: 'get',",
    "      muteHttpExceptions: true,",
    "      headers: buildHeaders(),",
    "    }",
    "  );",
    "",
    "  return parseJsonResponse(response);",
    "}",
    "",
    "function applySuffixUpdate(item) {",
    "  var campaignIterator = AdsApp.campaigns().withIds([item.google_ads_entity_id]).withLimit(1).get();",
    "  if (!campaignIterator.hasNext()) {",
    "    throw new Error('Campaign not found: ' + item.google_ads_entity_id);",
    "  }",
    "",
    "  var campaign = campaignIterator.next();",
    "  campaign.urls().setFinalUrlSuffix(item.final_url_suffix);",
    "}",
    "",
    "function reportResult(item, status, errorMessage) {",
    "  var payload = {",
    "    link_id: item.link_id,",
    "    status: status,",
    "    google_ads_customer_id: item.google_ads_customer_id,",
    "    google_ads_entity_type: item.google_ads_entity_type,",
    "    google_ads_entity_id: item.google_ads_entity_id,",
    "  };",
    "",
    "  if (status === 'synced') {",
    "    payload.applied_suffix = item.final_url_suffix;",
    "  }",
    "",
    "  if (status === 'failed' && errorMessage) {",
    "    payload.error = errorMessage;",
    "  }",
    "",
    "  var response = UrlFetchApp.fetch(BASE_URL + '/api/google-ads/report', {",
    "    method: 'post',",
    "    contentType: 'application/json',",
    "    muteHttpExceptions: true,",
    "    headers: buildHeaders(),",
    "    payload: JSON.stringify(payload),",
    "  });",
    "",
    "  if (response.getResponseCode() >= 300) {",
    "    Logger.log('Report failed for link #' + item.link_id + ': ' + response.getContentText());",
    "  }",
    "}",
    "",
    "function buildHeaders() {",
    "  var headers = {};",
    "",
    "  if (SCRIPT_TOKEN && SCRIPT_TOKEN !== 'REPLACE_ME') {",
    "    headers['x-google-ads-script-token'] = SCRIPT_TOKEN;",
    "  }",
    "",
    "  return headers;",
    "}",
    "",
    "function parseJsonResponse(response) {",
    "  var text = response.getContentText();",
    "  var status = response.getResponseCode();",
    "  var data = text ? JSON.parse(text) : [];",
    "",
    "  if (status >= 300) {",
    "    throw new Error((data && data.detail) || ('Request failed with status ' + status));",
    "  }",
    "",
    "  return data;",
    "}",
  ].join("\n");
}
