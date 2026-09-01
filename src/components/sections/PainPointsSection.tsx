export default function PainPointsSection() {
  const cards = [
    {
      icon: "clock-o",
      title: "操作繁琐效率低",
      desc: "手动管理多账号、频繁切换操作界面，一个Offer上线耗时数小时，加班成为常态，还容易出现操作失误。",
    },
    {
      icon: "exclamation-triangle",
      title: "账号关联风险高",
      desc: "多账号操作缺乏隔离机制，容易触发Google风控，广告账号和联盟账号面临封号风险，资产安全无保障。",
    },
    {
      icon: "money",
      title: "投放成本不可控",
      desc: "补点击/换链接不精准，流量数据不自然，联盟佣金流失；API审批周期长，错过最佳投放时机。",
    },
  ];

  return (
    <section id="pain-points" className="bg-white py-20">
      <div className="mx-auto max-w-[1200px] px-5">
        <h2 className="mb-4 text-center text-[30px] font-bold tracking-[-0.02em] text-[#1D2129]">
          你是否正面临这些投放难题？
        </h2>
        <p className="mx-auto mb-12 max-w-[760px] text-center text-[16px] leading-7 text-[#4E5969]">
          传统Google Ads投放方式效率低、风险高、成本大，ADXKit针对性解决所有核心痛点。
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-[16px] border border-[#EEF1F6] bg-white px-8 py-9 text-center shadow-[0_12px_26px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
            >
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF4FF] text-[22px] text-[#165DFF]">
                <i className={`fa fa-${card.icon}`}></i>
              </div>
              <h3 className="mb-4 text-[18px] font-semibold text-[#1D2129]">{card.title}</h3>
              <p className="text-sm leading-7 text-[#4E5969]">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
