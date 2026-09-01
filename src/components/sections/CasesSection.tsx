export default function CasesSection() {
  const cases = [
    {
      avatar: "张",
      name: "张老板",
      role: "广告投放公司老板",
      text: "公司有13名员工，之前经常加班还容易出错，带来各种账号风险。使用ADXKit后，人员效率大幅提升，工作质量和收益都翻了倍，终于不用天天担心账号安全问题了。",
    },
    {
      avatar: "李",
      name: "李斌",
      role: "自由职业投手",
      text: "做了12年Google Ads投手，以前熬夜返工改广告是常态，一个Offer一天都上不了线，身体都快垮了。用了ADXKit后，10分钟就能上线一个Offer，现在半天时间都能自由支配，边旅游边投放都没问题。",
    },
    {
      avatar: "华",
      name: "华英",
      role: "工作室负责人",
      text: "工作室原来只有3个人，买了ADXKit年会员后，广告投放规模直接翻倍，利润也跟着翻倍。现在换了更大的办公室，团队也扩充到了10个人，系统帮我们解决了效率和管理的核心问题。",
    },
  ];

  return (
    <section id="cases" className="bg-white py-20">
      <div className="mx-auto max-w-[1200px] px-5">
        <h2 className="mb-4 text-center text-[30px] font-bold tracking-[-0.02em] text-[#1D2129]">
          客户案例 · 真实效果验证
        </h2>
        <p className="mx-auto mb-12 max-w-[800px] text-center text-[16px] leading-7 text-[#4E5969]">
          来自不同规模投放团队的真实反馈，ADXKit助力投放效率与收益双提升。
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {cases.map((item) => (
            <div
              key={item.name}
              className="rounded-[16px] border border-[#EEF1F6] bg-white p-8 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
            >
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F7FB] text-base font-bold text-[#165DFF]">
                {item.avatar}
              </div>
              <p className="mb-6 text-sm leading-7 text-[#4E5969]">{item.text}</p>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="font-semibold text-[#1D2129]">{item.name}</div>
                  <div className="text-xs text-[#86909C]">{item.role}</div>
                </div>
                <div className="text-sm tracking-[0.18em] text-[#FFB800]">★★★★★</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
