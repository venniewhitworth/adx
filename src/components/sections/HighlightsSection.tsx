export default function HighlightsSection() {
  const highlights = [
    {
      title: "双向数据同步 · 无需API审批",
      items: [
        "基于Google Ads Script实现15分钟双向数据同步",
        "无需准备繁琐API资料，无需等待漫长审批周期",
        "实时同步广告数据，不影响投放节奏",
        "全程陪跑，入门小白也能轻松驾驭",
      ],
    },
    {
      title: "精准补点击算法 · 模拟自然流量",
      items: [
        "50项指标匹配投放区域自然流量特征，适配独立站Offer",
        "动态获取IP，多次交叉验证IP物理位置与时区",
        "流量模型按时区/人口分布比例分配点击量",
        "8个时间段划分，符合目标地区作息规律",
        "10个头部媒体referer自然分布，来源更真实",
        "点击数量自由设置，自主控制流量",
      ],
    },
    {
      title: "严谨换链接逻辑 · 数据闭环",
      items: [
        "换链频率自由设置，最小间隔仅10分钟",
        "采集最终到达页，反向更新跟踪链接参数",
        "每个链接生成唯一指纹，避免重复更换",
        "与补点击算法同源，保证数据一致性",
      ],
    },
    {
      title: "高效定时任务 · 全程可追溯",
      items: [
        "业界领先的定时任务调度模型，任务执行不丢失、不延迟",
        "完整记录任务执行数据：点击次数、换链次数、成功失败数",
        "可视化展示每一次执行的指纹、IP等核心信息",
        "任务执行状态实时监控，异常及时告警",
      ],
    },
    {
      title: "丰富配置能力 · 降低依赖风险",
      items: [
        "多供应商代理IP配置，避免单一IP服务商风险",
        "按国家/地区配置IP获取规则，适配不同广告需求",
        "13+ AI模型自由切换，满足差异化创意生成需求",
        "预置优质提示词模版，支持自定义优化",
        "AI成本智能控制，优先使用免费资源",
      ],
    },
    {
      title: "顶级防关联设计 · 保障账号安全",
      items: [
        "每个MCC账号生成独立Script脚本，加入随机指纹代码",
        "Cloudflare Worker转发脚本，独立域名/IP出口",
        "入站/出站数据物理隔离，规避Google Ads关联检测",
        "AI调用独立隔离，预防AI账号关联风险",
      ],
    },
  ];

  return (
    <section id="highlights" className="bg-white py-20">
      <div className="mx-auto max-w-[1200px] px-5">
        <h2 className="mb-4 text-center text-[30px] font-bold tracking-[-0.02em] text-[#1D2129]">
          系统亮点 · 差异化优势
        </h2>
        <p className="mx-auto mb-12 max-w-[800px] text-center text-[16px] leading-7 text-[#4E5969]">
          从技术底层到业务场景，全方位优化投放体验，保障账号安全与投放效果。
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {highlights.map((highlight) => (
            <div
              key={highlight.title}
              className="rounded-[14px] border border-[#EAF0F7] border-l-[3px] border-l-[#165DFF] bg-white p-8 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(15,23,42,0.07)]"
            >
              <h3 className="mb-4 text-[16px] font-semibold text-[#165DFF]">{highlight.title}</h3>
              <ul className="list-none space-y-3">
                {highlight.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-7 text-[#4E5969]">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#99A2B3]" />
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
