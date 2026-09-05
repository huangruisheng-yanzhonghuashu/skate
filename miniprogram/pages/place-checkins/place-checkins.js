/* 全部打卡列表（场地/店铺共用）：分页加载所有人的打卡 */
const cloud = require('../../utils/cloud.js')
const { fmtAgo, toMedia } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')

const PAGE_SIZE = 20

Page({
  data: {
    placeName: '',
    kind: 'venue',
    list: [],
    empty: false,
    finished: false, /* 没有更多 */
    loading: false,
    icons: { commentAsh: ICON.commentAsh, chevronDown: ICON.chevronDownAsh },
  },

  onLoad(options) {
    this._id = options.id
    this._skip = 0
    this.setData({ kind: options.kind || 'venue' })
    /* 标题：场地优先取名称，失败兜底通用标题 */
    const name = this._resolveName(options.id, options.kind)
    wx.setNavigationBarTitle({ title: (name || (options.kind === 'shop' ? '店铺' : '场地')) + ' · 全部打卡' })
    this.loadMore()
  },

  _resolveName(id, kind) {
    const place = kind === 'shop' ? cloud.findShop(id) : cloud.findVenue(id)
    return place ? place.name : ''
  },

  onShow() {
    if (!this.data.placeName) {
      const name = this._resolveName(this._id, this.data.kind)
      if (name) {
        this.setData({ placeName: name })
        wx.setNavigationBarTitle({ title: name + ' · 全部打卡' })
      }
    }
  },

  /* 下拉刷新：重置分页重拉 */
  onPullDownRefresh() {
    this._skip = 0
    this.setData({ list: [], finished: false, empty: false })
    this.loadMore()
    wx.stopPullDownRefresh()
  },

  loadMore() {
    if (this.data.loading || this.data.finished) return
    this.setData({ loading: true })
    cloud.getPlaceCheckins(this._id, { skip: this._skip, limit: PAGE_SIZE }).then((rows) => {
      const mapped = rows.map((r) => ({
        ...r,
        media: toMedia(r.photos, r.videos, r.mediaOrder),
        time: fmtAgo(r.at),
        commentCount: 0,
        commentsOpen: false,
      }))
      this._skip += rows.length
      /* 本页评论计数一次性聚合 */
      const ids = mapped.map((r) => r.id)
      return cloud.getCommentCounts(ids).then((cCounts) => {
        mapped.forEach((r) => { r.commentCount = cCounts[r.id] || 0 })
        this.setData({
          list: this.data.list.concat(mapped),
          loading: false,
          finished: rows.length < PAGE_SIZE,
          empty: this.data.list.length + mapped.length === 0,
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
    this.setData({ list: list })
  },

  /* comment-box 计数联动 */
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

  /* 打卡人头像/昵称 → 滑手主页（本人也进新页面：openid 缺失时兜底用本人 openid） */
  goUserProfile(e) {
    const d = e.currentTarget.dataset
    cloud.ensureOpenid().then((my) => {
      const openid = d.openid || my || ''
      wx.navigateTo({
        url: '/pages/user-profile/user-profile?openid=' + encodeURIComponent(openid) +
          '&u=' + encodeURIComponent(d.user || '') +
          '&avatar=' + encodeURIComponent(d.avatar || '') +
          '&years=' + encodeURIComponent(String(d.years || '')),
      })
    })
  },

  goPlace() {
    if (this.data.kind === 'shop') {
      wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + this._id })
    } else {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + this._id })
    }
  },
})
