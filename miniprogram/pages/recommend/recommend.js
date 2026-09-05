/* 推荐场地/店铺：滑手提交 → 管理员在运营管理「推荐审核」Tab 审
 * submissions 集合（仅创建者可读写）：用户只能看自己的推荐，审核结果/回复由云函数写回 */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { fmtRel } = require('../../utils/format.js')

const VENUE_CATEGORIES = ['混合', '碗池', '街式', '平地', 'U池', '泵道', '街式地形']
const ORG_CATEGORIES = ['板店', '俱乐部', '培训机构']
const VENUE_TAGS = ['免费', '收费', '有灯', '无灯', '水泥', '木质']
const SERVICES = ['卖板', '教学', '维修', '配件', '服装', '组织活动', '装备租赁', '场地运营']
const CITIES = ['嘉兴', '杭州']
const STATUS_TEXT = { pending: '待审核', done: '已通过', rejected: '未通过' }

/* 数据库记录 → 展示结构 */
function mapSubmission(d) {
  const status = d.status || 'pending'
  return {
    id: d._id,
    kind: d.kind || 'venue',
    kindText: d.kind === 'shop' ? '门店与俱乐部' : '场地',
    name: d.name || '',
    category: d.category || '',
    address: d.address || '',
    photos: d.photos || [],
    status: status,
    statusText: STATUS_TEXT[status] || STATUS_TEXT.pending,
    reply: d.reply || '',
    replyAt: d.replyAt ? fmtRel(d.replyAt) : '',
    timeText: fmtRel(d.at),
  }
}

const emptyForm = function (city) {
  return {
    kind: 'venue', name: '', city: city,
    category: '', services: [], tags: [],
    address: '', latitude: null, longitude: null,
    phone: '', hours: { open: '09:00', close: '21:00' },
    note: '', photos: [],
  }
}

Page({
  data: {
    list: [],
    loading: true,
    /* 提交弹窗 */
    formOpen: false,
    submitting: false,
    uploading: false,
    form: emptyForm('嘉兴'),
    venueCategories: VENUE_CATEGORIES,
    orgCategories: ORG_CATEGORIES,
    venueTags: VENUE_TAGS,
    services: SERVICES,
    cities: CITIES,
  },

  onShow() {
    this.load()
  },

  load() {
    cloud.getMySubmissions().then((list) => {
      /* 城市选项合并推荐里出现过的城市，保证表单可选 */
      const cities = CITIES.slice()
      list.forEach((d) => {
        if (d.city && cities.indexOf(d.city) < 0) cities.push(d.city)
      })
      this.setData({ list: list.map(mapSubmission), loading: false, cities: cities })
    })
  },

  /* ===== 提交弹窗 ===== */
  openForm() {
    const city = store.getCity()
    const form = emptyForm(city)
    const cities = this.data.cities.slice()
    if (city && cities.indexOf(city) < 0) cities.unshift(city)
    this.setData({ formOpen: true, submitting: false, uploading: false, form: form, cities: cities })
  },

  /* 有未提交内容时二次确认，防误触丢失 */
  closeForm() {
    if (this.data.submitting || this.data.uploading) return
    const f = this.data.form
    const dirty = !!(f.name.trim() || f.address.trim() || f.latitude !== null ||
      (f.photos && f.photos.length) || (f.kind === 'shop' && f.services.length) || f.note.trim())
    if (!dirty) {
      this.setData({ formOpen: false })
      return
    }
    wx.showModal({
      title: '放弃填写？',
      content: '当前填写的内容尚未提交',
      confirmText: '放弃',
      cancelText: '继续编辑',
      confirmColor: '#E5484D',
      success: (r) => {
        if (r.confirm) this.setData({ formOpen: false })
      },
    })
  },

  noop() { /* 阻止冒泡关闭弹窗 */ },

  switchKind(e) {
    const kind = e.currentTarget.dataset.kind
    if (kind === this.data.form.kind) return
    /* 切换类型清空类别（两套词表），服务/标签互斥随 kind 隐藏不参与提交 */
    this.setData({ 'form.kind': kind, 'form.category': '' })
  },

  onNameInput(e) { this.setData({ 'form.name': e.detail.value }) },
  onAddressInput(e) { this.setData({ 'form.address': e.detail.value }) },
  onPhoneInput(e) { this.setData({ 'form.phone': e.detail.value }) },
  onNoteInput(e) { this.setData({ 'form.note': e.detail.value }) },

  onCityChange(e) { this.setData({ 'form.city': this.data.cities[Number(e.detail.value)] }) },
  onCategoryChange(e) {
    const v = Number(e.detail.value)
    this.setData({ 'form.category': this.data.form.kind === 'venue' ? this.data.venueCategories[v] : this.data.orgCategories[v] })
  },
  onHoursOpen(e) { this.setData({ 'form.hours.open': e.detail.value }) },
  onHoursClose(e) { this.setData({ 'form.hours.close': e.detail.value }) },

  toggleTag(e) {
    const t = e.currentTarget.dataset.tag
    const tags = this.data.form.tags.slice()
    const i = tags.indexOf(t)
    if (i >= 0) tags.splice(i, 1)
    else tags.push(t)
    this.setData({ 'form.tags': tags })
  },

  toggleService(e) {
    const s = e.currentTarget.dataset.svc
    const arr = this.data.form.services.slice()
    const i = arr.indexOf(s)
    if (i >= 0) arr.splice(i, 1)
    else arr.push(s)
    this.setData({ 'form.services': arr })
  },

  /* 地图选点：一次拿到坐标+地址（坐标必填，没有坐标无法在首页地图展示） */
  chooseLocation() {
    const f = this.data.form
    wx.chooseLocation({
      latitude: f.latitude !== null ? f.latitude : undefined,
      longitude: f.longitude !== null ? f.longitude : undefined,
      success: (r) => {
        this.setData({
          'form.latitude': r.latitude,
          'form.longitude': r.longitude,
          'form.address': r.address || r.name || f.address,
        })
      },
      fail: (e) => {
        const msg = (e && e.errMsg) || ''
        if (msg.indexOf('auth') >= 0 || msg.indexOf('deny') >= 0) {
          wx.showModal({
            title: '需要位置权限',
            content: '用于在地图上选取场地/店铺坐标',
            confirmText: '去设置',
            success: (r2) => { if (r2.confirm) wx.openSetting() },
          })
        }
      },
    })
  },

  /* 照片选择即上传云存储（表单里保存 fileID），最多 6 张 */
  choosePhotos() {
    const left = 6 - this.data.form.photos.length
    if (left <= 0) {
      wx.showToast({ title: '最多 6 张', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: left,
      mediaType: ['image'],
      success: (r) => {
        const temps = r.tempFiles.map((f) => f.tempFilePath)
        this.setData({ uploading: true })
        Promise.all(temps.map((p) => cloud.uploadFileTo('submissions', p))).then((fileIDs) => {
          this.setData({
            'form.photos': this.data.form.photos.concat(fileIDs),
            uploading: false,
          })
        }).catch((e) => {
          this.setData({ uploading: false })
          wx.showToast({ title: '图片上传失败', icon: 'none' })
          console.warn('[recommend] 图片上传失败', (e && e.errCode) || (e && e.message))
        })
      },
    })
  },

  removePhoto(e) {
    const i = e.currentTarget.dataset.index
    const photos = this.data.form.photos.slice()
    photos.splice(i, 1)
    this.setData({ 'form.photos': photos })
  },

  previewFormPhoto(e) {
    wx.previewImage({ urls: this.data.form.photos, current: e.currentTarget.dataset.src })
  },

  previewPhoto(e) {
    wx.previewImage({ urls: e.currentTarget.dataset.photos, current: e.currentTarget.dataset.src })
  },

  /* 提交推荐（status 初始 pending，管理员审核后由云函数更新状态与回复） */
  submit() {
    if (this.data.submitting) return
    const f = this.data.form
    if (!f.name.trim()) { wx.showToast({ title: '请填写名称', icon: 'none' }); return }
    if (f.latitude === null || f.longitude === null) { wx.showToast({ title: '请地图选点', icon: 'none' }); return }
    if (!f.category) { wx.showToast({ title: f.kind === 'venue' ? '请选择场地类型' : '请选择机构类型', icon: 'none' }); return }
    if (f.kind === 'shop' && f.services.length === 0) { wx.showToast({ title: '请选择服务项目', icon: 'none' }); return }

    this.setData({ submitting: true })
    cloud.addSubmission({
      kind: f.kind,
      name: f.name.trim(),
      city: f.city,
      category: f.category,
      services: f.kind === 'shop' ? f.services : [],
      tags: f.kind === 'venue' ? f.tags : [],
      address: f.address.trim(),
      shortAddr: f.address.trim().slice(0, 10),
      latitude: f.latitude,
      longitude: f.longitude,
      phone: f.kind === 'shop' ? f.phone.trim() : '',
      hours: f.kind === 'shop' ? f.hours : null,
      note: f.note.trim(),
      photos: f.photos,
      status: 'pending',
      reply: '',
      replyAt: '',
      userName: store.getUser().nickname || '滑手',
      at: new Date().toISOString(),
    }).then(() => {
      this.setData({ formOpen: false, submitting: false })
      wx.showToast({ title: '已提交，审核通过后上架', icon: 'success' })
      this.load()
    }).catch((e) => {
      this.setData({ submitting: false })
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
      console.warn('[recommend] 提交失败', (e && e.errCode) || (e && e.message))
    })
  },
})
