const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { HEARTBEAT_INTERVAL_MS, PRESENCE_RADIUS_M } = require('../../utils/config.js')
const { fmtAgo } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')

/* 在场头像最多展示 4 个（真实心跳数据，超出折叠为 +N） */
const MAX_LIVE_AVATARS = 4

const REPORT_TYPES = ['地址错误', '已关闭', '设施损坏', '信息变更', '其他']

/* 连签徽章里程碑（签到成功弹层提示：再打 N 天解锁「M 日坚持」） */
const STREAK_MILESTONES = [3, 7, 30, 100]

/* 微博式打卡图布局：1 张 → 原比例单图；4 张 → 2×2 紧凑格；其余 → 3 列方格 */
function checkinPhotoLayout(photos) {
  const n = (photos || []).length
  if (n === 1) return 'one'
  if (n === 4) return 'four'
  return 'grid'
}

/* 状态栏高度（自定义导航：返回按钮悬浮定位用） */
function getStatusBarHeight() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    return info.statusBarHeight || 20
  } catch (e) {
    return 20
  }
}

/* 庆祝彩纸：14 片随机位置/颜色/时序（左起百分比，从顶部飘落） */
function buildConfetti() {
  const colors = ['#FF5A36', '#00D4AA', '#FFB800', '#2A8CFF', '#A06BFF', '#FF8A6E']
  const pieces = []
  for (let i = 0; i < 14; i++) {
    pieces.push({
      left: Math.round(4 + Math.random() * 92),
      delay: Math.round(Math.random() * 500),
      dur: 1400 + Math.round(Math.random() * 900),
      color: colors[i % colors.length],
      round: i % 3 === 0,
    })
  }
  return pieces
}

Page({
  data: {
    venue: null,
    photos: [],
    tags: [],
    current: 0,
    statusBarHeight: 20,
    distanceText: '',
    online: 0,
    presenceUsers: [],
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
      starOrange: ICON.starOrange,
      starGray: ICON.starGray,
      pin: ICON.pinOrangeSmall,
      send: ICON.sendOrange,
      check: ICON.checkWhite,
      checkWhite: ICON.checkWhite,
      flag: ICON.flagAsh,
      checkCircle: ICON.checkCircleOrange,
      edit: ICON.editAsh,
      plus: ICON.plusAsh,
      x: ICON.xWhite,
      imagePlus: ICON.imagePlusAsh,
      chevron: ICON.chevronRightAsh,
      back: ICON.chevronLeftWhite,
    },
  },

  onLoad(options) {
    /* 首页卡片「快捷签到」直达：详情页加载完成后自动打开签到弹层（2 步内完成） */
    this._autoCheckin = options.checkin === '1'
    this.setData({ statusBarHeight: getStatusBarHeight() })
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
        presenceUsers: [],
      })
      this.refresh()
      this.loadFeed()
      this.computeDistance()
      if (this._autoCheckin) {
        this._autoCheckin = false
        if (!store.checkedToday(venue.id)) this.openCheckin()
      }
    })
  },

  onShow() {
    if (this.data.venue) {
      this.refresh()
      this.loadFeed()
    }
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
          const u = store.getUser()
          cloud.heartbeat(v.id, { nickname: u.nickname, avatarFileID: u.avatarFileID }).catch((e) => {
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

  /* 当前场地真实在线人数 + 在场用户头像（30 分钟窗口内有心跳的独立用户） */
  refreshOnline() {
    const v = this.data.venue
    if (!v) return
    cloud.getOnlineCount(v.id).then((n) => {
      this.setData({ online: n, moreCount: Math.max(0, n - MAX_LIVE_AVATARS) })
    })
    cloud.getPresenceUsers(v.id).then((users) => {
      /* 文字头像色板轮换；fileID 头像直接用 image 渲染 */
      const palette = ['#FF5A36', '#2A8CFF', '#FFB800', '#00D4AA']
      const avatars = users.slice(0, MAX_LIVE_AVATARS).map((u, i) => ({
        text: (u.userName || '滑').slice(0, 1),
        avatarFile: u.avatarFileID || '',
        color: palette[i % palette.length],
      }))
      this.setData({ presenceUsers: avatars })
    })
  },

  /* 签到态 + 评分统计（真实均值/人数，无评分用预设分兜底） */
  refresh() {
    const venue = this.data.venue
    this.setData({ checked: store.checkedToday(venue.id) })
    cloud.getRatingStats('venue').then((map) => {
      const st = map[venue.id]
      this.setData({
        rating: st ? st.avg : venue.rating,
        ratingCount: st ? st.count : 0,
      })
    })
  },

  /* ===== 返回（自定义导航无系统返回键） ===== */
  goBack() {
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/home/home' }),
    })
  },

  /* 距离 pill：定位成功后算真实直线距离（失败静默隐藏） */
  computeDistance() {
    const v = this.data.venue
    if (!v) return
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const m = cloud.distanceM(res.latitude, res.longitude, v.latitude, v.longitude)
        this.setData({
          distanceText: m >= 1000 ? (m / 1000).toFixed(1) + 'km' : Math.round(m) + 'm',
        })
      },
      fail: () => { /* 无定位权限/失败：不显示距离 */ },
    })
  },

  /* ===== 评分弹窗 ===== */
  openRate() {
    cloud.getMyRating('venue', this.data.venue.id).then((my) => {
      this.setData({ rateOpen: true, rateStars: my || 0, myRating: my, rateSubmitting: false })
    })
  },

  closeRate() {
    if (this.data.rateSubmitting) return
    this.setData({ rateOpen: false })
  },

  /* 点第 N 颗星 → 前面 N 颗点亮（dataset 值可能是字符串，显式转数字） */
  pickStar(e) {
    this.setData({ rateStars: Number(e.currentTarget.dataset.star) })
  },

  submitRate() {
    if (this.data.rateSubmitting) return
    const score = this.data.rateStars
    if (!score) {
      wx.showToast({ title: '请先点亮星星', icon: 'none' })
      return
    }
    this.setData({ rateSubmitting: true })
    cloud.rateTarget('venue', this.data.venue.id, score).then(() => {
      this.setData({ rateOpen: false, rateSubmitting: false })
      wx.showToast({ title: '评分成功', icon: 'success' })
      this.refresh()
    }).catch((e) => {
      this.setData({ rateSubmitting: false })
      /* -502024/-501024 = 权限不足：提示去控制台设置集合权限 */
      const code = e && e.errCode
      if (code === -502024 || code === -501024 || (e && e.errMsg && e.errMsg.indexOf('permission') >= 0)) {
        wx.showToast({ title: '无写入权限：请在控制台将 ratings 权限设为「所有用户可读，仅创建者可写」', icon: 'none', duration: 3500 })
      } else {
        wx.showToast({ title: '评分失败，请重试', icon: 'none' })
      }
      console.error('[venue-detail] 评分失败', code, (e && e.errMsg) || e)
    })
  },

  loadFeed() {
    const venue = this.data.venue
    if (!venue) return
    cloud.getPlaceCheckins(venue.id, { noteOnly: true, limit: 3 }).then((feed) => {
      this.setData({
        feed: feed.map((f) => ({
          id: f.id,
          user: f.user,
          avatarFile: f.avatarFile,
          avatarText: f.avatarText,
          color: '#FF5A36',
          time: fmtAgo(f.at),
          note: f.note,
          photos: f.photos,
          layout: checkinPhotoLayout(f.photos),
          photoStyle: '',
        })),
      })
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

  /* ===== 签到弹窗（新增 / 补充今日打卡复用） ===== */
  openCheckin() {
    this._editId = ''
    this.setData({
      checkinOpen: true,
      checkinMode: 'new',
      note: '',
      checkinPhotos: [],
      checkinSubmitting: false,
    })
  },

  /* 补充今日打卡：预填当日记录的留言/照片（photos 为 fileID 直接回显） */
  openEditCheckin() {
    const rec = store.getTodayCheckin(this.data.venue.id)
    if (!rec) {
      this.refresh()
      return
    }
    this._editId = rec.id
    this.setData({
      checkinOpen: true,
      checkinMode: 'edit',
      note: rec.note || '',
      checkinPhotos: (rec.photos || []).slice(),
      checkinSubmitting: false,
    })
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

  /* 上传照片组：保留已上传的 fileID，只上传新选的临时文件，维持原顺序 */
  uploadMixedPhotos(photos) {
    const jobs = photos.map((p) => {
      if (p.indexOf('cloud://') === 0) return Promise.resolve(p)
      return cloud.uploadFileTo('checkin-photos', p)
    })
    return Promise.all(jobs)
  },

  confirmCheckin() {
    if (this.data.checkinSubmitting) return
    const v = this.data.venue
    const note = this.data.note.trim()
    const photos = this.data.checkinPhotos
    this.setData({ checkinSubmitting: true })
    const finish = (fileIDs) => {
      if (this._editId) {
        /* 补充打卡：更新当日记录（不新增，统计口径不变） */
        store.updateCheckin(this._editId, note, fileIDs).then(() => {
          this._editId = ''
          this.setData({ checkinOpen: false, checkinSubmitting: false, checkinPhotos: [], note: '' })
          wx.showToast({ title: '打卡已更新', icon: 'success' })
          this.refresh()
          this.loadFeed()
        })
        return
      }
      /* 新签到：本地立即生效，云端写入由 store 异步处理（失败自动排队重试） */
      store.addCheckin(v.id, v.name, note, fileIDs, 'venue')
      this.setData({ checkinOpen: false, checkinSubmitting: false, checkinPhotos: [], note: '' })
      this.showCelebrate()
      this.refresh()
      this.loadFeed()
    }
    if (photos.length) {
      /* 照片组：fileID 保留、临时文件上传，然后落库 */
      this.uploadMixedPhotos(photos)
        .then(finish)
        .catch((e) => {
          this.setData({ checkinSubmitting: false })
          wx.showToast({ title: '照片上传失败，请重试', icon: 'none' })
          console.warn('[venue-detail] 签到照片上传失败', (e && e.errCode) || (e && e.message))
        })
    } else {
      finish([])
    }
  },

  /* 查看该场地全部打卡 */
  showAllCheckins() {
    const v = this.data.venue
    wx.navigateTo({ url: '/pages/place-checkins/place-checkins?id=' + v.id + '&kind=venue' })
  },

  /* 签到成功庆祝（设计稿：彩纸 + 连续天数 + 下一个徽章提示），2.6s 自动消失 */
  showCelebrate() {
    const s = store.calcStats()
    const streak = s.streak
    const next = STREAK_MILESTONES.find((m) => m > streak)
    const sub = next
      ? '再打 ' + (next - streak) + ' 天解锁「' + next + ' 日坚持」徽章'
      : '全部徽章已解锁，滑手榜样！'
    this.setData({
      celebrate: true,
      celebrateStreak: streak,
      celebrateSub: sub,
      confetti: buildConfetti(),
    })
    if (this._celebrateTimer) clearTimeout(this._celebrateTimer)
    this._celebrateTimer = setTimeout(() => {
      this.setData({ celebrate: false })
    }, 2600)
  },

  /* 下拉刷新：重拉打卡流 + 在线数 + 签到态 */
  onPullDownRefresh() {
    this.refresh()
    this.loadFeed()
    this.refreshOnline()
    wx.stopPullDownRefresh()
  },

  /* 打卡照片预览 */
  previewFeedPhotos(e) {
    wx.previewImage({
      urls: e.currentTarget.dataset.urls,
      current: e.currentTarget.dataset.url,
    })
  },

  /* 微博式单图：按原图宽高比换算展示尺寸（宽封顶 420 / 高封顶 560，rpx） */
  onFeedPhotoLoad(e) {
    const { width, height } = e.detail
    const idx = e.currentTarget.dataset.fidx
    const item = this.data.feed[idx]
    if (!item || item.layout !== 'one' || !width || !height) return
    let w = 420
    let h = (420 * height) / width
    if (h > 560) {
      h = 560
      w = (560 * width) / height
    }
    this.setData({ [`feed[${idx}].photoStyle`]: `width:${Math.round(w)}rpx;height:${Math.round(h)}rpx;` })
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
    /* 先传云存储拿 fileID 再落库，photos 随报错一并写入 */
    const submit = (photos) => {
      cloud.addVenueReport({
        venueId: v.id,
        venueName: v.name,
        type: this.data.reportType,
        desc: this.data.reportDesc.trim(),
        photos: photos,
        status: 'pending',
        reply: '',
        replyAt: '',
        at: new Date().toISOString(),
      }).then(() => {
        this.setData({ reportOpen: false, reportSubmitting: false })
        wx.showToast({ title: '报错已提交', icon: 'success' })
      }).catch((e) => {
        this.setData({ reportSubmitting: false })
        wx.showToast({ title: '提交失败，请重试', icon: 'none' })
        console.warn('[venue-detail] 报错提交失败', (e && e.errCode) || (e && e.message))
      })
    }
    if (this.data.reportPhotos.length) {
      Promise.all(this.data.reportPhotos.map((p) => cloud.uploadFileTo('reports', p)))
        .then(submit)
        .catch((e) => {
          this.setData({ reportSubmitting: false })
          wx.showToast({ title: '图片上传失败，请重试', icon: 'none' })
          console.warn('[venue-detail] 报错图片上传失败', (e && e.errCode) || (e && e.message))
        })
    } else {
      submit([])
    }
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
})
