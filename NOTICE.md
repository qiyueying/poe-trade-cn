# 第三方来源与署名

本项目的代码为原创，但构建过程依赖下列外部来源。它们各自的权利归原作者所有。

## 游戏数据

- **词缀 / 物品 / 筛选器 / 静态数据**：来自 Grinding Gear Games 的官方市集 API
  （`www.pathofexile.com/api/trade{,2}/data/*`、`pathofexile.tw`、`poe.game.qq.com`）。
  仅在本机抓取并打包进扩展离线使用，不随仓库分发原始响应。
- **繁体用词（`poedb.tw` / `poe2db.tw`）**：只用于生成「英文 slug → 中文名称」词表。
  抓取的页面不入库（`tools/downloads/` 已 gitignore），脚本请求带正常 UA 并限速。
- **FilterBlade 汉化词典**（`extension/data/dict*.js`、`dict*.tw.json`）：由社区词典转换而来，
  用于物品名称的简繁映射；文件头写明了生成方式。

## 代码

- **OpenCC（js 移植）**（`tools/openccjs/`）：Apache License 2.0，见文件头注释。
- **`ref/poe-trade-zh/js/translate.zh_TW.js`**：旧「POE Trade ZH」扩展（Chrome 应用商店版本）的界面字符串表，
  仅作为 UI 词典的输入，`build/make_ui_dict.js` 读取。仓库刻意只保留这一个文件，该扩展的其余文件不入库。

## 商标

Path of Exile、Path of Exile 2 及相关名称、图标为 Grinding Gear Games 的商标。本项目为非官方作品，
与 Grinding Gear Games 无隶属或合作关系。
