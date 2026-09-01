export default function CtaSection({ onConsultClick }: { onConsultClick: () => void }) {
  return (
    <section className="bg-white py-20">
      <div className="max-w-[1200px] mx-auto px-5">
        <div className="rounded-[22px] bg-[#165DFF] px-6 py-14 text-center text-white shadow-[0_22px_45px_rgba(22,93,255,0.22)] sm:px-10 lg:px-16">
          <h2 className="mb-4 text-[30px] font-bold leading-tight sm:text-[32px]">立即体验ADXKit，开启高效投放之旅</h2>
          <p className="mx-auto mb-8 max-w-[760px] text-[15px] leading-7 text-white/85 sm:text-base">
            前10名特惠名额有限，购买后，专业团队1对1演示讲解，解决你的投放难题。
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={onConsultClick}
              className="rounded-lg bg-[#FF7D00] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(255,125,0,0.25)] transition-all hover:bg-[#E06E00]"
            >
              预约产品演示
            </button>
            <button
              type="button"
              onClick={onConsultClick}
              className="rounded-lg border border-white/30 bg-[#0E4BDB] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#0B41BE]"
            >
              添加客服微信咨询
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
