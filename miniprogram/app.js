// SkateSpot 小程序入口
const store = require('./utils/store.js')

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库版本过低，无法使用云开发能力，将使用本地数据')
      store.init()
      return
    }
    wx.cloud.init({
      env: 'cloud1-d4grizmp31acb587e',
      traceUser: true,
    })
    store.init()
  },
})
