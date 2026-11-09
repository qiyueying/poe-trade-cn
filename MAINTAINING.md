# 维护与发布手册（市集汉化 / PoE 1 & 2 Trade Localizer）

面向能改代码的人的运维文档：怎么发到 GitHub、新赛季怎么换数据、踩过的坑怎么绕。
插件本身的使用说明在 `src/README.md`（构建时替换版本号后写进 `dist/poe-trade-cn/README.md`）。

## 0. 一页速查

| 我要做什么 | 命令 |
| --- | --- |
| 新赛季全量刷新 + 构建 + 自检 + e2e | `powershell -ExecutionPolicy Bypass -File build/update.ps1` |
| 只重抓官方 API | `python build/fetch_data.py --force --sleep 0.8` |
| 只重抓编年史词表 | `python build/fetch_poedb.py --force` 然后 `python build/poedb_maps.py` |
| 只重新打包 | `python build/build_extension.py` |
| 数据一致性自检 | `node build/check_data.js` |
| 翻译 / 语言切换单测 | `node build/test_core.js`、`node build/test_lang.js` |
| 侧栏汇率算法单测 | `node build/test_rates.js` |
| 数值高亮切词单测 | `node build/test_highlight.js` |
| manifest 结构与资源自检 | `node build/check_manifest.js` |
| 浏览器端到端（自动起 headless Edge） | `node build/edge_e2e.js`、`node build/edge_e2e_poe2.js` |
| 把开发目录导出成发布仓库 | `powershell -ExecutionPolicy Bypass -File build/export_repo.ps1` |

解释器：脚本会依次试 `python`、`py -3`、环境变量 `DSH_PYTHON` 指向的解释器（或在命令行里把 Python 加进 PATH），
并检查 Pillow（`build_extension.py` 用 PIL 画图标）。Windows 商店的 `python.exe` 别名返回 9009，会被跳过。

## 1. 两个目录：开发工作区 vs 发布仓库

- **开发工作区** `归档\`：不是仓库。里面除了本插件，还有别的项目和大量浏览器测试残留（`build\` 约 5.5 GB，`edge_profile*`、`gh-tmp`、`.pnpm-store`、`node_modules` 等），
  直接 `git add .` 会带进两万多个文件。
- **发布仓库** `..\poe-trade-cn\`（由 `build/export_repo.ps1` 生成）：只含下面 37 个文件、约 4.3 MB，有自己的 `.git`。

| 入库 | 体积 | 说明 |
| --- | --- | --- |
| `src/` | 约 60 KB | 扩展源码（含 `src/panel/` 侧栏助手）、manifest、README 模板 |
| `extension/data/` | 2.0 MB | FilterBlade 汉化词典（CN / TW 各两套） |
| `build/*.py` `build/*.js` `build/update.ps1` `build/export_repo.ps1` | 小 | 抓取、生成、构建、自检、e2e、导出 |
| `tools/openccjs/` | 2.1 MB | OpenCC 的 js 版（Apache-2.0） |
| `ref/poe-trade-zh/js/translate.zh_TW.js` | 约 20 KB | UI 词典的原始字符串表，唯一保留的第三方参考文件 |
| 根目录 `README.md` `NOTICE.md` `MAINTAINING.md` `.gitignore` | 小 | 文档 |

| 不入库 | 体积 | 为什么 |
| --- | --- | --- |
| `build/raw/` | 10.5 MB | 官方 API 响应缓存，`fetch_data.py` 可重抓 |
| `build/out/` | 小 | 中间产物（`poedb_maps.json`、`merged_src*.json`、`ui_cn/tw.json`） |
| `tools/downloads/` | 105 MB | 编年史页面缓存 |
| `dist/` | 6.9 MB | 构建产物 + zip，对外只发 Release 附件 |
| `build/edge-ext-profile*/`、`build/*.png` | 单目录 60–650 MB | e2e 的浏览器用户目录与截图 |

导出规则在 `build/export_repo.ps1`：根目录文档和 `build/` 脚本按白名单复制（清单外的旧脚本会在目标里被删掉），
`src/`、`extension/data/`、`tools/openccjs/` 用 robocopy `/MIR` 镜像，`.git` 不受影响。

## 2. 首次发布到 GitHub

```powershell
cd 归档
powershell -ExecutionPolicy Bypass -File build/export_repo.ps1   # 生成 ..\poe-trade-cn
cd ..\poe-trade-cn
git init -b main
git add .
git status --short | wc -l     # 必须是 37 左右；几万行说明目录选错了
git commit -m "chore: import PoE trade localization extension 1.1.0"
git remote add origin git@github.com:<你的账号>/poe-trade-cn.git
git push -u origin main
```

> 注意：沙箱安全策略不允许我删除 git 元数据，所以当前 `归档\` 里留着一个**空的 `.git`**（没有任何提交）。
> 删掉它最稳妥：`Remove-Item -Recurse -Force 归档\.git`。留着也不会影响 `..\poe-trade-cn`，但千万别在里面 `git add .`。

仓库设置：

- Description：`Chrome/Edge extension that localizes the official Path of Exile 1 & 2 trade site (PoE1 繁體, PoE2 简/繁可切换)`。
- Topics：`path-of-exile`、`path-of-exile-2`、`chrome-extension`、`manifest-v3`、`i18n`。
- 关 Wiki / Projects，Issues 留着收「某条词缀没翻译」。

发 Release（唯一的下载入口）：

```bash
git tag -a v1.1.0 -m "1.1.0: PoE2 简繁切换"
git push origin v1.1.0
```

上传 `dist/poe-trade-cn.zip`，正文写三件事：① 数据快照 `DATA_VERSION`（构建日志 `built ... data 20261108.1045`）；
② 上游缺口（PoE1 繁體约 0.7%、PoE2 简体约 6.4%、PoE2 繁體约 25% 的条目回退英文）；③ 安装步骤。

版本只有一个来源：`build/build_extension.py` 的 `VERSION`（第 27 行）与 `src/manifest.json` 的 `version` 必须相同，tag 跟着它们。
`DATA_VERSION` 由构建时的 UTC 时间生成（`build_extension.py` 第 304 行附近），同时是页面缓存失效键（`src/content/main.js:61` 的 `D.version + ':' + lang`），不要手写。

## 3. 新赛季怎么换数据（增 / 删）

### 3.1 标准流程

```powershell
powershell -ExecutionPolicy Bypass -File build/update.ps1
```

依次：抓 24 个官方响应 → 抓三套编年史词表 → 生成 slug 映射 → 重建 UI 词典 → 构建 → 四项自检 → 自动起 headless Edge 跑两个 e2e。
开关：`-SkipFetch`、`-SkipPoedb`、`-SkipDict`、`-SkipTests`、`-SkipE2E`。

| # | 等价命令 | 通过判据 |
| --- | --- | --- |
| 1 | `python build/fetch_data.py --force --sleep 0.8` | 24 个响应全 exit 0；`build/raw/*/*/stats.json` 条目数没有异常下跌 |
| 2 | `python build/fetch_poedb.py --force` | 81 个页面（p2cn 26 + p2tw 26 + p1tw 29），日志无 `ERR` |
| 3 | `python build/poedb_maps.py` | 打印 `poe1 {'cn':0,'tw':2573} poe2 {'cn':2869,'tw':2869}` 这一量级 |
| 4 | `node build/make_ui_dict.js`、`node build/convert_ui.js` | 仅 UI 文案变更时需要；产出 `build/out/ui_cn.json`、`ui_tw.json` |
| 5 | `python build/build_extension.py` | `built ... data <时间戳>`、`zip ... 1.1–1.3 MB` |
| 6 | `node build/check_data.js` | `OK: payload identity, script purity, locale wording, UI maps and filters hold` |
| 6b | `node build/check_manifest.js` | `manifest checks passed`（脚本路径、WAR 资源与匹配式、图标、popup 都存在） |
| 7 | `node build/test_core.js` | `all core checks passed`（20 例，含 `poe2/cn ... items=4xxx` 这行） |
| 8 | `node build/test_lang.js` | 8 例通过 |
| 8c | `node build/test_highlight.js` | 12 例通过（含价格行不误伤、英文粘连数字跳过） |
| 8b | `node build/test_rates.js` | `rates checks passed`（poe1 D/C=624.3、poe2 D/C≈1.798 等 13 例） |
| 9 | `node build/edge_e2e.js`、`node build/edge_e2e_poe2.js` | 需要先有 9444 端口的 headless Edge；`update.ps1` 会自动起，手工跑则按 §7 起一个。poe2 脚本现在还断言侧栏宿主、折叠开关与 iframe 里的面板文字 |

最后在真实浏览器里手测一次（用当季真实联赛名）。headless 假页面证明的是改写链路，不是真实站点结构。

`build/test_idempotent.js` 是旧词典管线的遗留测试，依赖 `build/out/ninja_tw2cn.json` 与 `build/ninja_texts.json`（都已不可复现生成），**不在发布仓库里**，不要照搬它的结论。

### 3.2 增删数据的触点表

| 想改什么 | 改哪里 | 连带必须同步 |
| --- | --- | --- |
| 赛季新增物品类别 | `build/fetch_poedb.py` 的 `POE2_CLASSES`（第 24 行）/ `POE1_CLASSES`（第 32 行） | 重抓词表；`poedb_maps.py` 按目录 glob，不用改 |
| 某类别页面改名或 404 | 同上 | 先手测 `https://poedb.tw/tw/<Class>`、`https://poe2db.tw/cn/<Class>` 是否 200 |
| 新增/删除一套语言 | `build/fetch_poedb.py` 的 `SITES`（第 41 行）与 `OUTDIRS`（第 48 行）；`build/fetch_data.py` 的 `HOSTS`（第 17 行）；`build_extension.py` 的 `PLAN`（第 40 行）、`DICTS`（第 32 行） | `src/manifest.json` 的 `content_scripts` 引用要同步（多/少都会让扩展整体加载失败）、`src/popup/popup.js` 的开关、`src/content/main.js` 选数据、`check_data.js` 断言 |
| 换词典来源 | `extension/data/dict*.js`（全局名 `FBZH_DICT`）与 `DICTS` 的四条路径 | `build/build_extension.py` 的 `load_js_dict()` 只认 `{...}` 里的 `cn` 键，或纯 JSON |
| 极性词对 / 固定短语 | `src/content/core.js` 的 `POLARITY_CN`（第 50 行）、`POLARITY_TW`（第 51 行）、`fixPolarity`（第 53 行）、`MOD_TEXT_TW` | `build/test_core.js` 补 more/less 两个方向的用例 |
| UI 文案 | `build/make_ui_dict.js` 的输入与 `build/convert_ui.js` 的 `FIXES` 表 | 重跑第 4 步，否则 `dist/data/ui*.js` 还是旧文案 |
| 名称 / 描述 / 权限 | `src/manifest.json` | 权限变化会让用户重新授权 |
| 图标 | `build/build_extension.py` 的 PIL 绘制 | 无 |

### 3.3 必须知道的抓取约束（均为实测结论）

- 官方只有三台：`www.pathofexile.com`（en）、`pathofexile.tw`（tw）、`poe.game.qq.com`（cn）；编年史三套：`poe2db.tw/cn`（PoE2 简体）、`poe2db.tw/tw`（PoE2 繁體）、`poedb.tw/tw`（PoE1 繁體）。
- **PoE2 繁體在 `pathofexile.tw` 上只有 5996 条 stats**（英文 8313）。给 `www.pathofexile.com/api/trade2/data/stats` 加 `Accept-Language: zh-TW` 仍返回英文，这条路走不通；剩余约 25% 靠英文兜底，是上游缺口不是 bug。
- CN 与 TW 的 stats 只互补 79 条，别指望「两边拼起来」补齐。
- `fetch_poedb.py` 默认跳过已存在且 >4 KB 的页面，**换赛季必须带 `--force`**（`update.ps1` 已带）。
- 编年史 URL 只有 `poedb.tw/tw/<Class>`、`poe2db.tw/{cn,tw}/<Class>`；`.../tw/cls/<Class>` 是 404。
- 页面里同一行第一个 `<a>` 常含 `<img>`，所以正则要求 `>([^<]{1,60})</a>`（`build/poedb_maps.py:23` 的 `BASE_RE`）。站点改版若让正则 0 命中，脚本会**静默产出空映射**，因此每赛季核对条数：
  - PoE1 繁體：`Amulets` whiteitem 198 / unique 470、`One_Hand_Swords` 62、`Unique_item` unique 7864；
  - PoE2 繁體/简体：`Amulets` whiteitem 56、`Unique_item` unique 2365。

## 4. 已知问题与避免措施

| 现象 | 根因 | 措施 / 校验 |
| --- | --- | --- |
| 少数词缀显示英文 | 上游本地化缺条目（1% / 6% / 25%） | 设计上英文兜底；`check_data.js` 阈值 poe1 ≤2%、poe2cn ≤10%、poe2tw ≤30%，超阈只 WARN，Release notes 写明 |
| 新赛季词表没更新 | `fetch_poedb.py` 跳过 >4 KB 旧文件 | `--force`（`update.ps1` 已带） |
| 新装备类别的物品没翻译 | 类别是手写常量 | 同步 `POE1_CLASSES` / `POE2_CLASSES` |
| 词表突然空了一大片 | 站点改版让正则失配 | 手测页面 + 核对 §3.3 的条数基线 |
| 干净 clone 里 PoE2 简体物品名缺失（可能只剩 2000 多条） | `tools/downloads/p2`（poe2db.tw/cn）没有抓取脚本，词表为空却照样构建 | 已修：`fetch_poedb.py` 新增 `p2cn` 站点；`test_core.js` 的 `poe2/cn unique composite` 用例就是这条的报警器 |
| 构建直接抛 `FileNotFoundError: build/out/ui_cn.json` | 干净 clone 没有中间产物 | 已修：`build_extension.py` 的 `preflight()` 列出缺失输入与对应的生成命令，exit 2 |
| 繁体出现「冰霜抗性」而非台湾的「冰冷抗性」 | OpenCC 只换字形不换词 | 繁體优先用编年史词表；`check_data.js` 按 id 断言（poe1/tw、poe2/tw 应为 `+#% 冰冷抗性`，poe2/cn 为 `+#% 总冰霜抗性`） |
| 词缀「增加/减少」翻反 | 中英方向词不对齐 | `POLARITY_*` 成对表 + `fixPolarity` 按 more/less 双向翻转，`test_core.js` 覆盖 |
| 数值变成范围（`10–20%`） | 用了 `magnitudes` 范围 | 数值一律取自原描述；e2e 夹具也要写 `+42% total to Cold Resistance` 这种带数值形态，写 `#` 看不出是否翻译 |
| 打开页面无限刷新 | 语言脚本每次发现不一致就 reload | `sessionStorage` 守卫（`src/content/lang.js:7` 的 `poe-cn-lang-applied`）只刷一次；`test_lang.js` 覆盖 |
| 换语言后还是旧词 | 市集的 lscache 缓存了旧 payload | `main.js` 用 `D.version + ':' + lang` 清理 token；重建数据会换 `DATA_VERSION` |
| 扩展装了但页面没反应 | manifest 引用了不存在的 `data/*.js`，整个扩展加载失败 | 构建后确认 `PLAN` 里每个文件都存在；扩展页看红字；`check_data.js` 的脚本纯度断言 |
| 隐私模式下开关无效 | `chrome.storage` 不可用 | `lang.js` 不抛错、退化默认语言；`test_lang.js` 覆盖 |
| e2e 首次全量 pending（假失败） | Edge 冷启动时扩展还没加载完 | `update.ps1` 失败重试一次；手工跑要等 2 秒再断言 |
| **e2e 打印英文、marker 为 null，但退出码 0（假通过）** | Edge 157 起品牌版忽略 `--load-extension`；旧 profile 里残留的扩展让上几轮「看起来能用」，profile 一删就全线失效 | 启动参数加 `--disable-features=DisableLoadExtensionCommandLineSwitch`（`update.ps1` 已带）；两个 e2e 已改为断言中文，缺任意一条即 exit 1 |
| e2e 卡在「killed stale edge pid 0」 | netstat 里 TIME_WAIT 行也被解析成监听者 | 已过滤 `OwningProcess -gt 0`；真正占住 9444 的残留进程会被杀掉再重启 |
| 想自动化「点开关→重载」却拿不到扩展 id | `chrome://extensions` 是 shadow DOM；unpacked id 推算被 `ERR_BLOCKED_BY_CLIENT` 拒 | 用 `test_lang.js` 单测桥接逻辑 + 去掉 `lang.js` 副本验证繁體渲染；弹窗用 `file://` 打开 `src/popup/popup.html` 注入 `chrome` 桩截图 |
| 同一分钟重复构建，缓存不失效 | `DATA_VERSION` 精确到分钟 | 正常；一分钟内改数据要手动强刷确认 |
| 提交被拒（单文件 >100 MB）或 `git add` 卡死 | 工作区混着 5.5 GB 浏览器 profile | 在 `..\poe-trade-cn` 提交，不在 `归档` 里提交 |
| README 里版本号是旧的 | README 用 `{{VERSION}}` 模板，构建时替换 | 改版本先改 `build_extension.py` 的 `VERSION` 与 manifest，再构建 |

## 5. 发布前 checklist

- [ ] `VERSION`（`build/build_extension.py`）== `src/manifest.json` 的 `version`
- [ ] `update.ps1` 全绿（含两个 e2e），`check_data.js` 打印 OK，WARN 数记进 Release notes
- [ ] 真实页面手测：PoE1 搜索页（繁體）、PoE2 搜索页（简体 + 繁體）
- [ ] 弹窗三态正确：PoE1 页无开关、PoE2 页简体/繁體当前项高亮
- [ ] UI 有改动时补齐 Before/After 截图（同视口同主题）
- [ ] `dist/poe-trade-cn.zip` 1.1–1.3 MB；解压后只有 `content/ data/ icons/ popup/ manifest.json README.md`
- [ ] `export_repo.ps1` 已重跑，`git status --short` 只有预期改动（约 37 个文件）
- [ ] tag 与版本一致，Release 附 zip，正文含数据日期 + 上游缺口 + 安装步骤

## 6. 合规与署名

- **非官方**：README 与 Release 都写明「与 Grinding Gear Games 无关；Path of Exile 及相关名称为 GGG 的商标」。
- **官方数据**：词缀/物品/筛选器来自 GGG 官方市集 API，仅本地缓存，不入库、不转载。
- **流亡编年史**：`poedb.tw` / `poe2db.tw` 只用于生成「英文 slug → 中文名」词表；HTML 缓存不入库，脚本带正常 UA、站点间隔 0.6 s。
- **`ref/poe-trade-zh`**：旧「POE Trade ZH」扩展的本地副本（`_metadata/verified_contents.json` 可证来自 Chrome 应用商店）。仓库只保留 `js/translate.zh_TW.js` 一张字符串表，其余文件被 `.gitignore` 挡掉，`NOTICE.md` 说明来源。若不想承担任何衍生风险，可删掉该文件改为本地放置（代价：UI 词典不能从仓库重建）。
- **`tools/openccjs/`**：OpenCC 的 js 移植（Apache-2.0），保留文件头注释，`NOTICE.md` 注明。
- **`extension/data/dict*.js`**：FilterBlade 汉化词典，文件头写了生成方式；`NOTICE.md` 标注来源。
- **LICENSE 待定**：建议代码 MIT；数据文件在 README 单独声明「随插件分发，不适用 MIT」。若更倾向 GPL-3.0，改 LICENSE 并在 README 说明即可。

## 7. 排障

- 页面没汉化：确认 URL 命中 `https://www.pathofexile.com/trade*` 或 `/trade2*`；扩展页看报错；改代码后必须「重新加载」再刷新页面。
- 某条仍是英文：在该语言 `build/raw/<game>/<lang>/stats.json` 里搜它的 `id`，没有就是上游缺条目。
- 切换后没变化：看 `<html data-poe-cn-lang>` 是否等于目标语言；不等说明 `lang.js` 没跑或 storage 被禁用，刷新一次。
- 页面一直 pending：多半是数据脚本没加载成功（manifest 路径错 / `dist/data` 缺文件），不是网络问题。
- e2e 里页面保持英文、`marker=null`：Edge 157 品牌版会**静默忽略** `--load-extension`（日志里连 unpacked 装载记录都没有）。改用 CDP：`node build/load_extension.js dist/poe-trade-cn`（`Extensions.loadUnpacked`），`update.ps1` 已经在启动浏览器后自动调用，装不上直接失败。
- 装不上、扩展列表里没有它：先看 `--enable-logging=stderr` 里的 `Extension error:`。最常踩的是 `Invalid value for 'web_accessible_resources[0]'. Invalid match pattern.` —— **WAR 的 matches 路径只能是 `/*`**，写 `https://www.pathofexile.com/trade/*` 会让整个扩展加载失败（`check_manifest.js` 现在会拦住）。
- 侧栏面板空白：面板是 `chrome-extension://<id>/panel/panel.html` 的 iframe，浏览器把它当作独立 target（OOPIF），`Page.getFrameTree` 里看不到，用 `http://127.0.0.1:9444/json/list` 里 `type=iframe` 的 target 检查。
- 弹窗「Microsoft Edge 无法读取和写入其数据目录: /build/edge-ext-profile-e2e」：
  这是在 Git Bash / MSYS 里直接起 msedge、把 `--user-data-dir` 写成相对路径，MSYS 把它改写成 POSIX 形式（`/build/...`），Edge 按这个路径建目录必然失败。
  一律用 `build/update.ps1` 起 e2e（它用 `Join-Path (Get-Location)` 给绝对路径并保证目录存在），或在 bash 里传绝对路径 `--user-data-dir="$PWD/build/edge-ext-profile-e2e"`；弹窗点「确定」后重跑即可，残留进程会被 update.ps1 按命令行清掉。
- 发 Release 时 `curl https://api.github.com/...` 返回 `301 -> https://github.com/<path>`：`api.github.com` 被本机 DNS/VPN 劫持到 github.com 边缘，不是 token 问题。用 `--resolve api.github.com:443:140.82.121.6`（上传附件同理：`--resolve uploads.github.com:443:20.205.243.161`）即可，验证：`curl --resolve api.github.com:443:140.82.121.6 https://api.github.com/rate_limit` 应返回 200。
- 手工起 e2e 浏览器：

```powershell
& "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" --headless=new --remote-debugging-port=9444 `
  --user-data-dir=$PWD\build\edge-ext-profile-e2e `
  --disable-features=DisableLoadExtensionCommandLineSwitch `
  --load-extension=$PWD\dist\poe-trade-cn about:blank
```
