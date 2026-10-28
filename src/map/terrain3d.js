import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import {
  ARMIES,
  EVENTS,
  EVENT_TYPES,
  JAPAN_CRISES,
  KMT_BLOCKADES,
  KMT_UNITS,
  RIVERS,
  STORIES,
  ZONES,
} from '../mock'
import { BLOCKADE_COLOR, RIVER_COLOR, ZONE_COLOR } from '../core/constants/colors'
import { MARKER_MODE } from '../core/enums'
import { endOfDay, parseDate, positionAt } from '../utils/geo'
import { inWindow } from '../utils/date'
import { primaryArmyPosition } from './parallel'

setWorkerUrl(workerUrl)

const EARTH_RADIUS_KM = 6371

export const TERRAIN3D_SCENES = [
  { key: 'overview', center: [106.5, 32.5], zoom: 4.5, bearing: 0, pitch: 54 },
  { key: 'jiajin', center: [102.65, 30.72], zoom: 8, bearing: 15, pitch: 66 },
  { key: 'grassland', center: [103.2, 33.15], zoom: 7.7, bearing: 0, pitch: 66 },
]

function feature(geometry, properties) {
  return { type: 'Feature', geometry, properties }
}

function collection(features = []) {
  return { type: 'FeatureCollection', features }
}

function circleCoordinates({ lat, lng, radius }) {
  const lat1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180
  const angularDistance = radius / EARTH_RADIUS_KM
  const points = []
  for (let i = 0; i <= 48; i++) {
    const bearing = (i / 48) * Math.PI * 2
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
        Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
    )
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
        Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
      )
    points.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI])
  }
  return [points]
}

function makeMarker(className, label, title, color) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = className
  el.textContent = label
  el.title = title
  if (color) el.style.setProperty('--marker-color', color)
  return el
}

function dateKey(time) {
  return Math.floor((time + 8 * 60 * 60 * 1000) / 86400000)
}

function maxPitchForViewport(height) {
  if (height < 420) return 36
  if (height < 560) return 45
  return 82
}

function tilesFor(basemap) {
  if (!basemap.options.subdomains) return [basemap.url]
  return basemap.options.subdomains.map((subdomain) => basemap.url.replace('{s}', subdomain))
}

export function createTerrain3D(
  container,
  { routes, basemaps, basemap, t, onReady, onUserMove, onEventLecture, onEventPlay, onProgress },
) {
  const map = new MapLibreMap({
    container,
    center: TERRAIN3D_SCENES[0].center,
    zoom: TERRAIN3D_SCENES[0].zoom,
    bearing: TERRAIN3D_SCENES[0].bearing,
    pitch: Math.min(TERRAIN3D_SCENES[0].pitch, maxPitchForViewport(container.clientHeight)),
    minZoom: 3.5,
    maxZoom: 14,
    maxPitch: 82,
    style: {
      version: 8,
      sources: {
        ...Object.fromEntries(
          basemaps.map((item) => [
            `basemap-${item.key}`,
            {
              type: 'raster',
              tiles: tilesFor(item),
              tileSize: 256,
              maxzoom: item.options.maxNativeZoom,
              attribution: item.attribution,
            },
          ]),
        ),
        terrain: {
          type: 'raster-dem',
          tiles: ['https://elevation-tiles-prod.s3.us-east-1.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 15,
          encoding: 'terrarium',
          attribution: 'Elevation data © AWS Open Data / Tilezen',
        },
      },
      layers: [
        ...basemaps.map((item) => ({
          id: `basemap-${item.key}`,
          type: 'raster',
          source: `basemap-${item.key}`,
          layout: { visibility: item.key === basemap ? 'visible' : 'none' },
        })),
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

  let ready = false
  let selectedBasemap = basemap
  let popup = null
  let lastSituationKey = ''
  let lastEventKey = ''
  let lastArmyVisibility = ''
  let lastProgressUpdate = -Infinity
  let lastFollowUpdate = -Infinity
  let followingFirst = false
  let lastUpdateAt = -Infinity
  let lastTime = -Infinity
  const eventMarkers = []
  const situationMarkers = []
  const armyMarkers = new Map()
  const progressIndexes = Object.fromEntries(ARMIES.map((army) => [army.key, -1]))

  function closePopup() {
    popup?.remove()
    popup = null
  }

  function setBasemap(key) {
    selectedBasemap = basemaps.some((item) => item.key === key) ? key : basemaps[0].key
    if (!ready) return
    for (const item of basemaps) {
      map.setLayoutProperty(`basemap-${item.key}`, 'visibility', item.key === selectedBasemap ? 'visible' : 'none')
    }
  }

  function addPopup(item, lngLat, event = null) {
    closePopup()
    const root = document.createElement('div')
    root.className = 'terrain3d-popup-content'
    const title = document.createElement('h3')
    title.textContent = item.name
    root.append(title)
    const meta = document.createElement('div')
    meta.className = 'terrain3d-popup-meta'
    meta.textContent = [item.dateLabel, item.place].filter(Boolean).join(' · ')
    root.append(meta)
    const description = document.createElement('p')
    description.textContent = item.desc || ''
    root.append(description)
    if (event) {
      const actions = document.createElement('div')
      actions.className = 'terrain3d-popup-actions'
      const lecture = document.createElement('button')
      lecture.type = 'button'
      lecture.textContent = t('terrain3d.openLecture')
      lecture.addEventListener('click', () => onEventLecture(event))
      const continueFrom = document.createElement('button')
      continueFrom.type = 'button'
      continueFrom.textContent = t('terrain3d.playFromHere')
      continueFrom.addEventListener('click', () => {
        closePopup()
        onEventPlay(event)
      })
      actions.append(lecture, continueFrom)
      root.append(actions)
    }
    popup = new Popup({ closeButton: true, closeOnClick: false, maxWidth: '340px', className: 'terrain3d-popup' })
      .setLngLat(lngLat)
      .setDOMContent(root)
      .addTo(map)
  }

  function addPointMarkers() {
    EVENTS.forEach((event) => {
      const type = EVENT_TYPES[event.type] || EVENT_TYPES.battle
      const element = makeMarker('terrain3d-event-marker', type.mark, `${event.dateLabel} · ${event.name}`, type.color)
      const marker = new Marker({ element, anchor: 'bottom' }).setLngLat([event.lng, event.lat]).addTo(map)
      element.addEventListener('click', (e) => {
        e.stopPropagation()
        addPopup(event, [event.lng, event.lat], event)
      })
      eventMarkers.push({ event, marker, element })
    })

    const entries = [
      ...KMT_UNITS.map((item) => ({ item, group: 'kmt', label: item.short, className: 'terrain3d-context-marker kmt-marker', color: '#536b79' })),
      ...JAPAN_CRISES.map((item) => ({ item, group: 'japan', label: '日', className: 'terrain3d-context-marker japan-marker', color: '#8e2020' })),
      ...STORIES.map((item) => ({ item, group: 'stories', label: '书', className: 'terrain3d-context-marker story-marker', color: '#c9922e' })),
    ]
    entries.forEach(({ item, group, label, className, color }) => {
      const element = makeMarker(className, label, item.name, color)
      const marker = new Marker({ element, anchor: 'bottom' }).setLngLat([item.lng, item.lat]).addTo(map)
      element.addEventListener('click', (e) => {
        e.stopPropagation()
        addPopup(item, [item.lng, item.lat])
      })
      situationMarkers.push({
        group,
        item,
        marker,
        element,
        from: parseDate(item.from),
        to: endOfDay(item.to),
      })
    })

    ARMIES.forEach((army) => {
      const element = makeMarker('terrain3d-army-marker', army.short, army.name, army.color)
      armyMarkers.set(army.key, new Marker({ element, anchor: 'bottom' }))
    })
  }

  function addDataLayers() {
    map.addSource('army-routes', {
      type: 'geojson',
      data: collection(
        ARMIES.map((army) =>
          feature(
            {
              type: 'LineString',
              coordinates: routes[army.key].pts.map((point) => [point.lng, point.lat]),
            },
            { key: army.key, color: army.color },
          ),
        ),
      ),
    })
    map.addSource('army-progress', { type: 'geojson', data: collection() })
    map.addSource('situation-zones', { type: 'geojson', data: collection() })
    map.addSource('situation-lines', { type: 'geojson', data: collection() })

    map.addLayer({
      id: 'situation-zones-fill',
      type: 'fill',
      source: 'situation-zones',
      paint: { 'fill-color': ZONE_COLOR, 'fill-opacity': 0.12 },
    })
    map.addLayer({
      id: 'situation-zones-line',
      type: 'line',
      source: 'situation-zones',
      paint: { 'line-color': ZONE_COLOR, 'line-width': 1.5, 'line-opacity': 0.6, 'line-dasharray': [2, 2] },
    })
    map.addLayer({
      id: 'situation-blockades',
      type: 'line',
      source: 'situation-lines',
      filter: ['==', ['get', 'kind'], 'blockade'],
      paint: { 'line-color': BLOCKADE_COLOR, 'line-width': 4, 'line-opacity': 0.85, 'line-dasharray': [2, 2] },
    })
    map.addLayer({
      id: 'situation-rivers',
      type: 'line',
      source: 'situation-lines',
      filter: ['==', ['get', 'kind'], 'river'],
      paint: { 'line-color': RIVER_COLOR, 'line-width': 2.5, 'line-opacity': 0.8 },
    })

    ARMIES.forEach((army) => {
      map.addLayer({
        id: `army-route-${army.key}`,
        type: 'line',
        source: 'army-routes',
        filter: ['==', ['get', 'key'], army.key],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': army.color,
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.4, 8, 2.8, 12, 4],
          'line-opacity': 0.58,
        },
      })
    })
    map.addLayer({
      id: 'army-progress-casing',
      type: 'line',
      source: 'army-progress',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#fff9e9',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 3, 8, 6, 12, 8],
        'line-opacity': 0.9,
      },
    })
    map.addLayer({
      id: 'army-progress-line',
      type: 'line',
      source: 'army-progress',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.8, 8, 4, 12, 6],
        'line-opacity': 1,
      },
    })
    map.on('click', 'situation-zones-fill', (e) => {
      const item = ZONES.find((zone) => zone.id === e.features?.[0]?.properties?.id)
      if (item) addPopup(item, e.lngLat.toArray())
    })
    map.on('click', 'situation-blockades', (e) => {
      const item = KMT_BLOCKADES.find((line) => line.id === e.features?.[0]?.properties?.id)
      if (item) addPopup(item, e.lngLat.toArray())
    })
    map.on('click', 'situation-rivers', (e) => {
      const item = RIVERS.find((river) => river.name === e.features?.[0]?.properties?.name)
      if (item) addPopup({ ...item, dateLabel: '长征沿途江河要津', desc: '长征途中红军跋涉渡过的大江大河——一条大河就是一道雄关。' }, e.lngLat.toArray())
    })
    for (const layer of ['situation-zones-fill', 'situation-blockades', 'situation-rivers']) {
      map.on('mouseenter', layer, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', layer, () => {
        map.getCanvas().style.cursor = ''
      })
    }
  }

  function updateSituation(time, visibility) {
    const key = `${dateKey(time)}:${visibility.zones}:${visibility.kmt}:${visibility.japan}:${visibility.stories}:${visibility.rivers}`
    if (key === lastSituationKey) return
    lastSituationKey = key
    const zones = visibility.zones
      ? ZONES.filter((item) => inWindow(item.from, item.to, time)).map((item) =>
          feature(
            { type: 'Polygon', coordinates: circleCoordinates(item) },
            { id: item.id, name: item.name },
          ),
        )
      : []
    const lines = [
      ...(visibility.kmt
        ? KMT_BLOCKADES.filter((item) => inWindow(item.from, item.to, time)).map((item) =>
            feature(
              { type: 'LineString', coordinates: item.latlngs.map(([lat, lng]) => [lng, lat]) },
              { id: item.id, name: item.name, kind: 'blockade' },
            ),
          )
        : []),
      ...(visibility.rivers
        ? RIVERS.map((item) =>
            feature(
              { type: 'LineString', coordinates: item.pts.map(([lat, lng]) => [lng, lat]) },
              { name: item.name, kind: 'river' },
            ),
          )
        : []),
    ]
    map.getSource('situation-zones')?.setData(collection(zones))
    map.getSource('situation-lines')?.setData(collection(lines))
    for (const marker of situationMarkers) {
      const visible =
        visibility[marker.group] &&
        marker.from <= time &&
        time <= marker.to
      marker.element.style.display = visible ? '' : 'none'
    }
  }

  function updateEventMarkers(time, markerMode, panelEvent, visibleArmies) {
    const key = `${dateKey(time)}:${markerMode}:${panelEvent?.id || ''}:${ARMIES.map((army) => visibleArmies[army.key]).join('')}`
    if (key === lastEventKey) return
    lastEventKey = key
    for (const { event, element } of eventMarkers) {
      const passed = parseDate(event.date) <= time
      const armyOn = event.army === 'all' || visibleArmies[event.army]
      const visible = armyOn && (markerMode === MARKER_MODE.ALL || passed || event.id === panelEvent?.id)
      element.style.display = visible ? '' : 'none'
      element.classList.toggle('future', !passed)
    }
  }

  function syncArmyVisibility(visibleArmies) {
    const key = ARMIES.map((army) => visibleArmies[army.key]).join('')
    if (key === lastArmyVisibility) return
    lastArmyVisibility = key
    for (const army of ARMIES) {
      const visibility = visibleArmies[army.key] ? 'visible' : 'none'
      map.setLayoutProperty(`army-route-${army.key}`, 'visibility', visibility)
      const marker = armyMarkers.get(army.key)
      if (!visibleArmies[army.key]) marker.remove()
    }
  }

  function updateProgress(time, state, now) {
    const positions = {}
    const progressFeatures = []
    for (const army of ARMIES) {
      const route = routes[army.key]
      const position = positionAt(route, time, { noTravel: true })
      positions[army.key] = position
      const marker = armyMarkers.get(army.key)
      if (position.started && state.armyVisible[army.key]) {
        marker.setLngLat([position.head[1], position.head[0]])
        if (!marker.getElement().isConnected) marker.addTo(map)
        marker.getElement().classList.toggle('done', position.done)
        if (now - lastProgressUpdate >= 220 || position.idx !== progressIndexes[army.key] || time < lastTime || state.force) {
          const coordinates = route.pts.slice(0, position.idx).map((point) => [point.lng, point.lat])
          coordinates.push([position.head[1], position.head[0]])
          if (coordinates.length > 1) {
            progressFeatures.push(
              feature(
                { type: 'LineString', coordinates },
                { key: army.key, color: army.color },
              ),
            )
          }
        }
      } else {
        marker.remove()
      }
      progressIndexes[army.key] = position.idx
      onProgress?.(army.key, {
        started: position.started,
        done: position.done,
        pct: route.totalKm > 0 ? Math.round((position.km / route.totalKm) * 100) : 0,
      })
    }

    const progressDue = now - lastProgressUpdate >= 220 || time < lastTime || state.force
    if (progressDue) {
      map.getSource('army-progress')?.setData(collection(progressFeatures))
      lastProgressUpdate = now
    }
    lastTime = time
    return positions
  }

  function updateFollow(positions, state, now) {
    if (!state.follow || !state.armyVisible.first) {
      followingFirst = false
      return
    }
    if (!state.force && now - lastFollowUpdate < 450) return
    const target = primaryArmyPosition(positions, state.armyVisible)
    if (!target) {
      followingFirst = false
      return
    }
    const center = [target.head[1], target.head[0]]
    if (!followingFirst) {
      followingFirst = true
      const options = { center, zoom: Math.max(map.getZoom(), 5.8) }
      if (document.hidden) map.jumpTo(options)
      else map.easeTo({ ...options, duration: 900, essential: true })
      lastFollowUpdate = now + 450
      return
    }
    const current = map.getCenter()
    if (Math.abs(current.lng - center[0]) + Math.abs(current.lat - center[1]) < 0.00001) return
    if (document.hidden) map.jumpTo({ center })
    else map.easeTo({ center, duration: 420, essential: true })
    lastFollowUpdate = now
  }

  map.on('dragstart', () => onUserMove?.())
  map.on('resize', () => {
    const maxPitch = maxPitchForViewport(container.clientHeight)
    if (map.getPitch() > maxPitch) map.setPitch(maxPitch)
  })
  map.on('load', () => {
    addDataLayers()
    addPointMarkers()
    ready = true
    setBasemap(selectedBasemap)
    onReady?.()
  })

  function update(time, state) {
    if (!ready) return
    const now = performance.now()
    if (!state.force && now - lastUpdateAt < 75) return
    lastUpdateAt = now
    syncArmyVisibility(state.armyVisible)
    updateSituation(time, state.situationVisible)
    updateEventMarkers(time, state.markerMode, state.panelEvent, state.armyVisible)
    const positions = updateProgress(time, state, now)
    updateFollow(positions, state, now)
  }

  function flyToScene(sceneKey) {
    const scene = TERRAIN3D_SCENES.find((item) => item.key === sceneKey) || TERRAIN3D_SCENES[0]
    map.flyTo({
      center: scene.center,
      zoom: scene.zoom,
      bearing: scene.bearing,
      pitch: Math.min(scene.pitch, maxPitchForViewport(container.clientHeight)),
      duration: 1200,
    })
  }

  function destroy() {
    closePopup()
    for (const { marker } of eventMarkers) marker.remove()
    for (const { marker } of situationMarkers) marker.remove()
    for (const marker of armyMarkers.values()) marker.remove()
    map.remove()
  }

  return { update, setBasemap, flyToScene, closePopup, destroy }
}
