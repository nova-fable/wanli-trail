/**
 * @file UI 枚举（字符串字面量的单源定义）
 *
 * 约定：组件/composable 一律引用这里的成员，禁止就地书写魔法字符串；
 * 史实域枚举（事件类型 EVENT_TYPES 等）属数据集，留在 src/data/。
 */

/** 事件标记显隐模式（图例·显示设置） */
export const MARKER_MODE = {
  /** 随行军浮现：未抵达的事件隐藏，走过即浮现（默认） */
  MARCH: 'march',
  /** 全部常显：未发生的淡化展示 */
  ALL: 'all',
}

/** 语言码（i18n 词典键，与 core/i18n DICTS 对齐） */
export const LANG = {
  ZH_CN: 'zhCN',
  EN: 'en',
}
