const { ICON } = require('../../utils/icons.js')

Component({
  options: {
    styleIsolation: 'apply-shared',
  },
  properties: {
    venue: { type: Object, value: {} },
    online: { type: Number, value: 0 },
    checked: { type: Boolean, value: false },
    /* 今日签到时间（HH:mm），用于「今日已签到 · 14:20」状态行 */
    checkedTime: { type: String, value: '' },
    index: { type: Number, value: 0 },
  },
  data: {
    icons: {
      venue: ICON.venueOrange,
      star: ICON.starOrange,
      /* 设计稿：地址行橙色 pin */
      pin: ICON.pinOrangeSmall,
    },
    /* 入场动效错峰（60ms 起步，每张 +50ms，与设计稿一致） */
    delay: 0,
  },
  observers: {
    index(v) {
      this.setData({ delay: 60 + (v || 0) * 50 })
    },
  },
  methods: {
    go() {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + this.data.venue.id })
    },
  },
})
