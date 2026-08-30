const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { fmtAgo } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')

Page({
  data: {
    tab: 'latest',
    list: [],
    icons: {
      heartAsh: ICON.heartAsh,
      heartOrange: ICON.heartOrange,
      commentAsh: ICON.commentAsh,
    },
  },

  onLoad() {
    this._feeds = []
    this.loadFeeds()
  },

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ selected: 1 })
    this.loadFeeds()
    this.refresh()
  },

  /* 云端动态流（同时确保场地缓存已加载，用于显示场地名） */
  loadFeeds() {
    Promise.all([cloud.getFeeds(), cloud.getVenues()]).then((rs) => {
      this._feeds = rs[0]
      this.refresh()
    })
  },

  refresh() {
    const arr = (this._feeds || []).map((f) => {
      const liked = store.isLiked(f.id)
      return {
        ...f,
        venueName: (cloud.findVenue(f.venueId) || {}).name || '',
        timeText: fmtAgo(f.at),
        liked,
        likeCount: f.likes + (liked ? 1 : 0),
      }
    })
    if (this.data.tab === 'hot') {
      arr.sort((a, b) => b.likeCount + b.comments * 2 - (a.likeCount + a.comments * 2))
    } else {
      arr.sort((a, b) => new Date(b.at) - new Date(a.at))
    }
    this.setData({ list: arr })
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab })
    this.refresh()
  },

  toggleLike(e) {
    store.toggleLike(e.currentTarget.dataset.id)
    this.refresh()
  },

  goVenue(e) {
    wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + e.currentTarget.dataset.id })
  },

  onComment() {
    wx.showToast({ title: '评论区即将开放，敬请期待', icon: 'none' })
  },
})
