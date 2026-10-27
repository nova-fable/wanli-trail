/**
 * @file 底图配置（免 key 瓦片源单例）
 * 约定：三种底图共用暖色羊皮纸滤镜（styles/map.css .bm-*），名称展示于顶栏切换器。
 */
// 底图配置（全部免 key）
export const BASEMAPS = [
  {
    key: 'amap',
    name: '中文政区',
    url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    attribution: '© 高德地图',
    options: { subdomains: ['1', '2', '3', '4'], maxNativeZoom: 18 },
  },
  {
    key: 'esri',
    name: '地形沙盘',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — World Physical Map',
    options: { maxNativeZoom: 8 },
  },
  {
    key: 'osm',
    name: 'OSM',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    options: { maxNativeZoom: 18 },
  },
]
