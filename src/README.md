# 流放之路市集汉化 v{{VERSION}}

汉化《流放之路》1 与《流放之路》2 的官方市集页面：筛选器、物品名称、词缀描述、结果卡片和常用界面文字。

支持页面：

- `https://www.pathofexile.com/trade/...`（PoE 1，固定繁體中文）
- `https://www.pathofexile.com/trade2/...`（PoE 2，简体 / 繁體可切换）

## 安装

1. 打开 Edge 的 `edge://extensions/`，或 Chrome 的 `chrome://extensions/`。
2. 打开右上角的“开发人员模式”。
3. 点击“加载解压缩的扩展”，选择本目录（`poe-trade-cn`）。
4. 刷新已经打开的市集页面。

> 如果之前装过旧版 POE Trade ZH，建议先停用旧扩展，避免两套脚本同时改页面。

## 语言切换

PoE 2 页面点扩展图标，弹窗里有“简体 / 繁體”开关；选完会自动刷新当前市集页。

- 选择保存在 `chrome.storage.local`，由内容脚本写入页面 `localStorage`，页面脚本启动前就能读到。
- 切换语言会刷新一次页面（页面上已渲染的内容不会原地重排），刷新由一次性守卫限制，不会来回跳。
- PoE 1 只有繁體一版（台湾用词），弹窗只显示说明，不显示开关。
- 首次安装或扩展更新后也请刷新一次市集页面。

## 市集助手侧栏

市集页面右侧会常驻一条 380px 的助手面板（点面板左边的“市集”竖条可折叠，状态记在 `chrome.storage.local` 的 `poe-cn-panel-open`）：

- **汇率**：从 poe.ninja 取当前赛季的神圣石 / 崇高石 / 混沌石参考价，显示 D→C、E→C、D→E 三行；赛季名取页面 URL（`/trade/search/<League>`），也可手动改。结果缓存 15 分钟，只在国际服页面可用（国服没有 poe.ninja 数据）。
- **词缀**：开关「搜索结果中的数值高亮」（默认开，存 `poe-cn-highlight`）。只给短文本里的掷骰数值套 `span.poe-cn-num` 上色，价格行（无百分号、无正负号）不碰；关掉即把 `span` 还原成纯文本。
- **关于**：版本与仓库链接。

面板是覆盖在页面右侧的固定层，不改变官方页面布局，所以不会挤坏市集表单。

## 两套用词

| 游戏 | 语言 | 数据来源 |
| --- | --- | --- |
| PoE 1 | 繁體 | `pathofexile.tw` API + `poedb.tw/tw` 物品页 |
| PoE 2 | 简体 | `poe.game.qq.com` API + `poe2db.tw/cn` 物品页 |
| PoE 2 | 繁體 | `pathofexile.tw` API + `poe2db.tw/tw` 物品页 |

繁體优先取流放编年史的台湾用词（例如“冰冷抗性”），不会用字形转换把简体词硬转（那样只会得到“冰霜抗性”）。

## 实现方式

- 在页面脚本运行前拦截市集 API：
  - `/api/trade/data/stats`、`items`、`static`、`filters`
  - `/api/trade/fetch/...` 与 `/api/trade2/fetch/...`
- 筛选项只改显示文字（`text`），保留官方 `id`、`type`、`name` 字段，因此搜索、复制密语、生成查询链接仍然使用官方值。
- 结果物品的词缀通过 API 的 `hash`（如 `stat.explicit.stat_...`）匹配；数值取自原描述里的实际掷骰，不拿 `magnitudes` 的范围冒充。
- 词缀方向按语言翻转：简体“总增/总降、提高/降低、增加/减少”，繁體“總增/總降、增加/減少、更多/更少”，避免简体词混进繁體句子。
- 页面里剩余按钮、表头和动态文案由 DOM 监听补充翻译。
- 首次加载会清掉市集页面旧的 `lscache-trade*` 英文缓存，之后随数据版本与语言自动失效。

## 数据来源

- 官方市集 API：`poe.game.qq.com`（简体）、`pathofexile.tw`（繁體）、`www.pathofexile.com`（英文，用于对齐 ID 与兜底）。
- 流放编年史物品页：`poe2db.tw/cn`、`poe2db.tw/tw`、`poedb.tw/tw`。
- 本仓库已有的 FilterBlade 汉化词典（简体）与界面词典（繁體由简体词典经 OpenCC + 人工修正生成）。

## 已知限制

- 官方本地化 API 本身就比英文少条目：PoE 1 繁體约缺 1%，PoE 2 简体约缺 6%，PoE 2 繁體约缺 25%。这些条目按英文原样显示，不是扩展漏翻；上游补齐后会随重建自动跟上。
- 新赛季刚加入、编年史与官方 API 都还没有中文名的物品会保留英文。
- 稀有物品的随机名字（如 `Corpse Whisper`）不翻译，基底类型仍会翻译。
- 页面结构大改时，DOM 补充翻译可能漏掉个别新按钮；API 数据翻译不受影响。
- 汇率面板依赖 poe.ninja 的公开接口，赛季名写错时接口仍返回 200 但没有混沌石基准价，面板会提示「该赛季没有混沌石报价」。
- 阶级着色（T1-T7）尚未上线：需要每条词缀的阶级区间，官方市集 API 不提供，得从游戏词缀表（GGG StatDescriptions / PoB）生成规则后再接。
- 数值高亮靠改文本节点实现，官方页面重渲染时可能短暂还原；`MutationObserver` 会在 200ms 内补回，面板里的开关可一键关闭。

## 重新构建

在仓库根目录运行（Windows 下 `python` 指本机 Python 3）：

```powershell
python build/fetch_data.py        # 官方 API：en / zh-CN / zh-TW
python build/fetch_poedb.py       # 流放编年史物品页缓存
python build/poedb_maps.py        # 解析编年史 -> build/out/poedb_maps.json
node   build/make_ui_dict.js      # 界面词典（简体）
node   build/convert_ui.js        # 界面词典（繁體）
python build/build_extension.py   # 组装 dist/poe-trade-cn 与 zip
```

校对与测试：

```powershell
node build/check_data.js       # 产物结构、语言纯度、冷抗用词、UI 与筛选器覆盖
node build/test_core.js        # 三套 payload 的翻译逻辑
node build/test_lang.js        # 简繁切换与刷新守卫
node build/test_idempotent.js  # 重复翻译不变形
```

端到端（需要先启动带扩展的 Edge，并监听调试端口）：

```powershell
msedge --headless=new --remote-debugging-port=9444 ^
  --load-extension=<绝对路径>/dist/poe-trade-cn about:blank
node build/edge_e2e.js         # PoE 1（繁體）
node build/edge_e2e_poe2.js    # PoE 2（简体）
node build/edge_e2e_timing.js  # 注入时机
```

构建产物：`dist/poe-trade-cn/` 与 `dist/poe-trade-cn.zip`。
