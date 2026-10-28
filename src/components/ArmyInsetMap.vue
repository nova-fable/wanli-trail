<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import { playback } from '../composables/usePlayback'
import { BASEMAPS } from '../composables/useMapBase'
import { preparedRoutes } from '../composables/useRoutes'
import { createTravelTracker } from '../map/traveled'
import { positionAt } from '../utils/geo'
import { useI18n } from '../core/i18n'

const props = defineProps({
  army: { type: Object, required: true },
  status: { type: String, required: true },
  visible: { type: Boolean, required: true },
})
const { t } = useI18n()
const mapEl = ref(null)
const route = preparedRoutes[props.army.key]
let map = null
let tiles = null
let group = null
let marker = null
let travel = null
let lastUpdate = 0

function setBasemap(key) {
  if (!map) return
  if (tiles) map.removeLayer(tiles)
  const cfg = BASEMAPS.find((item) => item.key === key) || BASEMAPS[0]
  tiles = L.tileLayer(cfg.url, {
    subdomains: cfg.options.subdomains || 'abc',
    maxNativeZoom: cfg.options.maxNativeZoom,
    maxZoom: 12,
  }).addTo(map)
  tiles.bringToBack()
}

function update(force = false) {
  if (!map) return
  const now = performance.now()
  if (!force && playback.playing && now - lastUpdate < 160) return
  lastUpdate = now
  const pos = positionAt(route, playback.time, { noTravel: true })
  travel.update(route, pos)
  marker.setLatLng(pos.head)
  marker.setStyle({ opacity: pos.started ? 1 : 0.5, fillOpacity: pos.started ? 1 : 0.5 })
  const center = map.getCenter()
  if (Math.abs(center.lat - pos.head[0]) + Math.abs(center.lng - pos.head[1]) > 1.5) {
    map.getContainer().classList.remove('inset-follow')
    map.setView(pos.head, map.getZoom(), { animate: false })
  } else {
    map.getContainer().classList.add('inset-follow')
    map.panTo(pos.head, { animate: false })
  }
}

onMounted(() => {
  const start = route.pts[0]
  map = L.map(mapEl.value, {
    center: [start.lat, start.lng],
    zoom: 6,
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    boxZoom: false,
    keyboard: false,
  })
  setBasemap(playback.basemap)
  group = L.layerGroup().addTo(map)
  L.polyline(route.pts.map((p) => [p.lat, p.lng]), {
    color: props.army.color, weight: 2, opacity: 0.55, dashArray: '3 6', interactive: false,
  }).addTo(group)
  const casing = L.polyline([], { color: '#fff9e9', weight: 6, interactive: false }).addTo(group)
  const traveled = L.polyline([], { color: props.army.color, weight: 3.5, interactive: false }).addTo(group)
  travel = createTravelTracker({ casing, traveled, flow: { setLatLngs() {} } })
  marker = L.circleMarker([start.lat, start.lng], {
    radius: 6, color: '#fff9e9', weight: 2, fillColor: props.army.color, fillOpacity: 1, interactive: false,
  }).addTo(group)
  if (!props.visible) map.removeLayer(group)
  update(true)
})

watch(() => playback.time, () => update())
watch(() => playback.playing, () => update(true))
watch(() => playback.basemap, setBasemap)
watch(() => props.visible, (visible) => {
  if (!map || !group) return
  if (visible) group.addTo(map)
  else map.removeLayer(group)
})

onBeforeUnmount(() => {
  travel?.clear()
  map?.remove()
  map = null
})
</script>

<template>
  <article class="army-inset" :class="{ 'is-hidden': !visible }">
    <div class="army-inset-heading">
      <span class="army-inset-name"><i :style="{ background: army.color }"></i>{{ army.name }}</span>
      <span class="army-inset-status">{{ visible ? status : t('terrain3d.hidden') }}</span>
    </div>
    <div ref="mapEl" class="army-inset-map" :aria-label="`${army.name} · ${t('terrain3d.insetMap')}`"></div>
  </article>
</template>
