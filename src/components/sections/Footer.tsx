import Link from "next/link";

export default function Footer() {
  const columns = [
    {
      title: "产品",
      links: [
        { label: "核心功能", href: "#features" },
        { label: "系统亮点", href: "#highlights" },
        { label: "系统价值", href: "#values" },
        { label: "价格方案", href: "#pricing" },
      ],
    },
    {
      title: "资源",
      links: [
        { label: "客户案例", href: "#cases" },
        { label: "广告后台", href: "/dashboard" },
        { label: "进入后台", href: "/dashboard" },
        { label: "常见问题", href: "#pricing" },
      ],
    },
    {
      title: "联系我们",
      links: [
        { label: "在线客服", href: "#" },
        { label: "商务合作", href: "#" },
        { label: "技术支持", href: "#" },
        { label: "关于我们", href: "#" },
      ],
    },
  ];

  return (
    <footer className="bg-[#1F2329] py-16 text-[#A3AED0]">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-5 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
        <div>
          <Link href="/" className="mb-4 inline-block text-2xl font-extrabold text-white no-underline">
            ADXKit
          </Link>
          <p className="max-w-[360px] text-sm leading-7 text-slate-400">
            ADXKit 是一站式 Google Ads 广告管理系统，专注于解决广告投放效率低、风控压力大、链接维护繁琐等问题，为投放团队提供更安全、更高效的实战解决方案。
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="mb-6 text-sm font-semibold text-white">{col.title}</h4>
            <ul className="list-none space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("http") ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-[#A3AED0] no-underline transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  ) : link.href.startsWith("/") ? (
                    <Link
                      href={link.href}
                      className="text-sm text-[#A3AED0] no-underline transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="text-sm text-[#A3AED0] no-underline transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 flex max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t border-white/10 px-5 pt-6 text-xs text-slate-500">
        <span>© 2024 ADXKit 版权所有</span>
        <div className="flex items-center gap-4">
          <a href="#" className="text-slate-500 no-underline transition-colors hover:text-white">
            隐私政策
          </a>
          <a href="#" className="text-slate-500 no-underline transition-colors hover:text-white">
            服务条款
          </a>
        </div>
      </div>
    </footer>
  );
}
