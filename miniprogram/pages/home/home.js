const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { QQ_MAP_KEY } = require('../../utils/config.js')
const qqmap = require('../../utils/qqmap.js')
const { ICON } = require('../../utils/icons.js')

const FIELD_FILTERS = ['全部', '碗池', '街式', '平地', 'U池', '混合']
/* 机构（shop 实体）双维筛选：category 三分为主、services 可选叠加（toggle，无「全部」占位） */
const ORG_CATEGORY_FILTERS = ['全部', '板店', '俱乐部', '培训机构']
const ORG_SERVICE_FILTERS = ['卖板', '教学', '维修', '配件', '服装', '组织活动', '装备租赁', '场地运营']

/* HH:mm（今日已签到时间展示用） */
function fmtHm(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return pad(d.getHours()) + ':' + pad(d.getMinutes())
}

/* 两坐标球面距离（米）：最近场地推断城市用 */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.asin(Math.sqrt(a))
}

Page({
  data: {
    city: '嘉兴',
    entity: 'venue',
    filters: FIELD_FILTERS,
    filter: '全部',
    svcFilters: [],
    svcFilter: '',
    query: '',
    searchOpen: false,
    list: [],
    empty: false,
    loaded: false,
    mapCount: 0,
    locating: true,
    mapCollapsed: false,
    markers: [],
    selectedVenueId: '',
    latitude: 31.2304,
    longitude: 121.48,
    scale: 13,
    icons: {
      pinWhite: ICON.pinWhite,
      pinOrange: ICON.pinOrangeSmall,
      swap: ICON.swapWhite,
      search: ICON.searchPh,
      xWhite: ICON.xWhite,
      venueFog: ICON.venueFog,
    },
  },

  onLoad() {
    this._online = {}
    this._venues = []
    this._shops = []
    this._markerMap = []
    this._located = false
    this._venuesLoaded = false
    this._shopsLoaded = false
    this._loc = null
    this._geoDone = false
    this._geoCity = null
    this.loadVenues()
    this.loadShops()
    /* 用户评分统计 */
    this.refreshRatings()
    /* 手机定位：设置地图中心 + 自动匹配城市 */
    this.locate()
  },

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ selected: 0 })
    /* 城市选择页返回：检测城市变化，地图中心移到新城市（refresh 内会同步 data.city） */
    const cityChanged = store.getCity() !== this.data.city
    /* 数据 onLoad 已加载（云数据会话内不变，管理页改动会刷新 cloud 缓存），这里只刷新渲染 */
    this.refresh()
    this.buildMarkers()
    this.refreshOnline()
    if (cityChanged) this.centerOnCity()
  },

  /* 云端场地列表（数据全部来源于云数据库） */
  loadVenues() {
    cloud.getVenues().then((venues) => {
      /* 只保留上架状态（status !== 'off'，旧数据无 status 视为上架），下架场地列表/地图/城市推断全不可见 */
      this._venues = venues.filter((v) => v.status !== 'off')
      /* 在线人数：种子热度值先兜底，真实心跳数据随后覆盖 */
      venues.forEach((v) => { this._online[v.id] = v.online })
      this._venuesLoaded = true
      this.setData({ loaded: this._venuesLoaded && this._shopsLoaded })
      this.centerOnCityIfNeeded(venues)
      /* 定位城市应用（场地/店铺都就位后执行，避免基于不完整数据推断） */
      this.tryLocateCity()
      this.refresh()
      this.buildMarkers()
      this.refreshOnline()
    })
  },

  /* 云端店铺列表 */
  loadShops() {
    cloud.getShops().then((shops) => {
      /* 同场地：只保留上架门店/俱乐部 */
      this._shops = shops.filter((v) => v.status !== 'off')
      this._shopsLoaded = true
      this.setData({ loaded: this._venuesLoaded && this._shopsLoaded })
      this.tryLocateCity()
      this.refresh()
      this.buildMarkers()
    })
  },

  /* 定位未成功时，地图中心回退到当前城市第一个场地 */
  centerOnCityIfNeeded(venues) {
    if (this._located) return
    const currentCity = store.getCity()
    const cityVenues = venues.filter((v) => v.city === currentCity)
    if (!cityVenues.length) return
    this.setData({ latitude: cityVenues[0].latitude, longitude: cityVenues[0].longitude })
    const any = cityVenues.some((v) => v.id === this.data.selectedVenueId)
    if (!any) this.setData({ selectedVenueId: cityVenues[0].id })
  },

  /* 真实在线人数：一次聚合查询所有场地的窗口内心跳分布，覆盖列表显示 */
  refreshOnline() {
    cloud.getOnlineMap().then((map) => {
      if (!map) return /* 查询失败（如权限未配置），保留兜底热度值 */
      ;(this._venues || []).forEach((v) => { this._online[v.id] = map[v.id] || 0 })
      this.refresh()
    })
  },

  /* 用户评分统计：真实均值/人数覆盖卡片与详情显示（无评分时用种子预设分兜底） */
  refreshRatings() {
    Promise.all([cloud.getRatingStats('venue'), cloud.getRatingStats('shop')]).then((rs) => {
      this._venueRatings = rs[0]
      this._shopRatings = rs[1]
      this.refresh()
    })
  },

  /* ===== 手机定位 ===== */
  /* 获取经纬度：成功则移动地图中心并尝试逆地理匹配城市 */
  locate() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this._located = true
        this._loc = { latitude: res.latitude, longitude: res.longitude }
        this.setData({ latitude: res.latitude, longitude: res.longitude, scale: 14, locating: false })
        this.autoMatchCity(res.latitude, res.longitude)
      },
      fail: (e) => {
        /* 用户拒绝授权或定位失败：保持默认中心（当前城市第一个场地） */
        this.setData({ locating: false })
        const msg = (e && e.errMsg) || ''
        console.warn('[home] 定位失败，使用默认中心', msg)
        if (msg.indexOf('auth') >= 0 || msg.indexOf('deny') >= 0) {
          wx.showModal({
            title: '需要位置权限',
            content: '用于展示附近场地与当前位置',
            confirmText: '去设置',
            success: (r) => {
              if (r.confirm) wx.openSetting()
            },
          })
        }
      },
    })
  },

  /* 经纬度 → 城市名，两级策略：
   * 1) 配置了腾讯位置服务 Key 时走逆地理编码（精确到城市）
   * 2) 无 Key 或请求失败时，用「最近的场地/店铺」所在城市兜底（零配置可用） */
  autoMatchCity(latitude, longitude) {
    if (!QQ_MAP_KEY) {
      this.tryLocateCity()
      return
    }
    qqmap.request('/ws/geocoder/v1/', {
      location: latitude + ',' + longitude,
      key: QQ_MAP_KEY,
      get_poi: 0,
    }).then((result) => {
      const city = result && result.ad_info && result.ad_info.city
      if (!city) {
        this.tryLocateCity()
        return
      }
      this._geoDone = true
      this._geoCity = city.replace(/市$/, '')
      this.applyGeoCityIfKnown()
    }).catch((e) => {
      console.warn('[home] 逆地理编码失败，回退最近场地推断', (e && e.message) || e)
      this.tryLocateCity()
    })
  },

  /* 定位城市应用（统一入口，防竞态）：
   * 逆地理已出结果 → 云端存在该城市才自动切换（避免切到无数据城市出现空首页）
   * 逆地理未出结果 → 场地/店铺都加载完后用最近实体所在城市兜底 */
  tryLocateCity() {
    if (!this._loc) return
    if (this._geoDone) {
      this.applyGeoCityIfKnown()
      return
    }
    if (!(this._venuesLoaded && this._shopsLoaded)) return
    this.inferNearestCity()
  },

  /* 逆地理城市应用：云端有该城市数据才切换；数据未就位时由 loadVenues/loadShops 补调 */
  applyGeoCityIfKnown() {
    const name = this._geoCity
    if (!name || name === store.getCity()) return
    const known = (this._venues || []).concat(this._shops || []).some((v) => v.city === name)
    if (!known) return
    store.setCity(name)
    this.refresh()
    this.buildMarkers()
    wx.showToast({ title: '已定位到' + name, icon: 'none' })
  },

  /* 最近场地/店铺推断城市：定位成功后取球面距离最近实体所在城市
   * 场地数据未就位时跳过（tryLocateCity 会在两实体都就位后调用） */
  inferNearestCity() {
    const loc = this._loc
    if (!loc || this._geoDone) return
    const all = (this._venues || []).concat(this._shops || [])
      .filter((v) => v.latitude && v.longitude && v.city)
    if (!all.length) return
    let best = null
    let bestD = Infinity
    all.forEach((v) => {
      const d = haversine(loc.latitude, loc.longitude, v.latitude, v.longitude)
      if (d < bestD) {
        bestD = d
        best = v
      }
    })
    this._geoDone = true
    if (best.city !== store.getCity()) {
      store.setCity(best.city)
      this.refresh()
      this.buildMarkers()
      wx.showToast({ title: '已定位到' + best.city, icon: 'none' })
    }
  },

  onHide() {},
  onUnload() {},

  /* 地图折叠/展开：点击分隔手柄切换（收起后列表全屏，地图实例保留不销毁） */
  toggleMap() {
    this.setData({ mapCollapsed: !this.data.mapCollapsed })
  },

  /* 下拉刷新：强制重拉云端两实体 + 在线数 + 评分统计 */
  onPullDownRefresh() {
    Promise.all([cloud.getVenues(true), cloud.getShops(true)]).then((rs) => {
      this._venues = rs[0].filter((v) => v.status !== 'off')
      this._shops = rs[1].filter((v) => v.status !== 'off')
      rs[0].forEach((v) => { this._online[v.id] = v.online })
      this.refresh()
      this.buildMarkers()
      this.refreshOnline()
      this.refreshRatings()
      wx.stopPullDownRefresh()
      wx.showToast({ title: '已刷新', icon: 'none' })
    }).catch(() => {
      wx.stopPullDownRefresh()
      wx.showToast({ title: '刷新失败，请重试', icon: 'none' })
    })
  },

  /* 滑板鞋 pin 标记（场地）：热门/今日已签到为橙色，其余水泥灰
   * 店铺 pin 复用同一套图标，靠气泡"[店铺]"前缀区分；选中项常驻气泡
   * 与列表同口径过滤（城市+筛选+搜索），保证地图与列表认知一致 */
  buildMarkers() {
    const selected = this.data.selectedVenueId
    const entity = this.data.entity
    const src = (entity === 'venue' ? this._venues : this._shops) || []
    const query = (this.data.query || '').trim()
    let items = src.filter((v) => v.city === this.data.city)
    /* 无坐标实体无法上地图（导入数据待「地图选点」补坐标），markers 只要有坐标的 */
    items = items.filter((v) => typeof v.latitude === 'number' && typeof v.longitude === 'number')
    if (entity === 'venue' && this.data.filter !== '全部') {
      items = items.filter((v) => v.category === this.data.filter)
    }
    if (entity === 'shop' && this.data.filter !== '全部') {
      items = items.filter((s) => (s.category || '俱乐部') === this.data.filter)
    }
    if (entity === 'shop' && this.data.svcFilter) {
      items = items.filter((s) => (s.services || []).indexOf(this.data.svcFilter) >= 0)
    }
    if (query) {
      items = items.filter((v) =>
        v.name.indexOf(query) >= 0 || (entity === 'shop' && (v.address || '').indexOf(query) >= 0)
      )
    }
    this._markerMap = items.map((v, i) => ({ markerId: i + 1, kind: entity, id: v.id }))
    const markers = items.map((v, i) => {
      const isVenue = entity === 'venue'
      const active = isVenue ? (v.hot || store.checkedToday(v.id)) : v.hot
      const marker = {
        id: i + 1,
        latitude: v.latitude,
        longitude: v.longitude,
        iconPath: active ? '/images/marker.png' : '/images/marker-gray.png',
        /* 设计稿 pin 尺寸适中；选中项略大突出 */
        width: v.id === selected ? 42 : 36,
        height: v.id === selected ? 49 : 42,
        anchor: { x: 0.5, y: 1 },
      }
      if (v.id === selected) {
        marker.callout = {
          content: (isVenue ? '' : '[俱乐部] ') + v.name + ' ›',
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

  /* 点标记：首次选中显示气泡，再点进入对应详情页 */
  onMarkerTap(e) {
    const m = (this._markerMap || []).find((x) => x.markerId === e.detail.markerId)
    if (!m) return
    if (this.data.selectedVenueId === m.id) {
      const url = m.kind === 'shop'
        ? '/pages/shop-detail/shop-detail?id=' + m.id
        : '/pages/venue-detail/venue-detail?id=' + m.id
      wx.navigateTo({ url: url })
    } else {
      this.setData({ selectedVenueId: m.id })
      this.buildMarkers()
    }
  },

  /* 实体切换：场地 ⇄ 门店与俱乐部（设计稿交互规则：保留搜索词，不打断搜索流） */
  switchEntity(e) {
    const entity = e.currentTarget.dataset.entity
    if (entity === this.data.entity) return
    this.setData({
      entity: entity,
      filters: entity === 'shop' ? ORG_CATEGORY_FILTERS : FIELD_FILTERS,
      filter: '全部',
      svcFilters: entity === 'shop' ? ORG_SERVICE_FILTERS : [],
      svcFilter: '',
      selectedVenueId: '',
    })
    this.refresh()
    this.buildMarkers()
  },

  /* 定位按钮：重新定位 + 城市匹配（onLoad 未授权时可从这里补授权） */
  onTapLocate() {
    this.locate()
    wx.showToast({ title: '正在定位...', icon: 'none' })
  },

  refresh() {
    const query = (this.data.query || '').trim()
    const city = store.getCity()
    let list = []
    if (this.data.entity === 'venue') {
      let arr = (this._venues || []).filter((v) => v.city === city)
      if (this.data.filter !== '全部') arr = arr.filter((v) => v.category === this.data.filter)
      if (query) arr = arr.filter((v) => v.name.indexOf(query) >= 0)
      /* 只传 venue-card 实际渲染的字段，减小 setData 体积 */
      /* 评分：有用户评分用真实均值（+人数），无则种子预设分 */
      list = arr.map((v) => {
        const st = this._venueRatings && this._venueRatings[v.id]
        const today = store.getTodayCheckin(v.id)
        /* 评分统一一位小数展示（设计稿 4.5/4.2 样式；整数种子分补 .0，无评分为 0 走「暂无」） */
        const rating = st ? st.avg : v.rating
        return {
          id: v.id,
          name: v.name,
          rating: rating ? Number(rating).toFixed(1) : 0,
          ratingCount: st ? st.count : 0,
          distance: v.distance,
          shortAddr: v.shortAddr,
          category: v.category,
          hot: v.hot,
          tags: v.tags,
          photo: (v.photos && v.photos[0]) || '',
          online: this._online ? this._online[v.id] : v.online,
          checked: !!today,
          checkedTime: today ? fmtHm(today.at) : '',
        }
      })
    } else {
      let arr = (this._shops || []).filter((s) => s.city === city)
      /* category 三分筛选（旧数据无 category 视为俱乐部，保持向后兼容）；
       * chips 动态收敛：当前城市没有的机构类型不渲染，避免「点了必空态」 */
      const present = []
      ;(this._shops || []).forEach((s) => {
        if (s.city === city && s.category && present.indexOf(s.category) < 0) present.push(s.category)
      })
      const chips = ['全部'].concat(present)
      if (chips.join('|') !== this.data.filters.join('|')) {
        this.setData({ filters: chips, filter: chips.indexOf(this.data.filter) >= 0 ? this.data.filter : '全部' })
      }
      if (this.data.filter !== '全部') arr = arr.filter((s) => (s.category || '俱乐部') === this.data.filter)
      if (this.data.svcFilter) arr = arr.filter((s) => (s.services || []).indexOf(this.data.svcFilter) >= 0)
      if (query) arr = arr.filter((s) => s.name.indexOf(query) >= 0 || (s.address || '').indexOf(query) >= 0)
      list = arr.map((s) => {
        const st = this._shopRatings && this._shopRatings[s.id]
        return {
          id: s.id,
          name: s.name,
          category: s.category || '俱乐部',
          services: s.services || [],
          shortAddr: s.shortAddr,
          address: s.address,
          phone: s.phone || '',
          hours: s.hours,
          hot: s.hot,
          rating: st ? st.avg : 0,
          ratingCount: st ? st.count : 0,
        }
      })
    }
    /* 地图计数 chip：当前城市该实体总数（不受筛选/搜索影响，与设计稿「嘉兴 · 12 个场地」一致） */
    const cityTotal = this.data.entity === 'venue'
      ? (this._venues || []).filter((v) => v.city === city).length
      : (this._shops || []).filter((s) => s.city === city).length
    this.setData({ list, empty: list.length === 0, city: city, mapCount: cityTotal })
    /* 列表与地图保持同口径（搜索/筛选/切城后 markers 跟随） */
    this.buildMarkers()
  },

  /* 城市选择：跳转城市选择页（搜索/热门/字母索引，选中后写入 store 返回） */
  goCityPicker() {
    wx.navigateTo({ url: '/pages/city-picker/city-picker' })
  },

  /* 推荐场地、门店与俱乐部入口（列表底部/空态引导） */
  goRecommend() {
    wx.navigateTo({ url: '/pages/recommend/recommend' })
  },

  /* 城市切换后：地图中心移到新城市第一个实体（当前实体优先，另一实体兜底）
   * 无场地的城市保持当前地图中心，列表按城市过滤自然呈现空态 */
  centerOnCity() {
    const c = this.data.city
    const first = this.data.entity === 'shop'
      ? ((this._shops || []).find((v) => v.city === c) || (this._venues || []).find((v) => v.city === c))
      : ((this._venues || []).find((v) => v.city === c) || (this._shops || []).find((v) => v.city === c))
    if (!first) return
    this._located = false
    this.setData({ latitude: first.latitude, longitude: first.longitude, scale: 13, selectedVenueId: '' })
  },

  /* 搜索 */
  openSearch() {
    this.setData({ searchOpen: true })
  },

  closeSearch() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer)
      this._searchTimer = null
    }
    this.setData({ searchOpen: false, query: '' })
    this.refresh()
  },

  onQueryInput(e) {
    this.setData({ query: e.detail.value })
    /* 250ms 防抖：避免逐字符全量重建列表 + markers */
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null
      this.refresh()
    }, 250)
  },

  clearQuery() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer)
      this._searchTimer = null
    }
    this.setData({ query: '' })
    this.refresh()
  },

  /* 列表项点击：按实体进对应详情页 */
  goDetail(e) {
    const id = e.detail.id
    if (this.data.entity === 'shop') {
      wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + id })
    }
  },

  /* 筛选 */
  pickFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.filter })
    this.refresh()
  },

  /* 服务筛选（机构 Tab 第二行 chips）：toggle 语义，再点取消，不选=全部 */
  pickSvc(e) {
    const v = e.currentTarget.dataset.filter
    this.setData({ svcFilter: this.data.svcFilter === v ? '' : v })
    this.refresh()
  },

  /* 空态「查看全部」：重置筛选（按钮 bindtap，无 dataset） */
  resetFilter() {
    this.setData({ filter: '全部', svcFilter: '' })
    this.refresh()
  },

  /* 列表点击：同步地图选中（marker 放大 + 常驻气泡），再由卡片自身逻辑进详情 */
  syncSelection(e) {
    const id = e.currentTarget.dataset.id
    if (!id || id === this.data.selectedVenueId) return
    this.setData({ selectedVenueId: id })
    this.buildMarkers()
  },
})
