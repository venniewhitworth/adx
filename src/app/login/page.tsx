import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  DASHBOARD_AUTH_COOKIE_NAME,
  isDashboardAuthEnabled,
  normalizeDashboardNextPath,
  verifyDashboardSessionToken,
} from "@/lib/dashboard-auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
};

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = normalizeDashboardNextPath(getFirstValue(params.next));

  if (!isDashboardAuthEnabled()) {
    redirect(nextPath);
  }

  const cookieStore = await cookies();
  const existingToken = cookieStore.get(DASHBOARD_AUTH_COOKIE_NAME)?.value;
  if (await verifyDashboardSessionToken(existingToken)) {
    redirect(nextPath);
  }

  const hasError = getFirstValue(params.error) === "1";

  return (
    <main className="min-h-screen bg-white text-[#3D3530]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] border border-[#E8DDD2] bg-white shadow-[0_24px_80px_rgba(139,115,85,0.08)] lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative hidden overflow-hidden border-r border-[#F2E7DC] bg-[radial-gradient(circle_at_top_left,_rgba(196,149,106,0.18),_transparent_46%),linear-gradient(180deg,_#FFFDFB_0%,_#FFF7F0_100%)] p-10 lg:flex lg:flex-col lg:justify-between">
            <div className="space-y-6">
              <span className="inline-flex w-fit rounded-full border border-[#E8DDD2] bg-white/70 px-4 py-1 text-xs tracking-[0.24em] text-[#9A8E87] uppercase backdrop-blur">
                Protected Dashboard
              </span>
              <div className="space-y-4">
                <h1 className="max-w-md text-4xl leading-tight font-light text-[#3D3530]">
                  后台现在需要密码才能进入
                </h1>
                <p className="max-w-lg text-base leading-7 text-[#7E7068]">
                  这样别人就算拿到你的网址，也不能直接查看广告、链接、同步状态和导出数据。
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-white/70 bg-white/80 p-5 backdrop-blur">
                <p className="text-sm text-[#9A8E87]">保护范围</p>
                <p className="mt-2 text-lg font-medium text-[#3D3530]">
                  Dashboard / 解析接口 / 导出接口
                </p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/80 p-5 backdrop-blur">
                <p className="text-sm text-[#9A8E87]">保留不受影响</p>
                <p className="mt-2 text-lg font-medium text-[#3D3530]">
                  Google Ads Script / Railway 定时刷新
                </p>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center px-6 py-10 sm:px-10">
            <div className="w-full max-w-md space-y-8">
              <div className="space-y-3">
                <p className="text-sm tracking-[0.22em] text-[#9A8E87] uppercase">Adx Kit Access</p>
                <h2 className="text-3xl font-light text-[#3D3530]">输入后台密码</h2>
                <p className="text-sm leading-6 text-[#9A8E87]">
                  登录成功后会自动进入后台，并在当前浏览器里保持登录状态。
                </p>
              </div>

              <form
                action="/api/auth/login"
                method="post"
                className="space-y-5 rounded-[28px] border border-[#E8DDD2] bg-[#FFFCF8] p-6 shadow-[0_16px_36px_rgba(139,115,85,0.06)]"
              >
                <input type="hidden" name="next" value={nextPath} />

                <label className="block space-y-2">
                  <span className="text-sm text-[#7E7068]">后台密码</span>
                  <input
                    name="password"
                    type="password"
                    autoFocus
                    autoComplete="current-password"
                    placeholder="请输入你设置的后台密码"
                    className="h-12 w-full rounded-2xl border border-[#E8DDD2] bg-white px-4 text-base text-[#3D3530] outline-none transition focus:border-[#C4956A] focus:ring-4 focus:ring-[#C4956A]/12"
                  />
                </label>

                {hasError ? (
                  <div className="rounded-2xl border border-[#F0D7C2] bg-[#FFF4EA] px-4 py-3 text-sm text-[#A85F2F]">
                    密码不正确，请重新输入。
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#C4956A] px-5 text-base font-medium text-white transition hover:bg-[#B37A52] hover:shadow-md"
                >
                  进入后台
                </button>
              </form>

              <p className="text-xs leading-6 text-[#A5968E]">
                如果你还没有设置密码，需要先在本地环境变量或 Railway Variables 里添加
                `DASHBOARD_PASSWORD`。
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}