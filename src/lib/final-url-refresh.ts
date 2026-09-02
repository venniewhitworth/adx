import type { RefreshFinalUrlIntervalHours } from "@/types/ad-link";

export const defaultRefreshFinalUrlInterval: RefreshFinalUrlIntervalHours = 60;

export const refreshFinalUrlIntervalOptions: Array<{
  value: RefreshFinalUrlIntervalHours;
  label: string;
}> = [
  { value: 0.5, label: "每 30 秒" },
  { value: 1, label: "每 1 分钟" },
  { value: 10, label: "每 10 分钟" },
  { value: 30, label: "每 30 分钟" },
  { value: 60, label: "每 1 小时" },
  { value: 120, label: "每 2 小时" },
  { value: 360, label: "每 6 小时" },
  { value: 720, label: "每 12 小时" },
  { value: 1440, label: "每 24 小时" },
  { value: 2880, label: "每 48 小时" },
];

export function getRefreshIntervalLabel(value: RefreshFinalUrlIntervalHours | null | undefined) {
  const option = refreshFinalUrlIntervalOptions.find((item) => item.value === value);
  return option?.label ?? "手动刷新";
}
