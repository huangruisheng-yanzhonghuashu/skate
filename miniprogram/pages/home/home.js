const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { QQ_MAP_KEY } = require('../../utils/config.js')
const { ICON } = require('../../utils/icons.js')

const FILTERS = ['全部', '碗池', '街式', '平地', 'U池', '混合']

Page({
  data: {
    city: '嘉兴',
    cityOpen: false,
    cities: [],
    filters: FILTERS,
    filter: '全部',
    query: '',
    searchOpen: false,
    list: [],
    empty: false,
    venuesLoaded: false,
    markers: [],
    selectedVenueId: '',
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
    this._markerMap = []
    this._located = false
    this.loadVenues()
    /* 城市列表来自场地集合聚合 */
    cloud.getCities().then((cities) => {
      this.setData({ cities })
    })
    /* 手机定位：设置地图中心 + 自动匹配城市 */
    this.locate()
  },

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ selected: 0 })
    /* 场地数据 onLoad 已加载（云数据会话内不变），这里只刷新签到状态相关渲染，
     * 避免与 loadVenues 回调重复全量 setData */
    this.refresh()
    this.buildMarkers()
    this.startTick()
  },

  /* 云端场地列表（数据全部来源于云数据库） */
  loadVenues() {
    cloud.getVenues().then((venues) => {
      this._venues = venues
      if (!this._onlineInit) {
        venues.forEach((v) => { this._online[v.id] = v.online })
        this._onlineInit = true
      }
      /* 回退逻辑均以当前城市为准（refresh 尚未同步 data.city，直接读 store） */
      const currentCity = store.getCity()
      const cityVenues = venues.filter((v) => v.city === currentCity)
      /* 定位未成功时，地图中心回退到当前城市第一个场地（数据驱动） */
      if (!this._located && cityVenues.length) {
        this.setData({ latitude: cityVenues[0].latitude, longitude: cityVenues[0].longitude })
      }
      if (!cityVenues.some((v) => v.id === this.data.selectedVenueId) && cityVenues.length) {
        this.setData({ selectedVenueId: cityVenues[0].id })
      }
      this.refresh()
      this.buildMarkers()
    })
  },

  /* ===== 手机定位 ===== */
  /* 获取经纬度：成功则移动地图中心并尝试逆地理匹配城市 */
  locate() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this._located = true
        this.setData({ latitude: res.latitude, longitude: res.longitude, scale: 14 })
        this.autoMatchCity(res.latitude, res.longitude)
      },
      fail: (e) => {
        /* 用户拒绝授权或定位失败：保持默认中心（当前城市第一个场地） */
        const msg = (e && e.errMsg) || ''
        console.warn('[home] 定位失败，使用默认中心', msg)
        if (msg.indexOf('auth') >= 0 || msg.indexOf('deny') >= 0) {
          wx.showModal({
            title: '需要位置权限',
            content: '用于展示附近滑板场地与当前位置',
            confirmText: '去设置',
            success: (r) => {
              if (r.confirm) wx.openSetting()
            },
          })
        }
      },
    })
  },

  /* 逆地理编码：经纬度 → 城市名（需腾讯位置服务 Key，未配置时跳过） */
  autoMatchCity(latitude, longitude) {
    if (!QQ_MAP_KEY) return
    wx.request({
      url: 'https://apis.map.qq.com/ws/geocoder/v1/',
      data: {
        location: latitude + ',' + longitude,
        key: QQ_MAP_KEY,
        get_poi: 0,
      },
      success: (r) => {
        const ad = r.data && r.data.result && r.data.result.ad_info
        const city = ad && ad.city
        if (!city) return
        const name = city.replace(/市$/, '')
        /* 只自动切换到云端有场地数据的城市；无数据城市保持当前选择（地图仍定位到真实位置） */
        const known = this.data.cities || []
        if (name && name !== store.getCity() && known.indexOf(name) >= 0) {
          store.setCity(name)
          this.refresh()
          this.buildMarkers()
          wx.showToast({ title: '已定位到' + name, icon: 'none' })
        }
      },
      fail: (e) => {
        console.warn('[home] 逆地理编码失败', (e && e.errMsg) || e)
      },
    })
  },

  onHide() { this.stopTick() },
  onUnload() { this.stopTick() },

  /* 在线人数随机波动，营造"实时感" */
  startTick() {
    this.stopTick()
    this._timer = setInterval(() => {
      const list = this.data.list
      if (!list.length) return
      /* 只在当前渲染列表里随机选一条，定向更新单个字段，避免全量 setData */
      const i = Math.floor(Math.random() * list.length)
      const v = list[i]
      const next = Math.min(28, Math.max(1, (this._online[v.id] || v.online) + (Math.random() > 0.5 ? 1 : -1)))
      this._online[v.id] = next
      this.setData({ ['list[' + i + '].online']: next })
    }, 4000)
  },

  stopTick() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  },

  /* 滑板鞋 pin 标记：热门/今日已签到为橙色，其余水泥灰；选中项常驻气泡
   * 标记直接由云端场地数据生成，markerId 为序号，_markerMap 维护反查关系 */
  buildMarkers() {
    const selected = this.data.selectedVenueId
    const venues = (this._venues || []).filter((v) => v.city === this.data.city)
    this._markerMap = venues.map((v, i) => ({ markerId: i + 1, venueId: v.id }))
    const markers = venues.map((v, i) => {
      const active = v.hot || store.checkedToday(v.id)
      const marker = {
        id: i + 1,
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
    })
    this.setData({ markers })
  },

  /* 点标记：首次选中显示气泡，再点进入详情 */
  onMarkerTap(e) {
    const m = (this._markerMap || []).find((x) => x.markerId === e.detail.markerId)
    if (!m) return
    if (this.data.selectedVenueId === m.venueId) {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + m.venueId })
    } else {
      this.setData({ selectedVenueId: m.venueId })
      this.buildMarkers()
    }
  },

  /* 定位按钮：重新定位 + 城市匹配（onLoad 未授权时可从这里补授权） */
  onTapLocate() {
    this.locate()
    wx.showToast({ title: '正在定位...', icon: 'none' })
  },

  refresh() {
    const query = (this.data.query || '').trim()
    let arr = (this._venues || []).filter((v) => v.city === store.getCity())
    if (this.data.filter !== '全部') arr = arr.filter((v) => v.category === this.data.filter)
    if (query) arr = arr.filter((v) => v.name.indexOf(query) >= 0)
    /* 只传 venue-card 实际渲染的字段，剔除 photos 长URL、feed、坐标等大字段，减小 setData 体积 */
    const list = arr.map((v) => ({
      id: v.id,
      name: v.name,
      rating: v.rating,
      distance: v.distance,
      shortAddr: v.shortAddr,
      category: v.category,
      hot: v.hot,
      tags: v.tags,
      online: this._online ? this._online[v.id] : v.online,
      checked: store.checkedToday(v.id),
    }))
    this.setData({ list, empty: list.length === 0, venuesLoaded: true, city: store.getCity() })
  },

  /* 城市选择 */
  toggleCity() {
    this.setData({ cityOpen: !this.data.cityOpen })
  },

  pickCity(e) {
    const c = e.currentTarget.dataset.city
    store.setCity(c)
    /* 地图中心移到新城市第一个场地，并选中它 */
    const venue = (this._venues || []).find((v) => v.city === c)
    if (venue) this._located = false
    this.setData({ cityOpen: false })
    this.refresh()
    this.buildMarkers()
    if (venue) {
      this.setData({ latitude: venue.latitude, longitude: venue.longitude, scale: 13, selectedVenueId: venue.id })
    }
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
