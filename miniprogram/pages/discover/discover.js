const { FEED_LIST, getVenue } = require('../../data/mock.js')
const store = require('../../utils/store.js')
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

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ selected: 1 })
    this.refresh()
  },

  refresh() {
    const arr = FEED_LIST.map((f) => {
      const liked = store.isLiked(f.id)
      return {
        ...f,
        venueName: (getVenue(f.venueId) || {}).name || '',
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
