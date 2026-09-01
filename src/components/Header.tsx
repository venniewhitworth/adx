"use client";

import Link from "next/link";
import { useState } from "react";

const navItems = [
  { label: "产品", href: "#features" },
  { label: "系统亮点", href: "#highlights" },
  { label: "系统价值", href: "#values" },
  { label: "客户案例", href: "#cases" },
  { label: "价格方案", href: "#pricing" },
];

export default function Header({
  onBuyClick,
  onConsultClick,
}: {
  onBuyClick: () => void;
  onConsultClick: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#ECF1F7] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-5">
        <a href="#" className="text-[22px] font-black tracking-[-0.03em] text-[#165DFF] no-underline">
          Adx Kit
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-[13px] font-medium text-[#4E5969] no-underline transition-colors hover:text-[#165DFF]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={onConsultClick}
            className="rounded-lg border border-[#C9D8FF] bg-white px-4 py-2 text-[13px] font-semibold text-[#165DFF] transition-all hover:border-[#165DFF] hover:bg-[#F5F9FF]"
          >
            立即咨询
          </button>
          <button
            type="button"
            onClick={onBuyClick}
            className="rounded-lg bg-[#165DFF] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(22,93,255,0.18)] transition-all hover:bg-[#0E4BDB]"
          >
            立即购买
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg bg-[#0B53E6] px-4 py-2 text-[13px] font-semibold text-white no-underline shadow-[0_6px_18px_rgba(11,83,230,0.18)] transition-all hover:bg-[#093FBA]"
          >
            进入后台
          </Link>
        </div>

        <button
          type="button"
          className="text-2xl text-[#165DFF] md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="切换导航菜单"
        >
          ☰
        </button>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-4 border-t border-slate-200 bg-white px-5 py-4 md:hidden">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-[15px] font-medium text-[#4E5969] no-underline hover:text-[#165DFF] transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onConsultClick();
            }}
            className="rounded-lg border border-[#165DFF] px-4 py-2 text-left text-[15px] font-semibold text-[#165DFF]"
          >
            立即咨询
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onBuyClick();
            }}
            className="rounded-lg bg-[#FF7D00] px-4 py-2 text-left text-[15px] font-semibold text-white"
          >
            立即购买
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg bg-[#0B53E6] px-4 py-2 text-left text-[15px] font-semibold text-white no-underline"
            onClick={() => setMenuOpen(false)}
          >
            进入后台
          </Link>
        </nav>
      )}
    </header>
  );
}
