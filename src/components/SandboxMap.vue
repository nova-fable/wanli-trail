<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ARMIES } from '../data/armies'
import { EVENTS, EVENT_TYPES } from '../data/events'
import { ZONES, KMT_BLOCKADES, KMT_UNITS, JAPAN_CRISES } from '../data/situation'
import { STORIES } from '../data/stories'
import { playback, openEvent, flashToast } from '../composables/usePlayback'
import { BASEMAPS } from '../composables/useMapBase'
import { preparedRoutes, armyVisible, armyState, situationVisible } from '../composables/useLayers'
import { positionAt, parseDate, endOfDay, haversineKm } from '../utils/geo'

const mapEl = ref(null)
// 视野覆盖长征全程，并包含东北/华北的日军威胁标记
const CHINA_BOUNDS = [
  [23.2, 97.8],
  [42.6, 125.2],
]

let map = null
let tileLayer = null
const layers = {} // armyKey -> { group, ghost, casing, traveled, flow, startDot, marker }
const eventMarkers = []
let lastPassedCount = -1
// 事件时间戳预解析（countPassed 二分查找用）
const EVENT_TS = EVENTS.map((e) => parseDate(e.date))

// ===== 跟随镜头：飞行过渡 + 指数平滑跟拍 =====
// 事件特写（zoom 8）与跟拍视角（zoom 随倍速 6→4）之间用 flyTo 平滑拉推；
// 跟拍本身用每 tick 的指数平滑目标点 + CSS 过渡补间，避免离散 panTo 的抖动
const FOLLOW_ZOOMS = { 0.5: 6, 1: 6, 2: 5, 4: 4 }
let camBusy = false // 飞行中，暂停跟拍 panTo，避免打断动画
let camTimer = null
let camEnd = null
let followCam = null // 平滑镜头中心（EMA）
let followKey = null

const followZoom = () => FOLLOW_ZOOMS[playback.speed] || 6

function followTargetKey() {
  let key = playback.lastEventArmy
  // 跟随目标必须已出发且未被图例隐藏，否则镜头会跟拍一支隐形部队
  if (!layers[key] || !armyState[key]?.started || !armyVisible[key]) {
    key = ARMIES.find((a) => armyState[a.key].started && armyVisible[a.key])?.key
  }
  return key && layers[key] && layers[key].group.hasLayer(layers[key].marker) ? key : null
}

function endCamFlight(resetAnchor = true) {
  camBusy = false
  clearTimeout(camTimer)
  if (camEnd && map) {
    map.off('moveend', camEnd)
    camEnd = null
  }
  if (resetAnchor) followCam = null
}

// 所有镜头飞行统一走这里：飞行期间挂起跟拍，遮挡环境下 rAF 冻结时超时兜底落位
function beginCamFlight(target, zoom, dur = 1.5) {
  if (!map) return
  endCamFlight(false)
  camBusy = true
  mapEl.value?.classList.remove('smooth-follow')
  map.flyTo(target, zoom, { duration: dur })
  camEnd = () => endCamFlight(true)
  map.on('moveend', camEnd)
  camTimer = setTimeout(() => {
    if (!camBusy || !map) return
    endCamFlight(false)
    map.setView(target, zoom, { animate: false })
    followCam = null
  }, (dur + 0.8) * 1000)
}

// 恢复播放/开启跟随时：若镜头离部队较远或倍率不合适，先平滑飞回跟拍视角
function resumeFollow() {
  if (!map || !playback.follow || !playback.playing || playback.currentEvent) return
  const key = followTargetKey()
  if (!key) return
  const head = layers[key].marker.getLatLng()
  const c = map.getCenter()
  const z = followZoom()
  const far =
    Math.abs(c.lat - head.lat) > 1.2 ||
    Math.abs(c.lng - head.lng) > 1.2 ||
    Math.abs(map.getZoom() - z) > 1
  if (far) beginCamFlight([head.lat, head.lng], z, 1.5)
  else {
    endCamFlight(false)
    followCam = null
  }
}

// ===== 战场态势 =====
const situationLayers = { zones: null, kmt: null, japan: null, stories: null }
const situationEntities = [] // { id, data, obj, group, active }
let storyCursor = 0 // 已越过的精神印记数（用于播放时 toast 提示）

function buildSituation() {
  situationLayers.zones = L.layerGroup().addTo(map)
  situationLayers.kmt = L.layerGroup().addTo(map)
  situationLayers.japan = L.layerGroup().addTo(map)

  ZONES.forEach((z) => {
    const c = L.circle([z.lat, z.lng], {
      radius: z.radius * 1000,
      color: '#c62828',
      weight: 1.5,
      opacity: 0.85,
      dashArray: '4 6',
      fillColor: '#c62828',
      fillOpacity: 0.08,
    })
    c.bindTooltip(z.name, { permanent: true, direction: 'center', className: 'zone-label' })
    c.bindPopup(warPopup(z, '红军根据地'), { className: 'war-popup', maxWidth: 290 })
    situationEntities.push({ id: z.id, data: z, obj: c, group: 'zones', active: undefined })
  })

  KMT_BLOCKADES.forEach((b) => {
    const line = L.polyline(b.latlngs, {
      color: '#455a64',
      weight: 7,
      opacity: 0.85,
      dashArray: '12 8',
      lineCap: 'butt',
      interactive: true,
    })
    line.bindPopup(warPopup(b, '国民党军·封锁线'), { className: 'war-popup', maxWidth: 290 })
    const mid = b.latlngs[Math.floor(b.latlngs.length / 2)]
    const label = L.tooltip({ permanent: true, direction: 'top', className: 'kmt-label', offset: [0, 8] })
      .setLatLng(mid)
      .setContent(b.name)
    const g = L.layerGroup([line, label])
    situationEntities.push({ id: b.id, data: b, obj: g, group: 'kmt', active: undefined })
  })

  KMT_UNITS.forEach((u) => {
    const m = L.marker([u.lat, u.lng], { icon: enemyIcon(u.short), zIndexOffset: 200 })
    m.bindTooltip(`${u.name}（${u.dateLabel}）`, { direction: 'top', offset: [0, -42], className: 'ev-tip' })
    m.bindPopup(warPopup(u, '国民党军'), { className: 'war-popup', maxWidth: 290 })
    situationEntities.push({ id: u.id, data: u, obj: m, group: 'kmt', active: undefined })
  })

  JAPAN_CRISES.forEach((j) => {
    const m = L.marker([j.lat, j.lng], { icon: japanIcon(), zIndexOffset: 150 })
    m.bindTooltip(`${j.name}（${j.dateLabel}）`, { direction: 'top', offset: [0, -32], className: 'ev-tip' })
    m.bindPopup(warPopup(j, '日军威胁'), { className: 'war-popup', maxWidth: 290 })
    situationEntities.push({ id: j.id, data: j, obj: m, group: 'japan', active: undefined })
  })

  // 精神印记：金色书签，点击阅读故事
  situationLayers.stories = L.layerGroup().addTo(map)
  STORIES.forEach((s) => {
    const m = L.marker([s.lat, s.lng], { icon: storyIcon(), zIndexOffset: 300 })
    m.bindTooltip(`❦ 精神印记 ·《${s.name}》`, { direction: 'top', offset: [0, -14], className: 'ev-tip' })
    m.bindPopup(warPopup(s, '精神印记'), { className: 'war-popup', maxWidth: 290 })
    situationEntities.push({ id: s.id, data: s, obj: m, group: 'stories', active: undefined })
  })
}

// 按当前时间窗显隐态势实体（仅在状态翻转时操作 DOM）
function updateSituation(t) {
  for (const e of situationEntities) {
    const now = parseDate(e.data.from) <= t && t <= endOfDay(e.data.to)
    if (now === e.active) continue
    e.active = now
    const group = situationLayers[e.group]
    if (now) e.obj.addTo(group)
    else group.removeLayer(e.obj)
  }

  // 播放中跨越精神印记 → 轻提示（不中断行军）
  let crossed = 0
  for (const s of STORIES) {
    if (parseDate(s.from) <= t) crossed++
    else break
  }
  if (crossed > storyCursor && playback.playing) {
    flashToast(`❦ 精神印记 ·《${STORIES[storyCursor].name}》—— 点击地图书签阅读`)
  }
  storyCursor = crossed
}

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
  // 底图弱化为背景：降饱和让彩色路线成为视觉主角
  mapEl.value.classList.remove(...BASEMAPS.map((b) => `bm-${b.key}`))
  mapEl.value.classList.add(`bm-${cfg.key}`)
}

function walkerIcon(army) {
  return L.divIcon({
    className: '',
    html: `<div class="walker" style="--ac:${army.color}">
      <div class="w-lean"><div class="w-figure">
        <svg viewBox="0 0 34 42" width="34" height="42" aria-hidden="true">
          <ellipse class="w-shadow" cx="14" cy="39" rx="8" ry="2.4"/>
          <line class="w-pole" x1="23" y1="3" x2="23" y2="17"/>
          <path class="w-flag" d="M23 3 L32 6 L23 9 Z"/>
          <circle class="w-head" cx="13" cy="8.5" r="4.4"/>
          <path class="w-cap" d="M8.2 8.1 a4.8 4.8 0 0 1 9.6 0 Z"/>
          <circle class="w-star" cx="13" cy="6" r="1"/>
          <path class="w-pack" d="M6.5 14 h3.5 v7 h-3.5 a1.5 1.5 0 0 1 -1.5 -1.5 v-4 a1.5 1.5 0 0 1 1.5 -1.5 Z"/>
          <path class="w-body" d="M10.5 13 h6 l1.6 9 h-9.2 Z"/>
          <line class="w-arm w-arm-f" x1="12" y1="15" x2="18.5" y2="18"/>
          <line class="w-arm w-arm-b" x1="12" y1="15" x2="16" y2="20"/>
          <line class="w-leg w-leg-f" x1="13" y1="21.5" x2="16.5" y2="29.5"/>
          <line class="w-leg w-leg-b" x1="13" y1="21.5" x2="9.5" y2="29.5"/>
        </svg>
      </div></div>
      <span class="w-badge">${army.short}</span>
    </div>`,
    iconSize: [70, 88],
    iconAnchor: [35, 74],
  })
}

// ===== 事件地点图标：手绘军用地图符号（不规则图形，半透明填充不遮挡底图） =====
// 七种轮廓各表其类：出发=三角旗 / 战役=盾 / 会议=八角印 / 会师=五角星 /
// 天险=双峰山形 / 到达=下指锚镞 / 根据地=城垛；锚点为图形尖端所指的事件坐标
// tx/ty 为徽记单字中心（星形不置字）
const EV_SHAPES = {
  depart: {
    size: [34, 44], anchor: [9, 42], tx: 13.5, ty: 15.6,
    art: `<line class="ev-pole" x1="9" y1="41" x2="9" y2="4"/>
      <ellipse class="ev-ground" cx="9" cy="41.5" rx="2.4" ry="1"/>
      <path class="ev-plate" d="M10 4 L30 11.5 L10 19 Z"/>`,
  },
  battle: {
    size: [30, 31], anchor: [15, 29], tx: 15, ty: 15.5,
    art: `<path class="ev-plate" d="M2 3 h26 v9 c0 8 -8 13.5 -13 17 c-5 -3.5 -13 -9 -13 -17 z"/>`,
  },
  meeting: {
    size: [30, 30], anchor: [15, 28], tx: 15, ty: 19.5,
    art: `<path class="ev-plate" d="M8 2 h14 l6 6 v14 l-6 6 h-14 l-6 -6 v-14 z"/>`,
  },
  join: {
    size: [30, 30], anchor: [15, 27.5],
    art: `<path class="ev-star" d="M15 1.5 L18.41 10.81 L28.31 11.17 L20.52 17.29 L23.23 26.83 L15 21.3 L6.77 26.83 L9.48 17.29 L1.69 11.17 L11.59 10.81 Z"/>`,
  },
  pass: {
    size: [32, 30], anchor: [16, 27], tx: 16.5, ty: 24.5,
    art: `<path class="ev-plate" d="M1 27 L10.5 9 L15.5 17 L21 5 L31 27 Z"/>`,
  },
  arrive: {
    size: [28, 33], anchor: [14, 31.5], tx: 14, ty: 15.5,
    art: `<path class="ev-plate" d="M14 1 c7.2 0 13 5.4 13 12 c0 8.6 -8.4 14.6 -13 18.5 c-4.6 -3.9 -13 -9.9 -13 -18.5 c0 -6.6 5.8 -12 13 -12 z"/>`,
  },
  base: {
    size: [30, 31], anchor: [15, 31], tx: 15, ty: 18.5,
    art: `<path class="ev-plate" d="M3 9 V26 L15 31 L27 26 V9 H22 V4 H17.5 V9 H12.5 V4 H8 V9 Z"/>`,
  },
}

function eventIcon(ev) {
  const meta = EVENT_TYPES[ev.type]
  const s = EV_SHAPES[ev.type] || EV_SHAPES.battle
  const text = s.tx == null ? '' : `<text x="${s.tx}" y="${s.ty}">${meta.mark}</text>`
  return L.divIcon({
    className: '',
    html: `<div class="ev-mark" style="--ec:${meta.color}"><svg viewBox="0 0 ${s.size[0]} ${s.size[1]}" width="${s.size[0]}" height="${s.size[1]}" aria-hidden="true">${s.art}${text}</svg></div>`,
    iconSize: s.size,
    iconAnchor: s.anchor,
  })
}

// ===== 国民党军单位：燕尾旗（旗杆底端即驻地坐标） =====
function enemyIcon(short) {
  return L.divIcon({
    className: '',
    html: `<div class="kmt-flag"><svg viewBox="0 0 34 44" width="34" height="44" aria-hidden="true">
      <line class="ev-pole" x1="9" y1="41" x2="9" y2="4"/>
      <ellipse class="ev-ground" cx="9" cy="41.5" rx="2.4" ry="1"/>
      <circle cx="9" cy="3.5" r="1.5" fill="#9db4c8"/>
      <path d="M10 5 h20 l-5 6.5 5 6.5 h-20 z" fill="rgba(53,72,92,0.78)" stroke="#9db4c8" stroke-width="1.2" stroke-linejoin="round"/>
      <text x="20" y="16.3" text-anchor="middle" font-size="9" font-weight="700" fill="#eef3f8" font-family="Songti SC, STSong, serif">${short}</text>
    </svg></div>`,
    iconSize: [34, 44],
    iconAnchor: [9, 42],
  })
}

// ===== 日军威胁：放射芒星（警示 + 旭日意象，外层光束缓脉冲） =====
function japanIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="jp-mark"><svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
      <path class="rays" d="M54 28 L41.86 33.74 L46.38 46.38 L33.74 41.86 L28 54 L22.26 41.86 L9.62 46.38 L14.14 33.74 L2 28 L14.14 22.26 L9.62 9.62 L22.26 14.14 L28 2 L33.74 14.14 L46.38 9.62 L41.86 22.26 Z"/>
      <path class="core" d="M44 28 L36.31 31.45 L39.31 39.31 L31.45 36.31 L28 44 L24.55 36.31 L16.69 39.31 L19.69 31.45 L12 28 L19.69 24.55 L16.69 16.69 L24.55 19.69 L28 12 L31.45 19.69 L39.31 16.69 L36.31 24.55 Z"/>
      <text x="28" y="31.8" text-anchor="middle" font-size="11" font-weight="700" fill="#ffe0da" stroke="rgba(43,28,16,0.55)" stroke-width="0.7" paint-order="stroke" font-family="Songti SC, STSong, serif">日</text>
    </svg></div>`,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  })
}

// ===== 路线方向箭头：沿已走路段按里程间距布设，指向行军方向 =====
// 低倍率全国视野用大间距，放大到省级视野后加密，保证视野内始终可见
const arrowStepFor = (z) => (z >= 7 ? 60 : 140)
function addArrow(group, a, b, color) {
  // 屏幕旋转角 = 方位角（自北顺时针）
  const rad = Math.atan2((b[1] - a[1]) * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180), b[0] - a[0])
  const ang = (rad * 180) / Math.PI
  L.marker(b, {
    icon: L.divIcon({
      className: '',
      html: `<span class="route-arrow" style="--ac:${color};transform:rotate(${ang.toFixed(1)}deg)">▲</span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
    interactive: false,
    keyboard: false,
    zIndexOffset: 400,
  }).addTo(group)
}
// traveled 是稠密路线的前缀且稳定，前进时增量补箭头；里程明显回缩才整体重建
function syncArrows(ly, pos, color, step) {
  // arrowMaxKm 只增不减：回拨后仍高于它的箭头属于"未来"，必须重建清除
  if (ly.arrows && pos.km < (ly.arrowMaxKm || 0) - step / 4) {
    ly.group.removeLayer(ly.arrows)
    ly.arrows = null
  }
  if (ly.arrowStep !== step) {
    ly.arrowStep = step
    if (ly.arrows) {
      ly.group.removeLayer(ly.arrows)
      ly.arrows = null
    }
  }
  if (!ly.arrows) {
    ly.arrows = L.layerGroup().addTo(ly.group)
    ly.arrowIdx = 1
    ly.arrowAcc = 0
    ly.arrowPlaced = -step / 2
    ly.arrowMaxKm = pos.km
  }
  // 已走折线由 updateTraveled 增量维护（稠密前缀 + 当前位置队尾），索引与加密点对齐
  const ll = ly.travArr || []
  for (let i = Math.max(ly.arrowIdx, 1); i < ll.length; i++) {
    const a = ll[i - 1]
    const b = ll[i]
    ly.arrowAcc += haversineKm({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] })
    if (ly.arrowAcc - ly.arrowPlaced >= step) {
      ly.arrowPlaced = ly.arrowAcc
      addArrow(ly.arrows, a, b, color)
    }
  }
  ly.arrowIdx = Math.max(ly.arrowIdx, ll.length)
  ly.arrowMaxKm = Math.max(ly.arrowMaxKm || 0, pos.km)
}

function storyIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="story-mark">❦</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

function warPopup(d, side) {
  return `<div class="war-pop"><div class="wp-side">${side}</div><h5>${d.name}</h5><div class="wp-date">${d.dateLabel}</div><p>${d.desc}</p></div>`
}

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

// ===== 已走折线增量维护 =====
// 持久数组只追加/改队尾：跨过加密点或队尾偏移超过约 1km 时才重建 Leaflet 折线，
// 消除每帧 4 军 × 3 线的全量 setLatLngs 与数组重分配
const TAIL_EPS = 0.01 // 度 ≈ 1km，低倍率下不可见的滞后上界
function setTraveledLines(ly, arr) {
  ly.casing.setLatLngs(arr)
  ly.traveled.setLatLngs(arr)
  ly.flow.setLatLngs(arr)
}
function updateTraveled(ly, route, pos) {
  const pts = route.pts
  if (!pos.started) {
    if (ly.travArr !== null && ly.travArr !== undefined) {
      ly.travArr = null
      ly.travIdx = 0
      ly.travDone = false
      setTraveledLines(ly, [])
    }
    return
  }
  if (pos.done) {
    if (!ly.travDone) {
      ly.travArr = pts.map((p) => [p.lat, p.lng])
      ly.travIdx = pts.length
      ly.travDone = true
      setTraveledLines(ly, ly.travArr)
    }
    return
  }
  ly.travDone = false
  const k = ly.travIdx || 0
  if (!ly.travArr || pos.idx < k) {
    // 首次行军或时间回拨：从起点重建到当前段
    const arr = [[pts[0].lat, pts[0].lng]]
    for (let i = 1; i < pos.idx; i++) arr.push([pts[i].lat, pts[i].lng])
    arr.push([pos.head[0], pos.head[1]])
    ly.travArr = arr
    ly.travIdx = pos.idx
    setTraveledLines(ly, arr)
    return
  }
  if (pos.idx > k) {
    // 跨过加密点：旧队尾修正为真实途经点，补齐新段并以当前位置收尾
    const arr = ly.travArr
    arr[arr.length - 1] = [pts[k].lat, pts[k].lng]
    for (let i = k + 1; i < pos.idx; i++) arr.push([pts[i].lat, pts[i].lng])
    arr.push([pos.head[0], pos.head[1]])
    ly.travIdx = pos.idx
    setTraveledLines(ly, arr)
    return
  }
  // 同段推进：队尾偏移超过阈值才刷新（限流 setLatLngs 频率）
  const tail = ly.travArr[ly.travArr.length - 1]
  if (Math.abs(tail[0] - pos.head[0]) + Math.abs(tail[1] - pos.head[1]) > TAIL_EPS) {
    tail[0] = pos.head[0]
    tail[1] = pos.head[1]
    setTraveledLines(ly, ly.travArr)
  }
}

function render() {
  const t = playback.time
  updateSituation(t)
  for (const army of ARMIES) {
    const ly = layers[army.key]
    const route = preparedRoutes[army.key]
    const pos = positionAt(route, t, { noTravel: true })
    const st = armyState[army.key]
    st.started = pos.started
    st.done = pos.done
    st.pct = route.totalKm > 0 ? Math.round((pos.km / route.totalKm) * 100) : 0
    updateTraveled(ly, route, pos)
    // 流动虚线仅在行进中播放：暂停/到达即停，避免 SVG 恒定重栅格化
    const flowing = playback.playing && !pos.done
    if (ly.flowing !== flowing) {
      ly.flowing = flowing
      ly.flow.getElement()?.classList.toggle('running', flowing)
    }
    if (pos.started) syncArrows(ly, pos, army.color, arrowStepFor(map ? map.getZoom() : 5))
    else if (ly.arrows) {
      ly.group.removeLayer(ly.arrows)
      ly.arrows = null
      ly.arrowMaxKm = null
    }
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
      ly.group.removeLayer(ly.marker)
      ly.lastPos = null
      ly.emaX = 0
      ly.emaY = 0
    }
  }

  // 事件标记 已发生/未发生 样式（仅在跨越数量变化时更新 DOM）
  const passed = countPassed(t)
  if (passed !== lastPassedCount) {
    EVENTS.forEach((ev, i) => {
      const el = eventMarkers[i].getElement()?.querySelector('.ev-mark')
      if (el) el.classList.toggle('ev-future', i >= passed)
    })
    lastPassedCount = passed
  }

  // 镜头跟随：跟随最近跨过事件所属部队的标记
  // camBusy（事件特写/视角转换飞行中）时挂起跟拍，飞行结束由 moveend 释放
  if (playback.follow && playback.playing && !playback.currentEvent && !camBusy) {
    const key = followTargetKey()
    if (key) {
      const head = layers[key].marker.getLatLng()
      if (followKey !== key) {
        // 跟随目标换部队：若相距较远，先丝滑飞往新部队再接管跟拍
        followKey = key
        followCam = null
        const c = map.getCenter()
        if (
          Math.abs(c.lat - head.lat) > 1.8 ||
          Math.abs(c.lng - head.lng) > 1.8 ||
          Math.abs(map.getZoom() - followZoom()) > 1
        ) {
          beginCamFlight([head.lat, head.lng], followZoom(), 1.6)
        }
      } else {
        // 指数平滑跟拍：镜头中心向部队位置缓慢收敛（时间常数约 0.6s）；
        // 落后超过约 0.6°（高速行军/高倍速）时加大收敛系数追赶，避免被甩出屏幕。
        // 丢失锚点（用户缩放/刚开启跟拍）时从当前视野中心起步，平滑收拢而非跳变
        if (!followCam) {
          const c = map.getCenter()
          followCam = { lat: c.lat, lng: c.lng }
        }
        const dist = Math.hypot(head.lat - followCam.lat, head.lng - followCam.lng)
        const k = dist > 0.6 ? 0.22 : 0.085
        followCam.lat += (head.lat - followCam.lat) * k
        followCam.lng += (head.lng - followCam.lng) * k
        mapEl.value.classList.add('smooth-follow')
        map.panTo([followCam.lat, followCam.lng], { animate: false })
      }
    } else {
      mapEl.value.classList.remove('smooth-follow')
    }
  } else {
    mapEl.value.classList.remove('smooth-follow')
  }
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

  // ===== 战场态势层（先于路线加入，使路线绘制在其上） =====
  buildSituation()

  // 四路军的路线图层
  for (const army of ARMIES) {
    const route = preparedRoutes[army.key]
    const group = L.layerGroup()
    // 未走：淡虚线幽灵线
    const ghost = L.polyline(
      route.pts.map((p) => [p.lat, p.lng]),
      { color: army.color, weight: 2.5, opacity: 0.5, dashArray: '3 8', smoothFactor: 0.2, interactive: false },
    )
    // 白色描边衬底 + 主线 + 流动虚线（行进方向）
    const casing = L.polyline([], {
      color: '#ffffff',
      weight: 9,
      opacity: 0.9,
      lineJoin: 'round',
      lineCap: 'round',
      smoothFactor: 0.2,
      interactive: false,
    })
    const traveled = L.polyline([], {
      color: army.color,
      weight: 5.5,
      opacity: 1,
      lineJoin: 'round',
      lineCap: 'round',
      smoothFactor: 0.2,
      interactive: false,
    })
    const flow = L.polyline([], {
      color: '#ffffff',
      weight: 2.2,
      opacity: 0.9,
      dashArray: '1.5 12',
      lineCap: 'round',
      className: 'route-flow',
      smoothFactor: 0.2,
      interactive: false,
    })
    // 出发地起点标记
    const p0 = route.pts[0]
    const startDot = p0
      ? L.circleMarker([p0.lat, p0.lng], {
          radius: 5,
          color: army.color,
          weight: 3,
          fillColor: '#ffffff',
          fillOpacity: 1,
          interactive: false,
        })
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
    layers[army.key] = { group, ghost, casing, traveled, flow, startDot, marker, arrows: null, arrowKm: null, lastPos: null, dir: 1, lean: 0 }
  }

  // 事件标记
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

  // 重点事件的地图名称标签（放大到一定级别显示）
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
  // 底部预留全宽时间带 + 字幕高度（窄屏时间带更矮）
  const narrow = window.innerWidth <= 768
  map.fitBounds(CHINA_BOUNDS, {
    paddingTopLeft: [narrow ? 12 : 30, narrow ? 12 : 30],
    paddingBottomRight: [narrow ? 12 : 30, narrow ? 150 : 210],
    animate: false,
  })

  // 用户拖动地图 = 夺取镜头：中止飞行并关闭跟随
  map.on('dragstart', () => {
    endCamFlight(false)
    mapEl.value.classList.remove('smooth-follow')
    if (playback.follow) playback.follow = false
  })
  map.on('zoomstart', () => {
    // camBusy 时是镜头自身的飞行缩放，不处理；否则为用户缩放，解除跟拍过渡避免拖影
    if (!camBusy) {
      mapEl.value.classList.remove('smooth-follow')
      followCam = null
    }
  })

  render()
})

onBeforeUnmount(() => {
  endCamFlight(false)
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
  () => render(),
)

// 底图切换
watch(
  () => playback.basemap,
  (key) => setBasemap(key),
)

// 镜头飞往事件特写（含遮挡环境兜底，统一走 beginCamFlight）
function flyToEvent(ev) {
  if (!map || !ev) return
  beginCamFlight([ev.lat, ev.lng], ev.zoom || 8, 1.3)
}

// 面板事件变化（自动暂停或用户点击）→ 镜头飞往 + 高亮
watch(
  () => playback.panelEvent,
  (ev) => {
    eventMarkers.forEach((m, i) => {
      const el = m.getElement()?.querySelector('.ev-mark')
      if (el) el.classList.toggle('ev-active', !!ev && EVENTS[i].id === ev?.id)
    })
    if (ev) flyToEvent(ev)
  },
)

// 恢复播放 / 开启跟随 / 切换倍速 → 需要时平滑飞回跟拍视角（如事件特写 zoom 8 → 跟拍 zoom 6）
watch(
  () => playback.playing,
  (v) => {
    if (v) resumeFollow()
  },
)
watch(
  () => playback.follow,
  (v) => {
    if (v) resumeFollow()
    else endCamFlight(false)
  },
)
watch(
  () => playback.speed,
  () => {
    if (playback.follow && playback.playing && !camBusy) resumeFollow()
  },
)

// 部队显隐 → 军队编队图层与其事件标记
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
        // 隐藏军的事件不可点击，避免误触飞行讲解
        el.style.pointerEvents = on ? '' : 'none'
      }
    })
  },
  { deep: true },
)

// 战场态势层显隐
watch(
  situationVisible,
  (vis) => {
    if (!map) return
    for (const key of Object.keys(situationLayers)) {
      if (!situationLayers[key]) continue
      if (vis[key]) situationLayers[key].addTo(map)
      else map.removeLayer(situationLayers[key])
    }
  },
  { deep: true },
)
</script>

<template>
  <div ref="mapEl" class="sandbox-map"></div>
</template>
