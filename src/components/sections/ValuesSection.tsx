export default function ValuesSection() {
  const values = [
    {
      title: "提升操作效率",
      desc: "告别频繁登录Google Ads后台，一个系统管理所有账号，Offer上线时间从数小时缩短至10分钟，员工效率提升数倍。",
    },
    {
      title: "降低投入成本",
      desc: "无需购买多个指纹浏览器，无需为多账号管理额外付费，AI成本智能控制，优先使用免费资源，整体投放成本降低30%以上。",
    },
    {
      title: "控制投放风险",
      desc: "严格的账号隔离机制，精准的补点击/换链接算法，有效规避Google Ads账号和联盟账号封号风险，保障资产安全。",
    },
    {
      title: "保障数据完整",
      desc: "补点击/换链接严格匹配Offer投放要求，实现数据链路完整性和一致性，避免佣金流失，提升投放ROI。",
    },
    {
      title: "挖掘高价值Offer",
      desc: "爬虫+AI辅助生成广告创意，快速测试海量Offer，高效挖掘高价值广告，为放量投放提供有力支撑。",
    },
    {
      title: "支持团队协作",
      desc: "多租户SAAS架构，租户内支持多账号管理和员工权限分级，满足公司/工作室团队协作需求，管理更规范。",
    },
  ];

  return (
    <section id="values" className="bg-gradient-to-br from-[#165DFF] via-[#0B56E7] to-[#0A47D4] py-20 text-white">
      <div className="mx-auto max-w-[1200px] px-5 text-center">
        <h2 className="mb-4 text-[30px] font-bold tracking-[-0.02em]">系统价值 · 为投放创造实际收益</h2>
        <p className="mx-auto mb-12 max-w-[760px] text-[16px] leading-7 text-white/80">
          从效率提升到风险控制，从成本降低到收益增长，全方位体现系统价值。
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {values.map((value) => (
            <div
              key={value.title}
              className="rounded-[16px] border border-white/14 bg-white/10 p-8 text-left shadow-[0_12px_30px_rgba(0,0,0,0.12)] transition-all hover:-translate-y-1"
            >
              <h3 className="mb-4 text-[18px] font-semibold">{value.title}</h3>
              <p className="text-sm leading-7 text-white/78">{value.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
