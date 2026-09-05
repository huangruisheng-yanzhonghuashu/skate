/* 自定义导航工具（navigationStyle: custom 页面共用） */
/* 状态栏高度：返回按钮悬浮定位 / 标题栏占位用 */
function getStatusBarHeight() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    return info.statusBarHeight || 20
  } catch (e) {
    return 20
  }
}

/* 返回：无上级页面（如分享卡直达）时兜底回首页 */
function goBack() {
  wx.navigateBack({
    fail: () => wx.switchTab({ url: '/pages/home/home' }),
  })
}

module.exports = {
  getStatusBarHeight: getStatusBarHeight,
  goBack: goBack,
}
