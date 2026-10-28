<script setup>
/**
 * @file 开场页（路由页）：档案封面式主视觉
 *
 * 职责：整页渲染的开场画面，向 App 发出用户选择；不直接操作播放状态。
 * 数据来源：ARMIES（图例与剪影配色）、EVENTS（计数与会师星标）、
 *          preparedRoutes（微缩路线剪影的真实航点投影）。
 * 写路径：emit('start', mode) → App.onStart() 负责初始化播放并导航到沙盘路由。
 *
 * 视觉构成（自底向上）：
 * 1. intro-map  真实路线数据的微缩剪影（低透明发光线条，预告"这是沙盘"）
 * 2. intro-poem 右侧竖排七律（书法装饰，保留中文——属史实内容不键化）
 * 3. intro-seal 红色"长征"方印（档案封面语言）
 * 4. intro-core 星徽/标题/副题/图例/入口按钮/提示/统计条
 */
import { computed } from 'vue'
import { ARMIES, EVENTS } from '../mock'
import { preparedRoutes } from '../composables/useRoutes'
import { T_START, T_END } from '../composables/usePlayback'
import { DAY_MS } from '../utils/geo'
import { EVENT_INDEX } from '../core/constants/history'
import { useI18n } from '../core/i18n'

const { t } = useI18n()

/** start 事件：mode = 'tour'（开始演示）| 'explore'（自由探索） */
const emit = defineEmits(['start'])

// ===== 微缩路线剪影：经纬度 → viewBox 线性投影（装饰用途，省级精度足够） =====
const VIEW = { w: 1120, h: 940, latN: 42.6, latS: 23.2, lngW: 97.8, lngE: 125.2 }
const project = (lat, lng) => [
  ((lng - VIEW.lngW) / (VIEW.lngE - VIEW.lngW)) * VIEW.w,
  ((VIEW.latN - lat) / (VIEW.latN - VIEW.latS)) * VIEW.h,
]

// 四路剪影 path：采样降密（每军 ≤90 点）避免模板字符串过长
const routePaths = computed(() =>
  ARMIES.map((a) => {
    const pts = preparedRoutes[a.key].pts
    const step = Math.max(1, Math.floor(pts.length / 90))
    let d = ''
    for (let i = 0; i < pts.length; i += step) {
      const [x, y] = project(pts[i].lat, pts[i].lng)
      d += (d ? ' L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1)
    }
    return { color: a.color, d }
  }),
)

/** 会师/落脚金星标（会宁/将台堡/吴起镇/永坪——长征的四个"终点感"坐标） */
const starMarks = computed(() =>
  EVENT_INDEX
    .map((id) => EVENTS.find((e) => e.id === id))
    .filter(Boolean)
    .map((ev) => {
      const [x, y] = project(ev.lat, ev.lng)
      return { id: ev.id, x, y }
    }),
)

/** 竖排诗词（史实内容，保持中文；EN 下作为书法装饰保留） */
const POEM_LINES = ['红军不怕远征难', '万水千山只等闲']

// ===== 统计条数值：全部由数据推导，禁止硬编码 =====
/** 路数 = */
const armyCount = ARMIES.length

/**
 * 省数 = 四路 `provinces` 的去重并集。
 * 口径：按**省名**去重（不是按行政实体）——各路数据里的 '西康' 是同一历史省份，
 * 合并计一次；参谋部数据以省名书写，不做规范化映射。
 */
const provinceCount = new Set(ARMIES.flatMap((a) => a.provinces)).size

/**
 * 昼夜数 = 时间域折算，口径与统计条原值 761 一致。
 * `T_START`/`T_END` 是东八区零点，两者**差值**已含首日与末日之间的全部天数：
 * 1934-10-01 → 1936-10-31 恰好 (761 天) —— 即 1934-10-01 计第 1 天、
 * 1936-10-31 计第 761 天（含首尾、按整天，闰年 1936-02-29 自然计入）。
 * 故直接取整，**不再 +1**（+1 会得到 762，与原值不符）。
 */
const marchDays = Math.round((T_END - T_START) / DAY_MS)
</script>

<template>
  <div class="intro-overlay">
    <!-- 底层：真实路线数据的微缩剪影（发光线条 + 会师金星） -->
    <svg
      class="intro-map"
      :viewBox="`0 0 ${VIEW.w} ${VIEW.h}`"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <filter id="intro-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g opacity="0.34">
        <!-- 辉光层：粗线柔光，先铺氛围 -->
        <path
          v-for="(r, i) in routePaths"
          :key="'g' + i"
          :d="r.d"
          fill="none"
          :stroke="r.color"
          stroke-width="7"
          stroke-linejoin="round"
          stroke-linecap="round"
          opacity="0.35"
          filter="url(#intro-glow)"
        />
        <!-- 主线层：细线提亮，保证可辨识 -->
        <path
          v-for="(r, i) in routePaths"
          :key="'m' + i"
          :d="r.d"
          fill="none"
          :stroke="r.color"
          stroke-width="1.8"
          stroke-linejoin="round"
          stroke-linecap="round"
          opacity="0.75"
        />
        <!-- 会师金星 -->
        <g v-for="s in starMarks" :key="s.id" :transform="`translate(${s.x} ${s.y})`">
          <circle r="7" fill="rgba(232, 182, 44, 0.22)" />
          <path
            d="M0 -5 L1.4 -1.6 L5 -1.4 L2.2 1 L3.1 4.6 L0 2.6 L-3.1 4.6 L-2.2 1 L-5 -1.4 L-1.4 -1.6 Z"
            fill="#e8b62c"
            opacity="0.9"
          />
        </g>
      </g>
    </svg>

    <!-- 右侧竖排七律（书法装饰） -->
    <div class="intro-poem" aria-hidden="true">
      <span v-for="line in POEM_LINES" :key="line">{{ line }}</span>
      <span class="p-from">毛泽东《七律·长征》</span>
    </div>

    <!-- 右下"长征"方印 -->
    <div class="intro-seal" aria-hidden="true">长征</div>

    <!-- 主体 -->
    <div class="intro-core">
      <div class="intro-star">★</div>
      <h1 class="intro-title">{{ t('intro.title') }}</h1>
      <div class="intro-sub">{{ t('intro.sub') }}</div>

      <div class="intro-armies">
        <span v-for="a in ARMIES" :key="a.key">
          <i :style="{ background: a.color }"></i>{{ a.name }}
        </span>
      </div>

      <div class="intro-actions">
        <button class="btn-tour" @click="emit('start', 'tour')">{{ t('intro.btn.tour') }}</button>
        <button class="btn-explore" @click="emit('start', 'explore')">{{ t('intro.btn.explore') }}</button>
      </div>

      <div class="intro-tips">
        <span v-for="(tip, i) in t('intro.tips')" :key="i">{{ tip }}</span>
      </div>

      <!-- 统计条：数字金色宋体 + 上缘细线 -->
      <div class="intro-stats">
        <span><b>{{ armyCount }}</b>{{ t('intro.stat.armies') }}</span>
        <span><b>{{ EVENTS.length }}</b>{{ t('intro.stat.events') }}</span>
        <span><b>{{ provinceCount }}</b>{{ t('intro.stat.provinces') }}</span>
        <span><b>{{ marchDays }}</b>{{ t('intro.stat.days') }}</span>
      </div>
    </div>
  </div>
</template>
