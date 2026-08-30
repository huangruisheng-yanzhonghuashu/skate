const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { HEARTBEAT_INTERVAL_MS, PRESENCE_RADIUS_M } = require('../../utils/config.js')
const { fmtAgo } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')

const LIVE_AVATARS = [
  { text: 'AK', color: '#FF5A36' },
  { text: 'LY', color: '#2A8CFF' },
  { text: 'MC', color: '#FFB800' },
  { text: 'JD', color: '#00D4AA' },
]

const REPORT_TYPES = ['地址错误', '已关闭', '设施损坏', '信息变更', '其他']

Page({
  data: {
    venue: null,
    photos: [],
    tags: [],
    current: 0,
    online: 0,
    liveAvatars: LIVE_AVATARS,
    moreCount: 0,
    feed: [],
    checked: false,
    /* 签到弹窗 */
    checkinOpen: false,
    note: '',
    checkinPhotos: [],
    checkinSubmitting: false,
    /* 报错弹窗 */
    reportOpen: false,
    reportTypes: REPORT_TYPES,
    reportType: '地址错误',
    reportDesc: '',
    reportError: false,
    reportPhotos: [],
    reportSubmitting: false,
    icons: {
      star: ICON.starAmber,
      pin: ICON.pinOrangeSmall,
      send: ICON.sendOrange,
      check: ICON.checkWhite,
      flag: ICON.flagAsh,
      checkCircle: ICON.checkCircleSuccess,
      edit: ICON.editAsh,
      plus: ICON.plusAsh,
      x: ICON.xWhite,
      imagePlus: ICON.imagePlusAsh,
      chevron: ICON.chevronRightAsh,
    },
  },

  onLoad(options) {
    cloud.getVenues().then((venues) => {
      const venue = venues.find((v) => v.id === options.id) || null
      if (!venue) {
        wx.showToast({ title: '场地不存在或已下线', icon: 'none' })
        setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 800)
        return
      }
      this.setData({
        venue,
        photos: venue.photos,
        tags: venue.tags.map((t) => ({ label: t.label, src: ICON[t.icon] || ICON.tagMixed })),
        online: 0,
        moreCount: 0,
      })
      wx.setNavigationBarTitle({ title: venue.name })
      this.refresh()
    })
  },

  onShow() {
    if (this.data.venue) this.refresh()
    this.startPresence()
  },

  onHide() { this.stopPresence() },
  onUnload() { this.stopPresence() },

  /* ===== 实时在线心跳（方案 B：定位在场校验 + 30 分钟窗口） ===== */
  /* 前台期间定时：定位 → 距场地 PRESENCE_RADIUS_M 内才上报心跳 → 刷新在线数 */
  startPresence() {
    this.stopPresence()
    this.tickPresence()
    this._presenceTimer = setInterval(() => this.tickPresence(), HEARTBEAT_INTERVAL_MS)
  },

  stopPresence() {
    if (this._presenceTimer) {
      clearInterval(this._presenceTimer)
      this._presenceTimer = null
    }
  },

  tickPresence() {
    const v = this.data.venue
    if (!v) return
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const dist = cloud.distanceM(res.latitude, res.longitude, v.latitude, v.longitude)
        /* 只统计真实在场的用户：距离超阈值不上报 */
        if (dist <= PRESENCE_RADIUS_M) {
          cloud.heartbeat(v.id).catch((e) => {
            console.warn('[venue-detail] 心跳上报失败', (e && e.errCode) || (e && e.message))
          })
        }
        this.refreshOnline()
      },
      fail: () => {
        /* 无定位权限/定位失败：不上报心跳（不算在场），但仍展示真实在线数 */
        this.refreshOnline()
      },
    })
  },

  /* 当前场地真实在线人数（30 分钟窗口内有心跳的独立用户） */
  refreshOnline() {
    const v = this.data.venue
    if (!v) return
    cloud.getOnlineCount(v.id).then((n) => {
      this.setData({ online: n, moreCount: Math.max(0, n - LIVE_AVATARS.length) })
    })
  },

  /* 打卡动态 = 用户真实签到(带留言) + 场地打卡动态，最近3条（用户签到带真实身份） */
  refresh() {
    const venue = this.data.venue
    const u = store.getUser()
    const mine = store
      .getState()
      .checkins.filter((c) => c.venueId === venue.id && c.note)
      .map((c) => ({
        user: u.nickname || '我',
        avatar: u.avatarFileID ? '' : (u.nickname || '我').slice(0, 1),
        avatarFile: u.avatarFileID,
        color: '#FF5A36',
        time: fmtAgo(c.at),
        text: c.note,
      }))
    this.setData({
      checked: store.checkedToday(venue.id),
      feed: [...mine, ...venue.feed].slice(0, 3),
    })
  },

  onSwiperChange(e) {
    this.setData({ current: e.detail.current })
  },

  /* 原生地图导航 */
  openNav() {
    const v = this.data.venue
    wx.openLocation({
      latitude: v.latitude,
      longitude: v.longitude,
      name: v.name,
      address: v.address,
      scale: 16,
    })
  },

  /* ===== 签到弹窗 ===== */
  openCheckin() {
    this.setData({ checkinOpen: true, note: '', checkinPhotos: [], checkinSubmitting: false })
  },

  closeCheckin() {
    if (this.data.checkinSubmitting) return
    this.setData({ checkinOpen: false })
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  chooseCheckinPhoto() {
    const remain = 9 - this.data.checkinPhotos.length
    if (remain <= 0) return
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const added = res.tempFiles.map((f) => f.tempFilePath)
        this.setData({ checkinPhotos: [...this.data.checkinPhotos, ...added] })
      },
    })
  },

  removeCheckinPhoto(e) {
    const i = e.currentTarget.dataset.index
    const photos = [...this.data.checkinPhotos]
    photos.splice(i, 1)
    this.setData({ checkinPhotos: photos })
  },

  confirmCheckin() {
    if (this.data.checkinSubmitting) return
    const v = this.data.venue
    /* 本地立即生效，云端写入由 store 异步处理（失败自动排队重试） */
    store.addCheckin(v.id, v.name, this.data.note.trim())
    this.setData({ checkinOpen: false, checkinSubmitting: false })
    wx.showToast({ title: '签到成功', icon: 'success' })
    this.refresh()
  },

  /* ===== 报错弹窗 ===== */
  openReport() {
    this.setData({
      reportOpen: true,
      reportType: '地址错误',
      reportDesc: '',
      reportError: false,
      reportPhotos: [],
      reportSubmitting: false,
    })
  },

  closeReport() {
    if (this.data.reportSubmitting) return
    this.setData({ reportOpen: false })
  },

  pickReportType(e) {
    this.setData({ reportType: e.currentTarget.dataset.type })
  },

  onReportInput(e) {
    this.setData({ reportDesc: e.detail.value, reportError: e.detail.value.trim() ? false : this.data.reportError })
  },

  chooseReportPhoto() {
    const remain = 3 - this.data.reportPhotos.length
    if (remain <= 0) return
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const added = res.tempFiles.map((f) => f.tempFilePath)
        this.setData({ reportPhotos: [...this.data.reportPhotos, ...added] })
      },
    })
  },

  removeReportPhoto(e) {
    const i = e.currentTarget.dataset.index
    const photos = [...this.data.reportPhotos]
    photos.splice(i, 1)
    this.setData({ reportPhotos: photos })
  },

  submitReport() {
    if (this.data.reportSubmitting) return
    if (!this.data.reportDesc.trim()) {
      this.setData({ reportError: true })
      return
    }
    this.setData({ reportSubmitting: true })
    const v = this.data.venue
    cloud.addVenueReport({
      venueId: v.id,
      venueName: v.name,
      type: this.data.reportType,
      desc: this.data.reportDesc.trim(),
      at: new Date().toISOString(),
    }).then(() => {
      this.setData({ reportOpen: false, reportSubmitting: false })
      wx.showToast({ title: '报错已提交', icon: 'success' })
    }).catch((e) => {
      this.setData({ reportSubmitting: false })
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
      console.warn('[venue-detail] 报错提交失败', (e && e.errCode) || (e && e.message))
    })
  },

  noop() {},

  /* 分享 */
  onShareAppMessage() {
    const v = this.data.venue
    return {
      title: '发现一个好场地：' + v.name,
      path: '/pages/venue-detail/venue-detail?id=' + v.id,
      imageUrl: v.photos[0],
    }
  },

  onShareTimeline() {
    const v = this.data.venue
    return { title: '发现一个好场地：' + v.name, query: 'id=' + v.id }
  },

  showAllCheckins() {
    wx.showToast({ title: '全部打卡列表即将开放', icon: 'none' })
  },
})
