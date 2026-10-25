export const DAY_MS = 86400000

// 'YYYY-MM-DD' → 东八区时间戳（带记忆化：日期串是有限集合，热路径每秒调用数千次）
const _dateCache = new Map()
export function parseDate(s) {
  let v = _dateCache.get(s)
  if (v === undefined) {
    v = new Date(`${s}T00:00:00+08:00`).getTime()
    _dateCache.set(s, v)
  }
  return v
}

// 日期字符串按"当天之内"理解：补到当天最后一毫秒，避免跨天零点空档
export function endOfDay(s) {
  return parseDate(s) + DAY_MS - 1000
}

// 时间戳 → 中文日期（按东八区显示）
export function formatCnDate(ms) {
  const d = new Date(ms + 8 * 3600 * 1000)
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

export function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Catmull-Rom 样条加密 + 沿途蜿蜒：折线航点串成平滑弯曲的行军路线
// 航点本身精确通过；段内叠加垂直正弦偏移模拟沿河谷山路的蜿蜒（确定性伪随机，稳定渲染）
// 时间戳按段内弧长比例分配，部队沿曲线匀速推进
function crVal(a, b, c, d, s) {
  const s2 = s * s
  const s3 = s2 * s
  return 0.5 * (2 * b + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s2 + (-a + 3 * b - 3 * c + d) * s3)
}

// Catmull-Rom 样条加密参数（集中调参：曲率细分与蜿蜒风格）
const SPLINE = {
  SUBDIV: 10, // 每段细分点数，越大曲线越顺
  AMP_MIN_KM: 2.5, // 最小蜿蜒幅度（公里）
  AMP_MAX_KM: 14, // 最大蜿蜒幅度
  AMP_RATIO: 0.11, // 蜿蜒幅度随段长的比例
}

function pseudo(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x) // [0,1)
}

export function catmullRomDensify(points, subdiv = SPLINE.SUBDIV) {
  if (points.length < 3) return points
  const out = []
  const at = (i) => points[Math.max(0, Math.min(points.length - 1, i))]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    // 先按参数取细分点
    const raw = []
    for (let j = 0; j <= subdiv; j++) {
      const s = j / subdiv
      raw.push({
        ...p1,
        label: j === 0 ? p1.label : undefined,
        lat: crVal(p0.lat, p1.lat, p2.lat, p3.lat, s),
        lng: crVal(p0.lng, p1.lng, p2.lng, p3.lng, s),
      })
    }
    // 段内蜿蜒：垂直于段方向的正弦偏移，端点归零（航点不被移动）
    const spanKm = haversineKm(p1, p2)
    const ampKm =
      Math.min(SPLINE.AMP_MAX_KM, Math.max(SPLINE.AMP_MIN_KM, spanKm * SPLINE.AMP_RATIO)) *
      (0.55 + 0.9 * pseudo(i))
    const sign = pseudo(i + 999) > 0.5 ? 1 : -1
    const freq = 1 + Math.round(pseudo(i + 55)) // 1~2 个弯
    const dx = p2.lng - p1.lng
    const dy = p2.lat - p1.lat
    const dl = Math.hypot(dx, dy) || 1
    const px = -dy / dl // 垂直方向
    const py = dx / dl
    const kmPerDeg = 111
    for (let j = 0; j < raw.length; j++) {
      const s = j / subdiv
      const off = sign * ampKm * Math.sin(Math.PI * s * freq) ** 2
      raw[j].lat += (py * off) / kmPerDeg
      raw[j].lng += (px * off) / (kmPerDeg * Math.cos((p1.lat * Math.PI) / 180))
    }
    // 段内按弧长比例分配时间
    const lens = [0]
    for (let j = 1; j < raw.length; j++) lens.push(lens[j - 1] + haversineKm(raw[j - 1], raw[j]))
    const total = lens[lens.length - 1] || 1
    for (let j = 0; j < (i === 0 ? raw.length : raw.length - 1); j++) {
      out.push({ ...raw[j], t: p1.t + (p2.t - p1.t) * (lens[j] / total) })
    }
  }
  out.push(points[points.length - 1])
  return out
}

// 预处理路线：样条平滑 + 附加时间戳与累计里程
export function prepareRoute(rawPoints) {
  const dense = catmullRomDensify(
    rawPoints.map((p) => ({ ...p, t: parseDate(p.date) })),
  )
  const pts = dense
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + haversineKm(pts[i - 1], pts[i])
  return {
    pts,
    cum,
    totalKm: cum[cum.length - 1] || 0,
    startT: pts[0].t,
    endT: pts[pts.length - 1].t,
  }
}

// 计算时刻 t 的位置状态：
// started 已出发 / done 已走完 / idx 当前所在加密段右端索引 / head 部队位置 / traveled 已走折线 / km 已走里程
// opts.noTravel: 跳过 traveled 数组构建（调用方自行增量维护折线时使用，省去每帧全量分配）
export function positionAt(route, t, opts) {
  const { pts, cum } = route
  const noTravel = !!(opts && opts.noTravel)
  const last = pts[pts.length - 1]
  if (t < pts[0].t) {
    return {
      started: false, done: false, idx: 0,
      head: [pts[0].lat, pts[0].lng],
      traveled: noTravel ? null : [],
      km: 0,
    }
  }
  if (t >= last.t) {
    return {
      started: true, done: true, idx: pts.length - 1,
      head: [last.lat, last.lng],
      traveled: noTravel ? null : pts.map((p) => [p.lat, p.lng]),
      km: route.totalKm,
    }
  }
  let traveled = noTravel ? null : [[pts[0].lat, pts[0].lng]]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].t >= t) {
      const r = (t - pts[i - 1].t) / (pts[i].t - pts[i - 1].t)
      const lat = pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * r
      const lng = pts[i - 1].lng + (pts[i].lng - pts[i - 1].lng) * r
      if (traveled) traveled.push([lat, lng])
      return {
        started: true, done: false, idx: i,
        head: [lat, lng],
        traveled,
        km: cum[i - 1] + (cum[i] - cum[i - 1]) * r,
      }
    }
    if (traveled) traveled.push([pts[i].lat, pts[i].lng])
  }
  return {
    started: true, done: true, idx: pts.length - 1,
    head: [last.lat, last.lng],
    traveled,
    km: route.totalKm,
  }
}
