/* 云开发数据访问层：数据全部来源于云数据库
 * 读失败/无数据返回空数组（页面展示空态）；写失败由调用方处理（store 有重试队列） */
const ENV_ID = 'cloud1-d4grizmp31acb587e'
const { ONLINE_WINDOW_MIN } = require('./config.js')

/* wx.cloud.init 在 app.js 执行后才可用，因此全部惰性获取实例 */
let _db = null
let _agg = null
function db() {
  if (!_db) _db = wx.cloud.database()
  return _db
}
function agg() {
  if (!_agg) _agg = wx.cloud.database().command.aggregate
  return _agg
}

/* ===== 用户身份 ===== */
let _openid = ''
function ensureOpenid() {
  if (_openid) return Promise.resolve(_openid)
  return wx.cloud.callFunction({ name: 'getOpenId' })
    .then((r) => {
      _openid = (r.result && r.result.openid) || ''
      return _openid
    })
    .catch(() => '')
}

/* ===== 场地 ===== */
let _venues = null
let _venuesPromise = null
function getVenues() {
  if (_venues) return Promise.resolve(_venues)
  if (_venuesPromise) return _venuesPromise
  _venuesPromise = db().collection('venues').limit(20).get()
    .then((r) => {
      _venues = r.data || []
      return _venues
    })
    .catch((e) => {
      console.warn('[cloud] 场地读取失败', (e && e.errCode) || (e && e.message))
      _venues = []
      return _venues
    })
  return _venuesPromise
}

/* 从已加载的场地缓存中查找（需先调用过 getVenues） */
function findVenue(id) {
  return (_venues || []).find(function (v) { return v.id === id }) || null
}

/* 城市列表：从场地集合聚合 distinct */
function getCities() {
  return db().collection('venues').aggregate()
    .group({ _id: '$city' })
    .sort({ _id: 1 })
    .end()
    .then((r) => (r.list || []).map((x) => x._id).filter(Boolean))
    .catch((e) => {
      console.warn('[cloud] 城市聚合失败', (e && e.errCode) || (e && e.message))
      return []
    })
}

/* ===== 动态 ===== */
let _feeds = null
let _feedsPromise = null
function getFeeds() {
  if (_feeds) return Promise.resolve(_feeds)
  if (_feedsPromise) return _feedsPromise
  _feedsPromise = db().collection('feeds').limit(20).get()
    .then((r) => {
      _feeds = r.data || []
      return _feeds
    })
    .catch((e) => {
      console.warn('[cloud] 动态读取失败', (e && e.errCode) || (e && e.message))
      _feeds = []
      return _feeds
    })
  return _feedsPromise
}

/* ===== 签到（用户作用域：默认权限下自动只读写本人数据） ===== */
function getMyCheckins() {
  return db().collection('checkins')
    .orderBy('at', 'desc')
    .limit(100)
    .get()
    .then((r) => (r.data || []).map(function (d) {
      return {
        id: d._id,
        venueId: d.venueId,
        venueName: d.venueName,
        note: d.note || '',
        at: d.at,
        userName: d.userName || '',
        avatar: d.avatar || '',
      }
    }))
}

function pushCheckins(docs) {
  const col = db().collection('checkins')
  return Promise.all(docs.map(function (d) { return col.add({ data: d }) }))
}

function addCheckinDoc(doc) {
  return db().collection('checkins').add({ data: doc })
}

/* ===== 点赞（用户作用域） ===== */
function getMyLikes() {
  return db().collection('feed_likes')
    .limit(100)
    .get()
    .then((r) => {
      const likes = {}
      ;(r.data || []).forEach(function (d) { likes[d.feedId] = true })
      return likes
    })
}

/* liked=true 点赞（新增记录），false 取消（删除本人该动态的点赞记录） */
function setLike(feedId, liked) {
  if (liked) {
    return db().collection('feed_likes').add({ data: { feedId: feedId } })
  }
  return db().collection('feed_likes')
    .where({ feedId: feedId })
    .remove()
}

/* ===== 用户资料（城市等） ===== */
function getMyProfile() {
  return db().collection('user_profiles')
    .limit(1)
    .get()
    .then((r) => ((r.data && r.data[0]) || null))
    .catch(function () { return null })
}

function saveCity(city) {
  return getMyProfile().then(function (p) {
    if (p && p._id) {
      return db().collection('user_profiles').doc(p._id).update({ data: { city: city } })
    }
    return db().collection('user_profiles').add({ data: { city: city } })
  })
}

/* ===== 排行榜（聚合所有人签到数，需 checkins"所有用户可读"权限） ===== */
function getLeaderboard() {
  const $ = agg()
  return ensureOpenid().then(function () {
    return db().collection('checkins').aggregate()
      .group({ _id: '$_openid', count: $.sum(1), name: $.last('$userName') })
      .sort({ count: -1 })
      .limit(5)
      .end()
  }).then(function (r) {
    const rows = (r.list || []).filter(function (x) { return !!x._id })
    return rows.map(function (x, i) {
      return {
        rank: i + 1,
        user: x.name || '滑友',
        count: x.count,
        self: !!(_openid && x._id === _openid),
      }
    })
  }).catch(function (e) {
    console.warn('[cloud] 排行榜聚合失败', (e && e.errCode) || (e && e.message))
    return []
  })
}

/* ===== 场地报错 ===== */
function addVenueReport(doc) {
  return db().collection('venue_reports').add({ data: doc })
}

/* 统计本人报错条数 */
function countMyReports() {
  return db().collection('venue_reports').count()
    .then((r) => r.total || 0)
    .catch(() => 0)
}

/* ===== 头像与资料 ===== */
/* 上传头像到云存储，返回 fileID（image 组件可直接显示 cloud:// 路径） */
function uploadAvatar(tempFilePath) {
  const m = tempFilePath.match(/\.(\w+)$/)
  const ext = (m && m[1]) || 'jpg'
  const cloudPath = 'avatars/' + Date.now() + '-' + Math.floor(Math.random() * 1000000) + '.' + ext
  return wx.cloud.uploadFile({ cloudPath: cloudPath, filePath: tempFilePath })
    .then((r) => r.fileID)
}

/* 保存资料（昵称/头像/滑龄/城市），user_profiles 按用户隔离，upsert */
function saveProfile(profile) {
  return getMyProfile().then(function (p) {
    if (p && p._id) {
      return db().collection('user_profiles').doc(p._id).update({ data: profile })
    }
    return db().collection('user_profiles').add({ data: profile })
  })
}

/* ===== 场地实时在线（方案 B：位置心跳） ===== */
/* 两点球面距离（米），haversine 公式 */
function distanceM(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180
  const a = 0.5 - Math.cos((lat2 - lat1) * rad) / 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * (1 - Math.cos((lng2 - lng1) * rad)) / 2
  return 12742000 * Math.asin(Math.sqrt(a))
}

/* 心跳上报（详情页前台 + 定位在场地 PRESENCE_RADIUS_M 内时调用）
 * presence 集合一人一场地一条记录，upsert 刷新 updatedAt；
 * 在线数 = 该场地 updatedAt 在窗口内的记录数（天然按人去重） */
function heartbeat(venueId) {
  const col = db().collection('presence')
  const now = new Date().toISOString()
  return col.where({ venueId: venueId }).limit(1).get()
    .then(function (r) {
      if (r.data && r.data[0]) {
        return col.doc(r.data[0]._id).update({ data: { updatedAt: now } })
      }
      return col.add({ data: { venueId: venueId, updatedAt: now } })
    })
}

/* 某场地当前在线人数（窗口内有心跳的独立用户数） */
function getOnlineCount(venueId) {
  const cmd = db().command
  const since = new Date(Date.now() - ONLINE_WINDOW_MIN * 60 * 1000).toISOString()
  return db().collection('presence')
    .where({ venueId: venueId, updatedAt: cmd.gte(since) })
    .count()
    .then(function (r) { return r.total || 0 })
    .catch(function () { return 0 })
}

/* 批量：所有场地的在线人数映射 { venueId: count }（一次聚合，首页列表用）
 * 需 presence 集合"所有用户可读"权限，否则只能统计到自己，结果降级为空 */
function getOnlineMap() {
  const cmd = db().command
  const $ = agg()
  const since = new Date(Date.now() - ONLINE_WINDOW_MIN * 60 * 1000).toISOString()
  return db().collection('presence').aggregate()
    .match({ updatedAt: cmd.gte(since) })
    .group({ _id: '$venueId', total: $.sum(1) })
    .end()
    .then(function (r) {
      const map = {}
      ;(r.list || []).forEach(function (x) { map[x._id] = x.total })
      return map
    })
    .catch(function () { return {} })
}

module.exports = {
  ENV_ID: ENV_ID,
  ensureOpenid: ensureOpenid,
  getVenues: getVenues,
  findVenue: findVenue,
  getCities: getCities,
  getFeeds: getFeeds,
  getMyCheckins: getMyCheckins,
  pushCheckins: pushCheckins,
  addCheckinDoc: addCheckinDoc,
  getMyLikes: getMyLikes,
  setLike: setLike,
  getMyProfile: getMyProfile,
  saveCity: saveCity,
  getLeaderboard: getLeaderboard,
  addVenueReport: addVenueReport,
  countMyReports: countMyReports,
  uploadAvatar: uploadAvatar,
  saveProfile: saveProfile,
  distanceM: distanceM,
  heartbeat: heartbeat,
  getOnlineCount: getOnlineCount,
  getOnlineMap: getOnlineMap,
}
