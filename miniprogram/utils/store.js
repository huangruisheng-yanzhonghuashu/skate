/* 全局状态：签到 / 点赞 / 城市 —— 云端优先，本地缓存降级
 * 对页面保持同步 API；云端读写全部异步，失败进重试队列，下次启动补传 */
const cloud = require('./cloud.js')
const { dayKey } = require('./format.js')

const KEY = 'skatespot-mp-state-v1'
const PENDING_KEY = 'skatespot-mp-pending-v1'

/* 用户资料默认值：未完善资料时的展示降级（用户可在"我的"页编辑） */
const DEFAULT_USER = { nickname: '', avatarFileID: '', skateYears: '' }

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
      if (!state.city) state.city = '嘉兴'
      if (!state.user) state.user = Object.assign({}, DEFAULT_USER)
    }
  } catch (e) { /* ignore */ }
  if (!state) {
    state = { checkins: [], likes: {}, city: '嘉兴', user: Object.assign({}, DEFAULT_USER) }
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

/* 本地 → 云端一次性迁移（仅签到与点赞；旧本地记录补 photos/kind 默认值） */
function migrateLocal() {
  const docs = state.checkins.map(function (c) {
    return {
      venueId: c.venueId,
      venueName: c.venueName,
      note: c.note || '',
      photos: c.photos || [],
      kind: c.kind || 'venue',
      at: c.at,
      userName: state.user.nickname || '滑手',
      avatar: state.user.avatarFileID || (state.user.nickname || '滑').slice(0, 1),
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
        userName: state.user.nickname || '滑手',
        avatar: state.user.avatarFileID || (state.user.nickname || '滑').slice(0, 1),
      }
    })
    pending.likes = likeIds.map(function (feedId) { return { feedId: feedId, liked: true } })
    persistPending()
    console.warn('[store] 本地数据迁移上云失败，已排队重试', (e && e.errCode) || (e && e.message))
  })
}

/* 拉取用户资料（城市偏好 + 昵称头像滑龄），弱数据失败忽略 */
function loadProfile() {
  return cloud.getMyProfile().then(function (p) {
    if (!p) return
    let changed = false
    if (p.city && p.city !== state.city) {
      state.city = p.city
      changed = true
    }
    if (p.nickname || p.avatarFileID || p.skateYears) {
      state.user = {
        nickname: p.nickname || state.user.nickname,
        avatarFileID: p.avatarFileID || state.user.avatarFileID,
        skateYears: p.skateYears || state.user.skateYears,
      }
      changed = true
    }
    if (changed) {
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

/* 用户资料（同步 API） */
function getUser() {
  init()
  return state.user
}

/* 资料是否已完善（设置了昵称即视为完成） */
function isProfileComplete() {
  init()
  return !!state.user.nickname
}

/* 保存资料：本地立即生效并通知，云端异步 upsert（返回 Promise 供 UI 提示结果） */
function saveProfile(profile) {
  init()
  if (profile.nickname !== undefined) state.user.nickname = profile.nickname
  if (profile.avatarFileID !== undefined) state.user.avatarFileID = profile.avatarFileID
  if (profile.skateYears !== undefined) state.user.skateYears = profile.skateYears
  persist()
  notify()
  return cloud.saveProfile({
    nickname: state.user.nickname,
    avatarFileID: state.user.avatarFileID,
    skateYears: state.user.skateYears,
    city: state.city,
  })
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

/* 签到（photos: 云存储 fileID 数组；kind: 'venue'|'shop'）
 * 本地立即生效；云端写入成功后把云端 _id 回写到本地记录（供删除用），失败进重试队列 */
function addCheckin(venueId, venueName, note, photos, kind) {
  init()
  const at = new Date().toISOString()
  const localId = 'c-' + Date.now()
  state.checkins.unshift({
    id: localId,
    venueId: venueId,
    venueName: venueName,
    note: note || '',
    photos: photos || [],
    kind: kind || 'venue',
    at: at,
  })
  persist()
  notify()
  const doc = {
    venueId: venueId,
    venueName: venueName,
    note: note || '',
    photos: photos || [],
    kind: kind || 'venue',
    at: at,
    userName: state.user.nickname || '滑手',
    avatar: state.user.avatarFileID || (state.user.nickname || '滑').slice(0, 1),
  }
  cloud.addCheckinDoc(doc).then(function (r) {
    if (r && r._id) {
      const rec = state.checkins.find(function (c) { return c.id === localId })
      if (rec) {
        rec.id = r._id
        persist()
      }
    }
  }).catch(function (e) {
    pending.checkins.push(doc)
    persistPending()
    console.warn('[store] 签到上云失败，已排队重试', (e && e.errCode) || (e && e.message))
  })
}

/* 删除本人签到：本地立即移除 + 清理待同步队列 + 云端删除
 * 云端删除仅对已同步的记录有效（本地临时 id 开头的记录尚未上云，无需云删） */
function deleteCheckin(id) {
  init()
  const rec = state.checkins.find(function (c) { return c.id === id })
  state.checkins = state.checkins.filter(function (c) { return c.id !== id })
  persist()
  notify()
  if (!rec) return Promise.resolve()
  /* 待同步队列里按 at+venueId 匹配移除（pending 记录没有本地 id 关联） */
  pending.checkins = pending.checkins.filter(function (p) {
    return !(p.at === rec.at && p.venueId === rec.venueId)
  })
  persistPending()
  if (String(rec.id).indexOf('c-') === 0) return Promise.resolve()
  return cloud.removeCheckinDoc(rec.id).catch(function (e) {
    console.warn('[store] 签到云端删除失败', (e && e.errCode) || (e && e.message))
  })
}

/* 今天在某地点的打卡记录（供"补充留言/照片"预填），无则返回 null */
function getTodayCheckin(placeId) {
  init()
  const today = dayKey(new Date())
  return state.checkins.find(function (c) {
    return c.venueId === placeId && dayKey(c.at) === today
  }) || null
}

/* 补充打卡：更新当日已有记录的留言/照片（不新增记录，统计口径不变）
 * 本地立即生效；已同步记录（云端 _id）异步 update，未同步记录（c- 开头）同步更新重试队列 */
function updateCheckin(id, note, photos) {
  init()
  const rec = state.checkins.find(function (c) { return c.id === id })
  if (!rec) return Promise.resolve()
  rec.note = note || ''
  rec.photos = photos || []
  persist()
  notify()
  if (String(rec.id).indexOf('c-') === 0) {
    /* 未同步：更新待同步队列里的对应文档 */
    pending.checkins.forEach(function (p) {
      if (p.at === rec.at && p.venueId === rec.venueId) {
        p.note = rec.note
        p.photos = rec.photos
      }
    })
    persistPending()
    return Promise.resolve()
  }
  return cloud._updateCheckinDoc(rec.id, { note: rec.note, photos: rec.photos })
    .catch(function (e) {
      console.warn('[store] 打卡更新上云失败', (e && e.errCode) || (e && e.message))
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
  getUser: getUser,
  isProfileComplete: isProfileComplete,
  saveProfile: saveProfile,
  checkedToday: checkedToday,
  calcStats: calcStats,
  addCheckin: addCheckin,
  updateCheckin: updateCheckin,
  getTodayCheckin: getTodayCheckin,
  deleteCheckin: deleteCheckin,
  isLiked: isLiked,
  toggleLike: toggleLike,
  setCity: setCity,
  getCity: getCity,
  subscribe: subscribe,
}
