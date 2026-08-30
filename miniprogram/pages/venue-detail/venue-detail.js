const { getVenue } = require('../../data/mock.js')
const store = require('../../utils/store.js')
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
    const venue = getVenue(options.id)
    if (!venue) {
      wx.showToast({ title: '场地不存在或已下线', icon: 'none' })
      setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 800)
      return
    }
    this._onlineBase = venue.online
    this.setData({
      venue,
      photos: venue.photos,
      tags: venue.tags.map((t) => ({ label: t.label, src: ICON[t.icon] || ICON.tagMixed })),
      online: venue.online,
      moreCount: Math.max(0, venue.online - LIVE_AVATARS.length),
    })
    wx.setNavigationBarTitle({ title: venue.name })
    this.refresh()
  },

  onShow() {
    if (this.data.venue) this.refresh()
    this.startTick()
  },

  onHide() { this.stopTick() },
  onUnload() { this.stopTick() },

  /* 在线人数随机波动 */
  startTick() {
    this.stopTick()
    this._timer = setInterval(() => {
      const next = Math.min(30, Math.max(1, this.data.online + (Math.random() > 0.5 ? 1 : -1)))
      this.setData({ online: next, moreCount: Math.max(0, next - LIVE_AVATARS.length) })
    }, 5000)
  },

  stopTick() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  },

  /* 打卡动态 = 用户真实签到(带留言) + mock，最近3条 */
  refresh() {
    const venue = this.data.venue
    const mine = store
      .getState()
      .checkins.filter((c) => c.venueId === venue.id && c.note)
      .map((c) => ({ user: '我', avatar: '张', color: '#FF5A36', time: fmtAgo(c.at), text: c.note }))
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
    this.setData({ checkinSubmitting: true })
    setTimeout(() => {
      const v = this.data.venue
      store.addCheckin(v.id, v.name, this.data.note.trim())
      this.setData({ checkinOpen: false, checkinSubmitting: false })
      wx.showToast({ title: '签到成功', icon: 'success' })
      this.refresh()
    }, 800)
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
    setTimeout(() => {
      this.setData({ reportOpen: false, reportSubmitting: false })
      wx.showToast({ title: '报错已提交', icon: 'success' })
    }, 800)
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
