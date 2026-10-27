// 红军长征部队元信息（军团编制与途经省份见 docs/history/routes.md「出发编制」）
import redFirst from './routes/red-first'
import redSecond from './routes/red-second'
import redFourth from './routes/red-fourth'
import red25 from './routes/red-25th'

export const ARMIES = [
  {
    key: 'first',
    name: '红一方面军',
    short: '红一',
    // 出发时下辖红一、红三、红五、红八、红九军团，共 5 个军团
    sub: '中央红军 · 出发辖 5 个军团',
    color: '#e53935',
    mileage: '约二万五千里',
    // 途经省份（11 省，含西康今分属川藏）
    provinces: ['江西', '福建', '广东', '湖南', '广西', '贵州', '云南', '四川', '西康', '甘肃', '陕西'],
    route: redFirst,
  },
  {
    key: 'second',
    name: '红二方面军',
    short: '红二',
    // 前身红二、六军团；1936 年 7 月甘孜与红 32 军合编为红二方面军
    sub: '红二/六军团 · 后合编红32军',
    color: '#f57c00',
    mileage: '约二万余里',
    provinces: ['湖南', '湖北', '贵州', '云南', '西康', '四川', '甘肃', '青海', '陕西'],
    route: redSecond,
  },
  {
    key: 'fourth',
    name: '红四方面军',
    short: '红四',
    // 下辖红 4、9、30、31、33 军（番号后有调整）
    sub: '川陕出发 · 辖5个军',
    color: '#1e88e5',
    mileage: '约一万余里',
    provinces: ['四川', '西康', '青海', '甘肃'],
    route: redFourth,
  },
  {
    key: 'n25',
    name: '红二十五军',
    short: '红二十五',
    // 独立军级建制，不属三大方面军序列，最先到达陕北
    sub: '独立军 · 长征先锋',
    color: '#2e7d32',
    mileage: '近万里',
    provinces: ['河南', '湖北', '甘肃', '陕西'],
    route: red25,
  },
]

export const ARMY_MAP = Object.fromEntries(ARMIES.map((a) => [a.key, a]))
