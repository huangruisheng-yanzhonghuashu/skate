/* 场地/店铺管理（管理员白名单，写操作全部走 manageVenue 云函数） */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { fmtRel } = require('../../utils/format.js')

const CATEGORIES = ['混合', '碗池', '街式', '平地', 'U池', '泵道', '街式地形']
/* 场地标签选项 → 存库结构 { label, icon }（icon 供 venue-card 显示） */
const TAG_OPTIONS = ['免费', '收费', '有灯', '无灯', '水泥', '木质']
const TAG_ICON = { '免费': 'tagFree', '收费': 'tagFree', '有灯': 'tagLight', '无灯': 'tagLight', '水泥': 'tagCement', '木质': 'tagMixed' }
const SERVICES = ['卖板', '教学', '维修', '配件', '服装', '组织活动', '装备租赁', '场地运营']
/* 机构类型三分：板店 / 俱乐部 / 培训机构（org 实体统一存 shops 集合，category 区分） */
const ORG_CATEGORIES = ['板店', '俱乐部', '培训机构']
const CITIES = ['嘉兴', '杭州']

const emptyForm = function (city) {
  return {
    id: '', kind: 'venue', name: '', city: city,
    category: '', services: [], tags: [],
    address: '', latitude: null, longitude: null,
    phone: '', hours: { open: '09:00', close: '21:00' },
    photos: [], hot: false,
  }
}

Page({
  data: {
    isAdmin: null, /* null 校验中 / true / false */
    myOpenid: '',
    entity: 'venue',
    city: '',
    cityFilter: '全部',
    cityOptions: ['全部'],
    venues: [],
    shops: [],
    viewVenues: [],
    viewShops: [],
    /* 建议处理（你提我改）+ 场地报错处理 */
    feedbacks: [],
    feedbackLoading: false,
    reports: [],
    reportsLoading: false,
    replyOpen: false,
    replying: false,
    replySource: 'feedback',
    replyTarget: { id: '', desc: '' },
    replyForm: { status: 'done', reply: '' },
    /* 表单 */
    formOpen: false,
    saving: false,
    photosUploading: false,
    form: emptyForm('嘉兴'),
    categories: CATEGORIES,
    orgCategories: ORG_CATEGORIES,
    tagOptions: TAG_OPTIONS,
    services: SERVICES,
    cities: CITIES,
  },

  onLoad() {
    this.setData({ city: store.getCity() })
    /* 进入即校验管理员身份（check 的 ok:false 是业务态，不走 callManage 的抛错封装，直接拿 openid） */
    wx.cloud.callFunction({ name: 'manageVenue', data: { action: 'check', data: {} } })
      .then((r) => {
        const res = r.result || {}
        this.setData({ isAdmin: !!res.ok, myOpenid: res.openid || '' })
        if (res.ok) this.reload()
      })
      .catch((e) => {
        /* 云函数不可用（未部署/网络错误）：兜底取 openid，保证页面始终能显示可复制的身份 */
        console.warn('[admin] 权限校验失败', (e && e.errMsg) || (e && e.message) || e)
        this.setData({ isAdmin: false })
        cloud.ensureOpenid().then((openid) => {
          this.setData({ myOpenid: openid || '' })
        })
      })
  },

  onShow() {
    /* 从表单返回后刷新列表（saveProfile 成功路径已在 save 内处理） */
  },

  reload() {
    Promise.all([cloud.getVenues(true), cloud.getShops(true)]).then((rs) => {
      /* 城市选项：从场地+店铺数据自动聚合（有序去重），前置"全部" */
      const seen = {}
      const cities = []
      rs[0].concat(rs[1]).forEach((d) => {
        if (d.city && !seen[d.city]) {
          seen[d.city] = true
          cities.push(d.city)
        }
      })
      this.setData({
        venues: rs[0],
        shops: rs[1],
        cityOptions: ['全部'].concat(cities),
      })
      this.applyFilter()
    })
  },

  /* 城市筛选变化后重算视图列表（前端过滤，不重复拉云端） */
  applyFilter() {
    const c = this.data.cityFilter
    const byCity = (arr) => (c === '全部' ? arr : arr.filter((x) => x.city === c))
    this.setData({
      viewVenues: byCity(this.data.venues),
      viewShops: byCity(this.data.shops),
    })
  },

  onCityFilter(e) {
    this.setData({ cityFilter: this.data.cityOptions[Number(e.detail.value)] })
    this.applyFilter()
  },

  switchEntity(e) {
    const entity = e.currentTarget.dataset.entity
    this.setData({ entity: entity })
    if (entity === 'feedback') this.loadFeedback()
    else if (entity === 'report') this.loadReports()
    else this.applyFilter()
  },

  /* ===== 建议处理（你提我改） ===== */
  loadFeedback() {
    if (this.data.feedbackLoading) return
    this.setData({ feedbackLoading: true })
    cloud.callManage('listFeedback', {}).then((res) => {
      const list = (res.list || []).map(function (d) {
        const st = { pending: '待处理', done: '已处理', rejected: '已驳回' }[d.status] || '待处理'
        return {
          _id: d._id,
          type: d.type || '其他',
          desc: d.desc || '',
          photos: d.photos || [],
          status: d.status || 'pending',
          statusText: st,
          reply: d.reply || '',
          userName: d.userName || '滑手',
          timeText: fmtRel(d.at),
        }
      })
      this.setData({ feedbacks: list, feedbackLoading: false })
    }).catch((e) => {
      this.setData({ feedbackLoading: false })
      wx.showToast({ title: (e && e.message) || '建议加载失败', icon: 'none' })
      console.warn('[admin] 建议加载失败', (e && e.code) || '', (e && e.message) || e)
    })
  },

  /* 场地报错列表（venue_reports，含旧数据无 status 时按待处理兜底） */
  loadReports() {
    if (this.data.reportsLoading) return
    this.setData({ reportsLoading: true })
    cloud.callManage('listReports', {}).then((res) => {
      const list = (res.list || []).map(function (d) {
        const st = { pending: '待处理', done: '已处理', rejected: '已驳回' }[d.status || 'pending'] || '待处理'
        return {
          _id: d._id,
          venueId: d.venueId || '',
          venueName: d.venueName || '场地',
          type: d.type || '其他',
          desc: d.desc || '',
          photos: d.photos || [],
          status: d.status || 'pending',
          statusText: st,
          reply: d.reply || '',
          timeText: fmtRel(d.at),
        }
      })
      this.setData({ reports: list, reportsLoading: false })
    }).catch((e) => {
      this.setData({ reportsLoading: false })
      wx.showToast({ title: (e && e.message) || '报错加载失败', icon: 'none' })
      console.warn('[admin] 报错加载失败', (e && e.code) || '', (e && e.message) || e)
    })
  },

  /* 报错关联场地，点击回详情页核对信息 */
  goVenueDetail(e) {
    const id = e.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + id })
  },

  openReply(e) {
    const source = e.currentTarget.dataset.source || 'feedback'
    const id = e.currentTarget.dataset.id
    const list = source === 'report' ? this.data.reports : this.data.feedbacks
    const item = list.find((x) => x._id === id)
    if (!item) return
    this.setData({
      replyOpen: true,
      replying: false,
      replySource: source,
      replyTarget: { id: id, desc: item.desc },
      replyForm: { status: 'done', reply: '' },
    })
  },

  closeReply() {
    if (this.data.replying) return
    this.setData({ replyOpen: false })
  },

  setReplyStatus(e) {
    this.setData({ 'replyForm.status': e.currentTarget.dataset.status })
  },

  onReplyInput(e) {
    this.setData({ 'replyForm.reply': e.detail.value })
  },

  /* 提交回复（状态+回复一起写入，用户端立即可见；按来源分发到建议/报错） */
  submitReply() {
    if (this.data.replying) return
    const f = this.data.replyForm
    if (!f.reply.trim()) { wx.showToast({ title: '请填写回复内容', icon: 'none' }); return }
    this.setData({ replying: true })
    const action = this.data.replySource === 'report' ? 'replyReport' : 'replyFeedback'
    cloud.callManage(action, { id: this.data.replyTarget.id, status: f.status, reply: f.reply }).then(() => {
      this.setData({ replyOpen: false, replying: false })
      wx.showToast({ title: '已提交', icon: 'success' })
      if (this.data.replySource === 'report') this.loadReports()
      else this.loadFeedback()
    }).catch((e) => {
      this.setData({ replying: false })
      wx.showToast({ title: (e && e.message) || '提交失败', icon: 'none' })
      console.warn('[admin] 回复失败', (e && e.code) || '', (e && e.message) || e)
    })
  },

  previewFbPhoto(e) {
    wx.previewImage({ urls: e.currentTarget.dataset.photos, current: e.currentTarget.dataset.src })
  },

  /* ===== 表单 ===== */
  openCreate() {
    this.setData({ formOpen: true, saving: false, form: emptyForm(this.data.city) })
  },

  openEdit(e) {
    const kind = e.currentTarget.dataset.kind
    const list = kind === 'venue' ? this.data.venues : this.data.shops
    const item = list.find((x) => x.id === e.currentTarget.dataset.id)
    if (!item) return
    this.setData({
      formOpen: true,
      saving: false,
      form: {
        id: item.id,
        kind: kind,
        name: item.name,
        city: item.city,
        category: item.category || '',
        services: (item.services || []).slice(),
        tags: (item.tags || []).map((t) => t.label),
        address: item.address || '',
        latitude: item.latitude,
        longitude: item.longitude,
        phone: item.phone || '',
        hours: item.hours || { open: '09:00', close: '21:00' },
        photos: (item.photos || []).slice(),
        hot: !!item.hot,
      },
    })
  },

  /* 关闭表单：有未保存内容时二次确认，防误触丢失 */
  closeForm() {
    if (this.data.saving || this.data.photosUploading) return
    const f = this.data.form
    const dirty = !!(f.name.trim() || f.address.trim() || f.latitude !== null ||
      (f.photos && f.photos.length) || (f.kind === 'shop' && f.services.length))
    if (!dirty) {
      this.setData({ formOpen: false })
      return
    }
    wx.showModal({
      title: '放弃修改？',
      content: '当前填写的内容尚未保存',
      confirmText: '放弃',
      cancelText: '继续编辑',
      confirmColor: '#E5484D',
      success: (r) => {
        if (r.confirm) this.setData({ formOpen: false })
      },
    })
  },

  noop() { /* 阻止冒泡 */ },

  formName(e) { this.setData({ 'form.name': e.detail.value }) },
  formAddress(e) { this.setData({ 'form.address': e.detail.value }) },
  formPhone(e) { this.setData({ 'form.phone': e.detail.value }) },
  formCity(e) { this.setData({ 'form.city': this.data.cities[Number(e.detail.value)] }) },
  formCategory(e) { this.setData({ 'form.category': this.data.categories[Number(e.detail.value)] }) },
  /* 机构类型三分（板店/俱乐部/培训机构） */
  formOrgCategory(e) { this.setData({ 'form.category': this.data.orgCategories[Number(e.detail.value)] }) },
  formHoursOpen(e) { this.setData({ 'form.hours.open': e.detail.value }) },
  formHoursClose(e) { this.setData({ 'form.hours.close': e.detail.value }) },
  formHot(e) { this.setData({ 'form.hot': e.detail.value }) },

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

  /* 地图选点：一次拿到地址/坐标（未选时用地址文本兜底） */
  chooseLocation() {
    wx.chooseLocation({
      success: (r) => {
        this.setData({
          'form.latitude': r.latitude,
          'form.longitude': r.longitude,
          'form.address': r.address || r.name || this.data.form.address,
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

  /* 多图选择并上传云存储（选择即上传，表单里保存 fileID） */
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
        this.setData({ photosUploading: true })
        Promise.all(temps.map((p) => cloud.uploadFileTo('photos', p))).then((fileIDs) => {
          this.setData({
            'form.photos': this.data.form.photos.concat(fileIDs),
            photosUploading: false,
          })
        }).catch((e) => {
          this.setData({ photosUploading: false })
          wx.showToast({ title: '图片上传失败', icon: 'none' })
          console.warn('[admin] 图片上传失败', (e && e.errCode) || (e && e.message))
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

  /* 保存（新增或更新） */
  saveForm() {
    if (this.data.saving) return
    const f = this.data.form
    if (!f.name.trim()) { wx.showToast({ title: '请填写名称', icon: 'none' }); return }
    if (f.latitude === null || f.longitude === null) { wx.showToast({ title: '请地图选点', icon: 'none' }); return }
    if (f.kind === 'venue' && !f.category) { wx.showToast({ title: '请选择场地类型', icon: 'none' }); return }
    if (f.kind === 'shop' && !f.category) { wx.showToast({ title: '请选择机构类型', icon: 'none' }); return }
    if (f.kind === 'shop' && f.services.length === 0) { wx.showToast({ title: '请选择服务项目', icon: 'none' }); return }

    this.setData({ saving: true })
    const payload = {
      id: f.id || undefined,
      name: f.name.trim(),
      city: f.city,
      address: f.address.trim(),
      shortAddr: f.address.trim().slice(0, 10),
      latitude: f.latitude,
      longitude: f.longitude,
      photos: f.photos,
      hot: f.hot,
    }
    const action = f.kind === 'venue'
      ? (f.id ? 'updateVenue' : 'addVenue')
      : (f.id ? 'updateShop' : 'addShop')
    if (f.kind === 'venue') {
      payload.category = f.category
      payload.tags = f.tags.map((t) => ({ label: t, icon: TAG_ICON[t] || 'tagMixed' }))
    } else {
      payload.category = f.category
      payload.services = f.services
      payload.phone = f.phone.trim()
      payload.hours = f.hours
    }

    cloud.callManage(action, payload).then(() => {
      this.setData({ formOpen: false, saving: false })
      wx.showToast({ title: '已保存', icon: 'success' })
      this.reload()
    }).catch((e) => {
      this.setData({ saving: false })
      wx.showToast({ title: (e && e.message) || '保存失败', icon: 'none' })
      console.warn('[admin] 保存失败', (e && e.code) || '', (e && e.message) || e)
    })
  },

  /* 删除（二次确认） */
  removeItem(e) {
    const kind = e.currentTarget.dataset.kind
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确认删除这条' + (kind === 'venue' ? '场地' : '店铺') + '？',
      confirmColor: '#E5484D',
      success: (r) => {
        if (!r.confirm) return
        cloud.callManage(kind === 'venue' ? 'deleteVenue' : 'deleteShop', { id: id }).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' })
          this.reload()
        }).catch((err) => {
          wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' })
        })
      },
    })
  },

  /* 无权限提示里复制 openid */
  copyOpenid() {
    wx.setClipboardData({ data: this.data.myOpenid })
  },
})
