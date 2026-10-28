# 系统架构

> 面向改动者。读本文前建议先浏览 [data-format.md](data-format.md) 了解数据形态。
> 本文只写**机制与边界**（为什么这样分层、哪些路径不能动），不重复数据字段规范。

## 总体形态

纯前端单页应用：Vite 5 构建，Vue 3（`<script setup>`，纯 JS）组织界面，Leaflet 1.9 命令式集成地图。
**双页面 hash 路由**（开场页/沙盘页，零依赖手写）+ 零全局状态库；`src/mock/` 静态数据即"数据库"。

```text
route（router/index.js）──▶ App 按路由渲染 ──▶ #/intro 开场页（不初始化地图）
                                          └──▶ #/sandbox 沙盘页（SandboxMap + 全部浮层）
usePlayback（时间域单例）── tick 50ms ──▶ playback.time ──▶ SandboxMap.render()
```

**防闪烁**：index.html 预置 `#boot` 静态启动屏（与开场页同款视觉），JS 挂载后由 main.js 移除——
刷新首帧永远与开场页同款，且开场路由不初始化地图。

## 依赖方向（单向，不得反向）

```text
components ─▶ composables ─▶ mock（数据）─┐
     │                                    ├─▶ utils ─▶ core（常量/枚举/i18n）
     └──────────▶ map ────────────────────┘
```

- `mock/` 与 `utils/` 禁止 import `components/` `composables/` `map/`；`core/` 不得 import `utils/` 与 `mock/`。
- 组件取数据只走 barrel：`import { EVENTS } from '../mock'`；唯一例外是 `map/situation.js`
  （需按类索引态势实体，走子 barrel `../mock/situation`）。
- 目录归类契约与"什么该放哪"的判定规则见 [../../src/mock/README.md](../../src/mock/README.md)
  与 [../../src/utils/README.md](../../src/utils/README.md)。

## 目录职责

| 目录 | 职责 | 不做什么 |
|---|---|---|
| `src/mock/` | 史实数据唯一单源，按域归类 + barrel 单入口 | 不写逻辑、不 import 上层 barrel |
| `src/core/constants/` | 按域拆分的常量单源（map/icons/playback/history/colors/storage/ui） | 不存业务数据 |
| `src/core/enums/` | UI 枚举（`MARKER_MODE`/`LANG`）字符串字面量单源 | 史实域枚举留在 mock |
| `src/core/i18n/` | 列式词典引擎（zhCN 基础键源 + en Partial + `t()`） | 不键化史实内容 |
| `src/utils/` | 无状态纯工具（geo/date/format） | 不持有状态、不读数据仓库、不碰 DOM |
| `src/map/` | Leaflet 域模块（icons/camera/traveled/arrows/situation） | 不含 Vue 响应式状态 |
| `src/composables/` | 响应式单例与复用逻辑 | 不直接操作 Leaflet 图层 |
| `src/components/` | 视图组件；`SandboxMap.vue` 只编排地图 | 组件内禁止 `<style>` 块 |
| `src/styles/` | 样式单源：`global.css` 为 `@import` 清单，按语义分片 | 分片顺序即层叠顺序，不得随意调整 |

## 播放引擎（composables/usePlayback.js）

- **时间域**：`T_START = 1934-10-01` → `T_END = 1936-10-31`；1× 速率 = 7 天/秒；支持 0.5/1/2/4×。
- **驱动**：`setInterval(tick, 50)` 而非 rAF——窗口被遮挡/失焦时 rAF 会被宿主暂停，interval 仍推进
  （IAB 环境实测结论）。`pause()` 即 `clearInterval`，`play()` 按需重建。
- **遮挡防护**：后台标签被强化节流时 tick 间隔会暴涨至分钟级——dt > 5s 视为"曾被挂起"，跳帧不推进
  （恢复后原时间续播）；其余帧 dt 限幅 2s。防止遮挡期间"时间飞跃"误触终点或误置 `finished`。
  阈值见 `core/constants/playback.js` 的 `PLAYBACK.SKIP_DT_MS` / `MAX_DT_MS`。
- **事件指针**：`syncEventPointer()` 维护 `nextEventIdx`（指向下一个未越过事件）；autoTour 开启时 tick
  越线即暂停、写 `currentEvent`/`panelEvent`（**markRaw**，避免 Vue 代理破坏事件对象同一性）；
  关闭时仅更新 `lastEventArmy` 供镜头跟随。
- **seek 语义**：拖动/跳转**不置 `finished`**（结语只在 tick 自然到达终点时触发，
  防止拖到末端误弹结语或"回卷重播"）。
- **播放态不变量（改播放行为前必读）**：`playback.playing` 与 `setInterval` 句柄必须**同源变更**。
  `play()` 幂等起表（先 `stopTimer()` 再 `setInterval`），`pause()` 是唯一停表入口；
  组件需要"暂停后跳转"必须调 `halt()`，**禁止裸写 `playback.playing = false`**——
  裸写不会清表，`tick` 会以 50ms 空转（`tick` 的 `!playing` 分支只 return 不清表）；
  反之裸把标志置 true 也不会重建定时器，界面显示播放中而时间永久停滞。
  历史上事件总览/人物志/时间带的跳转与拖动都踩过这两种写法，已统一收口。

## 地图渲染（components/SandboxMap.vue + src/map/ 模块）

`SandboxMap.vue` 只做编排（组装图层 + 每 tick 调 `render()`）；逻辑按域拆到 `src/map/`：

| 模块 | 职责 |
|---|---|
| `map/icons.js` | 五类点标记 SVG 工厂（几何常量 `EV_SHAPES`/`WALKER_ICON` 在 `core/constants/icons.js`） |
| `map/camera.js` | 跟随镜头状态机（`createCamera`：飞行互斥 + EMA 跟拍 + 恢复收拢） |
| `map/traveled.js` | 已走折线增量维护（`createTravelTracker`，热路径性能关键） |
| `map/arrows.js` | 方向箭头增量布设（`syncArrows`/`clearArrows`，缩放档位换密度） |
| `map/situation.js` | 态势实体构建 + 时间窗显隐 + 精神印记 toast 回调（`buildSituationLayers`） |

- 每军四条折线：ghost（未走虚线）/ casing（白衬底）/ traveled（主色实线）/ flow（流动虚线示方向），
  `smoothFactor: 0.2` 保留曲线。
- **增量折线**：`createTravelTracker` 返回的 `update(route, pos)` 只在跨越加密点时追加、同段推进时改队尾；
  队尾偏移 <1km（`TRAVEL.TAIL_EPS`）不触发 `setLatLngs`（限流）。
  `positionAt(..., { noTravel: true })` 跳过每帧全量 traveled 分配。完成态缓存最终数组短路。
- **方向箭头**：`syncArrows` 沿已走路径每 140km（zoom≥7 时 60km，见 `ARROWS`）布一枚 ▲，
  按方位角旋转；前进增量放置，回拨超 step/4 或换密度档时整组重建（`arrowMaxKm` 单调递增防陈旧箭头残留）。
- **事件标记**：57 个手绘符号 divIcon（七种不规则轮廓，会师为 ★）；显隐由组件内 `syncMarkerVisibility`
  统一管理——`markerMode: march`（默认）下行军先于识图：未抵达的事件隐藏、走过即浮现
  （讲解中的事件始终可见）；`all` 模式未发生淡化。仅跨越计数或模式变化时 diff 更新 DOM。
  已越过事件数由 `countPassed(t)` 二分求得（`EVENT_TS` 预解析，与 `EVENTS` 同序）。
- **路由与启动**：hash 路由双页（intro/sandbox），`#/sandbox` 深链直达；路由名枚举 `ROUTES` 在 router/index.js。
- **态势显隐**：`buildSituationLayers(map).update(t, { playing, onStory })` 每帧只比对时间窗
  （`parseDate` 已记忆化），状态翻转才增删图层；江河要津为静态地理层，仅受图例开关控制。

### 镜头状态机（createCamera）

- `begin(target, zoom, dur)` 是**唯一飞行入口**：flyTo + moveend 释放 +
  `dur * 1000 + FALLBACKS.CAMERA_FLY_MS` 超时兜底（遮挡环境 rAF 冻结时保证落位）；
  飞行中 `busy = true` 挂起跟拍。**禁止裸调 `map.flyTo`**。
- 跟拍：`tickFollow()` 锚点 EMA 收敛（k=0.085，落后 >0.6° 时 0.22 追赶）+
  `.smooth-follow` CSS 过渡补间；锚点丢失时从**当前视野中心**起步平滑收拢。
- 特写↔跟拍衔接：`resume()` 判断距离与倍率差，必要时平滑拉远
  （跟拍 zoom 随倍速自适应，见 `FOLLOW.ZOOMS`）。
- 用户拖动即夺取镜头（dragstart → `abort()` 关跟随、中止飞行）；
  `isBusy()` 期间的 zoomstart 是镜头自身缩放，不误清锚点（走 `dropAnchor()`）。

## 性能设计要点

| 问题 | 对策 |
|---|---|
| 每帧 4 军×3 线全量 `setLatLngs` | `createTravelTracker` 增量维护 + done 短路 |
| 每帧重建 traveled 数组（~10 万对象/秒 GC） | `positionAt` 的 `noTravel` 模式 |
| `parseDate` 高频 Date 解析 | `utils/geo.js` 内 Map 记忆化（日期串有限集合）**不可删** |
| `countPassed` 每帧 O(n) | `EVENT_TS` 预解析 + 二分 |
| 流动虚线恒定重栅格化 | `.running` 类仅行进播放时挂载 |
| 单 chunk 迭代缓存差 | `manualChunks` 分离 leaflet |

## 环境兼容

- 遮挡/失焦（IAB、后台标签）：interval 引擎、flyTo 超时兜底、无 `<transition>` out-in 依赖——
  所有关键路径不依赖 rAF 持续性（`styles/map.css` 已无 `.fade-*` 过渡类）。
- Vue 响应式边界：事件对象一律 `markRaw`；`armyVisible`/`situationVisible` 为扁平 reactive
  （deep watch 仅表面开销）；地图实例、`preparedRoutes` 在响应式系统之外。
- 卸载清理：`map.remove()`、`camera.destroy()`、window keydown/pointermove/pointercancel
  全部随组件卸载移除。

## 样式分层（styles/）

`global.css` 只保留 `@import` 清单（仍是 `main.js` 的唯一入口），**导入顺序即层叠顺序**：

```text
tokens → base → map → panel-legend → panel-event → timeline → panel-index → intro → finale → responsive
```

`responsive.css`（900/768 两个断点）必须置末。设计 token 在 `tokens.css` 的 `:root`，
新增样式先找 token，找不到先补 token 再用。详见 [design.md](design.md)。

## 持久化（composables/usePrefs.js）

键 `cz-prefs-v1`（`STORAGE.PREFS`）：底图、倍速、autoTour、follow、markerMode、图例折叠、
armyVisible、situationVisible、lang（语言由 usePrefs 代管写盘）。
`initPrefs()` 必须在子组件挂载前调用（App setup 期）；watch 汇聚全部偏好变化统一落盘，
try/catch 兼容隐私模式。
