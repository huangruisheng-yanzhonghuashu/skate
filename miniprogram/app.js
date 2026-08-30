// SkateSpot 小程序入口
const store = require('./utils/store.js')

App({
  onLaunch() {
    store.init()
  },
})
