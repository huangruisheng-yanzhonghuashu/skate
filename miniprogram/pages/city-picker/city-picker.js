const store = require('../../utils/store.js')
const { CITY_GROUPS, HOT_CITIES, searchCities } = require('../../utils/cities.js')
const { ICON } = require('../../utils/icons.js')

Page({
  data: {
    city: '',
    query: '',
    results: [],
    groups: CITY_GROUPS,
    hot: HOT_CITIES,
    letters: CITY_GROUPS.map(function (g) { return g.letter }),
    intoView: '',
    statusBarHeight: 20,
    icons: {
      chevronLeftWhite: ICON.chevronLeftWhite,
      search: ICON.searchPh,
      xWhite: ICON.xWhite,
      venueFog: ICON.venueFog,
    },
  },

  onLoad() {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ city: store.getCity(), statusBarHeight: (win && win.statusBarHeight) || 20 })
  },

  onReady() {
    /* 缓存字母导航条各元素的触区，供滑动选字母用 */
    wx.createSelectorQuery().in(this)
      .selectAll('.alpha-item')
      .boundingClientRect(function (rects) {
        this._alphaRects = rects
      }.bind(this))
      .exec()
  },

  /* 搜索：本地名称包含匹配 */
  onQueryInput(e) {
    const q = (e.detail.value || '').trim()
    this.setData({ query: q, results: searchCities(q), intoView: '' })
  },

  clearQuery() {
    this.setData({ query: '', results: [], intoView: '' })
  },

  /* 字母导航：点按跳转 */
  jumpLetter(e) {
    this.setData({ intoView: 'L' + e.currentTarget.dataset.letter })
  },

  /* 字母导航：滑动选择（touchstart/touchmove 复用，按触点命中的字母跳转） */
  onAlphaTouch(e) {
    const rects = this._alphaRects
    if (!rects || !rects.length || !e.touches || !e.touches.length) return
    const y = e.touches[0].clientY
    for (let i = 0; i < rects.length; i++) {
      if (y >= rects[i].top && y <= rects[i].bottom) {
        const letter = this.data.letters[i]
        if (letter && 'L' + letter !== this.data.intoView) {
          this.setData({ intoView: 'L' + letter })
        }
        return
      }
    }
  },

  /* 选中城市：写入全局 store（首页 onShow 检测变化后自动刷新）并返回 */
  pick(e) {
    const c = e.currentTarget.dataset.city
    if (!c) return
    const changed = c !== store.getCity()
    store.setCity(c)
    if (changed) wx.showToast({ title: '已切换到' + c, icon: 'none' })
    wx.navigateBack()
  },

  goBack() {
    wx.navigateBack()
  },
})
