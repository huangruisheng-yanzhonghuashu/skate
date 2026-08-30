/* 店铺详情：照片轮播 + 服务 + 营业时间 + 拨号/导航 + 店铺打卡 */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { fmtAgo } = require('../../utils/format.js')

Page({
  data: {
    shop: null,
    status: '',
    openNow: false,
    checked: false,
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
      this.refresh()
      this.loadFeed()
    })
  },

  onShow() {
    if (this.data.shop) {
      this.refresh()
      this.loadFeed()
    }
  },

  refresh() {
    this.setData({ checked: store.checkedToday(this.data.shop.id) })
  },

  /* 店铺打卡流（所有人带留言的打卡，最近3条） */
  loadFeed() {
    const shop = this.data.shop
    if (!shop) return
    cloud.getPlaceCheckins(shop.id, { noteOnly: true, limit: 3 }).then((feed) => {
      this.setData({
        feed: feed.map((f) => ({
          id: f.id,
          user: f.user,
          avatarFile: f.avatarFile,
          avatarText: f.avatarText,
          color: '#FF9F2E',
          time: fmtAgo(f.at),
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
      wx.showToast({ title: '打卡成功', icon: 'success' })
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
