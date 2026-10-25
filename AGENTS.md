# AGENTS.md · wanli-trail（红军长征沙盘）

## 项目定位

`wanli-trail` 是一个**纯前端的红军长征沙盘演示应用**（仓库 `nova-fable/wanli-trail`）。它只做：

- 四路红军（红一/红二/红四方面军、红二十五军）1934.10—1936.10 全程路线的 GIS 沙盘演示
- 纪录片式自动播放（50 个关键事件自动暂停讲解）+ 自由探索两种模式
- 战场态势（苏区/国民党军/日军）、兵力消长、精神印记、诗词字幕等史实内容层

不包含：后端服务、账号体系、真实地图数据下载、移动 App 打包。所有史实数据**本地静态、坐标为近似考证值**，修正史实直接改 `src/data/`，不引入数据库。

## 技术栈

- Vite 5 + Vue 3（`<script setup>`，纯 JS，无 TS、无路由、无全局状态库）
- Leaflet 1.9（npm 引入，命令式集成，禁用 vue-leaflet 包装库）
- 底图全部免 key：高德矢量 / Esri 地形 / OSM，均做仿古羊皮纸滤镜处理
- 播放引擎为 **setInterval 50ms**（非 rAF：窗口被遮挡时 rAF 会被系统暂停）

## 目录

```text
index.html                     唯一前端入口（内含 #boot 预置启动屏：消灭首帧地图闪烁）
src/main.js                    应用挂载 + 移除 #boot
src/router/index.js            极简 hash 路由（intro/sandbox 双页；ROUTES 枚举单源）
src/App.vue                    路由装配层（按路由渲染开场页/沙盘页）+ 全局快捷键
src/styles/global.css          全部样式单源（组件内禁止 <style> 块）
src/core/                      跨域基础设施（不依赖业务组件）
  constants/map.js              地图几何常量（视野/跟随zoom/箭头间距/底部预留）
  constants/colors.js           Leaflet 图层配色（JS 侧单源）
  constants/storage.js          localStorage 键名
  enums/index.js                UI 枚举（MARKER_MODE/LANG）
  i18n/                         列式词典引擎（zhCN 基础键源 + en Partial + t()）
src/utils/geo.js               时间/地理工具：parseDate（记忆化）、endOfDay、样条加密、positionAt
src/composables/
  usePlayback.js               播放引擎单例（时间域/倍速/事件指针/seek/dt 限幅）
  useLayers.js                 图层显隐与四军实时状态
  useMapBase.js                底图配置
  usePrefs.js                  用户偏好持久化（localStorage，含语言代管）
src/data/                      史实数据集（单源，文档在 docs/history、docs/spirit）
  armies.js  routes/           四路红军元信息与带日期航点
  events.js                    50 个关键事件（导出时按日期重排序）
  figures.js                   20 位人物（firstEvent 引用事件 id）
  situation.js                 态势实体（全部带 from/to 时间窗）
  rivers.js                    江河要津简化走线
  stories.js strength.js quotes.js phases.js
src/map/                       Leaflet 域逻辑模块（SandboxMap 只编排）
  icons.js                      五类点标记 SVG 工厂 + EV_SHAPES 七轮廓
  camera.js                     跟随镜头状态机（飞行互斥 + EMA 跟拍）
  traveled.js                   已走折线增量维护（热路径性能关键）
  arrows.js                     方向箭头增量布设
  situation.js                  态势构建 + 时间窗显隐
src/components/                视图组件（SandboxMap/TimelineBar/EventPanel/EventIndex/ArmyLegend/...）
docs/
  history/                     事件全录、战役志、人物志、路线志、战场态势
  spirit/                      精神印记、长征诗词、长征精神
  dev/                         系统架构、设计语言、数据格式规范、i18n 规范
```

## 数据层约定

- **数据文件是史实唯一单源**，`docs/` 是它的成文档化视图：改数据必须同步补 docs，反之亦然。
- 时间窗语义统一走 `utils/geo.js` 的 `endOfDay`（to 补到当日最后一毫秒）；禁止在组件里自建 endOfDay 副本。
- `events.js` 源码按部队分段书写，导出时按日期排序——**新增事件只管插入对应部队段落**，插入位置不影响运行时顺序。
- 人物/事件互引用 id：`figures.js#firstEvent` → `events.js#id`；新增人物先确认目标事件存在。
- 坐标为省级精度近似值（小数点后两位）；修正坐标时在提交 body 注明依据。
- 兵力锚点与 `STRENGTH_TOTAL` 口径必须自洽（出发 ≈ 8.6万+1.7万+8万+0.3万 ≈ 18.6 万）。

## 前端代码规范

- 组件文件 PascalCase（`SandboxMap.vue`）；composable 以 `use` 开头 camelCase；与 ai-tracker-hud 不同，本仓库 Vue SFC 允许横杠仅限工具链约定文件。
- 依赖方向：`components → composables → data → utils`；`utils/` 禁止反向依赖任何业务模块。
- **样式只写 `src/styles/global.css`**：设计 token 在 `:root`（三级金 `--accent / --accent-soft / --gold-deep`、面板圆角/阴影），新样式先找 token，找不到先补 token 再用。
- 播放热路径（`render()` 每 50ms 一次）禁止每帧重建大数组/新建对象；已走折线由 `updateTraveled` 增量维护，`positionAt` 传 `{ noTravel: true }`。
- 镜头是状态机（`camBusy` 飞行互斥 + `followCam` EMA 跟拍）：改镜头逻辑前先读 `SandboxMap.vue` 相关节注释；所有镜头移动必须走 `beginCamFlight`，禁止裸调 `flyTo`。
- 遮挡环境兼容（IAB/失焦）：涉及动画的路径必须有非 rAF 兜底；新增过渡不得依赖 `<transition>` 的 out-in。

## 通用代码与注释规范

- 注释只写代码讲不出的信息（约束/边界/坑），**只描述最终状态**——不写演进叙事、不写日期、不写情绪词；演变过程留给 git log。
- 注释里引用的函数/字段必须 grep 得到；注释与代码不符以代码为准并立即修注释。
- 单源原则：同一事实只在一处成文（史实细节在 data，机制说明在 docs/dev，注释只交叉引用）。
- 死代码随手清到链尾：删事件 → 同步清 figures 引用/docs/索引面板无残留。

## 常用命令

```bash
npm install
npm run dev        # 开发服务器 http://127.0.0.1:5180
npm run build      # 生产构建（含 leaflet 分包）
npm run preview    # 预览 dist
```

## Git 提交规范

### 分批提交并及时推送（强制）

按功能点分批提交，禁止混合提交：一个需求 / bug / 重构 = 一个提交。功能点完成并通过
「验证」清单后立即提交并 `git push`，不要把多个功能点积压在工作区；推送失败时如实说明
原因，恢复后补推。

| 类别 | 提交策略 |
|---|---|
| 新增事件 / 人物 / 态势实体等史实数据 | 独立提交 `feat(data):`，body 注明史实依据 |
| 新增视图组件 / 面板 | 独立提交 `feat(ui):` |
| 播放引擎 / 镜头 / 渲染行为变更 | 独立提交 `feat(engine):` / `fix(engine):` |
| bug 修复 | 一个 bug 一个提交 `fix:`（body 附根因简述） |
| 样式 / 设计 token 调整 | 独立提交 `style:`，禁止混入逻辑改动 |
| 性能优化 | 独立提交 `perf:`（body 附前后对比或量化依据） |
| 文档 / 数据成文档化 | 独立提交 `docs:` |
| 重命名 / 移动 / 构建 / 依赖 | 独立提交 `refactor:` / `chore:` |

### Commit message 格式

```text
<type>(<scope>): <subject>    （body / footer 可选，各段之间空一行）
```

- **type（必填）**：`feat` 新功能 · `fix` 修复 bug · `refactor` 不改行为的结构调整 · `perf` 性能优化 · `docs` 仅文档/注释 · `style` 仅格式/视觉 · `chore` 构建/工程化/杂项。
- **scope（必填）**：子系统级；跨子系统按主要影响取一个，无法归类用 `global`。

| scope | 范围 |
|---|---|
| `data` | src/data/ 史实数据集（事件/路线/人物/态势/兵力/诗词/阶段） |
| `engine` | 播放引擎与镜头系统（usePlayback / SandboxMap 渲染与镜头） |
| `map` | 地图图层与地图内元素（路线/标记/态势实体/氛围特效） |
| `ui` | 界面组件与交互（时间轴/讲解卡/索引/图例/浮层） |
| `prefs` | 用户偏好持久化（usePrefs） |
| `style` | global.css 设计 token 与视觉样式 |
| `docs` | README / docs / AGENTS.md |
| `global` | 工程配置、依赖、构建、仓库事务 |

- **subject（必填）**：中文为主，50 字以内，不写句号，动词开头（新增/修复/重构/调整/移除/优化）；写「做了什么」，根因放 body。
- **body（可选）**：与 subject 空一行；写根因 + 方案（为什么改、改了哪几个关键点）。史实数据改动必须在 body 写明依据（来源或考据结论）。
- **footer（可选）**：`BREAKING CHANGE: <描述>`（数据结构 / 偏好存储不兼容时）；`Refs: <任务/issue>`。

### 提交前检查清单

1. `npm run build` 全绿；涉及播放/镜头/交互的改动先在 `npm run dev` 手工验收。
2. 改 `src/data/` 时自检：`events.js` 日期排序由导出保证、`figures.js#firstEvent` 引用有效、时间窗 `from ≤ to`、兵力口径与 `STRENGTH_TOTAL` 自洽。
3. 数据成文档化同步：改事件/人物/态势/诗词任一数据，`docs/history/` 或 `docs/spirit/` 对应篇同一提交内更新。
4. 注释自检：无日期、无演进叙事、无情绪词；注释引用的机制在代码里 grep 得到。
5. 改偏好结构（usePrefs）时确认旧键兼容或 bump 存储键版本（`cz-prefs-v1`）。

### 示例

```text
feat(data): 新增直罗镇战役、瓦窑堡会议等六个陕北阶段事件

补齐 1935-11 后红一方面军叙事断层；直罗镇为"奠基礼"收官战，瓦窑堡确立抗日民族
统一战线并衔接日军威胁层。依据：新华网/人民网党史频道相关条目（见 docs/history/battles.md）。

fix(engine): 修复图例隐藏某军后镜头仍跟拍隐形部队

根因：followTargetKey 只判断 marker 是否在 layerGroup 内，未判断该军是否被
armyVisible 隐藏。方案：目标挑选与回退均加 armyVisible 过滤。
```

## 验证

本地提交前跑同一套：

```bash
npm run build
```

手工验收（视改动范围取用）：

1. 开场页两个入口可用；演示模式跨事件自动暂停讲解、镜头飞行平滑。
2. 拖动时间轴到任意日期，路线/事件点/兵力/态势与日期一致；拖到终点不触发重播。
3. 图例隐藏某军：路线消失、事件标记不可点、镜头不再跟随该军。
4. 刷新页面：底图/倍速/开关/图例折叠状态保留。
5. 窄屏（≤768px）：面板不溢出、时间带可拖动。
