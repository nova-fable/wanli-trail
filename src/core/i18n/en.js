/**
 * @file 英文词典（Partial 起步）
 *
 * 缺键自动回退 zhCN（见 index.js 的 t()）；补键直接按 zhCN 键名对齐。
 * 数据内容（事件讲解词等史实文案）暂不提供英文，回退中文——见 docs/dev/i18n。
 */
export default {
  // ===== Header =====
  'app.title': 'Long March Sandbox',
  'pill.follow': 'Follow Camera',
  'pill.autoTour': 'Auto Narrate',
  'pill.figures': 'Figures',
  'pill.index': 'Events',
  'pill.finale': '★ Long March Spirit',
  'pill.restart': '↻ Replay',
  'pill.terrain3d': '3D Terrain',
  'tip.follow': 'Camera follows the marching troops during playback (map drag turns it off)',
  'tip.autoTour': 'Pause and narrate when playback crosses a key event',
  'tip.figures': 'Key figures of the Long March; click one to jump to their debut event',
  'tip.index': 'Overview of {n} key events; click a row to jump',
  'tip.finale': 'The Long March spirit: five essences · numbers · the poem',
  'tip.restart': 'Back to October 1934 and replay',
  'tip.terrain3d': 'Open the 3D terrain preview for Jiajin Mountain and the Songpan Grasslands',
  'tip.basemap': 'Switch basemap',
  'tip.compass': 'North is up',

  // ===== Common =====
  'close': 'Close',

  // ===== Intro =====
  'intro.title': 'The Long March',
  'intro.sub': 'The Great Strategic Transfer · Oct 1934 — Oct 1936',
  'intro.btn.tour': '▶ Start Tour',
  'intro.btn.explore': 'Free Explore',
  'intro.tips': [
    'Playback follows history; it pauses with narration at each key event',
    'During the march only routes and walkers show; icons emerge as troops pass',
    'The camera follows the troops by default; drag the map to take over',
    'Space play/pause · ← → jump 7 days · Esc close panels',
  ],
  'intro.stat.armies': 'armies on the march',
  'intro.stat.events': 'key events',
  'intro.stat.provinces': 'provinces crossed',
  'intro.stat.days': 'days of the march',
  'intro.note': 'Four routes · {n} key events · coordinates are approximate, for demonstration only',

  // ===== Legend =====
  'legend.armies': 'Red Army Routes',
  'legend.fold': 'Click to fold/unfold the legend',
  'legend.status.idle': 'Not started',
  'legend.status.done': '✓ Arrived',
  'legend.status.marching': 'Marching {pct}%',
  'legend.hideTip': 'Click to hide this route',
  'legend.showTip': 'Click to show this route',
  'legend.strength': 'Strength',
  'legend.strengthRange': 'Start {from} → End {to}',
  'legend.situation': 'Battlefield',
  'legend.count': '{n}',
  'legend.item.zones.name': 'Soviet Bases',
  'legend.item.zones.sub': 'Six soviet areas over time',
  'legend.item.zones.tip': 'Bases shown by time window: lost at departure, gained at reunion',
  'legend.item.kmt.name': 'KMT Forces',
  'legend.item.kmt.sub': 'Blockades · pursuit · garrisons',
  'legend.item.kmt.tip': 'Four blockade lines and KMT unit deployments',
  'legend.item.japan.name': 'Japanese Threat',
  'legend.item.japan.sub': 'National crisis · North for resistance',
  'legend.item.japan.tip': 'Sept 18 Incident, North China crisis — the backdrop of the Long March',
  'legend.item.stories.name': 'Spirit Marks',
  'legend.item.stories.sub': 'Half a quilt · The golden fish hook · Monument',
  'legend.item.stories.tip': 'Stories of sacrifice and solidarity on the march; click a bookmark to read',
  'legend.item.rivers.name': 'Great Rivers',
  'legend.item.rivers.sub': 'Xiang · Wu · Chishui · Jinsha · Dadu',
  'legend.item.rivers.tip': 'Ten great rivers crossed on the march (simplified lines)',
  'legend.display': 'Display',
  'legend.displayTip': 'How event icons are shown',
  'legend.mode.march': 'Reveal on march',
  'legend.mode.all': 'Always show',
  'legend.modeNote.march': 'Unreached icons stay hidden while marching; they emerge as troops pass',
  'legend.modeNote.all': 'All icons visible; future ones dimmed',

  // ===== Timeline =====
  'tl.hint': 'Click a dot to jump · drag the track to scrub',
  'tl.continuous': '⏭ Play all',
  'tip.continuous': 'Back to Oct 1934 and play through to the reunion (no pauses)',
  'tip.play': 'Play',
  'tip.pause': 'Pause',
  'tip.replayFinished': 'Replay',
  'tl.trackAria': 'Playback progress (left/right arrow keys jump seven days)',

  // ===== Event panel =====
  'ep.k.date': 'Date',
  'ep.k.day': 'Day',
  'ep.k.place': 'Place',
  'ep.day': 'Day {n} of the march',
  'ep.day.pre': 'Eve of the march',
  'ep.close': 'Close',
  'ep.continue': 'March on ▸▸',
  'ep.playFrom': '▶ Continue from here',
  'ep.prev': '◂ Prev',
  'ep.next': 'Next ▸',
  'ep.allArmies': 'Multiple route armies',

  // ===== Event index =====
  'ei.title': '❖ Events',
  'ei.filter.all': 'All',
  'ei.itemTip': 'Click to jump: {name}',

  // ===== Figures =====
  'fp.title': 'Figures of the March',
  'fp.itemTip': 'Click to view the debut event of {name}',

  // ===== Finale =====
  'finale.title': 'The Long March Spirit',
  'finale.sub': 'A vital part of the red gene and spiritual lineage of the Chinese Communists',
  'finale.poemTitle': 'The Long March (seven-character poem)',
  'finale.poemAuthor': 'Mao Zedong · October 1935',
  'finale.again': '↻ March again',
  'finale.explore': 'Free explore',
  'finale.back': 'Back to the sandbox',

  // ===== Help =====
  'help.btn': '?',
  'help.title': '❖ Guide',
  'help.hk.play': 'Play / Pause',
  'help.hk.days': 'Jump 7 days',
  'help.hk.close': 'Close panels',
  'help.sec':
    'Drag the map to take over the camera (follow turns off); click map icons, timeline dots or index rows to jump; the legend toggles routes and battlefield layers.',

  // ===== Language =====
  'lang.label': 'Language',
  'terrain3d.title': 'Long March Terrain · Parallel Views',
  'terrain3d.note': 'The main view follows the First Army; other armies appear in synchronized 2D maps. Routes are approximate.',
  'terrain3d.mainView': 'Main View · First Army',
  'terrain3d.parallel': 'Other armies on the march',
  'terrain3d.insetMap': 'Synchronized 2D map',
  'terrain3d.hidden': 'Hidden',
  'terrain3d.settings': 'Map Settings',
  'terrain3d.collapse': 'Collapse map settings',
  'terrain3d.routeLayers': 'Red Army Routes & Progress',
  'terrain3d.situationLayers': 'Battlefield Layers',
  'terrain3d.scene.jiajin': 'Jiajin Mountain',
  'terrain3d.scene.grassland': 'Songpan Grasslands',
  'terrain3d.scene.overview': 'Full Route',
  'terrain3d.caption.overview': 'Four routes and current troop positions; playback and timeline stay in sync.',
  'terrain3d.caption.jiajin': 'Crossing Jiajin Mountain: explore the relief of western Sichuan in 3D.',
  'terrain3d.caption.grassland': 'Crossing the Songpan Grasslands: explore the plateau and river valleys.',
  'terrain3d.openLecture': 'Open full narration',
  'terrain3d.playFromHere': 'Continue from here',
  'terrain3d.source': 'Basemap {basemap} · Elevation data © AWS Open Data / Tilezen',
}
