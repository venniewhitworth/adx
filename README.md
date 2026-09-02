# AdX Kit

一个用来管理联盟跟踪链接、解析最终落地页、生成 Google Ads 后缀，并把后缀同步到 Google Ads 广告系列的 Next.js 后台。

## 现在这套后台怎么用

打开 `/dashboard` 后，主流程已经简化成这一套：

1. 填任务名称
2. 填联盟跟踪链接
3. 选国家
4. 默认 Referer 就是 `Facebook`，也可以手动改
5. `自动刷新` 默认是 `每 1 小时`，也可以手动选择其他间隔
6. 点 `保存并解析`

保存后，系统会自动做这些事：

- 默认使用 IPRoyal 代理解析
- 每次解析自动生成新的 `SESSION_ID`
- 把 `Referer` 真的带到请求头里
- 解析出真实最终 URL
- 自动提取 Google Ads `Final URL suffix`

页面右侧会直接显示：

- 最终 URL
- 上一次最终 URL
- Google Ads 后缀
- 上次已同步后缀
- 出口 IP
- 出口国家
- 同步状态

后台页面还会每 `15 秒` 自动刷新一次，所以只要链接重新解析了，或者 Google Ads Script 回写了结果，你在列表和右侧结果区里都会直接看到有没有变化。

## Google Ads 最终网址现在是怎么更新的

这里更新的不是完整最终网址，而是 Google Ads 里的 `Final URL suffix`。

后台逻辑是这样的：

1. 先解析联盟链接，拿到真实最终 URL
2. 从最终 URL 里取出 `?` 后面的参数
3. 生成 Google Ads 后缀
4. 后台接口把“待同步”的后缀提供给 Google Ads Script
5. Google Ads Script 把这个后缀写到对应广告系列的 `Final URL suffix`
6. 写成功后再回传后台，状态从“待同步”变成“已同步”

现在同步层级已经固定：

- 只支持 `广告系列`
- 不再支持 `广告组`

你在后台高级设置里只需要填：

- `Google Ads Customer ID`
- `广告系列 ID`

## 这项目现在做什么

- 管理联盟跟踪链接和最终链接
- 通过 IPRoyal 代理解析真实落地页
- 记录最终 URL 变化
- 生成适合 Google Ads 的 `Final URL suffix`
- 提供导出 CSV
- 支持到期自动刷新最终 URL
- 支持 Google Ads Script 拉取待同步后缀并回写结果

## 技术栈

- Next.js 16
- React 19
- TypeScript strict
- Tailwind CSS v4
- Playwright

## 本地启动

要求：

- Node.js `24+`

安装依赖：

```bash
npm install
```

开发模式：

```bash
npm run dev
```

生产模式本地验证：

```bash
npm run build
npm run start
```

默认本地地址：

```text
http://127.0.0.1:3001/dashboard
```

如果你要让 `30 秒` 或 `1 分钟` 这种高频自动刷新真正生效，需要再启动高频刷新 worker：

```bash
npm run worker:refresh-due
```

页面里有两种“自动”要分开理解：

- `高频刷新 worker`：负责按 30 秒或 1 分钟去重新解析联盟链接
- `Google Ads Script 定时执行`：负责把最新后缀同步到 Google Ads 广告系列

## 本地一键启动版

现在项目根目录已经带了这几个可双击文件：

- `启动后台.command`
- `停止后台.command`
- `重启后台.command`
- `查看状态.command`
- `查看日志.command`

第一次使用前，先确保依赖已经装好：

```bash
npm install
```

之后直接双击：

```text
启动后台.command
```

它会自动完成这些事：

- 先执行生产构建
- 后台启动 Web 服务
- 后台启动自动刷新 Worker
- 自动打开 `http://127.0.0.1:3001/dashboard`

运行日志和 PID 会写到：

```text
.local-runtime/
```

常用位置：

- Web 日志：`.local-runtime/logs/web.log`
- Worker 日志：`.local-runtime/logs/worker.log`

### 黑屏后还会不会继续跑

只要电脑没有真正休眠，这套本地后台就会继续运行。

- `锁屏 / 黑屏`：通常还会继续跑
- `合上 Mac 笔记本盖子`：通常会睡眠，后台会停
- `主动点睡眠`：会停
- `关机 / 重启`：会停

如果你想长期挂着跑，建议：

- 插着电源
- 不要合盖
- 保持系统不要自动进入睡眠

### 一键启动版适合什么场景

- 你自己本机长期开着用
- 不想部署到外网
- 想像软件一样双击就打开

如果后面需要，我可以再继续给这套一键启动版加：

- 开机自动启动
- 自动最小化
- 菜单栏常驻

## 环境变量

`.env.local` 现在默认已经切到 IPRoyal：

```env
IPROYAL_PROXY_HOST=geo.iproyal.com:12321
IPROYAL_PROXY_USER=你的代理用户名
IPROYAL_PROXY_PASSWORD_BASE=你的代理密码基础串
IPROYAL_PROXY_SESSION_LIFETIME=10m
```

建议再补这些：

```env
DASHBOARD_PASSWORD=你自己的后台密码
GOOGLE_ADS_SCRIPT_TOKEN=你自己的脚本token
REFRESH_SCHEDULER_TOKEN=你自己的定时任务token
APP_BASE_URL=http://127.0.0.1:3001
REFRESH_DUE_POLL_INTERVAL_MS=30000
```

默认我已经在 `.env.local` 里补好了这些值，本地直接能跑。

## Referer 默认规则

现在后端和前端都统一成：

- 默认 `Referer` 是 `https://www.facebook.com/`
- 如果你手动改成别的，就按你填的走
- 如果是接口创建记录，没传 `referer_url` 也会自动回退到 Facebook

## 数据存储

当前版本默认使用本地 JSON 文件存储：

- 本地开发：`data/links.json`
- Railway 挂载 Volume 后：写入 Volume

如果没有持久化存储，重新部署后数据可能丢失。

## Railway 部署

推荐直接部署到 Railway。

项目已经包含：

- [Dockerfile](./Dockerfile)
- [railway.toml](./railway.toml)
- [Railway 部署说明](./docs/deployment/railway.md)

部署时重点关注：

- 配置 IPRoyal 代理环境变量
- 配置 `DASHBOARD_PASSWORD`
- 配置 `GOOGLE_ADS_SCRIPT_TOKEN`
- 配置 `REFRESH_SCHEDULER_TOKEN`
- 挂一个持久化 Volume 保存 `links.json`

## Google Ads Script 定时教程

这个定时需要你在 Google Ads 后台里单独设置一次，不是后台自己帮你点。

操作顺序：

1. 先把你的站点放到公网，保证 Google Ads 能访问到这个后台地址
2. 打开后台 `/dashboard`
3. 展开 `Google Ads Script`
4. 复制脚本模板
5. 把脚本里的 `REPLACE_ME` 改成 `.env.local` 里的 `GOOGLE_ADS_SCRIPT_TOKEN`
6. 这份脚本已经是兼容版，会同时通过请求头和 URL 参数传 token，专门兼容部分 Google Ads Script 环境下 header 鉴权不稳定的问题
7. 去 Google Ads 后台的 `Scripts`
8. 新建脚本并粘贴
9. 先点一次“预览”或“运行”确认能拉到数据
10. 如果日志出现 `No pending suffix updates for ...`，说明鉴权已经成功，只是暂时没有待同步记录
11. 再设置执行频率，比如每 15 分钟一次

后面就不需要你每次手点了，脚本会自己把“待同步”的后缀更新到广告系列。

## 链接变化怎么看

现在后台已经直接显示：

- 当前最终 URL
- 上一次最终 URL
- 当前 Google Ads 后缀
- 上次已同步后缀

判断规则很简单：

- 当前最终 URL 和上一次最终 URL 不一样：说明链接变了
- 当前后缀和上次已同步后缀不一样：说明 Google Ads 下次脚本运行还会继续更新

你不用自己比对，后台页面会直接把这些值都显示出来。

## 常用路径

- 首页：`/`
- 登录页：`/login`
- 后台：`/dashboard`

## 常用命令

```bash
npm run dev
npm run build
npm run start
npm run worker:refresh-due
npm run lint
npm run typecheck
npm run check
```

## 代理出口 IP 测试

项目里新增了一个独立脚本：[scripts/check-proxy-ip.py](/Users/qingyan/ai-website-cloner/scripts/check-proxy-ip.py)

用途：

- 每次请求主动生成新的 `SESSION_ID`
- 通过 IPRoyal 代理获取新的出口 IP
- 输出 IP 归属信息，方便验证代理是否轮换成功

运行示例：

```bash
python3 scripts/check-proxy-ip.py --attempts 3
```

如果你已经把 IPRoyal 环境变量配进 `.env.local`，脚本就会直接按默认配置测试。
