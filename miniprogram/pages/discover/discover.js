/* 发现页：真实打卡社区流（所有人的内容打卡：有留言或有照片） */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { fmtAgo } = require('../../utils/format.js')
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
    this.loadMore()
  },

  loadMore() {
    if (this.data.loading || this.data.finished) return
    this.setData({ loading: true })
    cloud.getPublicCheckins({ skip: this._skip, limit: PAGE_SIZE }).then((rows) => {
      this._skip += rows.length
      const ids = rows.map((r) => r.id)
      return cloud.getLikeCounts(ids).then((counts) => {
        Object.assign(this._counts, counts)
        const mapped = rows.map((r) => ({
          id: r.id,
          kind: r.kind,
          venueId: r.venueId,
          venueName: r.venueName,
          user: r.user,
          avatarFile: r.avatarFile,
          avatarText: r.avatarText,
          note: r.note,
          photos: r.photos,
          timeText: fmtAgo(r.at),
          liked: store.isLiked(r.id),
          likeCount: this._counts[r.id] || 0,
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

  onReachBottom() {
    this.loadMore()
  },

  /* 最新：时间倒序（已是查询序）；热门：点赞数优先 */
  sortList(list) {
    if (this.data.tab === 'hot') {
      return list.slice().sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
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

  goPlace(e) {
    const { id, kind } = e.currentTarget.dataset
    if (kind === 'shop') {
      wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + id })
    }
  },

  preview(e) {
    wx.previewImage({
      urls: e.currentTarget.dataset.urls,
      current: e.currentTarget.dataset.url,
    })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  },
})
