/* 滑手主页：他人视角的公开档案（头部资料 + 数据概览 + 常去场地 + 公开动态流）
 * 头部信息：跳转携带的种子信息先渲染，他人资料（user_profiles）拉到后覆盖；
 * 动态口径与发现页一致：只展示"打卡"（有留言或照片/视频的内容记录），纯签到不对外；
 * 累计签到数与常去场地只按"签到"记录统计（getUserStats/getUserFrequentVenues） */
const cloud = require('../../utils/cloud.js')
const store = require('../../utils/store.js')
const { fmtAgo, toMedia } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')
const nav = require('../../utils/nav.js')

const PAGE_SIZE = 20
/* 常去场地：聚合上限 100（兼做足迹场地数统计），展示前 10 张 */
const PLACE_FETCH_LIMIT = 100
const PLACE_SHOW_LIMIT = 10

Page({
  data: {
    isSelf: false,
    /* 头部（种子信息 → 他人资料覆盖） */
    user: '滑手',
    avatarFile: '',
    avatarText: '滑',
    skateYears: '',
    city: '',
    skills: [],
    metaText: '',
    /* 数据概览 */
    statsLoaded: false,
    stats: { checkinCount: 0, venueCount: 0, likeCount: 0 },
    /* 常去场地 */
    places: [],
    /* 动态流 */
    list: [],
    loading: false,
    finished: false,
    empty: false,
    statusBarHeight: 20,
    icons: {
      trophy: ICON.trophyOrange,
      venue: ICON.venueOrange,
      heart: ICON.heartOrange,
      heartAsh: ICON.heartAsh,
      heartOrange: ICON.heartOrange,
      commentAsh: ICON.commentAsh,
      back: ICON.chevronLeftWhite,
    },
  },

  onLoad(options) {
    this._openid = decodeURIComponent(options.openid || '')
    this._skip = 0
    this._counts = {}
    const user = decodeURIComponent(options.u || '') || '滑手'
    this.setData({
      user: user,
      avatarFile: decodeURIComponent(options.avatar || ''),
      skateYears: decodeURIComponent(options.years || ''),
      avatarText: user.slice(0, 1),
      statusBarHeight: nav.getStatusBarHeight(),
    })
    this.updateMeta()
    this.initSelf()
    this.loadProfile()
    this.loadPlaces()
    this.loadMore()
  },

  /* 返回（自定义导航无系统返回键） */
  goBack() {
    nav.goBack()
  },

  updateMeta() {
    const parts = []
    if (this.data.skateYears) parts.push('滑龄' + this.data.skateYears)
    if (this.data.city) parts.push(this.data.city)
    this.setData({ metaText: parts.join(' · ') })
  },

  /* 本人主页：资料直接用本地 store 实时数据（含 skills，最准） */
  initSelf() {
    if (!this._openid) {
      this.setData({ isSelf: true })
      return
    }
    cloud.ensureOpenid().then((my) => {
      if (my && my === this._openid) {
        const u = store.getUser()
        this.setData({
          isSelf: true,
          user: u.nickname || '滑手',
          avatarFile: u.avatarFileID || '',
          skateYears: u.skateYears || '',
          city: store.getCity(),
          skills: u.skills || [],
          avatarText: (u.nickname || '滑').slice(0, 1),
        })
        this.updateMeta()
      }
    })
  },

  /* 他人资料：需 user_profiles"所有用户可读"权限；无权限/未设置时静默保留种子信息 */
  loadProfile() {
    if (!this._openid) return
    cloud.getUserProfileByOpenid(this._openid).then((p) => {
      if (!p || this.data.isSelf) return
      const nickname = p.nickname || this.data.user
      this.setData({
        user: nickname,
        avatarFile: (p.avatarFileID && p.avatarFileID.indexOf('cloud://') === 0) ? p.avatarFileID : this.data.avatarFile,
        skateYears: p.skateYears || this.data.skateYears,
        city: p.city || this.data.city,
        skills: Array.isArray(p.skills) ? p.skills : [],
        avatarText: nickname.slice(0, 1),
      })
      this.updateMeta()
    })
  },

  /* 常去场地 + 足迹场地数（聚合一次，展示取前 10） */
  loadPlaces() {
    if (!this._openid) {
      this.setData({ statsLoaded: true })
      return
    }
    cloud.getUserFrequentVenues(this._openid, PLACE_FETCH_LIMIT).then((rows) => {
      this.setData({
        places: rows.slice(0, PLACE_SHOW_LIMIT),
        'stats.venueCount': rows.length,
      })
      return cloud.getUserStats(this._openid)
    }).then((s) => {
      if (!s) return
      this.setData({ 'stats.checkinCount': s.checkinCount, 'stats.likeCount': s.likeCount, statsLoaded: true })
    })
  },

  /* ===== 动态流（同发现页：分页 + 点赞/评论计数一次性聚合） ===== */
  loadMore() {
    if (this.data.loading || this.data.finished) return Promise.resolve()
    this.setData({ loading: true })
    return cloud.getPublicCheckins({ openid: this._openid, skip: this._skip, limit: PAGE_SIZE }).then((rows) => {
      this._skip += rows.length
      const ids = rows.map((r) => r.id)
      return Promise.all([cloud.getLikeCounts(ids), cloud.getCommentCounts(ids)]).then((rs) => {
        Object.assign(this._counts, rs[0])
        const cCounts = rs[1]
        const mapped = rows.map((r) => ({
          id: r.id,
          kind: r.kind,
          venueId: r.venueId,
          venueName: r.venueName,
          note: r.note,
          media: toMedia(r.photos, r.videos, r.mediaOrder),
          timeText: fmtAgo(r.at),
          liked: store.isLiked(r.id),
          likeCount: this._counts[r.id] || 0,
          commentCount: cCounts[r.id] || 0,
          commentsOpen: false,
        }))
        const list = this.data.list.concat(mapped)
        this.setData({
          list: list,
          loading: false,
          finished: rows.length < PAGE_SIZE,
          empty: list.length === 0,
        })
      })
    })
  },

  toggleLike(e) {
    const id = e.currentTarget.dataset.id
    const nowLiked = store.toggleLike(id)
    const list = this.data.list.map((item) => {
      if (item.id !== id) return item
      const count = this._counts[id] || 0
      const next = nowLiked ? count + 1 : Math.max(0, count - 1)
      this._counts[id] = next
      return { ...item, liked: nowLiked, likeCount: next }
    })
    this.setData({ list: list })
  },

  toggleComments(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.list.map((item) => {
      if (item.id !== id) return item
      return { ...item, commentsOpen: !item.commentsOpen }
    })
    this.setData({ list: list })
  },

  onCommentCount(e) {
    const id = e.currentTarget.dataset.id
    const delta = e.detail.delta
    const list = this.data.list.map((item) => {
      if (item.id !== id) return item
      return { ...item, commentCount: Math.max(0, (item.commentCount || 0) + delta) }
    })
    this.setData({ list: list })
  },

  onReachBottom() {
    this.loadMore()
  },

  onPullDownRefresh() {
    this._skip = 0
    this._counts = {}
    this.setData({ list: [], finished: false, empty: false })
    Promise.all([this.loadPlaces(), this.loadMore()])
      .catch(() => {})
      .then(() => wx.stopPullDownRefresh())
  },

  /* 常去场地卡 / 动态卡场地名 → 场地或店铺详情 */
  goPlace(e) {
    const { id, kind } = e.currentTarget.dataset
    if (kind === 'shop') {
      wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + id })
    }
  },

  /* 打卡媒体预览（微博式混合查看器） */
  previewMedia(e) {
    const media = e.currentTarget.dataset.media || []
    const current = e.currentTarget.dataset.index || 0
    cloud.getMediaPreviewSources(media).then((sources) => {
      if (!sources.length) return
      this.setData({ viewerShow: true, viewerSources: sources, viewerCurrent: current })
    })
  },

  onViewerClose() {
    this.setData({ viewerShow: false })
  },
})
