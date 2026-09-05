/* 店铺详情：照片轮播 + 服务 + 营业时间 + 拨号/导航 + 店铺打卡 */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { fmtAgo } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')

/* 连签徽章里程碑（庆祝层提示用，与场地详情页一致） */
const STREAK_MILESTONES = [3, 7, 30, 100]

/* 庆祝彩纸：14 片随机位置/颜色/时序 */
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
    shop: null,
    status: '',
    openNow: false,
    checked: false,
    rating: 0,
    ratingCount: 0,
    /* org↔venue 关联：合作/上课场地（partnerVenues 名称解析为 venue 引用） */
    partners: [],
    icons: {
      starOrange: ICON.starOrange,
      starGray: ICON.starGray,
      checkWhite: ICON.checkWhite,
    },
    feed: [],
    /* 打卡弹窗 */
    checkinOpen: false,
    note: '',
    checkinPhotos: [],
    checkinSubmitting: false,
  },

  onLoad(options) {
    cloud.getShops().then((shops) => {
      const shop = shops.find((s) => s.id === options.id) || null
      if (!shop) {
        wx.showToast({ title: '店铺不存在或已下线', icon: 'none' })
        setTimeout(() => wx.switchTab({ url: '/pages/home/home' }), 800)
        return
      }
      const status = cloud.openStatus(shop)
      this.setData({ shop: shop, status: status, openNow: status === '营业中' })
      wx.setNavigationBarTitle({ title: shop.name })
      this.resolvePartners(shop)
      this.refresh()
      this.loadFeed()
    })
  },

  /* partnerVenues 存的是场地名：解析成 venue 引用供详情页跳转（名称不匹配的忽略） */
  resolvePartners(shop) {
    const names = shop.partnerVenues || []
    if (!names.length) return
    cloud.getVenues().then((venues) => {
      this.setData({
        partners: names
          .map((n) => venues.find((v) => v.name === n))
          .filter(Boolean)
          .map((v) => ({ id: v.id, name: v.name, shortAddr: v.shortAddr || v.address || '' })),
      })
    })
  },

  /* 合作场地 → 场地详情 */
  goVenue(e) {
    const id = e.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + id })
  },

  onShow() {
    if (this.data.shop) {
      this.refresh()
      this.loadFeed()
    }
  },

  /* 签到态 + 评分统计（真实均值/人数） */
  refresh() {
    this.setData({ checked: store.checkedToday(this.data.shop.id) })
    cloud.getRatingStats('shop').then((map) => {
      const st = map[this.data.shop.id]
      this.setData({
        rating: st ? st.avg : 0,
        ratingCount: st ? st.count : 0,
      })
    })
  },

  /* ===== 店铺评分弹窗 ===== */
  openRate() {
    cloud.getMyRating('shop', this.data.shop.id).then((my) => {
      this.setData({ rateOpen: true, rateStars: my || 0, myRating: my, rateSubmitting: false })
    })
  },

  closeRate() {
    if (this.data.rateSubmitting) return
    this.setData({ rateOpen: false })
  },

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
    cloud.rateTarget('shop', this.data.shop.id, score).then(() => {
      this.setData({ rateOpen: false, rateSubmitting: false })
      wx.showToast({ title: '评分成功', icon: 'success' })
      this.refresh()
    }).catch((e) => {
      this.setData({ rateSubmitting: false })
      const code = e && e.errCode
      if (code === -502024 || code === -501024 || (e && e.errMsg && e.errMsg.indexOf('permission') >= 0)) {
        wx.showToast({ title: '无写入权限：请在控制台将 ratings 权限设为「所有用户可读，仅创建者可写」', icon: 'none', duration: 3500 })
      } else {
        wx.showToast({ title: '评分失败，请重试', icon: 'none' })
      }
      console.error('[shop-detail] 评分失败', code, (e && e.errMsg) || e)
    })
  },

  /* 店铺打卡流（所有人带留言的打卡，最近3条） */
  loadFeed() {
    const shop = this.data.shop
    if (!shop) return
    cloud.getPlaceCheckins(shop.id, { noteOnly: true, limit: 20 }).then((rows) => {
      /* 云写入是异步的（失败进重试队列）：合并本地本人打卡兜底，按 id 去重后时间倒序取前3 */
      const seen = {}
      const merged = []
      rows.concat(store.getLocalPlaceCheckins(shop.id, true)).forEach((r) => {
        if (seen[r.id]) return
        seen[r.id] = true
        merged.push(r)
      })
      merged.sort((a, b) => (a.at < b.at ? 1 : -1))
      this.setData({
        feed: merged.slice(0, 3).map((f) => ({
          id: f.id,
          user: f.user,
          avatarFile: f.avatarFile,
          avatarText: f.avatarText,
          color: '#FF9F2E',
          time: fmtAgo(f.at),
          skateYears: f.skateYears || 0,
          note: f.note,
          photos: f.photos,
        })),
      })
    })
  },

  callShop() {
    const phone = this.data.shop && this.data.shop.phone
    if (!phone) {
      wx.showToast({ title: '该店铺未留电话', icon: 'none' })
      return
    }
    wx.makePhoneCall({ phoneNumber: phone, fail: function () { /* 用户取消 */ } })
  },

  openMap() {
    const s = this.data.shop
    wx.openLocation({
      latitude: s.latitude,
      longitude: s.longitude,
      name: s.name,
      address: s.address,
      scale: 16,
    })
  },

  previewPhoto(e) {
    wx.previewImage({ urls: this.data.shop.photos, current: e.currentTarget.dataset.url })
  },

  /* 打卡成功轻庆祝：1.8s 自动消失 */
  /* 打卡成功庆祝（设计稿同款：橙徽章 + 连签 + 彩纸），2.6s 自动消失 */
  showCelebrate(placeName) {
    const s = store.calcStats()
    const next = STREAK_MILESTONES.find((m) => m > s.streak)
    const sub = placeName + (next ? ' · 再打 ' + (next - s.streak) + ' 天解锁「' + next + ' 日坚持」徽章' : '')
    this.setData({
      celebrate: true,
      celebrateStreak: s.streak,
      celebrateSub: sub,
      confetti: buildConfetti(),
    })
    if (this._celebrateTimer) clearTimeout(this._celebrateTimer)
    this._celebrateTimer = setTimeout(() => {
      this.setData({ celebrate: false })
    }, 2600)
  },

  /* 下拉刷新 */
  onPullDownRefresh() {
    this.refresh()
    this.loadFeed()
    wx.stopPullDownRefresh()
  },

  /* 分享给好友 / 分享朋友圈 */
  onShareAppMessage() {
    const s = this.data.shop
    return {
      title: s.name + ' · 滑板好店推荐',
      path: '/pages/shop-detail/shop-detail?id=' + s.id,
      imageUrl: s.photos && s.photos[0] ? s.photos[0] : '',
    }
  },

  onShareTimeline() {
    const s = this.data.shop
    return {
      title: s.name + ' · 滑板好店推荐',
      query: 'id=' + s.id,
    }
  },

  /* ===== 店铺打卡弹窗（新增 / 补充今日打卡复用） ===== */
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

  /* 补充今日打卡：预填当日记录 */
  openEditCheckin() {
    const rec = store.getTodayCheckin(this.data.shop.id)
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

  noop() { /* 阻止冒泡 */ },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  chooseCheckinPhoto() {
    const remain = 9 - this.data.checkinPhotos.length
    if (remain <= 0) return
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
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

  /* 上传照片组：保留已上传 fileID，只上传新选临时文件 */
  uploadMixedPhotos(photos) {
    const jobs = photos.map((p) => {
      if (p.indexOf('cloud://') === 0) return Promise.resolve(p)
      return cloud.uploadFileTo('checkin-photos', p)
    })
    return Promise.all(jobs)
  },

  confirmCheckin() {
    if (this.data.checkinSubmitting) return
    const s = this.data.shop
    const note = this.data.note.trim()
    const photos = this.data.checkinPhotos
    this.setData({ checkinSubmitting: true })
    const finish = (fileIDs) => {
      if (this._editId) {
        store.updateCheckin(this._editId, note, fileIDs).then(() => {
          this._editId = ''
          this.setData({ checkinOpen: false, checkinSubmitting: false, checkinPhotos: [], note: '' })
          wx.showToast({ title: '打卡已更新', icon: 'success' })
          this.refresh()
          this.loadFeed()
        })
        return
      }
      store.addCheckin(s.id, s.name, note, fileIDs, 'shop')
      this.setData({ checkinOpen: false, checkinSubmitting: false, checkinPhotos: [], note: '' })
      this.showCelebrate(s.name)
      this.refresh()
      this.loadFeed()
    }
    if (photos.length) {
      this.uploadMixedPhotos(photos)
        .then(finish)
        .catch((e) => {
          this.setData({ checkinSubmitting: false })
          wx.showToast({ title: '照片上传失败，请重试', icon: 'none' })
          console.warn('[shop-detail] 打卡照片上传失败', (e && e.errCode) || (e && e.message))
        })
    } else {
      finish([])
    }
  },

  /* 查看全部打卡 */
  showAllCheckins() {
    wx.navigateTo({ url: '/pages/place-checkins/place-checkins?id=' + this.data.shop.id + '&kind=shop' })
  },

  previewFeedPhotos(e) {
    wx.previewImage({
      urls: e.currentTarget.dataset.urls,
      current: e.currentTarget.dataset.url,
    })
  },

})
