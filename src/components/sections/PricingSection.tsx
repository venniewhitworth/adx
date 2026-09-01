export default function PricingSection({ onConsultClick }: { onConsultClick: () => void }) {
  const plans = [
    {
      title: "年付会员",
      desc: "适合入门级投放团队/个人",
      price: "¥7999",
      period: "/年（前10名）",
      note: "正常价格：¥9000/年",
      items: [
        "12个月系统使用权",
        "完整功能无限制使用",
        "多账号管理权限",
        "基础技术支持",
        "租户内权限分级管理",
      ],
      featured: false,
    },
    {
      title: "两年付会员",
      desc: "适合中长期稳定投放团队",
      price: "¥15000",
      period: "/两年（前10名）",
      note: "原价¥18000，限时立减¥3000",
      items: [
        "24+2个月系统使用权",
        "完整功能无限制使用",
        "多账号管理权限",
        "优先技术支持",
        "手把手全程陪跑",
        "租户内权限分级管理",
      ],
      featured: true,
    },
    {
      title: "独立部署",
      desc: "适合大型投放团队/企业级客户",
      price: "¥35000",
      period: "/授权（前10名）",
      note: "正常价格：¥45000/授权",
      items: [
        "永久系统使用授权",
        "私有化部署，数据完全私有",
        "定制化功能扩展支持",
        "1年免费技术支持",
        "多租户独立管理",
      ],
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 bg-[#F7F8FF]">
      <div className="max-w-[1200px] mx-auto px-5">
        <h2 className="text-[30px] font-bold text-center mb-4">价格方案：按阶段选择合适的节奏</h2>
        <p className="text-[18px] text-[#4E5969] text-center max-w-[840px] mx-auto mb-3">
          前10名享特惠价格，所有会员版本功能完全一致，仅存在使用时长差异。
        </p>
        <p className="text-sm leading-7 text-[#86909C] text-center max-w-[920px] mx-auto mb-12">
          系统功能和核心能力保持一致，主要区别在使用周期和交付方式；
          如果你对团队协作、多账号隔离、广告链接替换和创意生成有更高要求，独立部署会更适合长期稳定投放。
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.title}
              className={`relative overflow-hidden rounded-[32px] bg-white p-8 shadow-[0_20px_60px_rgba(22,93,255,0.1)] border transition-all ${
                plan.featured ? "border-[#165DFF] border-2 scale-105" : "border-[#E7EAF3]"
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF7D00] text-white px-5 py-1 rounded-full text-xs font-semibold">
                  推荐选择
                </div>
              )}
              <h3 className="text-xl font-semibold mb-2">{plan.title}</h3>
              <p className="text-sm text-[#6B7280] mb-6">{plan.desc}</p>
              <div className="mb-6">
                <span className="text-[36px] font-bold text-[#165DFF]">{plan.price}</span>
                <span className="text-base font-medium text-[#94A3B8]">{plan.period}</span>
              </div>
              <p className="text-xs text-[#FF7D00] mb-6">{plan.note}</p>
              <ul className="list-none text-left mb-8 space-y-3">
                {plan.items.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-[#4E5969]">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#165DFF]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onConsultClick}
                className={`w-full rounded-xl px-6 py-3 text-sm font-semibold transition-all ${
                  plan.featured
                    ? "bg-[#FF7D00] text-white hover:bg-[#E06E00]"
                    : "bg-[#165DFF] text-white hover:bg-[#0E4BDB]"
                }`}
              >
                {plan.title === "独立部署" ? "预约咨询" : "立即购买"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
