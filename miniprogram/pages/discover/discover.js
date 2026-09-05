/* 发现页：真实打卡社区流（所有人的内容打卡：有留言或有照片） */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { fmtAgo, toMedia } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')

const PAGE_SIZE = 20

Page({
  data: {
    tab: 'latest',
    list: [],
    loading: false,
    finished: false,
    empty: false,
    icons: {
      heartAsh: ICON.heartAsh,
      heartOrange: ICON.heartOrange,
      commentAsh: ICON.commentAsh,
    },
  },

  onLoad() {
    this._skip = 0
    this._counts = {} /* feedId → 点赞数（聚合结果缓存） */
    this.loadMore()
  },

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ selected: 1 })
    /* 打卡/点赞可能已变化：重置分页重新加载 */
    this.reload()
  },

  reload() {
    this._skip = 0
    this._counts = {}
    this.setData({ list: [], finished: false, empty: false })
    return this.loadMore()
  },

  loadMore() {
    if (this.data.loading || this.data.finished) return Promise.resolve()
    this.setData({ loading: true })
    return cloud.getPublicCheckins({ skip: this._skip, limit: PAGE_SIZE }).then((rows) => {
      this._skip += rows.length
      const ids = rows.map((r) => r.id)
      return Promise.all([cloud.getLikeCounts(ids), cloud.getCommentCounts(ids)]).then((rs) => {
        Object.assign(this._counts, rs[0])
        const cCounts = rs[1]
        const mapped = rows.map((r) => ({
          id: r.id,
          openid: r.openid,
          kind: r.kind,
          venueId: r.venueId,
          venueName: r.venueName,
          user: r.user,
          avatarFile: r.avatarFile,
          avatarText: r.avatarText,
          note: r.note,
          photos: r.photos,
          media: toMedia(r.photos, r.videos, r.mediaOrder),
          timeText: fmtAgo(r.at),
          liked: store.isLiked(r.id),
          likeCount: this._counts[r.id] || 0,
          commentCount: cCounts[r.id] || 0,
          commentsOpen: false,
        }))
        const list = this.data.list.concat(mapped)
        this.setData({
          list: this.sortList(list),
          loading: false,
          finished: rows.length < PAGE_SIZE,
          empty: list.length === 0,
        })
      })
    })
  },

  /* 展开/收起评论区 */
  toggleComments(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.list.map((item) => {
      if (item.id !== id) return item
      return { ...item, commentsOpen: !item.commentsOpen }
    })
    this.setData({ list: this.sortList(list) })
  },

  /* comment-box 发布/删除评论后计数联动 */
  onCommentCount(e) {
    const id = e.currentTarget.dataset.id
    const delta = e.detail.delta
    const list = this.data.list.map((item) => {
      if (item.id !== id) return item
      const next = Math.max(0, (item.commentCount || 0) + delta)
      return { ...item, commentCount: next }
    })
    this.setData({ list: this.sortList(list) })
  },

  onReachBottom() {
    this.loadMore()
  },

  onPullDownRefresh() {
    this.reload().then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh())
  },

  /* 最新：时间倒序（已是查询序）；热门：点赞×2 + 评论×3 混合权重（互动加权，避免纯点赞冷启动全 0 失真） */
  sortList(list) {
    if (this.data.tab === 'hot') {
      const score = (x) => (x.likeCount || 0) * 2 + (x.commentCount || 0) * 3
      return list.slice().sort((a, b) => score(b) - score(a))
    }
    return list
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    this.setData({ list: this.sortList(this.data.list) })
  },

  toggleLike(e) {
    const id = e.currentTarget.dataset.id
    const nowLiked = store.toggleLike(id)
    /* 本地即时更新：计数 ±1 + 状态翻转（下次聚合会给出准确值） */
    const list = this.data.list.map((item) => {
      if (item.id !== id) return item
      const count = this._counts[id] || 0
      const next = nowLiked ? count + 1 : Math.max(0, count - 1)
      this._counts[id] = next
      return { ...item, liked: nowLiked, likeCount: next }
    })
    this.setData({ list: this.sortList(list) })
  },

  /* 打卡人头像/昵称 → 滑手主页（本人也进新页面：openid 缺失时兜底用本人 openid） */
  goUserProfile(e) {
    const d = e.currentTarget.dataset
    cloud.ensureOpenid().then((my) => {
      const openid = d.openid || my || ''
      wx.navigateTo({
        url: '/pages/user-profile/user-profile?openid=' + encodeURIComponent(openid) +
          '&u=' + encodeURIComponent(d.user || '') +
          '&avatar=' + encodeURIComponent(d.avatar || ''),
      })
    })
  },

  goPlace(e) {
    const { id, kind } = e.currentTarget.dataset
    if (kind === 'shop') {
      wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + id })
    }
  },

  /* 打卡媒体预览（微博式混合查看器）：图视频混滑、视频封面点播不自动播放 */
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

  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  },
})
