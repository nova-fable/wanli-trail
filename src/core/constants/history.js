/**
 * @file 史实域常量（跨模块引用的史实坐标/日期标识）
 *
 * 与 src/mock 的分工：史实内容的唯一单源（事件/人物/态势/诗词/阶段与派生量
 * DEPARTURE_DATE）全在 src/mock；本文件只收**被 UI 直接断言的标识**——
 * 即"哪些事件要特殊呈现"这类契约，避免组件内散落字符串字面量。
 * 本文件不得 import src/mock 或 src/utils（core 依赖方向约束，见 CONTRACT.md §2），
 * 故这里只写事件 id 字面量，取值须与 src/mock 的 events 域对齐。
 */

/**
 * 会师/落脚金星标事件 id（开场页微缩剪影的四枚"终点感"坐标）
 *
 * 顺序即渲染顺序，取值对应 src/mock 事件域（events）里的 id：
 * grand-huining 会宁会师 / grand-jiangtaipu 将台堡会师 /
 * f1-wuqizhen 吴起镇（中央红军落脚点）/ n25-yongping 永坪会师（红二十五军落脚点）。
 * 查不到的 id 在消费方被静默跳过，故增删事件后需同步核对本清单。
 */
export const EVENT_INDEX = ['grand-huining', 'grand-jiangtaipu', 'f1-wuqizhen', 'n25-yongping']
