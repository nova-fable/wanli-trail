<!--
  @file 长征精神结语页：五大精神 / 数说长征 / 七律 / 宣言书论断
  职责：播放自然到达终点或顶栏按钮进入；提供再走一遍/自由探索/返回沙盘三个去向。
  注：SPIRITS/NUMBERS/POEM 为史实内容，与 docs/spirit/finale.md 同源，不键化。
-->
<script setup>
// 长征精神结语页：演示终点的精神升华
import { restart, startExplore, closePanel } from '../composables/usePlayback'
import { useI18n } from '../core/i18n'

const { t } = useI18n()

const SPIRITS = [
  ['坚定信念', '把全国人民和中华民族的根本利益看得高于一切，坚定革命的理想和信念，坚信正义事业必然胜利。'],
  ['不怕牺牲', '为了救国救民，不怕任何艰难险阻，不惜付出一切牺牲。'],
  ['实事求是', '坚持独立自主、实事求是，一切从实际出发。'],
  ['顾全大局', '顾全大局、严守纪律、紧密团结。'],
  ['依靠人民', '紧紧依靠人民群众，同人民群众生死相依、患难与共、艰苦奋斗。'],
]

const NUMBERS = [
  ['纵横十四省', '转战大半个中国'],
  ['翻越 20 余座雪山', '海拔多在 4000 米以上'],
  ['渡过 24 条大河', '湘江、乌江、赤水、金沙江、大渡河……'],
  ['穿越 500 里草地', '吞噬无数年轻的生命'],
  ['大小战斗 600 余次', '平均每天都有一场遭遇'],
  ['出发 18.6 万 → 到达 5.6 万', '平均每前进约 300 米，就有一名战士倒下'],
]

const POEM = [
  '红军不怕远征难，万水千山只等闲。',
  '五岭逶迤腾细浪，乌蒙磅礴走泥丸。',
  '金沙水拍云崖暖，大渡桥横铁索寒。',
  '更喜岷山千里雪，三军过后尽开颜。',
]

const emit = defineEmits(['close'])

function again() {
  closePanel()
  emit('close')
  restart()
}
function explore() {
  closePanel()
  emit('close')
  startExplore()
}
</script>

<template>
  <div class="finale-overlay">
    <div class="finale-scroll">
      <div class="finale-star">★</div>
      <h1 class="finale-title">{{ t('finale.title') }}</h1>
      <p class="finale-sub">{{ t('finale.sub') }}</p>

      <div class="finale-spirits">
        <div v-for="(s, i) in SPIRITS" :key="i" class="spirit-item">
          <span class="sp-tag">{{ s[0] }}</span>
          <span class="sp-text">{{ s[1] }}</span>
        </div>
      </div>

      <div class="finale-nums">
        <div v-for="(n, i) in NUMBERS" :key="i" class="num-item">
          <span class="num-main">{{ n[0] }}</span>
          <span class="num-sub">{{ n[1] }}</span>
        </div>
      </div>

      <div class="finale-poem">
        <div class="poem-title">{{ t('finale.poemTitle') }} <span>{{ t('finale.poemAuthor') }}</span></div>
        <p v-for="(l, i) in POEM" :key="i">{{ l }}</p>
      </div>

      <p class="finale-quote">
        "长征是宣言书，长征是宣传队，长征是播种机。……长征是以我们的胜利、敌人失败的结果而告结束。"
        <span>—— 毛泽东《论反对日本帝国主义的策略》</span>
      </p>

      <div class="finale-actions">
        <button class="btn-tour" @click="again">{{ t('finale.again') }}</button>
        <button class="btn-explore" @click="explore">自由探索</button>
        <button class="btn-explore" @click="emit('close')">{{ t('finale.back') }}</button>
      </div>
    </div>
  </div>
</template>
