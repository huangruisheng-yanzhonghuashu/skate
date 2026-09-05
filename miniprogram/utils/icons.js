/* SVG 图标工厂：生成 data URI，供 <image> 使用（线条风格与设计稿 lucide 图标一致） */

function svg(inner, opts) {
  opts = opts || {}
  const stroke = opts.stroke || '#8C8C8C'
  const fill = opts.fill || 'none'
  const sw = opts.sw || 2
  const s =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="' + fill +
    '" stroke="' + stroke + '" stroke-width="' + sw +
    '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(s)
}

const P = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22L9 12 15 12 15 22"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-2.072-2.143-2.072-2.143S8.5 8.5 7 10c-1.5 1.5-2 2.5-2 3.5a4.5 4.5 0 0 0 8.5 1.5c.5-1 0-2-1-3-1-1-2-1.5-2-1.5s.5 1 0 2c-.5 1-1.5 1.5-2.5 1.5Z"/><path d="M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0Z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><path d="M15 10a3 3 0 1 1-6 0a3 3 0 1 1 6 0Z"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><path d="M16 7a4 4 0 1 1-8 0a4 4 0 1 1 8 0Z"/>',
  star: '<path d="M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2Z"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  comment: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
  venue: '<path d="M3.5 17.2h17" stroke-width="2.6"/><path d="M5.4 16.9V14.3Q5.4 10.6 8.8 10.1L10.6 9.85Q11.9 9.7 12.4 10.9L13.3 12.9Q14.6 12.3 16.2 12.3H18.6Q20.4 12.35 20.4 14.1V16.9"/><path d="M12.1 12.3L13.5 11.85"/>',
  locate: '<circle cx="12" cy="12" r="7"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/><circle cx="12" cy="12" r="1.2" fill="#1A1A1E" stroke="none"/>',
  /* 定位准星（白色中心点版：深色按钮上中心点可见，与设计稿一致） */
  locateW: '<circle cx="12" cy="12" r="7"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/><circle cx="12" cy="12" r="1.6" fill="#FFFFFF" stroke="none"/>',
  send: '<path d="M3 11L22 2 13 21 11 13 3 11Z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22V15"/>',
  check: '<path d="M20 6L9 17 4 12"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01 9 11.01"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/>',
  imagePlus: '<path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M10 8.5a1.5 1.5 0 1 1-3 0a1.5 1.5 0 1 1 3 0Z"/><path d="M21 15l-5-5L5 21"/>',
  plus: '<path d="M12 5L12 19"/><path d="M5 12L19 12"/>',
  x: '<path d="M18 6L6 18"/><path d="M6 6L18 18"/>',
  chevronRight: '<path d="M9 18l6-6-6-6"/>',
  chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  /* 城市切换（⇌ 双向箭头，与设计稿城市入口一致） */
  swap: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
  search: '<path d="M19 11a8 8 0 1 1-16 0a8 8 0 1 1 16 0Z"/><path d="M21 21l-4.3-4.3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  /* 场地标签 */
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  tagMixed: '<path d="M6 9V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5"/><path d="M6 11h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/><path d="M14 14a2 2 0 1 1-4 0a2 2 0 1 1 4 0Z"/>',
  tagFree: '<path d="M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0Z"/><path d="M16 8h-6a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H8"/><path d="M12 18v2"/><path d="M12 6V4"/>',
  tagLight: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2 1.5-3.5A6 6 0 0 0 6 8c0 1 .5 2 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  tagCement: '<path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  /* 签到统计 */
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  calendar: '<path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
}

const ASH = '#8C8C8C'
const ORANGE = '#FF5A36'
const WHITE = '#FFFFFF'
const FOG = '#E8E8E8'

const ICON = {
  /* TabBar（灰 / 橙 / 白——白用于激活胶囊底） */
  homeAsh: svg(P.home, { stroke: ASH }),
  homeOrange: svg(P.home, { stroke: ORANGE }),
  homeWhite: svg(P.home, { stroke: WHITE, sw: 2.2 }),
  flameAsh: svg(P.flame, { stroke: ASH }),
  flameOrange: svg(P.flame, { stroke: ORANGE }),
  flameWhite: svg(P.flame, { stroke: WHITE, sw: 2.2 }),
  compassAsh: svg(P.compass, { stroke: ASH }),
  compassWhite: svg(P.compass, { stroke: WHITE, sw: 2.2 }),
  pinAsh: svg(P.pin, { stroke: ASH }),
  pinOrange: svg(P.pin, { stroke: ORANGE }),
  pinWhite: svg(P.pin, { stroke: WHITE, sw: 2.2 }),
  userAsh: svg(P.user, { stroke: ASH }),
  userOrange: svg(P.user, { stroke: ORANGE }),
  userWhite: svg(P.user, { stroke: WHITE, sw: 2.2 }),

  /* 评分星（橙实心 / 灰实心 / 琥珀，星级可视化用） */
  starOrange: svg(P.star, { fill: ORANGE, stroke: ORANGE }),
  starGray: svg(P.star, { fill: '#E8E8EA', stroke: '#E8E8EA' }),
  starAmber: svg(P.star, { fill: '#FFB800', stroke: '#FFB800' }),

  /* 发现页 */
  heartAsh: svg(P.heart, { stroke: ASH }),
  heartOrange: svg(P.heart, { fill: ORANGE, stroke: ORANGE }),
  commentAsh: svg(P.comment, { stroke: ASH }),

  /* 场地卡片 / 空态 */
  venueOrange: svg(P.venue, { stroke: ORANGE }),
  venueFog: svg(P.venue, { stroke: FOG }),
  pinAshSmall: svg(P.pin, { stroke: ASH }),
  pinOrangeSmall: svg(P.pin, { stroke: ORANGE }),

  /* 场地详情 */
  sendOrange: svg(P.send, { stroke: ORANGE }),
  flagAsh: svg(P.flag, { stroke: ASH }),
  checkWhite: svg(P.check, { stroke: WHITE, sw: 2.5 }),
  tagMixed: svg(P.tagMixed, { stroke: ASH }),
  tagFree: svg(P.tagFree, { stroke: ASH }),
  tagLight: svg(P.tagLight, { stroke: ASH }),
  tagCement: svg(P.tagCement, { stroke: ASH }),

  /* 弹窗 */
  checkCircleSuccess: svg(P.checkCircle, { stroke: '#00D4AA' }),
  checkCircleOrange: svg(P.checkCircle, { stroke: ORANGE }),
  editAsh: svg(P.edit, { stroke: ASH }),
  plusAsh: svg(P.plus, { stroke: ASH }),
  plusOrange: svg(P.plus, { stroke: ORANGE }),
  xWhite: svg(P.x, { stroke: WHITE, sw: 2.5 }),
  cameraWhite: svg(P.camera, { stroke: WHITE }),
  imagePlusAsh: svg(P.imagePlus, { stroke: ASH }),

  /* 通用 */
  searchAsh: svg(P.search, { stroke: ASH }),
  searchWhite: svg(P.search, { stroke: WHITE }),
  /* 深色胶囊内的搜索图标：与占位文字同色 #C7C7C7（同设计稿 currentColor） */
  searchPh: svg(P.search, { stroke: '#C7C7C7' }),
  chevronDownWhite: svg(P.chevronDown, { stroke: WHITE }),
  swapWhite: svg(P.swap, { stroke: WHITE, sw: 2.2 }),
  locateInk: svg(P.locate, { stroke: '#1A1A1E' }),
  locateWhite: svg(P.locateW, { stroke: WHITE }),
  checkGreenBold: svg(P.check, { stroke: '#00B386', sw: 3 }),
  checkOrangeBold: svg(P.check, { stroke: ORANGE, sw: 3 }),
  chevronRightAsh: svg(P.chevronRight, { stroke: ASH }),
  chevronLeftWhite: svg(P.chevronLeft, { stroke: WHITE, sw: 2.5 }),
  chevronDownAsh: svg(P.chevronDown, { stroke: ASH }),
  fileOrange: svg(P.file, { stroke: ORANGE }),
  settingsOrange: svg(P.settings, { stroke: ORANGE }),

  /* 我的签到统计 */
  trophyOrange: svg(P.trophy, { stroke: ORANGE }),
  flameOrangeStat: svg(P.flame, { stroke: ORANGE }),
  calendarOrange: svg(P.calendar, { stroke: ORANGE }),
}

module.exports = { ICON, svg }
