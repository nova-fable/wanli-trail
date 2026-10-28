<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { AttributionControl, Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ARMIES } from '../mock'
import { useI18n } from '../core/i18n'

setWorkerUrl(workerUrl)

const { t } = useI18n()
const emit = defineEmits(['close'])
const mapEl = ref(null)
const activeScene = ref('jiajin')

const SCENES = [
  {
    key: 'jiajin',
    center: [102.65, 30.72],
    zoom: 7.4,
    bearing: 15,
    pitch: 68,
  },
  {
    key: 'grassland',
    center: [103.2, 33.15],
    zoom: 7.2,
    bearing: 0,
    pitch: 68,
  },
]

let map = null

function sceneFor(key) {
  return SCENES.find((scene) => scene.key === key) || SCENES[0]
}

function flyToScene(key) {
  activeScene.value = key
  const scene = sceneFor(key)
  map?.flyTo({
    center: scene.center,
    zoom: scene.zoom,
    bearing: scene.bearing,
    pitch: scene.pitch,
    duration: 1200,
  })
}

onMounted(async () => {
  await nextTick()
  map = new MapLibreMap({
    container: mapEl.value,
    center: SCENES[0].center,
    zoom: SCENES[0].zoom,
    bearing: SCENES[0].bearing,
    pitch: SCENES[0].pitch,
    maxPitch: 82,
    maxZoom: 14,
    style: {
      version: 8,
      sources: {
        basemap: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 19,
          attribution: '© OpenStreetMap contributors',
        },
        terrain: {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 15,
          encoding: 'terrarium',
          attribution: 'Elevation data © AWS Open Data / Tilezen',
        },
      },
      layers: [
        { id: 'basemap', type: 'raster', source: 'basemap' },
        {
          id: 'terrain-hillshade',
          type: 'hillshade',
          source: 'terrain',
          paint: {
            'hillshade-shadow-color': '#574832',
            'hillshade-highlight-color': '#fff3d5',
            'hillshade-accent-color': '#8d7959',
            'hillshade-exaggeration': 0.35,
          },
        },
      ],
      terrain: { source: 'terrain', exaggeration: 1.35 },
      sky: {},
    },
    attributionControl: false,
  })
  map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')
  map.addControl(new AttributionControl({ compact: true }), 'bottom-right')

  map.on('load', () => {
    map.addSource('army-routes', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: ARMIES.map((army) => ({
          type: 'Feature',
          properties: { key: army.key, color: army.color },
          geometry: {
            type: 'LineString',
            coordinates: army.route.map(({ lat, lng }) => [lng, lat]),
          },
        })),
      },
    })
    map.addLayer({
      id: 'army-routes-casing',
      type: 'line',
      source: 'army-routes',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#fff9e9',
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.5, 10, 5],
        'line-opacity': 0.85,
      },
    })
    map.addLayer({
      id: 'army-routes',
      type: 'line',
      source: 'army-routes',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 10, 3],
        'line-opacity': 0.95,
      },
    })
  })
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <section class="terrain3d" :aria-label="t('terrain3d.title')">
    <div ref="mapEl" class="terrain3d-map"></div>
    <div class="terrain3d-tools">
      <div class="terrain3d-head">
        <div>
          <h2>{{ t('terrain3d.title') }}</h2>
          <p>{{ t('terrain3d.note') }}</p>
        </div>
        <button class="terrain3d-close" :aria-label="t('close')" @click="emit('close')">×</button>
      </div>
      <div class="terrain3d-scenes">
        <button
          v-for="scene in SCENES"
          :key="scene.key"
          :class="{ on: activeScene === scene.key }"
          @click="flyToScene(scene.key)"
        >
          {{ t(`terrain3d.scene.${scene.key}`) }}
        </button>
      </div>
      <p class="terrain3d-caption">{{ t(`terrain3d.caption.${activeScene}`) }}</p>
    </div>
    <div class="terrain3d-attribution">{{ t('terrain3d.source') }}</div>
  </section>
</template>
