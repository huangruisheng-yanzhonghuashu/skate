/* 全部打卡列表（场地/店铺共用）：分页加载所有人的打卡 */
const cloud = require('../../utils/cloud.js')
const { fmtAgo } = require('../../utils/format.js')

const PAGE_SIZE = 20

Page({
  data: {
    placeName: '',
    kind: 'venue',
    list: [],
    empty: false,
    finished: false, /* 没有更多 */
    loading: false,
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

  loadMore() {
    if (this.data.loading || this.data.finished) return
    this.setData({ loading: true })
    cloud.getPlaceCheckins(this._id, { skip: this._skip, limit: PAGE_SIZE }).then((rows) => {
      const mapped = rows.map((r) => ({ ...r, time: fmtAgo(r.at) }))
      this._skip += rows.length
      this.setData({
        list: this.data.list.concat(mapped),
        loading: false,
        finished: rows.length < PAGE_SIZE,
        empty: this.data.list.length + mapped.length === 0,
      })
    })
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

  goPlace() {
    if (this.data.kind === 'shop') {
      wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + this._id })
    } else {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + this._id })
    }
  },
})
