export default function FeaturesSection() {
  const features = [
    {
      icon: "user-circle",
      title: "Ads账号管理",
      desc: "无需手动维护子账号信息，录入MCC账号后自动同步所有子账号数据，统一后台管理。",
      items: [
        "MCC账号一键录入，子账号自动同步",
        "多账号数据集中展示，状态实时监控",
        "账号权限分级管理，满足团队协作需求",
      ],
    },
    {
      icon: "list-alt",
      title: "广告全维度管理",
      desc: "围绕广告系列投放管理、链接解析和后缀同步，操作简单直接。",
      items: [
        "广告系列：名称、状态、落地链接和同步信息集中管理",
        "最终链接：自动解析联盟跳转，直接拿真实落地页",
        "Google Ads：自动生成 Final URL suffix 并同步到广告系列",
        "投放记录：国家、Referer、出口 IP 和同步状态统一查看",
      ],
    },
    {
      icon: "magic",
      title: "自动广告生成",
      desc: "输入推广链接即可生成高转化广告创意，节省人工撰写时间。",
      items: [
        "爬虫自动采集落地页核心信息（标题、描述、用户评价）",
        "AI生成3组广告创意：15个标题+4个描述+30个关键词",
        "审核通过后一键提交Google Ads投放",
        "支持多语言、多场景创意生成",
      ],
    },
    {
      icon: "cogs",
      title: "系统灵活配置",
      desc: "保留必要配置项，默认值直接可用，减少手工操作。",
      items: [
        "代理解析：默认接入 IPRoyal，每次解析自动切换 SESSION_ID",
        "AI配置：集成13+头部AI模型，自由切换模型版本",
        "支持自定义提示词模版，优化创意生成效果",
        "AI成本控制：优先使用免费模型/免费额度，降低成本",
      ],
    },
  ];

  return (
    <section id="features" className="bg-[#F5F7FB] py-20">
      <div className="mx-auto max-w-[1200px] px-5">
        <h2 className="mb-4 text-center text-[30px] font-bold tracking-[-0.02em] text-[#1D2129]">
          核心功能 · 全流程覆盖
        </h2>
        <p className="mx-auto mb-12 max-w-[800px] text-center text-[16px] leading-7 text-[#4E5969]">
          从账号管理到广告投放，从创意生成到数据同步，一套系统搞定所有操作。
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-[16px] border border-[#E8EDF5] bg-white p-8 shadow-[0_10px_26px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(15,23,42,0.08)]"
            >
              <h3 className="mb-4 flex items-center gap-2 text-[18px] font-semibold text-[#1D2129]">
                <i className={`fa fa-${feature.icon} text-[#165DFF]`}></i>
                {feature.title}
              </h3>
              <p className="mb-4 text-sm leading-7 text-[#4E5969]">{feature.desc}</p>
              <ul className="list-none space-y-2">
                {feature.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-7 text-[#4E5969]">
                    <span className="mt-1 font-semibold text-[#00B42A]">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
