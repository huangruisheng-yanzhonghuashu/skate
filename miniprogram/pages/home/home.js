const { MAP_MARKERS, CITIES } = require('../../data/mock.js')
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { ICON } = require('../../utils/icons.js')

const FILTERS = ['全部', '碗池', '街式', '平地', 'U池', '混合']

Page({
  data: {
    city: '上海',
    cityOpen: false,
    cities: CITIES,
    filters: FILTERS,
    filter: '全部',
    query: '',
    searchOpen: false,
    list: [],
    empty: false,
    markers: [],
    selectedVenueId: MAP_MARKERS[0].venueId,
    latitude: 31.2304,
    longitude: 121.48,
    scale: 13,
    icons: {
      pinWhite: ICON.pinWhite,
      chevronDown: ICON.chevronDownWhite,
      search: ICON.searchPh,
      xWhite: ICON.xWhite,
      venueFog: ICON.venueFog,
      locate: ICON.locateInk,
    },
  },

  onLoad() {
    this._online = {}
    this._onlineInit = false
    this._venues = []
    this.loadVenues()
  },

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ selected: 0 })
    this.loadVenues()
    this.refresh()
    this.buildMarkers()
    this.startTick()
  },

  /* 云端场地列表：云端优先，mock 降级 */
  loadVenues() {
    cloud.getVenues().then((venues) => {
      this._venues = venues
      if (!this._onlineInit) {
        venues.forEach((v) => { this._online[v.id] = v.online })
        this._onlineInit = true
      }
      this.refresh()
      this.buildMarkers()
    })
  },

  onHide() { this.stopTick() },
  onUnload() { this.stopTick() },

  /* 在线人数随机波动，营造"实时感" */
  startTick() {
    this.stopTick()
    this._timer = setInterval(() => {
      if (!this._venues.length) return
      const v = this._venues[Math.floor(Math.random() * this._venues.length)]
      const next = Math.min(28, Math.max(1, this._online[v.id] + (Math.random() > 0.5 ? 1 : -1)))
      this._online[v.id] = next
      const list = this.data.list.map((item) =>
        item.id === v.id ? { ...item, online: next } : item
      )
      this.setData({ list })
    }, 4000)
  },

  stopTick() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  },

  /* 滑板鞋 pin 标记：热门/今日已签到为橙色，其余水泥灰；选中项常驻气泡 */
  buildMarkers() {
    const selected = this.data.selectedVenueId
    const markers = MAP_MARKERS.map((m) => {
      const v = cloud.getCachedVenue(m.venueId)
      if (!v) return null
      const active = v.hot || store.checkedToday(v.id)
      const marker = {
        id: m.markerId,
        latitude: v.latitude,
        longitude: v.longitude,
        iconPath: active ? '/images/marker.png' : '/images/marker-gray.png',
        width: 44,
        height: 52,
        anchor: { x: 0.5, y: 1 },
      }
      if (v.id === selected) {
        marker.callout = {
          content: v.name + '\n距你 ' + v.distance,
          display: 'ALWAYS',
          color: '#1A1A1E',
          fontSize: 12,
          borderRadius: 8,
          borderWidth: 0,
          bgColor: '#FFFFFF',
          padding: 8,
          textAlign: 'center',
        }
      }
      return marker
    }).filter(Boolean)
    this.setData({ markers })
  },

  /* 点标记：首次选中显示气泡，再点进入详情 */
  onMarkerTap(e) {
    const m = MAP_MARKERS.find((x) => x.markerId === e.detail.markerId)
    if (!m) return
    if (this.data.selectedVenueId === m.venueId) {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + m.venueId })
    } else {
      this.setData({ selectedVenueId: m.venueId })
      this.buildMarkers()
    }
  },

  /* 回到当前定位 */
  onLocate() {
    if (!this._mapCtx) this._mapCtx = wx.createMapContext('map', this)
    this._mapCtx.moveToLocation()
    wx.showToast({ title: '已回到当前位置', icon: 'none' })
  },

  refresh() {
    const query = (this.data.query || '').trim()
    let arr = this._venues || []
    if (this.data.filter !== '全部') arr = arr.filter((v) => v.category === this.data.filter)
    if (query) arr = arr.filter((v) => v.name.indexOf(query) >= 0)
    const list = arr.map((v) => ({
      ...v,
      online: this._online ? this._online[v.id] : v.online,
      checked: store.checkedToday(v.id),
    }))
    this.setData({ list, empty: list.length === 0, city: store.getCity() })
  },

  /* 城市选择 */
  toggleCity() {
    this.setData({ cityOpen: !this.data.cityOpen })
  },

  pickCity(e) {
    const c = e.currentTarget.dataset.city
    store.setCity(c)
    this.setData({ cityOpen: false })
    this.refresh()
    wx.showToast({ title: '已切换到' + c, icon: 'none' })
  },

  /* 搜索 */
  openSearch() {
    this.setData({ searchOpen: true })
  },

  closeSearch() {
    this.setData({ searchOpen: false, query: '' })
    this.refresh()
  },

  onQueryInput(e) {
    this.setData({ query: e.detail.value })
    this.refresh()
  },

  clearQuery() {
    this.setData({ query: '' })
    this.refresh()
  },

  /* 筛选 */
  pickFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.filter })
    this.refresh()
  },
})
