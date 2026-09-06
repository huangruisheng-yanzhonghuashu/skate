const { ICON } = require('../utils/icons.js')

Component({
  data: {
    selected: 0,
    hidden: false, /* 全屏浮层（媒体预览等）打开时隐藏 TabBar，关闭恢复 */
    list: [
      { path: '/pages/home/home', text: '首页', icon: ICON.homeAsh, activeIcon: ICON.homeOrange },
      { path: '/pages/discover/discover', text: '发现', icon: ICON.compassAsh, activeIcon: ICON.compassOrange },
      { path: '/pages/checkins/checkins', text: '签到', icon: ICON.pinAsh, activeIcon: ICON.pinOrange },
      { path: '/pages/profile/profile', text: '我的', icon: ICON.userAsh, activeIcon: ICON.userOrange },
    ],
  },
  methods: {
    switchTab(e) {
      const path = e.currentTarget.dataset.path
      wx.switchTab({ url: path })
    },
  },
})
