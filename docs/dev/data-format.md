# 数据格式规范

> 改 `src/data/` 前必读。数据是史实的唯一单源；改动后按 AGENTS.md 提交规范在 body 注明依据，并同步更新 docs/history、docs/spirit 对应篇。

## 路线航点（data/routes/*.js）

```js
export default [
  { date: '1934-10-17', lat: 25.95, lng: 115.41, label: '于都' },
  ...
]
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `date` | ✓ | `YYYY-MM-DD`；该航点的到达日，**全文件必须单调不减** |
| `lat` / `lng` | ✓ | 省级精度近似值（两位小数）；陆上坐标，禁止入海路径 |
| `label` | 可选 | 地名（起点/会师点/关键转折必须标注，便于调试验证） |

处理管线（geo.js）：`parseDate` 记忆化 → Catmull-Rom 样条加密（SPLINE 常量：SUBDIV=10、蜿蜒幅度 2.5–14km 按段长 0.11 比例）→ 累计里程 cum → `positionAt(t)` 线性插值。

## 事件（data/events.js）

```js
{
  id: 'f1-zunyi',            // 命名：<部队前缀>-<slug>；f1- / f2- / f4- / n25- / grand-
  army: 'first',             // first | second | fourth | n25 | all
  type: 'meeting',           // depart | battle | meeting | join | pass | arrive | base
  name: '遵义会议',
  place: '贵州遵义',
  date: '1935-01-15',        // 运行时排序键；dateLabel 可写区间
  dateLabel: '1935年1月15日—17日',
  lat: 27.66, lng: 106.93, zoom: 8,   // flyTo 目标（zoom 7 全国性 / 8 局部）
  major: true,               // 可选：重点事件（地图常驻地名签）
  people: ['毛泽东', '周恩来'],        // 必须与 figures.js 人名一致（或为未收录真实人物）
  desc: '……',                // 讲解词，60–100 字，叙述+评价
}
```

- 源码按部队分段书写，**导出时按 date 重排序**——插入位置只影响可读性。
- `id` 一经发布不改（figures.js#firstEvent 引用它）。
- 类型徽记（EVENT_TYPES.mark）：`出/战/议/会/险/抵/据`，新增类型须同时给 mark 与 color，并在 SandboxMap 的 `EV_SHAPES` 补对应不规则轮廓（现有：旗/盾/印/星/山/锚/城垛）。

## 人物（data/figures.js）

```js
{ id: 'mao', name: '毛泽东', army: 'first', role: '…', desc: '…', firstEvent: 'f1-yudu' }
```

`firstEvent` 必须存在于 events.js；`army` 决定头像底色（ARMY_MAP）。people 引用人名 = `name`，改动人名须同步全部 events.js 引用。

## 态势实体（data/situation.js）

四组导出：`ZONES`（lat/lng/radius 公里）、`KMT_BLOCKADES`（latlngs 折线）、`KMT_UNITS`（lat/lng + short 首字徽标）、`JAPAN_CRISES`（lat/lng）。共同字段：

| 字段 | 说明 |
|---|---|
| `from` / `to` | `YYYY-MM-DD` 时间窗；运行时按 `parseDate(from) ≤ t ≤ endOfDay(to)` 判定（to 含当日） |
| `dateLabel` | 展示用区间文本 |
| `desc` | 弹窗说明 |

约定：封锁线 `to` = 被突破日；苏区 `to` = 主力撤离日；敌情窗口必须覆盖对应红军事件的时段（防止"事件发生了、敌人却不在场"）。

## 精神印记（data/stories.js）

`{ id, name, from, to, lat, lng, dateLabel, desc }`；`from` 对齐故事发生地行军时刻（toast 在此时触发）；`to` 一律 `1936-10-31`（激活后常驻）。

## 兵力（data/strength.js）

- `STRENGTH`：`armyKey → [[date, 人数], ...]` 锚点升序，区间内线性插值；锚点须对齐关键事件（出发/湘江/缩编/会师）。
- `STRENGTH_TOTAL` 口径必须与锚点自洽：start ≈ 8.6万+1.7万+8万+0.3万 ≈ **18.6 万**；end ≈ 0.7+1.3+3.3+0.34 万 ≈ **5.6 万**。

## 江河要津（data/rivers.js）

```js
export const RIVERS = [{ name: '金沙江', pts: [[lat, lng], ...] }, ...]
```

- 简化示意走线（5—16 点/条，省级精度），渲染为青蓝双色衬底折线 + 河名常驻标签
- 收录与红军渡河事件直接相关的江河（湘江/乌江/赤水/金沙江/大渡河/嘉陵江/岷江/长江/黄河/渭河）；新增河流加条目即可，无时间窗（静态地理层）
- 与 routes 同一坐标系注意：长江上游段即金沙江，两条走线在宜宾（28.8,104.62）汇接

## 诗词（data/quotes.js）与阶段（data/phases.js）

- QUOTES：`{ from, to, text, note }`；时间窗不得重叠（_subtitle 逐条 find 取首个命中）；按 from 升序书写。
- PHASES：`{ from, to, text }` 阶段叙述；同样不得重叠，覆盖 T_START→T_END 全程。

## 互引用自检清单

1. `figures.firstEvent` → `events.id` 全部存在
2. `events.people` 人名 ⊆ figures.name ∪ 未收录真实人物白名单
3. 各 routes date 单调不减
4. quotes/phases 时间窗无重叠、无空洞（phases 需全程覆盖）
5. STRENGTH 锚点日期升序、口径与 STRENGTH_TOTAL 自洽
6. 改动同步 docs/history/* 与 docs/spirit/* 对应篇
