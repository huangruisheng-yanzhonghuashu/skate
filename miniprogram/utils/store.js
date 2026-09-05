/* 全局状态：签到 / 点赞 / 城市 —— 云端优先，本地缓存降级
 * 对页面保持同步 API；云端读写全部异步，失败进重试队列，下次启动补传 */
const cloud = require('./cloud.js')
const { dayKey } = require('./format.js')

const KEY = 'skatespot-mp-state-v1'
const PENDING_KEY = 'skatespot-mp-pending-v1'

/* 用户资料默认值：未完善资料时的展示降级（用户可在"我的"页编辑）
 * skills: 擅长标签（预设词表多选，上限 5 个，见 profile 页 TAG_OPTIONS） */
const DEFAULT_USER = { nickname: '', avatarFileID: '', skateYears: '', skills: [] }

let state = null
const listeners = new Set()
/* 云端写入失败的重试队列：checkins 为云端 doc 结构，likes 只保留最新目标状态，
 * mediaUploads 为微博式异步媒体上传队列（{at, venueId, photos: [], videos: []} 临时路径） */
let pending = { checkins: [], likes: [], mediaUploads: [] }

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
      /* 旧版本快照无媒体队列字段：补默认，避免 undefined */
      if (!Array.isArray(pending.mediaUploads)) pending.mediaUploads = []
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
      skateYears: c.skateYears || state.user.skateYears || 0,
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
    if (p.nickname || p.avatarFileID || p.skateYears || (p.skills && p.skills.length)) {
      state.user = {
        nickname: p.nickname || state.user.nickname,
        avatarFileID: p.avatarFileID || state.user.avatarFileID,
        skateYears: p.skateYears || state.user.skateYears,
        skills: (p.skills && p.skills.length) ? p.skills : (state.user.skills || []),
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
  if (!pending.checkins.length && !pending.likes.length && !pending.mediaUploads.length) return
  const jobs = []
  if (pending.checkins.length) {
    jobs.push(cloud.pushCheckins(pending.checkins).then(function (results) {
      /* 回填云端 _id（与 addCheckinDoc 成功路径一致）：媒体异步上云按 rec.id 定位 doc */
      ;(results || []).forEach(function (r, i) {
        const d = pending.checkins[i]
        if (!r || !r._id || !d) return
        const rec = state.checkins.find(function (c) { return c.at === d.at && c.venueId === d.venueId })
        if (rec && String(rec.id).indexOf('c-') === 0) rec.id = r._id
      })
      persist()
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
  if (pending.mediaUploads.length) {
    pending.mediaUploads.slice().forEach(function (v) {
      const rec = state.checkins.find(function (c) { return c.at === v.at && c.venueId === v.venueId })
      /* 记录已删除：直接出队 */
      if (!rec) {
        pending.mediaUploads = pending.mediaUploads.filter(function (x) { return x !== v })
        return
      }
      /* doc 未上云（rec.id 还是本地临时 id）：留在队列，等 checkins 补传回填后下轮续传 */
      if (String(rec.id).indexOf('c-') === 0) return
      jobs.push(
        uploadRecMedia(rec, rec.id).then(function () {
          pending.mediaUploads = pending.mediaUploads.filter(function (x) { return x !== v })
        })
      )
    })
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
  if (profile.skills !== undefined) state.user.skills = profile.skills
  persist()
  notify()
  return cloud.saveProfile({
    nickname: state.user.nickname,
    avatarFileID: state.user.avatarFileID,
    skateYears: state.user.skateYears,
    skills: state.user.skills || [],
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

/* 签到（photos: 图片路径数组；videos: 视频路径数组；均可为临时路径或 fileID）
 * 微博式发布：本地立即生效（临时媒体本机可播，带"上传中"角标），云端 doc 只带已上传的
 * fileID 写入，临时媒体由后台队列静默压缩/上传，完成后回填本地 + 更新云端 doc，用户零等待 */
function addCheckin(venueId, venueName, note, photos, kind, videos, order) {
  init()
  const at = new Date().toISOString()
  const localId = 'c-' + Date.now()
  const allPhotos = photos || []
  const allVideos = videos || []
  const isCloud = function (v) { return v.indexOf('cloud://') === 0 }
  const cloudPhotos = allPhotos.filter(isCloud)
  const cloudVideos = allVideos.filter(isCloud)
  const tempPhotos = allPhotos.filter(function (v) { return !isCloud(v) })
  const tempVideos = allVideos.filter(function (v) { return !isCloud(v) })
  state.checkins.unshift({
    id: localId,
    venueId: venueId,
    venueName: venueName,
    note: note || '',
    photos: allPhotos,
    videos: allVideos,
    mediaOrder: order || [],
    kind: kind || 'venue',
    at: at,
    skateYears: state.user.skateYears || 0,
  })
  persist()
  notify()
  const doc = {
    venueId: venueId,
    venueName: venueName,
    note: note || '',
    photos: cloudPhotos,
    videos: cloudVideos,
    mediaOrder: order || [],
    kind: kind || 'venue',
    at: at,
    userName: state.user.nickname || '滑手',
    avatar: state.user.avatarFileID || (state.user.nickname || '滑').slice(0, 1),
    skateYears: state.user.skateYears || 0,
  }
  cloud.addCheckinDoc(doc).then(function (r) {
    const rec = state.checkins.find(function (c) { return c.id === localId })
    if (r && r._id && rec) {
      rec.id = r._id
      persist()
    }
    /* 媒体后台上传（不阻塞发布） */
    if ((tempPhotos.length || tempVideos.length) && rec) uploadRecMedia(rec, (r && r._id) || '')
  }).catch(function (e) {
    pending.checkins.push(doc)
    if (tempPhotos.length || tempVideos.length) enqueueMediaUpload(at, venueId, tempPhotos, tempVideos)
    persistPending()
    console.warn('[store] 签到上云失败，已排队重试', (e && e.errCode) || (e && e.message))
  })
}

/* 媒体上传队列入队（同记录旧条目先出队，避免重复上传） */
function enqueueMediaUpload(at, venueId, tempPhotos, tempVideos) {
  pending.mediaUploads = pending.mediaUploads.filter(function (p) {
    return !(p.at === at && p.venueId === venueId)
  })
  pending.mediaUploads.push({ at: at, venueId: venueId, photos: tempPhotos, videos: tempVideos })
}

/* 临时路径原地替换为 fileID（按下标对应，保持顺序与 mediaOrder 一致） */
function replaceTempWithFileIDs(list, fileIDs) {
  let i = 0
  return list.map(function (v) {
    return v.indexOf('cloud://') === 0 ? v : fileIDs[i++]
  })
}

/* 单条打卡的媒体异步上云：图片/视频直接上传（不压缩——wx.compressVideo 有"压缩中，请稍候"
 * 原生弹窗无法隐藏，服务端压缩后续可接腾讯云数据万象）→ 回填本地 + 更新云端 doc
 * 失败进 pending.mediaUploads，下次启动 flushPending 续传 */
function uploadRecMedia(rec, docId) {
  const tempPhotos = (rec.photos || []).filter(function (v) { return v.indexOf('cloud://') !== 0 })
  const tempVideos = (rec.videos || []).filter(function (v) { return v.indexOf('cloud://') !== 0 })
  if (!tempPhotos.length && !tempVideos.length) return Promise.resolve()
  return Promise.all([
    Promise.all(tempPhotos.map(function (p) { return cloud.uploadFileTo('checkin-photos', p) })),
    Promise.all(tempVideos.map(function (p) { return cloud.uploadFileTo('checkin-videos', p) })),
  ])
    .then(function (rs) {
      /* 上传期间记录可能被删除：重新定位，不存在则静默结束 */
      const rec2 = state.checkins.find(function (c) { return c.at === rec.at && c.venueId === rec.venueId })
      if (!rec2) return
      rec2.photos = replaceTempWithFileIDs(rec2.photos, rs[0])
      rec2.videos = replaceTempWithFileIDs(rec2.videos, rs[1])
      persist()
      notify()
      if (docId) return cloud._updateCheckinDoc(docId, { photos: rec2.photos, videos: rec2.videos })
    })
    .catch(function (e) {
      enqueueMediaUpload(rec.at, rec.venueId, tempPhotos, tempVideos)
      persistPending()
      console.warn('[store] 媒体上云失败，已排队续传', (e && e.errCode) || (e && e.message))
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
  pending.mediaUploads = pending.mediaUploads.filter(function (p) {
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

/* 某地点的本人打卡（本地兜底）：输出结构与 cloud 的 mapCheckin 对齐。
 * 详情页打卡动态用：云读取失败/云写入延迟（含重试队列中）时，本人打卡仍可见 */
function getLocalPlaceCheckins(placeId, noteOnly) {
  init()
  const nickname = state.user.nickname || '滑手'
  const avatar = state.user.avatarFileID || ''
  return state.checkins
    .filter(function (c) {
      if (c.venueId !== placeId) return false
      /* noteOnly：有留言/照片/视频（与 cloud.getPlaceCheckins 口径一致） */
      if (noteOnly && !(c.note || '').trim() && !(c.photos || []).length && !(c.videos || []).length) return false
      return true
    })
    .map(function (c) {
      return {
        id: c.id,
        kind: c.kind || 'venue',
        venueId: c.venueId,
        venueName: c.venueName,
        note: c.note || '',
        photos: c.photos || [],
        videos: c.videos || [],
        mediaOrder: c.mediaOrder || [],
        at: c.at,
        skateYears: c.skateYears || 0,
        user: nickname,
        avatarFile: avatar.indexOf('cloud://') === 0 ? avatar : '',
        avatarText: avatar.indexOf('cloud://') === 0 ? nickname.slice(0, 1) : (avatar || nickname.slice(0, 1)),
      }
    })
}

/* 补充打卡：更新当日已有记录的留言/照片（不新增记录，统计口径不变）
 * 本地立即生效；已同步记录（云端 _id）异步 update，未同步记录（c- 开头）同步更新重试队列 */
function updateCheckin(id, note, photos, videos, order) {
  init()
  const rec = state.checkins.find(function (c) { return c.id === id })
  if (!rec) return Promise.resolve()
  rec.note = note || ''
  rec.photos = photos || []
  rec.videos = videos || []
  rec.mediaOrder = order || []
  /* 旧记录无滑龄快照：补充打卡时顺手回填当前资料（已填过则不覆盖，保持快照语义） */
  if (!rec.skateYears) rec.skateYears = state.user.skateYears || 0
  persist()
  notify()
  /* 媒体分流：cloud:// 直接写 doc；临时路径走微博式异步上传（不阻塞） */
  const cloudPhotos = rec.photos.filter(function (v) { return v.indexOf('cloud://') === 0 })
  const cloudVideos = rec.videos.filter(function (v) { return v.indexOf('cloud://') === 0 })
  const tempPhotos = rec.photos.filter(function (v) { return v.indexOf('cloud://') !== 0 })
  const tempVideos = rec.videos.filter(function (v) { return v.indexOf('cloud://') !== 0 })
  if (String(rec.id).indexOf('c-') === 0) {
    /* 未同步：更新待同步队列里的对应文档 */
    pending.checkins.forEach(function (p) {
      if (p.at === rec.at && p.venueId === rec.venueId) {
        p.note = rec.note
        p.photos = cloudPhotos
        p.videos = cloudVideos
        p.mediaOrder = rec.mediaOrder
        p.skateYears = rec.skateYears
      }
    })
    if (tempPhotos.length || tempVideos.length) {
      enqueueMediaUpload(rec.at, rec.venueId, tempPhotos, tempVideos)
    }
    persistPending()
    return Promise.resolve()
  }
  const p = cloud._updateCheckinDoc(rec.id, { note: rec.note, photos: cloudPhotos, videos: cloudVideos, mediaOrder: rec.mediaOrder, skateYears: rec.skateYears })
    .catch(function (e) {
      console.warn('[store] 打卡更新上云失败', (e && e.errCode) || (e && e.message))
    })
  if (tempPhotos.length || tempVideos.length) uploadRecMedia(rec, rec.id)
  return p
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
  getLocalPlaceCheckins: getLocalPlaceCheckins,
  deleteCheckin: deleteCheckin,
  isLiked: isLiked,
  toggleLike: toggleLike,
  setCity: setCity,
  getCity: getCity,
  subscribe: subscribe,
}
