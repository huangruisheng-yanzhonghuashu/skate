const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { HEARTBEAT_INTERVAL_MS, PRESENCE_RADIUS_M } = require('../../utils/config.js')
const { fmtAgo, toMedia } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')

/* 在场头像最多展示 4 个（真实心跳数据，超出折叠为 +N） */
const MAX_LIVE_AVATARS = 4

const REPORT_TYPES = ['地址错误', '已关闭', '设施损坏', '信息变更', '其他']

/* 连签徽章里程碑（签到成功弹层提示：再打 N 天解锁「M 日坚持」） */
const STREAK_MILESTONES = [3, 7, 30, 100]

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
    operatorShop: null,
    current: 0,
    statusBarHeight: 20,
    distanceText: '',
    online: 0,
    presenceUsers: [],
    moreCount: 0,
    feed: [],
    checked: false,
    /* 打卡弹窗 */
    checkinOpen: false,
    note: '',
    checkinMedia: [],
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
      camera: ICON.cameraOrange,
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
    /* 订阅 store 变更：视频后台异步上传完成后（notify）实时重载打卡动态，"上传中"角标消失 */
    this._unsubStore = store.subscribe(() => this.loadFeed())
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
      /* 运营方（org↔venue 关联）：有 operator 时解析机构供跳转 */
      if (venue.operator) {
        cloud.getShops().then((shops) => {
          const op = shops.find((s) => s.name === venue.operator)
          if (op) this.setData({ operatorShop: { id: op.id, name: op.name } })
        })
      }
      this.refresh()
      this.loadFeed()
      this.computeDistance()
      if (this._autoCheckin) {
        this._autoCheckin = false
        if (!store.checkedToday(venue.id)) this.doCheckin()
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
  onUnload() {
    this.stopPresence()
    if (this._unsubStore) this._unsubStore()
  },

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

  /* 运营方机构 → 机构详情 */
  goOperator() {
    const op = this.data.operatorShop
    if (op) wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + op.id })
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
    cloud.getPlaceCheckins(venue.id, { noteOnly: true, limit: 20 }).then((rows) => {
      /* 云写入是异步的（失败进重试队列）：合并本地本人打卡兜底，按 id 去重后时间倒序取前3。
       * 本人记录本地行优先：云 doc 在视频异步上传完成前 videos 为空，本地版本（含临时视频）是全集，
       * 若云端行胜出会导致刚发的视频从动态里消失 */
      const seen = {}
      const merged = []
      store.getLocalPlaceCheckins(venue.id, true).concat(rows).forEach((r) => {
        /* 双键去重：id + at|venueId（云端 _id 回填前本地是临时 id，防竞态期同条记录出现两次） */
        const k2 = r.at + '|' + r.venueId
        if (seen[r.id] || seen[k2]) return
        seen[r.id] = true
        seen[k2] = true
        merged.push(r)
      })
      merged.sort((a, b) => (a.at < b.at ? 1 : -1))
      this.setData({
        feed: merged.slice(0, 3).map((f) => ({
          id: f.id,
          openid: f.openid || '',
          own: store.hasCheckin(f.id),
          user: f.user,
          avatarFile: f.avatarFile,
          avatarText: f.avatarText,
          color: '#FF5A36',
          time: fmtAgo(f.at),
          skateYears: f.skateYears || 0,
          note: f.note,
          photos: f.photos,
          videos: f.videos,
          media: toMedia(f.photos, f.videos, f.mediaOrder),
        })),
      })
    })
  },

  onSwiperChange(e) {
    this.setData({ current: e.detail.current })
  },

  /* 打卡人头像/昵称 → 滑手主页（本人也进新页面：openid 缺失时兜底用本人 openid） */
  goUserProfile(e) {
    const d = e.currentTarget.dataset
    cloud.ensureOpenid().then((my) => {
      const openid = d.openid || my || ''
      wx.navigateTo({
        url: '/pages/user-profile/user-profile?openid=' + encodeURIComponent(openid) +
          '&u=' + encodeURIComponent(d.user || '') +
          '&avatar=' + encodeURIComponent(d.avatar || '') +
          '&years=' + encodeURIComponent(String(d.years || '')),
      })
    })
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

  /* ===== 一键签到（硬校验：定位在场地 PRESENCE_RADIUS_M 内才允许；无内容，计入统计/连签/排行） ===== */
  doCheckin() {
    const v = this.data.venue
    if (!v || this._checkinBusy) return
    this._checkinBusy = true
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this._checkinBusy = false
        const dist = cloud.distanceM(res.latitude, res.longitude, v.latitude, v.longitude)
        if (dist <= PRESENCE_RADIUS_M) {
          store.checkIn(v.id, v.name, 'venue', Math.round(dist))
          this.showCelebrate()
          this.refresh()
          return
        }
        wx.showModal({
          title: '无法签到',
          content: '你距「' + v.name + '」约 ' + (dist >= 1000 ? (dist / 1000).toFixed(1) + 'km' : Math.round(dist) + 'm') + '，需在现场才能签到。也可以先发一条打卡分享内容。',
          confirmText: '导航前往',
          cancelText: '我知道了',
          success: (r) => { if (r.confirm) this.openNav() },
        })
      },
      fail: () => {
        this._checkinBusy = false
        wx.showModal({
          title: '需要定位权限',
          content: '签到需开启定位以确认你在现场。也可以直接发打卡分享内容。',
          confirmText: '去开启',
          success: (r) => {
            if (!r.confirm) return
            wx.openSetting({
              success: (s) => { if (s.authSetting['scope.userLocation']) this.doCheckin() },
            })
          },
        })
      },
    })
  },

  /* ===== 打卡弹窗（发布 / 编辑复用；打卡带留言/媒体，可发多条，无需在现场） ===== */
  openPost() {
    this._editId = ''
    this.setData({
      checkinOpen: true,
      checkinMode: 'new',
      note: '',
      checkinMedia: [],
      checkinSubmitting: false,
    })
  },

  /* 编辑打卡：预填记录的留言/媒体（fileID 直接回显） */
  openEditPost(rec) {
    this._editId = rec.id
    this.setData({
      checkinOpen: true,
      checkinMode: 'edit',
      note: rec.note || '',
      checkinMedia: toMedia(rec.photos, rec.videos, rec.mediaOrder),
      checkinSubmitting: false,
    })
  },

  /* 长按自己的打卡卡片：编辑 / 删除（他人卡片无响应） */
  onPostLongPress(e) {
    const id = e.currentTarget.dataset.id
    if (!store.hasCheckin(id)) return
    const rec = store.getState().checkins.find((c) => c.id === id) || null
    wx.showActionSheet({
      itemList: ['编辑打卡', '删除打卡'],
      success: (r) => {
        if (r.tapIndex === 0) {
          if (rec) this.openEditPost(rec)
        } else if (r.tapIndex === 1) {
          wx.showModal({
            title: '删除打卡',
            content: '删除这条打卡？删除后不可恢复',
            confirmColor: '#E5484D',
            success: (m) => {
              if (!m.confirm) return
              store.deleteCheckin(id).then(() => {
                wx.showToast({ title: '已删除', icon: 'success' })
                this.loadFeed()
              })
            },
          })
        }
      },
      fail: () => { /* 用户取消 */ },
    })
  },

  closeCheckin() {
    if (this.data.checkinSubmitting) return
    this.setData({ checkinOpen: false })
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  /* 选媒体：图片 + 视频混选（微博式），图+视频合计上限 9 */
  chooseCheckinMedia() {
    const remain = 9 - this.data.checkinMedia.length
    if (remain <= 0) return
    wx.chooseMedia({
      count: remain,
      mediaType: ['mix'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const added = res.tempFiles.map((f) => ({
          type: f.fileType === 'video' ? 'video' : 'image',
          url: f.tempFilePath,
        }))
        this.setData({ checkinMedia: [...this.data.checkinMedia, ...added] })
      },
    })
  },

  removeCheckinMedia(e) {
    const i = e.currentTarget.dataset.index
    const media = [...this.data.checkinMedia]
    media.splice(i, 1)
    this.setData({ checkinMedia: media })
  },

  /* 拆分媒体为存储结构：photos（图片）/ videos（视频）/ order（混排顺序标记）。
   * 微博式：全部媒体后台异步上传（图片直接传、视频静默压缩后传），发布零等待 */
  splitCheckinMedia(media) {
    const photos = []
    const videos = []
    const order = []
    media.forEach((m) => {
      if (m.type === 'image') {
        order.push('p' + photos.length)
        photos.push(m.url)
      } else {
        order.push('v' + videos.length)
        videos.push(m.url)
      }
    })
    return { photos: photos, videos: videos, order: order }
  },

  confirmPost() {
    if (this.data.checkinSubmitting) return
    const v = this.data.venue
    const note = this.data.note.trim()
    const media = this.data.checkinMedia
    const submit = () => {
      const m = this.splitCheckinMedia(media)
      if (this._editId) {
        /* 编辑打卡：更新单条记录 */
        store.updatePost(this._editId, note, m.photos, m.videos, m.order).then(() => {
          this._editId = ''
          this.setData({ checkinOpen: false, checkinSubmitting: false, checkinMedia: [], note: '' })
          wx.showToast({ title: '打卡已更新', icon: 'success' })
          this.loadFeed()
        })
        return
      }
      /* 发布打卡：本地立即生效，媒体由 store 后台队列异步上云（零等待，失败自动排队续传） */
      store.addPost(v.id, v.name, note, m.photos, 'venue', m.videos, m.order)
      this.setData({ checkinOpen: false, checkinSubmitting: false, checkinMedia: [], note: '' })
      wx.showToast({ title: '打卡已发布', icon: 'success' })
      this.loadFeed()
    }
    /* 留言内容安全（复用 checkMsg 云函数，msgSecCheck v2） */
    if (note) {
      wx.cloud.callFunction({ name: 'checkMsg', data: { content: note } }).then((r) => {
        const res = (r && r.result) || {}
        if (!res.ok) {
          wx.showToast({ title: res.msg || '内容包含违规信息，请修改后发布', icon: 'none', duration: 3000 })
          return
        }
        submit()
      }).catch(() => submit()) /* 审核服务异常不阻塞发布（云函数侧已降级放行） */
    } else {
      submit()
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
      ? '再签 ' + (next - streak) + ' 天解锁「' + next + ' 日坚持」徽章'
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

  /* 打卡媒体预览（微博式混合查看器）：图视频混滑、视频封面点播不自动播放 */
  previewMedia(e) {
    const media = e.currentTarget.dataset.media || []
    const current = e.currentTarget.dataset.index || 0
    cloud.getMediaPreviewSources(media).then((sources) => {
      if (!sources.length) return
      this.setData({ viewerShow: true, viewerSources: sources, viewerCurrent: current })
    })
  },

  onViewerClose() {
    this.setData({ viewerShow: false })
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
