/* 全局状态：签到 / 点赞 / 城市 —— 云端优先，本地缓存降级
 * 对页面保持同步 API；云端读写全部异步，失败进重试队列，下次启动补传 */
const cloud = require('./cloud.js')
const { dayKey } = require('./format.js')

const KEY = 'skatespot-mp-state-v1'
const PENDING_KEY = 'skatespot-mp-pending-v1'

const USER = { name: '板仔小张', avatar: '张', skateYears: '2年' }

let state = null
const listeners = new Set()
/* 云端写入失败的重试队列：checkins 为云端 doc 结构，likes 只保留最新目标状态 */
let pending = { checkins: [], likes: [] }

function persist() {
  try {
    wx.setStorageSync(KEY, state)
  } catch (e) { /* ignore */ }
}

function persistPending() {
  try {
    wx.setStorageSync(PENDING_KEY, pending)
  } catch (e) { /* ignore */ }
}

function notify() {
  listeners.forEach(function (fn) {
    try { fn() } catch (e) { /* ignore */ }
  })
}

function init() {
  if (state) return
  /* 1. 本地缓存立即生效，保证首屏渲染 */
  try {
    const saved = wx.getStorageSync(KEY)
    if (saved && Array.isArray(saved.checkins)) {
      state = saved
      if (!state.likes) state.likes = {}
      if (!state.city) state.city = '上海'
    }
  } catch (e) { /* ignore */ }
  if (!state) {
    state = { checkins: [], likes: {}, city: '嘉兴' }
    persist()
  }
  /* 2. 恢复上次未同步成功的队列 */
  try {
    const saved = wx.getStorageSync(PENDING_KEY)
    if (saved && Array.isArray(saved.checkins) && Array.isArray(saved.likes)) {
      pending = saved
    }
  } catch (e) { /* ignore */ }
  /* 3. 异步从云端同步 */
  syncFromCloud()
}

/* ===== 云端同步 ===== */
function syncFromCloud() {
  Promise.all([cloud.getMyCheckins(), cloud.getMyLikes()])
    .then(function (rs) {
      const cloudCheckins = rs[0]
      const cloudLikes = rs[1]
      if (cloudCheckins.length === 0 && state.checkins.length > 0) {
        /* 云端为空而本地有数据：首次接入，把本地签到/点赞迁移上云 */
        return migrateLocal()
      }
      state.checkins = cloudCheckins
      state.likes = cloudLikes
      persist()
      notify()
      return loadProfile()
    })
    .then(function () {
      flushPending()
    })
    .catch(function (e) {
      console.warn('[store] 云端同步失败，暂用本地数据', (e && e.errCode) || (e && e.message))
    })
}

/* 本地 → 云端一次性迁移（仅签到与点赞） */
function migrateLocal() {
  const docs = state.checkins.map(function (c) {
    return {
      venueId: c.venueId,
      venueName: c.venueName,
      note: c.note || '',
      at: c.at,
      userName: USER.name,
      avatar: USER.avatar,
    }
  })
  const likeIds = Object.keys(state.likes).filter(function (k) { return state.likes[k] })
  return Promise.all([
    cloud.pushCheckins(docs),
    Promise.all(likeIds.map(function (feedId) { return cloud.setLike(feedId, true) })),
  ]).then(function () {
    return loadProfile()
  }).catch(function (e) {
    /* 迁移失败：整批进待同步队列，下次启动重试 */
    pending.checkins = state.checkins.map(function (c) {
      return {
        venueId: c.venueId,
        venueName: c.venueName,
        note: c.note || '',
        at: c.at,
        userName: USER.name,
        avatar: USER.avatar,
      }
    })
    pending.likes = likeIds.map(function (feedId) { return { feedId: feedId, liked: true } })
    persistPending()
    console.warn('[store] 本地数据迁移上云失败，已排队重试', (e && e.errCode) || (e && e.message))
  })
}

/* 拉取用户资料（城市偏好），弱数据失败忽略 */
function loadProfile() {
  return cloud.getMyProfile().then(function (p) {
    if (p && p.city && p.city !== state.city) {
      state.city = p.city
      persist()
      notify()
    }
  }).catch(function () { /* ignore */ })
}

/* 重试队列补传 */
function flushPending() {
  if (!pending.checkins.length && !pending.likes.length) return
  const jobs = []
  if (pending.checkins.length) {
    jobs.push(cloud.pushCheckins(pending.checkins).then(function () {
      pending.checkins = []
    }))
  }
  if (pending.likes.length) {
    const likeJobs = pending.likes.map(function (l) {
      return cloud.setLike(l.feedId, l.liked)
    })
    jobs.push(Promise.all(likeJobs).then(function () {
      pending.likes = []
    }))
  }
  Promise.all(jobs).then(function () {
    persistPending()
  }).catch(function (e) {
    persistPending()
    console.warn('[store] 待同步队列仍有失败，下次启动重试', (e && e.errCode) || (e && e.message))
  })
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
  const at = new Date().toISOString()
  state.checkins.unshift({
    id: 'c-' + Date.now(),
    venueId: venueId,
    venueName: venueName,
    note: note || '',
    at: at,
  })
  persist()
  notify()
  /* 云端异步写入，失败排队重试 */
  cloud.addCheckinDoc({
    venueId: venueId,
    venueName: venueName,
    note: note || '',
    at: at,
    userName: USER.name,
    avatar: USER.avatar,
  }).catch(function (e) {
    pending.checkins.push({
      venueId: venueId,
      venueName: venueName,
      note: note || '',
      at: at,
      userName: USER.name,
      avatar: USER.avatar,
    })
    persistPending()
    console.warn('[store] 签到上云失败，已排队重试', (e && e.errCode) || (e && e.message))
  })
}

function isLiked(feedId) {
  init()
  return !!state.likes[feedId]
}

function toggleLike(feedId) {
  init()
  const nowLiked = !state.likes[feedId]
  if (nowLiked) {
    state.likes[feedId] = true
  } else {
    delete state.likes[feedId]
  }
  persist()
  notify()
  /* 云端异步写入，失败排队重试（同一 feedId 只保留最新目标状态） */
  cloud.setLike(feedId, nowLiked).catch(function (e) {
    const found = pending.likes.find(function (l) { return l.feedId === feedId })
    if (found) {
      found.liked = nowLiked
    } else {
      pending.likes.push({ feedId: feedId, liked: nowLiked })
    }
    persistPending()
    console.warn('[store] 点赞上云失败，已排队重试', (e && e.errCode) || (e && e.message))
  })
  return nowLiked
}

function setCity(city) {
  init()
  state.city = city
  persist()
  notify()
  /* 城市偏好弱数据：云端失败忽略，本地已生效 */
  cloud.saveCity(city).catch(function () { /* ignore */ })
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
  user: USER,
}
