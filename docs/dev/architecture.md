# 系统架构

> 面向改动者。读本文前建议先浏览 [data-format.md](data-format.md) 了解数据形态。

## 总体形态

纯前端单页应用：Vite 5 构建，Vue 3（`<script setup>`，纯 JS）组织界面，Leaflet 1.9 命令式集成地图。无路由、无全局状态库、无后端；`src/data/` 静态数据即"数据库"。

```text
用户/播放器 ──▶ usePlayback（时间域单例）──▶ playback.time
                  │                            │
                  ▼                            ▼
           setInterval 50ms tick      SandboxMap.render()（每 tick）
                  │                            │
                  ├─ 事件指针推进/自动暂停       ├─ positionAt ×4（军位置）
                  ├─ syncEventPointer          ├─ updateTraveled（增量折线）
                  └─ flashToast                ├─ syncArrows（增量箭头）
                                               ├─ updateSituation（时间窗显隐）
                                               └─ 镜头状态机（跟拍/飞行）
```

## 播放引擎（usePlayback.js）

- **时间域**：`T_START = 1934-10-01` → `T_END = 1936-10-31`；1× 速率 = 7 天/秒；支持 0.5/1/2/4×。
- **驱动**：`setInterval(tick, 50)` 而非 rAF——窗口被遮挡/失焦时 rAF 会被宿主暂停，interval 仍推进（IAB 环境实测结论）。`pause()` 即 `clearInterval`，`play()` 按需重建。
- **事件指针**：`nextEventIdx` 指向下一个未越过事件；autoTour 开启时 tick 越线即暂停、写 `currentEvent/panelEvent`（**markRaw**，避免 Vue 代理破坏事件对象同一性）；关闭时仅更新 `lastEventArmy` 供镜头跟随。
- **seek 语义**：拖动/跳转**不置 `finished`**（结语只在 tick 自然到达终点时触发，防止拖到末端误弹结语或"回卷重播"）。

## 地图渲染（SandboxMap.vue）

- 每军四条折线：ghost（未走虚线）/ casing（白衬底）/ traveled（主色实线）/ flow（流动虚线示方向），`smoothFactor: 0.2` 保留曲线。
- **增量折线（updateTraveled）**：持久数组只在跨越加密点时追加、同段推进时改队尾；队尾偏移 <1km 不触发 `setLatLngs`（限流）。`positionAt(..., { noTravel: true })` 跳过每帧全量 traveled 分配。完成态缓存最终数组短路。
- **方向箭头（syncArrows）**：沿已走路径每 140km（zoom≥7 时 60km）布一枚 ▲，按方位角旋转；前进增量放置，回拨超 step/4 或换密度档时整组重建（`arrowMaxKm` 单调递增防陈旧箭头残留）。
- **事件标记**：50 个 divIcon（宋体单字徽记，会师为 ★）；已发生/未发生样式仅在跨越计数变化时 diff 更新。
- **态势显隐（updateSituation）**：每帧只比对时间窗（parseDate 已记忆化），状态翻转才增删图层。
- **镜头状态机**：
  - `beginCamFlight(target, zoom, dur)` 统一入口：flyTo + moveend 释放 + (dur+0.8)s 超时兜底（遮挡环境 rAF 冻结时保证落位）；飞行中 `camBusy=true` 挂起跟拍。
  - 跟拍：`followCam` 锚点 EMA 收敛（k=0.085，落后 >0.6° 时 0.22 追赶）+ `.smooth-follow` CSS 过渡补间；锚点丢失时从**当前视野中心**起步平滑收拢。
  - 特写↔跟拍衔接：恢复播放/开跟随/换倍速时 `resumeFollow()` 判断距离与倍率差，必要时平滑拉远（跟拍 zoom 随倍速 6/6/5/4 自适应）。
  - 用户拖动即夺取镜头（dragstart 关跟随、中止飞行）；camBusy 期间的 zoomstart 是镜头自身缩放，不误清锚点。

## 性能设计要点

| 问题 | 对策 |
|---|---|
| 每帧 4 军×3 线全量 setLatLngs | updateTraveled 增量维护 + done 短路 |
| 每帧重建 traveled 数组（~10 万对象/秒 GC） | positionAt noTravel 模式 |
| parseDate 高频 Date 解析 | geo.js 内 Map 记忆化（日期串有限集合） |
| countPassed 每帧 O(n) | EVENT_TS 预解析 + 二分 |
| 流动虚线恒定重栅格化 | `.running` 类仅行进播放时挂载 |
| 单 chunk 迭代缓存差 | manualChunks 分离 leaflet |

## 环境兼容

- 遮挡/失焦（IAB、后台标签）：interval 引擎、flyTo 超时兜底、无 `<transition>` out-in 依赖——所有关键路径不依赖 rAF 持续性。
- Vue 响应式边界：事件对象一律 markRaw；`armyVisible/situationVisible` 为扁平 reactive（deep watch 仅表面开销）；地图实例、preparedRoutes 在响应式系统之外。
- 卸载清理：map.remove、endCamFlight、window keydown/pointermove/pointercancel 全部随组件卸载移除。

## 持久化（usePrefs.js）

键 `cz-prefs-v1`：底图、倍速、autoTour、follow、图例折叠、armyVisible、situationVisible。`initPrefs()` 必须在子组件挂载前调用（App setup 期）；watch 汇聚全部偏好变化统一落盘，try/catch 兼容隐私模式。
