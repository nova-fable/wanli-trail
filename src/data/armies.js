import redFirst from './routes/red-first'
import redSecond from './routes/red-second'
import redFourth from './routes/red-fourth'
import red25 from './routes/red-25th'

export const ARMIES = [
  {
    key: 'first',
    name: '红一方面军',
    short: '红一',
    sub: '中央红军',
    color: '#e53935',
    mileage: '约二万五千里',
    route: redFirst,
  },
  {
    key: 'second',
    name: '红二方面军',
    short: '红二',
    sub: '红二、六军团',
    color: '#f57c00',
    mileage: '约二万余里',
    route: redSecond,
  },
  {
    key: 'fourth',
    name: '红四方面军',
    short: '红四',
    sub: '川陕苏区出发',
    color: '#1e88e5',
    mileage: '约一万余里',
    route: redFourth,
  },
  {
    key: 'n25',
    name: '红二十五军',
    short: '红二十五',
    sub: '长征先锋',
    color: '#2e7d32',
    mileage: '近万里',
    route: red25,
  },
]

export const ARMY_MAP = Object.fromEntries(ARMIES.map((a) => [a.key, a]))
