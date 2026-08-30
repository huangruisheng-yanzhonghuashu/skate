const store = require('../../utils/store.js')
const { fmtRel } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')

Page({
  data: {
    user: store.user,
    city: '上海',
    checkinCount: 0,
    recent: [],
    icons: {
      flame: ICON.flameOrange,
      pin: ICON.pinOrangeSmall,
      file: ICON.fileOrange,
      settings: ICON.settingsOrange,
      chevron: ICON.chevronRightAsh,
    },
  },

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ selected: 3 })
    this.refresh()
  },

  refresh() {
    const s = store.calcStats()
    const recent = store
      .getState()
      .checkins.slice(0, 3)
      .map((c) => ({ ...c, timeText: fmtRel(c.at) }))
    this.setData({ checkinCount: s.total, recent, city: store.getCity() })
  },

  goCheckins() {
    wx.switchTab({ url: '/pages/checkins/checkins' })
  },

  goReports() {
    wx.showToast({ title: '报错记录即将上线', icon: 'none' })
  },

  goSuggest() {
    wx.showToast({ title: '感谢支持，建议入口即将开放', icon: 'none' })
  },

  goSettings() {
    wx.showToast({ title: '设置功能开发中', icon: 'none' })
  },

  goVenue(e) {
    wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + e.currentTarget.dataset.id })
  },
})
