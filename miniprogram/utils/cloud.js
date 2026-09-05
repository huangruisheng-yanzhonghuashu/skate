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
/* force=true 丢弃缓存重新拉取（管理页增删改后调用） */
function getVenues(force) {
  if (force) { _venues = null; _venuesPromise = null }
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

/* ===== 签到与打卡（用户作用域：默认权限下自动只读写本人数据） =====
 * type='checkin' 签到（现场定位一键记录，无内容） / type='post' 打卡（带留言/媒体的内容记录，可多条）
 * 旧数据无 type 字段：读侧按"是否有留言/媒体"懒兼容判定 */
/* 单条记录 → 展示结构（avatar 兼容 fileID 与文字头像两种存储） */
function mapCheckin(d) {
  const avatar = d.avatar || ''
  return {
    id: d._id,
    openid: d._openid || '',
    type: d.type || '',
    kind: d.kind || 'venue',
    venueId: d.venueId,
    venueName: d.venueName,
    note: d.note || '',
    photos: d.photos || [],
    videos: d.videos || [],
    mediaOrder: d.mediaOrder || [],
    at: d.at,
    skateYears: d.skateYears || 0,
    user: d.userName || '滑手',
    avatarFile: avatar.indexOf('cloud://') === 0 ? avatar : '',
    avatarText: avatar.indexOf('cloud://') === 0 ? (d.userName || '滑').slice(0, 1) : (avatar || (d.userName || '滑').slice(0, 1)),
  }
}

function getMyCheckins() {
  return db().collection('checkins')
    .orderBy('at', 'desc')
    .limit(100)
    .get()
    .then((r) => (r.data || []).map(mapCheckin))
}

function pushCheckins(docs) {
  const col = db().collection('checkins')
  return Promise.all(docs.map(function (d) { return col.add({ data: d }) }))
}

function addCheckinDoc(doc) {
  return db().collection('checkins').add({ data: doc })
}

/* 删除本人签到（"仅创建者可写"权限下只能删自己的） */
function removeCheckinDoc(id) {
  return db().collection('checkins').doc(id).remove()
}

/* 补充打卡：更新本人签到记录的留言/照片 */
function _updateCheckinDoc(id, patch) {
  return db().collection('checkins').doc(id).update({ data: patch })
}

/* 某地点（场地/店铺）的打卡流（所有人，按时间倒序）——只含"打卡"（有留言或媒体的内容记录）：
 * 纯签到（type=checkin）与旧版签到（无 type、note/photos 字段缺失或 null）一律不出现。
 * ⚠️ Mongo 的 neq 会命中"字段不存在"的文档，内容条件必须先 exists(true) 再排除 null/空值。
 * 需 checkins"所有用户可读"权限；无权限时仅返回自己的，行为仍正确 */
function getPlaceCheckins(venueId, opts) {
  opts = opts || {}
  const cmd = db().command
  const noteQ = cmd.exists(true).and(cmd.neq('')).and(cmd.neq(null))
  const photosQ = cmd.exists(true).and(cmd.neq([])).and(cmd.neq(null))
  const videosQ = cmd.exists(true).and(cmd.neq([])).and(cmd.neq(null))
  const where = cmd.or([
    { venueId: venueId, note: noteQ },
    { venueId: venueId, photos: photosQ },
    { venueId: venueId, videos: videosQ },
  ])
  let q = db().collection('checkins').where(where)
  if (opts.skip) q = q.skip(opts.skip)
  return q.orderBy('at', 'desc').limit(opts.limit || 20).get()
    .then((r) => (r.data || []).map(mapCheckin))
    .catch((e) => {
      console.warn('[cloud] 打卡流读取失败', (e && e.errCode) || (e && e.message))
      return []
    })
}

/* 发现页社区流：所有人的"打卡"（有留言或媒体的内容记录），全量按时间倒序分页
 * 纯签到（含旧版字段缺失/null 的签到记录）不出现；type 不参与判断——补打卡更新不改 type。
 * ⚠️ Mongo 的 neq 会命中"字段不存在"的文档，内容条件必须先 exists(true) 再排除 null/空值。
 * opts.openid 传入时限定为某位滑手的公开动态（滑手主页用） */
function getPublicCheckins(opts) {
  opts = opts || {}
  const cmd = db().command
  const noteQ = cmd.exists(true).and(cmd.neq('')).and(cmd.neq(null))
  const photosQ = cmd.exists(true).and(cmd.neq([])).and(cmd.neq(null))
  const videosQ = cmd.exists(true).and(cmd.neq([])).and(cmd.neq(null))
  const where = opts.openid
    ? cmd.or([
        { _openid: opts.openid, note: noteQ },
        { _openid: opts.openid, photos: photosQ },
        { _openid: opts.openid, videos: videosQ },
      ])
    : cmd.or([
        { note: noteQ },
        { photos: photosQ },
        { videos: videosQ },
      ])
  let q = db().collection('checkins').where(where)
  if (opts.skip) q = q.skip(opts.skip)
  return q.orderBy('at', 'desc').limit(opts.limit || 20).get()
    .then((r) => (r.data || []).map(mapCheckin))
    .catch((e) => {
      console.warn('[cloud] 社区流读取失败', (e && e.errCode) || (e && e.errMsg) || (e && e.message))
      return []
    })
}

/* 点赞计数聚合：feed_likes 集合按 feedId in ids 分组计数（需"所有用户可读"权限） */
function getLikeCounts(ids) {
  const cmd = db().command
  const $ = agg()
  if (!ids || !ids.length) return Promise.resolve({})
  return db().collection('feed_likes').aggregate()
    .match({ feedId: cmd.in(ids) })
    .group({ _id: '$feedId', total: $.sum(1) })
    .end()
    .then(function (r) {
      const map = {}
      ;(r.list || []).forEach(function (x) { map[x._id] = x.total })
      return map
    })
    .catch(function (e) {
      console.warn('[cloud] 点赞计数聚合失败', (e && e.errCode) || (e && e.message))
      return {}
    })
}

/* ===== 评论（UGC 最小版：发布即显示，仅可删自己的；公开内容） ===== */
/* 某条打卡的评论列表（时间正序，分页） */
function getComments(checkinId, opts) {
  opts = opts || {}
  let q = db().collection('comments').where({ checkinId: checkinId })
  if (opts.skip) q = q.skip(opts.skip)
  return q.orderBy('at', 'asc').limit(opts.limit || 20).get()
    .then((r) => (r.data || []).map(function (d) {
      const avatar = d.avatar || ''
      return {
        id: d._id,
        checkinId: d.checkinId,
        user: d.userName || '滑手',
        avatarFile: avatar.indexOf('cloud://') === 0 ? avatar : '',
        avatarText: avatar.indexOf('cloud://') === 0 ? (d.userName || '滑').slice(0, 1) : (avatar || '滑'),
        note: d.note || '',
        at: d.at,
      }
    }))
    .catch((e) => {
      console.warn('[cloud] 评论读取失败', (e && e.errCode) || (e && e.message))
      return []
    })
}

/* 发布评论（需携带发布者昵称/头像冗余，展示免联表） */
function addCommentDoc(checkinId, note, user) {
  return db().collection('comments').add({
    data: {
      checkinId: checkinId,
      note: note,
      at: new Date().toISOString(),
      userName: (user && user.nickname) || '滑手',
      avatar: (user && user.avatarFileID) || ((user && user.nickname) || '滑').slice(0, 1),
    },
  }).then((r) => ({ id: r._id }))
}

/* 删除自己的评论（"仅创建者可写"下只能删自己的） */
function removeCommentDoc(id) {
  return db().collection('comments').doc(id).remove()
}

/* 评论计数聚合：comments 集合按 checkinId in ids 分组计数 */
function getCommentCounts(ids) {
  const cmd = db().command
  const $ = agg()
  if (!ids || !ids.length) return Promise.resolve({})
  return db().collection('comments').aggregate()
    .match({ checkinId: cmd.in(ids) })
    .group({ _id: '$checkinId', total: $.sum(1) })
    .end()
    .then(function (r) {
      const map = {}
      ;(r.list || []).forEach(function (x) { map[x._id] = x.total })
      return map
    })
    .catch(function (e) {
      console.warn('[cloud] 评论计数聚合失败', (e && e.errCode) || (e && e.message))
      return {}
    })
}

/* ===== 用户评分（ratings：一人一实体一条，可改分） ===== */
/* 某类型全部实体的评分统计聚合：{ targetId: { avg, count } }
 * 需 ratings"所有用户可读"权限 */
function getRatingStats(targetType) {
  const $ = agg()
  return db().collection('ratings').aggregate()
    .match({ targetType: targetType })
    .group({
      _id: '$targetId',
      avg: $.avg('$score'),
      count: $.sum(1),
    })
    .end()
    .then(function (r) {
      const map = {}
      ;(r.list || []).forEach(function (x) {
        map[x._id] = { avg: Math.round((x.avg || 0) * 10) / 10, count: x.count || 0 }
      })
      return map
    })
    .catch(function (e) {
      console.warn('[cloud] 评分统计聚合失败', (e && e.errCode) || (e && e.message))
      return {}
    })
}

/* 本人当前评分（无则 null） */
function getMyRating(targetType, targetId) {
  return db().collection('ratings')
    .where({ targetType: targetType, targetId: targetId })
    .limit(1)
    .get()
    .then((r) => ((r.data && r.data[0]) ? r.data[0].score : null))
    .catch(() => null)
}

/* 提交评分：upsert（一人一实体一条，改分即覆盖） */
function rateTarget(targetType, targetId, score) {
  return db().collection('ratings')
    .where({ targetType: targetType, targetId: targetId })
    .limit(1)
    .get()
    .then((r) => {
      if (r.data && r.data[0]) {
        return db().collection('ratings').doc(r.data[0]._id).update({ data: { score: score, at: new Date().toISOString() } })
      }
      return db().collection('ratings').add({
        data: { targetType: targetType, targetId: targetId, score: score, at: new Date().toISOString() },
      })
    })
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

/* ===== 排行榜（聚合所有人场地"签到"数，需 checkins"所有用户可读"权限）
 * limit 参数化（首页榜 5 / 完整榜 20）；只数签到：type=checkin，或旧数据（无 type）无留言/媒体；
 * 店铺签到不计入（kind != shop，旧数据无 kind 字段视为场地），打卡（type=post）不参与排行 */
function getLeaderboard(limit) {
  const $ = agg()
  const cmd = db().command
  return ensureOpenid().then(function () {
    return db().collection('checkins').aggregate()
      .match(cmd.or([
        { kind: cmd.neq('shop'), type: 'checkin' },
        { kind: cmd.neq('shop'), type: cmd.exists(false), note: cmd.in(['', null]), photos: cmd.in([[], null]), videos: cmd.in([[], null]) },
      ]))
      .group({ _id: '$_openid', count: $.sum(1), name: $.last('$userName') })
      .sort({ count: -1 })
      .limit(limit || 5)
      .end()
  }).then(function (r) {
    const rows = (r.list || []).filter(function (x) { return !!x._id })
    return rows.map(function (x, i) {
      return {
        rank: i + 1,
        openid: x._id || '',
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

/* ===== 滑手主页（他人视角的公开档案） ===== */
/* 他人资料（需 user_profiles"所有用户可读"权限；无权限/未设置时返回 null，调用方降级用跳转种子信息） */
function getUserProfileByOpenid(openid) {
  if (!openid) return Promise.resolve(null)
  return db().collection('user_profiles')
    .where({ _openid: openid })
    .limit(1)
    .get()
    .then((r) => (r.data && r.data[0]) || null)
    .catch(function (e) {
      console.warn('[cloud] 他人资料读取失败', (e && e.errCode) || (e && e.message))
      return null
    })
}

/* 常去场地：按 openid 聚合"签到"记录按场地分组计数，签到数倒序（需 checkins"所有用户可读"权限）
 * 返回 [{ id: venueId, name, kind, count }]；limit：展示用 10 / 统计足迹场地数用 100 */
function getUserFrequentVenues(openid, limit) {
  const $ = agg()
  const cmd = db().command
  if (!openid) return Promise.resolve([])
  return db().collection('checkins').aggregate()
    .match(cmd.or([
      { _openid: openid, type: 'checkin' },
      { _openid: openid, type: cmd.exists(false), note: cmd.in(['', null]), photos: cmd.in([[], null]), videos: cmd.in([[], null]) },
    ]))
    .group({ _id: '$venueId', count: $.sum(1), name: $.last('$venueName'), kind: $.last('$kind') })
    .sort({ count: -1 })
    .limit(limit || 100)
    .end()
    .then(function (r) {
      return (r.list || []).filter(function (x) { return !!x._id }).map(function (x) {
        return { id: x._id, name: x.name || '', kind: x.kind || 'venue', count: x.count }
      })
    })
    .catch(function (e) {
      console.warn('[cloud] 常去场地聚合失败', (e && e.errCode) || (e && e.message))
      return []
    })
}

/* 滑手数据概览：累计签到数 + 获赞总数
 * 签到数只数"签到"记录（type=checkin，或旧数据无留言/媒体）；打卡不计数
 * 获赞 = 该滑手打卡（type=post，或旧数据有留言/媒体）最近 100 条的点赞求和
 * 需 checkins / feed_likes"所有用户可读"权限 */
function getUserStats(openid) {
  const cmd = db().command
  if (!openid) return Promise.resolve({ checkinCount: 0, likeCount: 0 })
  const countQ = db().collection('checkins')
    .where(cmd.or([
      { _openid: openid, type: 'checkin' },
      { _openid: openid, type: cmd.exists(false), note: cmd.in(['', null]), photos: cmd.in([[], null]), videos: cmd.in([[], null]) },
    ]))
    .count()
    .catch(function () { return { total: 0 } })
  const idsQ = db().collection('checkins')
    .where(cmd.or([
      { _openid: openid, type: 'post' },
      { _openid: openid, note: cmd.neq('') },
      { _openid: openid, photos: cmd.neq([]) },
      { _openid: openid, videos: cmd.neq([]) },
    ]))
    .field({ _id: true })
    .limit(100)
    .get()
    .catch(function () { return { data: [] } })
  return Promise.all([countQ, idsQ]).then(function (rs) {
    const ids = (rs[1].data || []).map(function (d) { return d._id })
    return getLikeCounts(ids).then(function (map) {
      const likeCount = Object.keys(map).reduce(function (s, k) { return s + (map[k] || 0) }, 0)
      return { checkinCount: (rs[0] && rs[0].total) || 0, likeCount: likeCount }
    })
  })
}

/* ===== 店铺 ===== */
let _shops = null
let _shopsPromise = null
/* force=true 丢弃缓存重新拉取（管理页增删改后调用） */
function getShops(force) {
  if (force) { _shops = null; _shopsPromise = null }
  if (_shops) return Promise.resolve(_shops)
  if (_shopsPromise) return _shopsPromise
  _shopsPromise = db().collection('shops').limit(20).get()
    .then((r) => {
      _shops = r.data || []
      return _shops
    })
    .catch((e) => {
      console.warn('[cloud] 店铺读取失败', (e && e.errCode) || (e && e.message))
      _shops = []
      return _shops
    })
  return _shopsPromise
}

/* 从已加载的店铺缓存中查找 */
function findShop(id) {
  return (_shops || []).find(function (s) { return s.id === id }) || null
}

/* 店铺营业状态：营业中 / 已打烊 / 未设置 */
function openStatus(shop) {
  if (!shop || !shop.hours || !shop.hours.open || !shop.hours.close) return ''
  const now = new Date()
  const mins = now.getHours() * 60 + now.getMinutes()
  const toM = function (s) {
    const p = s.split(':')
    return Number(p[0]) * 60 + Number(p[1])
  }
  return mins >= toM(shop.hours.open) && mins < toM(shop.hours.close) ? '营业中' : '已打烊'
}

/* ===== 管理端（manageVenue 云函数封装） ===== */
function callManage(action, data) {
  return wx.cloud.callFunction({ name: 'manageVenue', data: { action: action, data: data } })
    .then(function (r) {
      const res = (r.result && typeof r.result === 'object') ? r.result : { ok: false, msg: '云函数返回异常' }
      if (!res.ok) {
        const e = new Error(res.msg || '操作失败')
        e.code = res.code
        throw e
      }
      return res
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

/* 我的报错列表（时间倒序；仅创建者可读写下自动只返回本人的） */
function getMyReports() {
  return db().collection('venue_reports')
    .orderBy('at', 'desc')
    .limit(100)
    .get()
    .then((r) => r.data || [])
    .catch((e) => {
      console.warn('[cloud] 报错读取失败', (e && e.errCode) || (e && e.message))
      return []
    })
}

/* ===== 你提我改（feedback：仅创建者可读写，用户只能看自己的；管理员读全部/回复走 manageVenue 云函数） ===== */
function addFeedback(doc) {
  return db().collection('feedback').add({ data: doc }).then((r) => ({ id: r._id }))
}

/* 我的建议列表（时间倒序） */
function getMyFeedback() {
  return db().collection('feedback')
    .orderBy('at', 'desc')
    .limit(100)
    .get()
    .then((r) => r.data || [])
    .catch((e) => {
      console.warn('[cloud] 建议读取失败', (e && e.errCode) || (e && e.message))
      return []
    })
}

/* 统计本人建议条数（我的页菜单显示） */
function countMyFeedback() {
  return db().collection('feedback').count()
    .then((r) => r.total || 0)
    .catch(() => 0)
}

/* ===== 推荐（滑手推荐场地/店铺，submissions：仅创建者可读写，用户只能看自己的；管理员审核走 manageVenue 云函数） ===== */
function addSubmission(doc) {
  return db().collection('submissions').add({ data: doc }).then((r) => ({ id: r._id }))
}

/* 我的推荐列表（时间倒序） */
function getMySubmissions() {
  return db().collection('submissions')
    .orderBy('at', 'desc')
    .limit(100)
    .get()
    .then((r) => r.data || [])
    .catch((e) => {
      console.warn('[cloud] 推荐读取失败', (e && e.errCode) || (e && e.message))
      return []
    })
}

/* 统计本人推荐条数（我的页菜单显示） */
function countMySubmissions() {
  return db().collection('submissions').count()
    .then((r) => r.total || 0)
    .catch(() => 0)
}

/* 编辑本人待审核推荐（仅创建者可读写权限下只能改自己的；patch 不含 status/reply，审核流字段由云函数管） */
function updateMySubmission(id, patch) {
  return db().collection('submissions').doc(id).update({ data: patch })
}

/* ===== 头像与资料 ===== */
/* 上传头像到云存储，返回 fileID（image 组件可直接显示 cloud:// 路径） */
function uploadAvatar(tempFilePath) {
  return uploadFileTo('avatars', tempFilePath)
}

/* 通用上传：dir 为云存储目录名，返回 fileID */
function uploadFileTo(dir, tempFilePath) {
  const m = tempFilePath.match(/\.(\w+)$/)
  const ext = (m && m[1]) || 'jpg'
  const cloudPath = dir + '/' + Date.now() + '-' + Math.floor(Math.random() * 1000000) + '.' + ext
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

/* 打卡媒体预览源（微博式混合预览用）：cloud:// 换取临时 https 链接（previewMedia 未承诺支持云文件 ID），
 * 本地临时路径原样透传；换取失败降级为原 url */
function getMediaPreviewSources(media) {
  const list = media || []
  if (!list.length) return Promise.resolve([])
  const cloudIds = list
    .filter(function (m) { return m.url.indexOf('cloud://') === 0 })
    .map(function (m) { return m.url })
  const build = function (urlMap) {
    return list.map(function (m) {
      return { url: urlMap[m.url] || m.url, type: m.type }
    })
  }
  if (!cloudIds.length) return Promise.resolve(build({}))
  return wx.cloud.getTempFileURL({ fileList: cloudIds })
    .then(function (r) {
      const map = {}
      ;(r.fileList || []).forEach(function (f) {
        if (f.fileID && f.tempFileURL) map[f.fileID] = f.tempFileURL
      })
      return build(map)
    })
    .catch(function () { return build({}) })
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
 * 冗余携带用户身份（昵称/头像），供"在场头像"展示（改资料后下次心跳自动同步）
 * 在线数 = 该场地 updatedAt 在窗口内的记录数（天然按人去重） */
function heartbeat(venueId, user) {
  const col = db().collection('presence')
  const now = new Date().toISOString()
  const identity = {
    userName: (user && user.nickname) || '滑手',
    avatarFileID: (user && user.avatarFileID) || '',
  }
  return col.where({ venueId: venueId }).limit(1).get()
    .then(function (r) {
      if (r.data && r.data[0]) {
        return col.doc(r.data[0]._id).update({ data: { updatedAt: now, userName: identity.userName, avatarFileID: identity.avatarFileID } })
      }
      return col.add({ data: { venueId: venueId, updatedAt: now, userName: identity.userName, avatarFileID: identity.avatarFileID } })
    })
}

/* 某场地当前在场用户（窗口内，按心跳时间倒序，最多 8 个）
 * 返回 [{ userName, avatarFileID }]；旧记录无身份字段时 userName 为空串 */
function getPresenceUsers(venueId) {
  const cmd = db().command
  const since = new Date(Date.now() - ONLINE_WINDOW_MIN * 60 * 1000).toISOString()
  return db().collection('presence')
    .where({ venueId: venueId, updatedAt: cmd.gte(since) })
    .orderBy('updatedAt', 'desc')
    .limit(8)
    .get()
    .then((r) => (r.data || []).map(function (d) {
      return { userName: d.userName || '', avatarFileID: d.avatarFileID || '' }
    }))
    .catch(function (e) {
      console.warn('[cloud] 在场用户读取失败', (e && e.errCode) || (e && e.message))
      return []
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
 * 成功返回 map（可能为空对象 = 当前无人在线）；失败返回 null（调用方保留兜底显示）
 * 需 presence 集合"所有用户可读"权限，否则只能统计到自己 */
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
    .catch(function (e) {
      console.warn('[cloud] 在线数聚合失败', (e && e.errCode) || (e && e.message))
      return null
    })
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
  _updateCheckinDoc: _updateCheckinDoc,
  removeCheckinDoc: removeCheckinDoc,
  getPlaceCheckins: getPlaceCheckins,
  getPublicCheckins: getPublicCheckins,
  getMediaPreviewSources: getMediaPreviewSources,
  getLikeCounts: getLikeCounts,
  getComments: getComments,
  addCommentDoc: addCommentDoc,
  removeCommentDoc: removeCommentDoc,
  getCommentCounts: getCommentCounts,
  getRatingStats: getRatingStats,
  getMyRating: getMyRating,
  rateTarget: rateTarget,
  getMyLikes: getMyLikes,
  setLike: setLike,
  getMyProfile: getMyProfile,
  saveCity: saveCity,
  getLeaderboard: getLeaderboard,
  getUserProfileByOpenid: getUserProfileByOpenid,
  getUserFrequentVenues: getUserFrequentVenues,
  getUserStats: getUserStats,
  addVenueReport: addVenueReport,
  countMyReports: countMyReports,
  getMyReports: getMyReports,
  addFeedback: addFeedback,
  getMyFeedback: getMyFeedback,
  countMyFeedback: countMyFeedback,
  addSubmission: addSubmission,
  getMySubmissions: getMySubmissions,
  countMySubmissions: countMySubmissions,
  updateMySubmission: updateMySubmission,
  uploadAvatar: uploadAvatar,
  uploadFileTo: uploadFileTo,
  saveProfile: saveProfile,
  distanceM: distanceM,
  heartbeat: heartbeat,
  getPresenceUsers: getPresenceUsers,
  getOnlineCount: getOnlineCount,
  getOnlineMap: getOnlineMap,
  getShops: getShops,
  findShop: findShop,
  openStatus: openStatus,
  callManage: callManage,
}
