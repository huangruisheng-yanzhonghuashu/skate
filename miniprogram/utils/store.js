/* 全局状态：签到 / 点赞 / 城市，wx.setStorageSync 持久化 + 简单订阅通知 */
const { dayKey } = require('./format.js')

const KEY = 'skatespot-mp-state-v1'

/* 基于当前时间生成种子签到（共16条，含今日/昨日/前日连续） */
function seedCheckins() {
  const now = new Date()
  const rel = function (daysAgo, h, m, venueId, venueName) {
    const d = new Date(now)
    d.setDate(d.getDate() - daysAgo)
    d.setHours(h, m, 0, 0)
    return { id: 'seed-' + daysAgo + '-' + h, venueId: venueId, venueName: venueName, at: d.toISOString(), note: '' }
  }
  return [
    rel(0, 14, 30, 'binjiang', '滨江滑板公园'),
    rel(1, 18, 0, 'hongkou', '虹口碗池公园'),
    rel(2, 10, 0, 'xuhui', '徐汇滨江平地'),
    rel(3, 16, 20, 'binjiang', '滨江滑板公园'),
    rel(5, 9, 40, 'yangpu', '杨浦U池公园'),
    rel(6, 19, 5, 'jingan', '静安街式广场'),
    rel(8, 15, 0, 'hongkou', '虹口碗池公园'),
    rel(9, 11, 30, 'binjiang', '滨江滑板公园'),
    rel(11, 17, 10, 'xuhui', '徐汇滨江平地'),
    rel(13, 10, 50, 'yangpu', '杨浦U池公园'),
    rel(15, 14, 15, 'binjiang', '滨江滑板公园'),
    rel(18, 16, 0, 'jingan', '静安街式广场'),
    rel(21, 9, 30, 'hongkou', '虹口碗池公园'),
    rel(24, 15, 40, 'binjiang', '滨江滑板公园'),
    rel(27, 11, 0, 'xuhui', '徐汇滨江平地'),
    rel(30, 10, 20, 'binjiang', '滨江滑板公园'),
  ]
}

let state = null
const listeners = new Set()

function persist() {
  try {
    wx.setStorageSync(KEY, state)
  } catch (e) { /* ignore */ }
}

function notify() {
  listeners.forEach(function (fn) {
    try { fn() } catch (e) { /* ignore */ }
  })
}

function init() {
  if (state) return
  try {
    const saved = wx.getStorageSync(KEY)
    if (saved && Array.isArray(saved.checkins)) {
      state = saved
      return
    }
  } catch (e) { /* ignore */ }
  state = { checkins: seedCheckins(), likes: {}, city: '上海' }
  persist()
}

function getState() {
  init()
  return state
}

/* 今日是否已在某场地签到（不传 venueId 则任意场地） */
function checkedToday(venueId) {
  init()
  const today = dayKey(new Date())
  return state.checkins.some(function (c) {
    return dayKey(c.at) === today && (!venueId || c.venueId === venueId)
  })
}

/* 统计：总数 / 连续天数 / 本周天数 / 本月签到日集合 */
function calcStats() {
  init()
  const now = new Date()
  const keys = new Set(state.checkins.map(function (c) { return dayKey(c.at) }))
  const shiftKey = function (delta) {
    const d = new Date(now)
    d.setDate(d.getDate() + delta)
    return dayKey(d)
  }
  const todayKey = dayKey(now)
  let streak = 0
  let cursor = keys.has(todayKey) ? 0 : -1
  while (keys.has(shiftKey(cursor - streak))) streak++

  const monday = new Date(now)
  const weekday = (now.getDay() + 6) % 7
  monday.setDate(now.getDate() - weekday)
  monday.setHours(0, 0, 0, 0)
  const weekDays = new Set(
    state.checkins.filter(function (c) { return new Date(c.at) >= monday })
      .map(function (c) { return dayKey(c.at) })
  ).size

  const monthDays = new Set(
    state.checkins.filter(function (c) {
      const d = new Date(c.at)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).map(function (c) { return new Date(c.at).getDate() })
  )

  return { total: state.checkins.length, streak: streak, weekDays: weekDays, monthDays: monthDays }
}

function addCheckin(venueId, venueName, note) {
  init()
  state.checkins.unshift({
    id: 'c-' + Date.now(),
    venueId: venueId,
    venueName: venueName,
    note: note || '',
    at: new Date().toISOString(),
  })
  persist()
  notify()
}

function isLiked(feedId) {
  init()
  return !!state.likes[feedId]
}

function toggleLike(feedId) {
  init()
  state.likes[feedId] = !state.likes[feedId]
  persist()
  notify()
  return state.likes[feedId]
}

function setCity(city) {
  init()
  state.city = city
  persist()
  notify()
}

function getCity() {
  init()
  return state.city
}

function subscribe(fn) {
  listeners.add(fn)
  return function () { listeners.delete(fn) }
}

module.exports = {
  init: init,
  getState: getState,
  checkedToday: checkedToday,
  calcStats: calcStats,
  addCheckin: addCheckin,
  isLiked: isLiked,
  toggleLike: toggleLike,
  setCity: setCity,
  getCity: getCity,
  subscribe: subscribe,
  user: { name: '板仔小张', avatar: '张', skateYears: '2年' },
}
