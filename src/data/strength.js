// 红军兵力消长（约数，用于演示）：各军关键时间点兵力锚点，区间内线性插值
// 数字为史学界常见约数，仅作量级演示
import { parseDate, DAY_MS } from '../utils/geo'

export const STRENGTH = {
  first: [
    ['1934-10-17', 86000], // 于都出发
    ['1934-11-26', 80000], // 抵湘江前
    ['1934-12-02', 30000], // 湘江之战后
    ['1935-02-09', 31000], // 遵义扩红后
    ['1935-06-12', 20000], // 达维会师时
    ['1935-09-12', 8000], // 俄界缩编为陕甘支队
    ['1935-10-19', 7000], // 到达吴起镇
  ],
  second: [
    ['1935-11-19', 17000], // 桑植出发
    ['1936-04-28', 16000], // 石鼓渡江
    ['1936-07-05', 15000], // 红二方面军成立
    ['1936-10-22', 13000], // 将台堡会师
  ],
  fourth: [
    ['1935-03-28', 80000], // 强渡嘉陵江出发
    ['1935-11-25', 65000], // 百丈关战役后
    ['1936-06-30', 40000], // 甘孜整编北上
    ['1936-10-09', 33000], // 会宁会师
  ],
  n25: [
    ['1934-11-16', 2980], // 何家冲出发
    ['1935-05-01', 3700], // 鄂豫陕发展壮大
    ['1935-09-15', 3400], // 永坪会师（唯一壮大的队伍）
  ],
}

// 出发/到达总兵力（四路合计，约数）
// 出发口径：红一 8.6万（1934-10 于都）+ 红二、六军团 1.7万（1935-11 桑植）
//           + 红四 8万（1935-03 嘉陵江）+ 红二十五军约0.3万（1934-11 何家冲）≈ 18.6 万
// 到达口径：四路各自到达终点时点合计 ≈ 5.6 万（非同一时点；红二十五军已合编入红十五军团）
export const STRENGTH_TOTAL = { start: '约 18.6 万人', end: '约 5.6 万人' }

function parseSeries(series) {
  return series.map(([d, n]) => [parseDate(d), n])
}

const PARSED = Object.fromEntries(Object.entries(STRENGTH).map(([k, v]) => [k, parseSeries(v)]))

// 时刻 t 的兵力：未出发 null；末锚点后保持
export function strengthAt(key, t) {
  const pts = PARSED[key]
  if (!pts || t < pts[0][0]) return null
  if (t >= pts[pts.length - 1][0]) return pts[pts.length - 1][1]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] >= t) {
      const [t0, n0] = pts[i - 1]
      const [t1, n1] = pts[i]
      const r = (t - t0) / (t1 - t0 || DAY_MS)
      return Math.round(n0 + (n1 - n0) * r)
    }
  }
  return pts[pts.length - 1][1]
}

export function strengthText(n) {
  if (n == null) return '—'
  return n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}万` : `${n}`
}
