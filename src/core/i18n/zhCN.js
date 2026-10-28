/**
 * @file 中文词典（基础键源，单源）
 *
 * 约定（同 ai-tracker-hud 列式词典架构）：
 * - 所有 UI 文案键在此定义；新增键必须先加 zhCN，en 为 Partial 可滞后（缺键回退中文）
 * - 数据内容（事件/人物/故事/诗词/阶段等史实文案）不键化，留在 src/mock/，见 docs/dev/i18n
 * - 占位符语法：`{name}`，由 t(key, params) 替换
 */
export default {
  // ===== 顶栏 =====
  'app.title': '红军长征沙盘',
  'pill.follow': '镜头跟随',
  'pill.autoTour': '自动讲解',
  'pill.figures': '人物志',
  'pill.index': '事件总览',
  'pill.finale': '★ 长征精神',
  'pill.restart': '↻ 重新播放',
  'pill.terrain3d': '3D 地形',
  'tip.follow': '播放时镜头跟随部队推进（拖动地图会自动关闭）',
  'tip.autoTour': '播放跨越关键事件时自动暂停并讲解',
  'tip.figures': '查看长征关键人物志，点击人物跳转其登场事件',
  'tip.index': '{n} 个关键事件总览，点击条目跳转讲解',
  'tip.finale': '查看长征精神结语：五大精神 · 数说长征 · 七律长征',
  'tip.restart': '回到 1934 年 10 月重新播放',
  'tip.terrain3d': '打开夹金山与松潘草地的 3D 地形预览',
  'tip.basemap': '切换底图',
  'tip.compass': '上北下南',

  // ===== 通用 =====
  'close': '关闭',

  // ===== 开场页 =====
  'intro.title': '红军长征',
  'intro.sub': '伟大的战略转移 · 1934.10 — 1936.10',
  'intro.btn.tour': '▶ 开始演示',
  'intro.btn.explore': '自由探索',
  'intro.tips': [
    '播放沿史实推进，跨过关键事件自动暂停讲解、镜头推近',
    '行军中只看路线与小红军，走过之处图标次第浮现',
    '镜头默认跟随部队行军，拖动地图即可随时接管视角',
    '空格 播放/暂停 · ← → 前后七天 · Esc 关闭浮层',
  ],
  'intro.stat.armies': '路红军并肩长征',
  'intro.stat.events': '个关键事件',
  'intro.stat.provinces': '省纵横转战',
  'intro.stat.days': '个昼夜征程',
  'intro.note': '四路红军 · {n} 个关键事件 · 坐标为近似考证值，仅供演示',

  // ===== 图例面板 =====
  'legend.armies': '红军部队',
  'legend.fold': '点击折叠/展开图例',
  'legend.status.idle': '待出发',
  'legend.status.done': '✓ 已到达',
  'legend.status.marching': '行军中 {pct}%',
  'legend.hideTip': '点击隐藏该部队路线',
  'legend.showTip': '点击显示该部队路线',
  'legend.strength': '红军兵力',
  'legend.strengthRange': '出发 {from} → 到达 {to}',
  'legend.situation': '战场态势',
  'legend.count': '{n} 处',
  'legend.item.zones.name': '红军根据地驻扎',
  'legend.item.zones.sub': '六大苏区存续演变',
  'legend.item.zones.tip': '红军各根据地的时间窗显示：出发即失去、会师即获得',
  'legend.item.kmt.name': '国民党军围堵',
  'legend.item.kmt.sub': '封锁线 · 追剿 · 驻防',
  'legend.item.kmt.tip': '四道封锁线与湘、粤、桂、黔、川、滇、中央军、东北军部署',
  'legend.item.japan.name': '日军威胁',
  'legend.item.japan.sub': '民族危机 · 北上抗日',
  'legend.item.japan.tip': '九一八、华北事变、绥远抗战——长征"北上抗日"的时代背景',
  'legend.item.stories.name': '精神印记',
  'legend.item.stories.sub': '半条被子 · 金色鱼钩 · 丰碑',
  'legend.item.stories.tip': '长征路上体现不怕牺牲、患难与共、鱼水情深的故事，点击地图书签阅读',
  'legend.item.rivers.name': '江河要津',
  'legend.item.rivers.sub': '湘江 · 乌江 · 赤水 · 金沙江 · 大渡河',
  'legend.item.rivers.tip': '长征渡过的十条大江大河（简化示意走线）——一条大河就是一道雄关',
  'legend.display': '显示设置',
  'legend.displayTip': '事件图标的展示方式',
  'legend.mode.march': '随行军浮现',
  'legend.mode.all': '全部常显',
  'legend.modeNote.march': '行军中隐藏未抵达的图标，小红军走过即浮现',
  'legend.modeNote.all': '全部图标常显，未发生的淡化展示',

  // ===== 时间轴 =====
  'tl.hint': '点击刻度跳转事件 · 拖动轨道回溯',
  'tl.continuous': '⏭ 连播',
  'tip.continuous': '回到 1934 年 10 月，自动播放到大会师（不逐事件暂停）',
  'tip.play': '播放',
  'tip.pause': '暂停',
  'tip.replayFinished': '重新播放',
  'tl.trackAria': '播放进度（左右方向键前后七天）',

  // ===== 事件讲解卡 =====
  'ep.k.date': '时',
  'ep.k.day': '程',
  'ep.k.place': '地',
  'ep.day': '长征第 {n} 天',
  'ep.day.pre': '长征前夕',
  'ep.close': '关闭',
  'ep.continue': '继续前进 ▸▸',
  'ep.playFrom': '▶ 从此处继续',
  'ep.prev': '◂ 上一事件',
  'ep.next': '下一事件 ▸',
  'ep.allArmies': '多路红军主力',

  // ===== 事件总览 =====
  'ei.title': '❖ 事件总览',
  'ei.filter.all': '全部',
  'ei.itemTip': '点击跳转：{name}',

  // ===== 人物志 =====
  'fp.title': '长征人物志',
  'fp.itemTip': '点击查看：{name}首次登场的事件',

  // ===== 长征精神结语页 =====
  'finale.title': '长征精神',
  'finale.sub': '伟大长征精神，是中国共产党人红色基因和精神族谱的重要组成部分',
  'finale.poemTitle': '《七律 · 长征》',
  'finale.poemAuthor': '毛泽东 · 一九三五年十月',
  'finale.again': '↻ 再走一遍长征路',
  'finale.explore': '自由探索',
  'finale.back': '返回沙盘',

  // ===== 操作指南 =====
  'help.btn': '?',
  'help.title': '❖ 操作指南',
  'help.hk.play': '播放 / 暂停',
  'help.hk.days': '前后七天',
  'help.hk.close': '关闭浮层',
  'help.sec':
    '拖动地图即接管镜头（自动关闭跟随）；点击地图事件点、时间轴刻度或事件总览条目可跳转讲解；左上角图例可隐藏部队与战场态势层；倍速越高跟随视野越广。',

  // ===== 语言 =====
  'lang.label': '语言',
  'terrain3d.title': '长征地形 · 并行沙盘',
  'terrain3d.note': '主视图跟随中央红军，其他部队以二维小地图同步展示 · 路线为近似示意',
  'terrain3d.mainView': '主视图 · 中央红军 / 红一',
  'terrain3d.parallel': '其他部队同步行军',
  'terrain3d.insetMap': '同步二维地图',
  'terrain3d.hidden': '已隐藏',
  'terrain3d.settings': '地图设置',
  'terrain3d.collapse': '收起地图设置',
  'terrain3d.routeLayers': '红军路线与行军进度',
  'terrain3d.situationLayers': '战场态势图层',
  'terrain3d.scene.jiajin': '夹金山',
  'terrain3d.scene.grassland': '松潘草地',
  'terrain3d.scene.overview': '全程总览',
  'terrain3d.caption.overview': '四路红军全程路线与当前行军位置；播放、暂停和时间轴与沙盘同步。',
  'terrain3d.caption.jiajin': '翻越夹金山：在立体地形中观察川西山地起伏。',
  'terrain3d.caption.grassland': '穿越松潘草地：观察高原与河谷交错的地貌。',
  'terrain3d.openLecture': '查看完整讲解',
  'terrain3d.playFromHere': '从此处继续播放',
  'terrain3d.source': '底图 {basemap} · 高程数据 © AWS Open Data / Tilezen',
}
