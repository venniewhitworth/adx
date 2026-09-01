"use client";

import Image from "next/image";
import Link from "next/link";

const heroFeatures = [
  "MCC账号一键同步，无需手动维护",
  "15分钟数据双向同步，无需API审批",
  "补点击算法精准匹配自然流量特征",
  "AI生成高转化广告创意，效率提升10倍",
];

const heroTags = [
  {
    text: "10分钟上线Offer",
    position: "left-4 top-4 xl:left-8 xl:top-6",
    tone: "border-blue-200 text-[#165DFF]",
  },
  {
    text: "无需API / 脚本双向同步",
    position: "right-4 top-10 xl:right-8",
    tone: "border-slate-200 text-[#4E5969]",
  },
  {
    text: "AI辅助生成广告效率高",
    position: "left-[26%] top-[22%]",
    tone: "border-cyan-200 text-[#0088DD]",
  },
  {
    text: "按投放国家分层",
    position: "right-[18%] top-[30%]",
    tone: "border-red-200 text-[#F53F3F]",
  },
  {
    text: "点击流量分布更自然",
    position: "left-[20%] top-[48%]",
    tone: "border-pink-200 text-[#E64BA0]",
  },
  {
    text: "IP / 时区 / Referer 精准匹配",
    position: "right-4 top-[58%] xl:right-8",
    tone: "border-emerald-200 text-[#00B42A]",
  },
  {
    text: "多账号安全隔离",
    position: "bottom-18 left-8",
    tone: "border-[#FFB65C] text-[#FF7D00]",
  },
  {
    text: "出入站物理隔离更安全",
    position: "bottom-8 right-[14%]",
    tone: "border-[#FFB65C] text-[#FF7D00]",
  },
];

export default function Hero({
  onBuyClick,
  onConsultClick,
}: {
  onBuyClick: () => void;
  onConsultClick: () => void;
}) {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f5f9ff_56%,#ffffff_100%)] pb-18 pt-14 sm:pt-16">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center px-5 text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#EAF2FF] px-3 py-1 text-[11px] font-semibold text-[#165DFF] shadow-[0_2px_10px_rgba(22,93,255,0.08)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#165DFF]" />
          Google Ads 全流程自动化管理
        </span>

        <h1 className="max-w-[920px] text-[34px] font-extrabold leading-[1.18] tracking-[-0.03em] text-[#1D2129] sm:text-[42px] lg:text-[50px]">
          告别繁琐操作，让
          <span className="text-[#165DFF]"> Google Ads投放 </span>
          更安全、更高效、更简单
        </h1>

        <p className="mt-5 max-w-[940px] text-sm leading-7 text-[#4E5969] sm:text-[15px]">
          ADXKit 一站式广告管理系统，无需申请 Google Ads API，无需频繁切换代理和指纹浏览器，
          10 分钟完成 Offer 上线，多账号隔离管理，补点击/换链接智能执行，AI 生成广告创意，
          全面提升投放效率与安全性，即使是新入行的小白都能轻松驾驭。
        </p>

        <div className="mt-6 flex max-w-[1040px] flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] font-medium text-[#4E5969]">
          {heroFeatures.map((text) => (
            <div key={text} className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E8FFF0] text-[12px] text-[#00B42A]">
                ✓
              </span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm font-medium text-[#165DFF]">
          粘贴联盟链接 → 爬虫采集落地页 → AI 生成创意 → 一键提交投放（新手秒变专家）
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={onConsultClick}
            className="rounded-lg bg-[#165DFF] px-7 py-3 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(22,93,255,0.2)] transition-all hover:bg-[#0E4BDB]"
          >
            立即咨询
          </button>
          <button
            type="button"
            onClick={onBuyClick}
            className="rounded-lg bg-[#FF7D00] px-7 py-3 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(255,125,0,0.22)] transition-all hover:bg-[#E06E00]"
          >
            立即购买
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg bg-[#165DFF] px-7 py-3 text-sm font-semibold text-white no-underline shadow-[0_10px_26px_rgba(22,93,255,0.2)] transition-all hover:bg-[#0E4BDB]"
          >
            进入后台
          </Link>
        </div>

        <div className="relative mt-12 w-full max-w-[1120px] rounded-[18px] border border-[#DCE7F8] bg-[#EDF4FF] p-3 shadow-[0_24px_60px_rgba(22,93,255,0.12)] sm:mt-14 sm:p-4">
          <div className="overflow-hidden rounded-[16px] border border-white/80 bg-white shadow-[0_16px_40px_rgba(22,93,255,0.08)]">
            <Image
              src="/adxkit.com/adxkit.png"
              alt="ADXKit 系统界面展示"
              width={1120}
              height={640}
              className="h-auto w-full"
              priority
            />
          </div>

          {heroTags.map((badge) => (
            <div
              key={badge.text}
              className={`absolute hidden rounded-full border bg-white px-3 py-2 text-[11px] font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.12)] md:block ${badge.position} ${badge.tone}`}
            >
              {badge.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
