// 滑哪儿 小程序入口
const store = require('./utils/store.js')
const { BRAND_FONT_URL } = require('./utils/config.js')

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
    /* 品牌字体（得意黑）：全局注册，首页字标等处引用；加载失败静默回退系统粗体 */
    if (BRAND_FONT_URL) {
      wx.loadFontFace({
        global: true,
        family: 'Smiley Sans',
        source: 'url("' + BRAND_FONT_URL + '")',
        fail: function () { /* 静默降级，不影响功能 */ },
      })
    }
  },
})
