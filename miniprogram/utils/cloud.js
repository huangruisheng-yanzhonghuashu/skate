/* 云开发数据访问层：云端优先，本地 mock 降级
 * 所有接口返回 Promise；云端不可用/无数据时降级到 data/mock.js，保证离线可体验 */
const mock = require('../data/mock.js')

const ENV_ID = 'cloud1-d4grizmp31acb587e'

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
      if (!r.data || r.data.length === 0) throw new Error('venues empty')
      _venues = r.data
      return _venues
    })
    .catch((e) => {
      console.warn('[cloud] 场地读取失败，降级本地数据', (e && e.errCode) || (e && e.message))
      _venues = mock.VENUES
      return _venues
    })
  return _venuesPromise
}

/* 同步取场地：优先云端缓存，未加载时降级 mock（详情页直达场景） */
function getCachedVenue(id) {
  const fromCloud = (_venues || []).find(function (v) { return v.id === id })
  return fromCloud || mock.getVenue(id)
}

/* ===== 动态 ===== */
let _feeds = null
let _feedsPromise = null
function getFeeds() {
  if (_feeds) return Promise.resolve(_feeds)
  if (_feedsPromise) return _feedsPromise
  _feedsPromise = db().collection('feeds').limit(20).get()
    .then((r) => {
      if (!r.data || r.data.length === 0) throw new Error('feeds empty')
      _feeds = r.data
      return _feeds
    })
    .catch((e) => {
      console.warn('[cloud] 动态读取失败，降级本地数据', (e && e.errCode) || (e && e.message))
      _feeds = mock.FEED_LIST
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

/* ===== 排行榜（聚合所有人签到数，需 checkins"所有用户可读"权限；未配置时降级 mock） ===== */
function getLeaderboard() {
  const $ = agg()
  return ensureOpenid().then(function (openid) {
    return db().collection('checkins').aggregate()
      .group({ _id: '$_openid', count: $.sum(1), name: $.last('$userName') })
      .sort({ count: -1 })
      .limit(5)
      .end()
  }).then(function (r) {
    const rows = (r.list || []).filter(function (x) { return !!x._id })
    if (rows.length === 0) throw new Error('leaderboard empty')
    return rows.map(function (x, i) {
      return {
        rank: i + 1,
        user: x.name || '滑友',
        count: x.count,
        self: !!(_openid && x._id === _openid),
      }
    })
  }).catch(function (e) {
    console.warn('[cloud] 排行榜聚合失败，降级本地数据', (e && e.errCode) || (e && e.message))
    return mock.LEADERBOARD
  })
}

/* ===== 场地报错 ===== */
function addVenueReport(doc) {
  return db().collection('venue_reports').add({ data: doc })
}

module.exports = {
  ENV_ID: ENV_ID,
  ensureOpenid: ensureOpenid,
  getVenues: getVenues,
  getCachedVenue: getCachedVenue,
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
}
