"use client";

import Image from "next/image";

export default function ConsultModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#101827]/70 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="consult-modal-title"
    >
      <div
        className="relative w-full max-w-[360px] rounded-[24px] bg-white p-6 text-center shadow-[0_24px_80px_rgba(16,24,39,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 h-8 w-8 rounded-full bg-slate-100 text-lg leading-none text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
          aria-label="关闭咨询弹窗"
        >
          ×
        </button>
        <p
          id="consult-modal-title"
          className="mx-auto max-w-[240px] text-[18px] font-semibold leading-7 text-[#1D2129]"
        >
          请用微信扫描二维码添加好友进行咨询！
        </p>
        <div className="mx-auto mt-5 w-[220px] overflow-hidden rounded-[20px] border border-slate-100 shadow-[0_16px_40px_rgba(22,93,255,0.08)]">
          <Image
            src="/adxkit.com/qrc.jpg"
            alt="ADXKit 微信咨询二维码"
            width={440}
            height={440}
            className="h-auto w-full"
            priority
          />
        </div>
        <p className="mt-4 text-sm leading-6 text-[#4E5969]">
          添加后可获取产品演示、购买咨询和部署答疑。
        </p>
      </div>
    </div>
  );
}
