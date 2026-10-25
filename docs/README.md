# wanli-trail · 项目文档

红军长征沙盘演示（1934.10 — 1936.10）的成文档化知识库。**史实数据的唯一单源是 `src/data/`**，本目录是其成文档视图——两者不一致时，以代码数据为准并立即修文档。

## 篇章

### 历史篇（docs/history/）

| 文档 | 内容 |
|---|---|
| [events.md 事件全录](history/events.md) | 57 个关键事件全条目：按部队与时期分组，含日期、地点、类型、关联人物与完整讲解词 |
| [battles.md 战役志](history/battles.md) | 十二场标志性战役的深度条目：背景、经过、结果、历史意义 |
| [figures.md 人物志](history/figures.md) | 22 位关键人物小传：职务、长征事迹、首次登场事件 |
| [routes.md 路线志](history/routes.md) | 四路红军行军路线：起讫、里程、航点规模、关键转折与考证说明 |
| [situation.md 战场态势](history/situation.md) | 六大苏区、四道封锁线、国民党军 13 个单位、日军 5 次民族危机的时间窗与说明 |
| [martyrs.md 英烈志](history/martyrs.md) | 长征烈士名录：高级指挥员/师级指挥员/普通战士与无名英雄，附沙盘对应标注 |

### 精神篇（docs/spirit/）

| 文档 | 内容 |
|---|---|
| [stories.md 精神印记](spirit/stories.md) | 8 个体现长征精神的故事：半条被子、断肠明志、金色鱼钩、七根火柴…… |
| [poems.md 长征诗词](spirit/poems.md) | 7 首长征诗词：全文、创作背景与播放时间窗 |
| [finale.md 长征精神](spirit/finale.md) | 五大长征精神、数说长征、毛泽东《七律·长征》与"宣言书·宣传队·播种机" |

### 开发篇（docs/dev/）

| 文档 | 内容 |
|---|---|
| [architecture.md 系统架构](dev/architecture.md) | 播放引擎、地图渲染、镜头系统、增量维护与性能设计 |
| [design.md 设计语言](dev/design.md) | "指挥舱 + 羊皮纸档案"双层视觉体系、设计 token、地图元素层级 |
| [data-format.md 数据格式规范](dev/data-format.md) | 各数据文件字段定义、时间窗语义、互引用规则与增改清单 |

## 阅读路径

- 只想看史实：`events.md` → `battles.md` → `figures.md`
- 想改数据：先读 [data-format.md](dev/data-format.md)，再对照对应篇章
- 想改交互/渲染：先读 [architecture.md](dev/architecture.md)
- 提交代码：**先读仓库根目录 [AGENTS.md](../AGENTS.md) 的「Git 提交规范」**，分批提交、及时推送
