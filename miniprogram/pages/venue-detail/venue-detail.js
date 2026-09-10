const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { PRESENCE_RADIUS_M } = require('../../utils/config.js')
const { fmtAgo, toMedia } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')
const mediaPick = require('../../utils/media-pick.js')
const preview = require('../../utils/preview.js')

const REPORT_TYPES = ['地址错误', '已关闭', '设施损坏', '信息变更', '其他']

/* 状态栏高度（自定义导航：返回按钮悬浮定位用） */
function getStatusBarHeight() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    return info.statusBarHeight || 20
  } catch (e) {
    return 20
  }
}

Page({
  data: {
    venue: null,
    photos: [],
    tags: [],
    tagMore: 0,
    hot: false,
    operatorShop: null,
    current: 0,
    statusBarHeight: 20,
    distanceText: '',
    rating: '',
    ratingCount: 0,
    rateInt: 0,
    feed: [],
    /* 今日打卡卡（设计稿 v1.1 ③：今日 N 位滑手打卡 + 头像×4 + 折叠+N） */
    todayCount: 0,
    todayAvatars: [],
    todayMore: 0,
    checked: false,
    /* 打卡弹窗 */
    checkinOpen: false,
    note: '',
    checkinMedia: [],
    checkinMediaMode: '', /* '' 未定 / image 图片态 / video 视频态（图视频互斥） */
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
      starDarkGray: ICON.starDarkGray,
      pin: ICON.pinOrangeSmall,
      send: ICON.sendGray,
      check: ICON.checkWhite,
      checkWhite: ICON.checkWhite,
      camera: ICON.cameraWhite,
      cameraRose: ICON.cameraRose,
      play: ICON.playWhite,
      flag: ICON.flagDim,
      checkCircle: ICON.checkCircleOrange,
      edit: ICON.editAsh,
      plus: ICON.plusAsh,
      x: ICON.xWhite,
      imagePlus: ICON.imagePlusAsh,
      imageDim: ICON.imageDim,
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
        /* 标签最多 3 个平铺，溢出折叠 +N（规范 4.3：禁止超过 3 个平铺） */
        tags: venue.tags.slice(0, 3).map((t) => ({ label: t.label, src: ICON[t.icon] || ICON.tagMixed })),
        tagMore: Math.max(0, venue.tags.length - 3),
        hot: !!venue.hot,
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
    if (this._backFromVideoPreview) {
      this._backFromVideoPreview = false
      return /* 视频预览返回：不重拉签到态与打卡流 */
    }
    if (this.data.venue) {
      this.refresh()
      this.loadFeed()
    }
  },

  onHide() {},
  onUnload() {
    if (this._unsubStore) this._unsubStore()
    if (this._celebrateTimer) clearTimeout(this._celebrateTimer)
    if (this._celebrateOutTimer) clearTimeout(this._celebrateOutTimer)
  },

  /* 签到态 + 评分统计（真实均值/人数，无评分用预设分兜底；离散星取整下限点亮） */
  refresh() {
    const venue = this.data.venue
    this.setData({ checked: store.checkedToday(venue.id) })
    this.loadToday()
    cloud.getRatingStats('venue').then((map) => {
      const st = map[venue.id]
      const rating = st ? st.avg : venue.rating
      this.setData({
        rating: rating ? Math.round(rating * 10) / 10 : '',
        ratingCount: st ? st.count : 0,
        rateInt: Math.min(5, Math.max(0, Math.floor(rating || 0))),
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

  /* 今日打卡卡：今日该场地打卡/签到的去重滑手（与首页「今日 N 人打过卡」同口径），
   * 头像取今日记录（同一滑手取最近一条），×4 平铺 + 折叠 +N */
  loadToday() {
    const venue = this.data.venue
    if (!venue) return
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    cloud.getVenueTodayCheckins(venue.id, dayStart.toISOString()).then((rows) => {
      this.setData({
        todayCount: rows.length,
        todayAvatars: rows.slice(0, 4).map((r) => ({
          openid: r.openid,
          avatarFile: r.avatarFile,
          avatarText: r.avatarText,
          color: '#FF5A36',
        })),
        todayMore: Math.max(0, rows.length - 4),
      })
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
    const v = this.data.venue
    /* 打卡门槛：所选地点近 7 天必须有本人签到记录（新发布时校验，编辑已发打卡不受限） */
    if (!store.checkedWithinDays(v.id, 7)) {
      wx.showModal({
        title: '无法打卡',
        content: '近 7 天没有在「' + v.name + '」的签到记录，先到场签到后才能打卡。',
        confirmText: '去签到',
        cancelText: '我知道了',
        success: (r) => { if (r.confirm) this.doCheckin() },
      })
      return
    }
    this._editId = ''
    this.setData({
      checkinOpen: true,
      checkinMode: 'new',
      note: '',
      checkinMedia: [],
      checkinMediaMode: '',
      checkinSubmitting: false,
    })
  },

  /* 编辑打卡：预填记录的留言/媒体（fileID 直接回显） */
  openEditPost(rec) {
    this._editId = rec.id
    const media = toMedia(rec.photos, rec.videos, rec.mediaOrder)
    this.setData({
      checkinOpen: true,
      checkinMode: 'edit',
      note: rec.note || '',
      checkinMedia: media,
      checkinMediaMode: mediaPick.modeOf(media),
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

  /* 选媒体（图/视频互斥：图≤9张 或 视频1个），选择规则统一在 utils/media-pick.js */
  chooseCheckinMedia() {
    mediaPick.pick(this.data.checkinMedia).then(({ added }) => {
      if (added.length) {
        this._setCheckinMedia([...this.data.checkinMedia, ...added])
      }
    }).catch((e) => {
      wx.showToast({ title: (e && e.msg) || '选择失败，请重试', icon: 'none' })
    })
  },

  /* 媒体统一写入口：同步派生媒体模式驱动添加格文案与视频大格形态 */
  _setCheckinMedia(media) {
    const list = media.map((m) => (
      m.type === 'video' && !m.durationText
        ? { ...m, durationText: mediaPick.fmtDuration(m.duration) }
        : m
    ))
    this.setData({ checkinMedia: list, checkinMediaMode: mediaPick.modeOf(list) })
  },

  removeCheckinMedia(e) {
    const i = e.currentTarget.dataset.index
    const media = [...this.data.checkinMedia]
    media.splice(i, 1)
    this._setCheckinMedia(media)
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
    /* 留言必填 */
    if (!note) {
      wx.showToast({ title: '说点什么后再发布', icon: 'none' })
      return
    }
    /* 媒体互斥硬校验（防状态被绕过），正常流程触不到 */
    const invalidMsg = mediaPick.validate(media)
    if (invalidMsg) {
      wx.showToast({ title: invalidMsg, icon: 'none' })
      return
    }
    const submit = () => {
      const m = this.splitCheckinMedia(media)
      if (this._editId) {
        /* 编辑打卡：更新单条记录 */
        store.updatePost(this._editId, note, m.photos, m.videos, m.order).then(() => {
          this._editId = ''
          this.setData({ checkinOpen: false, checkinSubmitting: false, checkinMedia: [], checkinMediaMode: '', note: '' })
          wx.showToast({ title: '打卡已更新', icon: 'success' })
          this.loadFeed()
        })
        return
      }
      /* 发布打卡：本地立即生效，媒体由 store 后台队列异步上云（零等待，失败自动排队续传） */
      store.addPost(v.id, v.name, note, m.photos, 'venue', m.videos, m.order)
      this.setData({ checkinOpen: false, checkinSubmitting: false, checkinMedia: [], checkinMediaMode: '', note: '' })
      wx.showToast({ title: '打卡已发布', icon: 'success' })
      this.loadFeed()
      this.loadToday() /* 打卡记录计入今日打卡卡 */
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

  /* 签到成功庆祝（设计稿瘦身版：无彩纸无激励文案，1.2s 自动消失，点遮罩立即关） */
  showCelebrate() {
    const s = store.calcStats()
    this.setData({ celebrate: true, celebrateClosing: false, celebrateStreak: s.streak })
    if (this._celebrateTimer) clearTimeout(this._celebrateTimer)
    this._celebrateTimer = setTimeout(() => {
      this._celebrateTimer = null
      this.closeCelebrate()
    }, 1200)
  },

  /* 关闭庆祝层：200ms 淡出后再移除节点（规范 9.2 消失动效） */
  closeCelebrate() {
    if (this._celebrateTimer) {
      clearTimeout(this._celebrateTimer)
      this._celebrateTimer = null
    }
    if (this.data.celebrateClosing) return
    this.setData({ celebrateClosing: true })
    if (this._celebrateOutTimer) clearTimeout(this._celebrateOutTimer)
    this._celebrateOutTimer = setTimeout(() => {
      this._celebrateOutTimer = null
      this.setData({ celebrate: false, celebrateClosing: false })
    }, 200)
  },

  /* 已签到副键：仅状态展示，点击轻提示（规范 7.3） */
  onDoneTap() {
    wx.showToast({ title: '今日已签到', icon: 'none' })
  },

  /* 下拉刷新：重拉打卡流 + 在线数 + 签到态 */
  onPullDownRefresh() {
    this.refresh()
    this.loadFeed()
    wx.stopPullDownRefresh()
  },

  /* 打卡媒体预览：图片走浮层，视频跳原生 video-preview 页（系统右滑返回，页面自拉计数） */
  previewMedia(e) {
    const d = e.currentTarget.dataset
    const media = d.media || []
    const current = e.currentTarget.dataset.index || 0
    cloud.getMediaPreviewSources(media).then((sources) => {
      /* 视频走原生页面：标记来源，返回时 onShow 跳过刷新 */
      if (sources.some((s) => s.type === 'video')) this._backFromVideoPreview = true
      preview.open(this, { sources: sources, current: current, id: d.id || '' })
    })
  },

  onViewerClose() {
    this.setData({ viewerShow: false })
  },

  /* 页面转发（查看器内 open-type=share 依赖页面处理器） */
  onShareAppMessage() {
    return { title: '去哪滑 · 发现', path: '/pages/discover/discover' }
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
