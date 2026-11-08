# 流放之路市集汉化 · PoE 1 / PoE 2 Trade Localizer

把《流放之路》（Path of Exile）与《流放之路 2》**官方市集页面**汉化的浏览器扩展：筛选器、物品名称、词缀描述、搜索结果卡片、常用界面文字。

- PoE 1：`https://www.pathofexile.com/trade/...` —— 固定**繁體中文**（台湾 / 流亡编年史用词）
- PoE 2：`https://www.pathofexile.com/trade2/...` —— **简体 / 繁體**可在弹窗里切换

数据全部随扩展本地加载，不联网、不上报，游戏端语言设置不需要改。

## 安装

**推荐**：到本仓库的 [Releases](../../releases) 下载 `poe-trade-cn.zip`，解压到任意目录，然后

- Chrome / Edge 打开 `chrome://extensions`（Edge 为 `edge://extensions`），打开「开发者模式」，点「加载已解压的扩展程序」，选择解压出来的目录；
- 打开官方市集页面，首次安装后刷新一次页面。

从源码构建见 [`MAINTAINING.md`](MAINTAINING.md)（需要 Python 3 + Pillow 与 Node.js 18+）。

## 目录

| 路径 | 内容 |
| --- | --- |
| `src/` | 扩展源码（content scripts、popup、manifest）与插件说明 [`src/README.md`](src/README.md) |
| `extension/data/` | 汉化词典（FilterBlade 来源，CN / TW 各一套） |
| `build/` | 抓取官方 API、生成词表、构建、自检与端到端脚本 |
| `tools/openccjs/` | 繁简转换（OpenCC 的 js 版） |
| `MAINTAINING.md` | 发布流程、新赛季换数据的步骤、已知问题与避免措施 |
| `NOTICE.md` | 第三方来源与署名 |

## 已知限制

上游本地化本身缺条目：PoE 1 繁體约 0.7%、PoE 2 简体约 6.4%、PoE 2 繁體约 25%（`pathofexile.tw` 只提供部分词缀）。这些条目会原样显示英文，不是漏翻。细节与校验阈值见 `MAINTAINING.md` §4。

## 声明

非官方项目，与 Grinding Gear Games 无关。Path of Exile 及相关名称为 GGG 的商标；词缀与物品数据来自官方市集 API，繁体用词参考流亡编年史（`poedb.tw` / `poe2db.tw`）。详见 [`NOTICE.md`](NOTICE.md)。
