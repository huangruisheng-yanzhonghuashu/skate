/* 全部打卡列表（场地/店铺共用）：分页加载所有人的打卡 */
const cloud = require('../../utils/cloud.js')
const { fmtAgo } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')

const PAGE_SIZE = 20

/* 微博式打卡图布局：1 张 → 原比例单图；4 张 → 2×2 紧凑格；其余 → 3 列方格 */
function checkinPhotoLayout(photos) {
  const n = (photos || []).length
  if (n === 1) return 'one'
  if (n === 4) return 'four'
  return 'grid'
}

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
        time: fmtAgo(r.at),
        commentCount: 0,
        commentsOpen: false,
        layout: checkinPhotoLayout(r.photos),
        photoStyle: '',
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

  preview(e) {
    wx.previewImage({
      urls: e.currentTarget.dataset.urls,
      current: e.currentTarget.dataset.url,
    })
  },

  /* 微博式单图：按原图宽高比换算展示尺寸（宽封顶 420 / 高封顶 560，rpx） */
  onFeedPhotoLoad(e) {
    const { width, height } = e.detail
    const idx = e.currentTarget.dataset.fidx
    const item = this.data.list[idx]
    if (!item || item.layout !== 'one' || !width || !height) return
    let w = 420
    let h = (420 * height) / width
    if (h > 560) {
      h = 560
      w = (560 * width) / height
    }
    this.setData({ [`list[${idx}].photoStyle`]: `width:${Math.round(w)}rpx;height:${Math.round(h)}rpx;` })
  },

  goPlace() {
    if (this.data.kind === 'shop') {
      wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + this._id })
    } else {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + this._id })
    }
  },
})
