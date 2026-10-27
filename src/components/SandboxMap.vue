<script setup>
/**
 * @file 沙盘地图组件（Leaflet 编排层）
 *
 * 职责：地图实例与图层组装；render() 每帧编排（军位置/折线/箭头/标记可见性/镜头）；
 * 响应播放引擎与图例开关的 watch。仅做编排，不写盘。
 * 数据来源：playback（时间/模式）、preparedRoutes（加密路线）、data/*（事件与态势）。
 * 写路径：Leaflet 图层操作 + 容器 class；地图实例与图层集合都在响应式系统之外
 * （Leaflet 对象进 reactive 会被代理破坏内部状态——保持 module-scope 普通变量）。
 *
 * 模块分层（本组件只编排，逻辑在各模块）：
 * - map/icons.js      五类点标记的 SVG 工厂
 * - map/camera.js     跟随镜头状态机（飞行互斥 + EMA 跟拍）
 * - map/traveled.js   已走折线增量维护（热路径性能关键）
 * - map/arrows.js     方向箭头增量布设
 * - map/situation.js  态势实体构建与时间窗显隐
 */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ARMIES, EVENTS } from '../mock'
import { playback, openEvent, flashToast } from '../composables/usePlayback'
import { BASEMAPS } from '../composables/useMapBase'
import { preparedRoutes, armyVisible, armyState, situationVisible } from '../composables/useLayers'
import { positionAt, parseDate } from '../utils/geo'
import { MAP_VIEW } from '../core/constants/map'
import { MARKER_MODE } from '../core/enums'
import { walkerIcon, eventIcon } from '../map/icons'
import { createCamera } from '../map/camera'
import { createTravelTracker } from '../map/traveled'
import { syncArrows, clearArrows, arrowStepFor } from '../map/arrows'
import { buildSituationLayers } from '../map/situation'

/** 地图容器 DOM（Leaflet 挂载点） */
const mapEl = ref(null)

/** 地图实例 / 当前瓦片层（module-scope，刻意脱离 Vue 响应式，见文件头） */
let map = null
let tileLayer = null
/** 军图层集合：armyKey → { group, ghost, casing, traveled, flow, startDot, marker, travel, arrows 状态... } */
const layers = {}
/** 50 个事件标记（与 EVENTS 同序） */
const eventMarkers = []
/** 已越过事件数缓存（diff 后才动 DOM）与显隐模式缓存 */
let lastPassedCount = -1
let lastMarkerMode = null
/** 事件时间戳预解析（countPassed 二分用；EVENTS 已按日期升序） */
const EVENT_TS = EVENTS.map((e) => parseDate(e.date))

/** 跟随镜头控制器（ctx 注入依赖，模块不直接 import playback 单例） */
const camera = createCamera({
  getMap: () => map,
  container: () => mapEl.value,
  playback,
  armyState,
  armyVisible,
  getArmyLayer: (key) => layers[key],
  orderedArmyKeys: ARMIES.map((a) => a.key),
})

/** 态势图层集合（onMounted 构建；键 zones/kmt/japan/stories/rivers） */
let situation = null

/**
 * 统计时刻 t 已越过的事件数（二分；EVENTS/EVENT_TS 同序）
 * @param {number} t 当前时刻 ms
 */
function countPassed(t) {
  let lo = 0
  let hi = EVENT_TS.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (EVENT_TS[mid] <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * 事件标记可见性同步（march=随行军浮现 / all=未发生淡化）。
 * march 模式下未抵达的事件隐藏（小红军走过即浮现，行军先于识图）；
 * 讲解中的事件始终可见（flyTo 的落点）。只在跨越计数/模式变化时整体调用。
 * @param {number} passed 已越过事件数
 */
function syncMarkerVisibility(passed) {
  const march = playback.markerMode === MARKER_MODE.MARCH
  const panelId = playback.panelEvent?.id
  EVENTS.forEach((ev, i) => {
    const el = eventMarkers[i].getElement()?.querySelector('.ev-mark')
    if (!el) return
    el.classList.toggle('ev-future', !march && i >= passed)
    el.classList.toggle('ev-hidden', march && i >= passed && ev.id !== panelId)
  })
}

/**
 * 切换底图（瓦片层替换 + 容器羊皮纸滤镜类切换）
 * @param {string} key BASEMAPS 成员 key
 */
function setBasemap(key) {
  if (tileLayer) map.removeLayer(tileLayer)
  const cfg = BASEMAPS.find((b) => b.key === key) || BASEMAPS[0]
  tileLayer = L.tileLayer(cfg.url, {
    attribution: cfg.attribution,
    subdomains: cfg.options.subdomains || 'abc',
    maxNativeZoom: cfg.options.maxNativeZoom,
    maxZoom: 12,
    minZoom: 4,
  })
  tileLayer.addTo(map)
  // 底图羊皮纸化滤镜（三底图同暖色偏移，切换观感连续）见 styles/map.css .bm-*
  mapEl.value.classList.remove(...BASEMAPS.map((b) => `bm-${b.key}`))
  mapEl.value.classList.add(`bm-${cfg.key}`)
}

/**
 * 每帧渲染（playback.time/playing 变化与 zoomend 触发，50ms 档）：
 * 态势显隐 → 四军（位置/折线/流动/箭头/小红军）→ 事件标记可见性 → 镜头跟拍
 */
function render() {
  const t = playback.time
  situation.update(t, {
    playing: playback.playing,
    onStory: (s) => flashToast(`❦ 精神印记 ·《${s.name}》—— 点击地图书签阅读`),
  })

  for (const army of ARMIES) {
    const ly = layers[army.key]
    const route = preparedRoutes[army.key]
    // noTravel：折线由 tracker 增量维护，跳过每帧全量数组分配（热路径关键）
    const pos = positionAt(route, t, { noTravel: true })
    const st = armyState[army.key]
    st.started = pos.started
    st.done = pos.done
    st.pct = route.totalKm > 0 ? Math.round((pos.km / route.totalKm) * 100) : 0

    ly.travel.update(route, pos)

    // 流动虚线仅在行进中播放：暂停/到达即停，避免 SVG 恒定重栅格化
    const flowing = playback.playing && !pos.done
    if (ly.flowing !== flowing) {
      ly.flowing = flowing
      ly.flow.getElement()?.classList.toggle('running', flowing)
    }

    if (pos.started) syncArrows(ly, ly.travel, pos, army.color, arrowStepFor(map.getZoom()))
    else clearArrows(ly)

    if (pos.started) {
      if (!ly.group.hasLayer(ly.marker)) ly.marker.addTo(ly.group)
      // 行走方向：位移指数平滑（EMA）+ 水平显著才转身，避免蜿蜒路线来回翻面
      if (ly.lastPos) {
        const dLng = pos.head[1] - ly.lastPos[1]
        const dLat = pos.head[0] - ly.lastPos[0]
        ly.emaX = (ly.emaX || 0) * 0.82 + dLng * 0.18
        ly.emaY = (ly.emaY || 0) * 0.82 + dLat * 0.18
        const sp = Math.hypot(ly.emaX, ly.emaY)
        if (sp > 1e-7 && Math.abs(ly.emaX) > 0.3 * sp) ly.dir = ly.emaX > 0 ? 1 : -1
      }
      const walking = playback.playing && !pos.done
      ly.lean = walking ? 10 : 0
      ly.lastPos = pos.head
      ly.marker.setLatLng(pos.head)
      const el = ly.marker.getElement()?.querySelector('.walker')
      if (el) {
        el.classList.toggle('done', pos.done)
        el.classList.toggle('walking', walking)
        const leanEl = el.querySelector('.w-lean')
        if (leanEl) leanEl.style.transform = `scaleX(${ly.dir}) rotate(${ly.dir * ly.lean}deg)`
      }
    } else if (ly.group.hasLayer(ly.marker)) {
      // 未出发：收起小红军并清方向状态（再次出发从正向起步）
      ly.group.removeLayer(ly.marker)
      ly.lastPos = null
      ly.emaX = 0
      ly.emaY = 0
    }
  }

  // 事件标记可见性（跨越计数或显隐模式变化时才动 DOM）
  const passed = countPassed(t)
  if (passed !== lastPassedCount || playback.markerMode !== lastMarkerMode) {
    syncMarkerVisibility(passed)
    lastPassedCount = passed
    lastMarkerMode = playback.markerMode
  }

  camera.tickFollow()
}

onMounted(() => {
  map = L.map(mapEl.value, {
    center: [31, 106],
    zoom: 5,
    minZoom: 4,
    maxZoom: 12,
    zoomControl: false,
    attributionControl: false,
    worldCopyJump: true,
  })
  L.control.zoom({ position: 'topright' }).addTo(map)
  L.control.attribution({ position: 'topright', prefix: false }).addTo(map)
  L.control.scale({ imperial: false, position: 'bottomright', maxWidth: 110 }).addTo(map)
  setBasemap(playback.basemap)

  // 战场态势层先于路线加入，使路线绘制在其上
  situation = buildSituationLayers(map)

  // 四路军的路线图层：ghost 幽灵线（未走）/ casing 白衬底 / traveled 主线 / flow 流动虚线
  for (const army of ARMIES) {
    const route = preparedRoutes[army.key]
    const group = L.layerGroup()
    const ghost = L.polyline(
      route.pts.map((p) => [p.lat, p.lng]),
      { color: army.color, weight: 2.5, opacity: 0.5, dashArray: '3 8', smoothFactor: 0.2, interactive: false },
    )
    const casing = L.polyline([], {
      color: '#ffffff', weight: 9, opacity: 0.9, lineJoin: 'round', lineCap: 'round', smoothFactor: 0.2, interactive: false,
    })
    const traveled = L.polyline([], {
      color: army.color, weight: 5.5, opacity: 1, lineJoin: 'round', lineCap: 'round', smoothFactor: 0.2, interactive: false,
    })
    const flow = L.polyline([], {
      color: '#ffffff', weight: 2.2, opacity: 0.9, dashArray: '1.5 12', lineCap: 'round', className: 'route-flow', smoothFactor: 0.2, interactive: false,
    })
    // 出发地起点标记
    const p0 = route.pts[0]
    const startDot = p0
      ? L.circleMarker([p0.lat, p0.lng], { radius: 5, color: army.color, weight: 3, fillColor: '#ffffff', fillOpacity: 1, interactive: false })
      : null
    const marker = L.marker(p0 ? [p0.lat, p0.lng] : [0, 0], {
      icon: walkerIcon(army),
      zIndexOffset: 800,
      keyboard: false,
    })
    ghost.addTo(group)
    casing.addTo(group)
    traveled.addTo(group)
    flow.addTo(group)
    if (startDot) startDot.addTo(group)
    group.addTo(map)
    layers[army.key] = {
      group, ghost, casing, traveled, flow, startDot, marker,
      travel: createTravelTracker({ casing, traveled, flow }),
      arrows: null, arrowIdx: 1, arrowAcc: 0, arrowPlaced: 0, arrowMaxKm: null, arrowStep: null,
      lastPos: null, dir: 1, lean: 0, flowing: false, emaX: 0, emaY: 0,
    }
  }

  // 事件标记：点击 → 关闭跟随并弹出讲解
  EVENTS.forEach((ev, i) => {
    const m = L.marker([ev.lat, ev.lng], { icon: eventIcon(ev), zIndexOffset: 500 })
    m.bindTooltip(`${i + 1}. ${ev.name}（${ev.dateLabel}）`, {
      direction: 'top',
      offset: [0, -32],
      className: 'ev-tip',
    })
    m.on('click', () => {
      playback.follow = false
      openEvent(ev)
    })
    m.addTo(map)
    eventMarkers.push(m)
  })

  // 重点事件的地图名称标签（zoom≥6 常驻）
  const majorLabels = L.layerGroup()
  EVENTS.filter((e) => e.major).forEach((ev) => {
    L.tooltip({ permanent: true, direction: 'right', className: 'ev-label', offset: [14, 0] })
      .setLatLng([ev.lat, ev.lng])
      .setContent(ev.name)
      .addTo(majorLabels)
  })
  const syncMajorLabels = () => {
    if (map.getZoom() >= 6) majorLabels.addTo(map)
    else map.removeLayer(majorLabels)
  }
  map.on('zoomend moveend', syncMajorLabels)
  // 缩放改变箭头密度档位，需要重算
  map.on('zoomend', () => render())

  // 初始视野必须禁用动画：页面不可见时 rAF 暂停会导致动画式中断、视野残缺
  // 底部按窄屏/桌面预留时间带 + 字幕高度（MAP_VIEW.RESERVE 与 CSS 断点约定同值）
  const narrow = window.innerWidth <= MAP_VIEW.NARROW_BREAKPOINT
  map.fitBounds(MAP_VIEW.CHINA_BOUNDS, {
    paddingTopLeft: [narrow ? 12 : 30, narrow ? 12 : 30],
    paddingBottomRight: [narrow ? 12 : 30, narrow ? MAP_VIEW.RESERVE.narrow : MAP_VIEW.RESERVE.wide],
    animate: false,
  })

  // 用户拖动地图 = 夺取镜头：中止飞行并关闭跟随
  map.on('dragstart', () => {
    camera.abort()
    mapEl.value.classList.remove('smooth-follow')
    if (playback.follow) playback.follow = false
  })
  map.on('zoomstart', () => {
    // 飞行中的缩放是镜头自身行为；用户缩放则解除跟拍过渡并丢锚点（从新视野收拢）
    if (!camera.isBusy()) {
      mapEl.value.classList.remove('smooth-follow')
      camera.dropAnchor()
    }
  })

  render()
})

onBeforeUnmount(() => {
  camera.destroy()
  if (map) map.remove()
  map = null
})

// 每帧播放推进
watch(
  () => playback.time,
  () => render(),
)

// 暂停/恢复也要渲染：walking 动画与倾角依赖 playing 而非 time
watch(
  () => playback.playing,
  (v) => {
    render()
    if (v) camera.resume()
  },
)

// 底图切换
watch(
  () => playback.basemap,
  (key) => setBasemap(key),
)

// 镜头飞往事件特写（含遮挡环境兜底，统一走 camera.begin）
function flyToEvent(ev) {
  if (!map || !ev) return
  camera.begin([ev.lat, ev.lng], ev.zoom || 8, 1.3)
}

// 面板事件变化（自动暂停或用户点击）→ 高亮 + 可见性重算 + 镜头飞往
watch(
  () => playback.panelEvent,
  (ev) => {
    eventMarkers.forEach((m, i) => {
      const el = m.getElement()?.querySelector('.ev-mark')
      if (el) el.classList.toggle('ev-active', !!ev && EVENTS[i].id === ev?.id)
    })
    // march 模式：讲解中的事件从隐藏态浮现，其余按当前进度重算
    syncMarkerVisibility(countPassed(playback.time))
    if (ev) flyToEvent(ev)
  },
)

// 开启跟随 → 平滑飞回跟拍视角；关闭跟随 → 中止飞行
watch(
  () => playback.follow,
  (v) => {
    if (v) camera.resume()
    else camera.abort()
  },
)

// 切换倍速 → 跟随缩放档位变化，需要时平滑过渡
watch(
  () => playback.speed,
  () => {
    if (playback.follow && playback.playing && !camera.isBusy()) camera.resume()
  },
)

// 部队显隐 → 军队编队图层与其事件标记（隐藏军事件禁点击，防误触飞行讲解）
watch(
  armyVisible,
  (vis) => {
    if (!map) return
    for (const army of ARMIES) {
      const ly = layers[army.key]
      if (!ly) continue
      if (vis[army.key]) ly.group.addTo(map)
      else map.removeLayer(ly.group)
    }
    EVENTS.forEach((ev, i) => {
      if (ev.army === 'all') return
      const el = eventMarkers[i].getElement()
      if (el) {
        const on = vis[ev.army]
        el.style.opacity = on ? '' : '0.12'
        el.style.pointerEvents = on ? '' : 'none'
      }
    })
  },
  { deep: true },
)

// 战场态势层显隐（含江河要津静态层）
watch(
  situationVisible,
  (vis) => {
    if (!map || !situation) return
    for (const key of Object.keys(situation.layers)) {
      if (vis[key]) situation.layers[key].addTo(map)
      else map.removeLayer(situation.layers[key])
    }
  },
  { deep: true },
)
</script>

<template>
  <div ref="mapEl" class="sandbox-map"></div>
</template>
