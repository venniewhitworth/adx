# MCP 自动化采集使用说明

准备：
- 建议在项目中安装 Playwright：

```bash
npm i -D playwright
npx playwright install chromium
```

快速使用：
1. 运行采集脚本收集截图与资产元数据：

```bash
node scripts/mcp/collect-assets.mjs https://adxkit.com
```

采集结果：
- `docs/design-references/<host>-<viewport>.png` — 全页截图（desktop/tablet/mobile）
- `docs/research/<host>-assets.json` — 采集到的资产与基本页面拓扑信息

2. 使用采集输出执行批量下载到 `public/`：

```bash
node scripts/download-assets.mjs docs/research/<host>-assets.json
```

3. 在浏览器内或通过 Playwright 运行 `scripts/mcp/component-extract.js` 来提取组件的 `getComputedStyle()` 值：

- 在控制台运行（替换 SELECTOR）：

```javascript
// 将输出复制到剪贴板
copy((() => { /* paste the script from scripts/mcp/component-extract.js here */ })('SELECTOR'))
```

- 或通过 Playwright：

```javascript
const data = await page.evaluate((selector, fn) => { return fn(selector); }, 'SELECTOR', require('./scripts/mcp/component-extract.js'));
```

注意事项：
- 采集脚本会尝试等待网络空闲，但某些站点使用延迟加载或交互驱动的内容，请在采集前手动打开必要的模态或交互状态，或用浏览器 MCP 执行额外的点击/滚动操作。
- 如果站点使用自定义平滑滚动库（Lenis/Locomotive），采集脚本可能需要调整（延长等待、在运行环境启用模拟滚动）。

后续：
- 我可以根据 `docs/research/<host>-assets.json` 自动生成 `docs/research/DESIGN_TOKENS.md` 和初始 `src/app/globals.css` 草稿，是否需要我继续？
