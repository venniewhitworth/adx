import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adx Kit - 一站式Google Ads广告管理系统 | 告别繁琐操作，安全高效投放",
  description: "ADXKit 一站式广告管理系统，无需申请 Google Ads API、无需频繁切换代理和指纹浏览器，10分钟完成Offer上线",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
