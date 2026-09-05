/* 发布打卡（全局入口）：选地点（搜索 + 最近去过）+ 留言 + 图/视频，无需在现场
 * 打卡为内容记录（type=post），可发多条；签到（现场凭证）走详情页一键操作 */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { ICON } = require('../../utils/icons.js')

const MAX_MEDIA = 9
const LIST_LIMIT = 30

Page({
  data: {
    place: null, /* { id, name, kind } */
    pickerOpen: false,
    query: '',
    recents: [],
    results: [],
    note: '',
    media: [],
    submitting: false,
    icons: {
      pin: ICON.pinOrangeSmall,
      camera: ICON.cameraWhite,
      check: ICON.checkWhite,
      plus: ICON.plusAsh,
      imagePlus: ICON.imagePlusAsh,
      x: ICON.xWhite,
      close: ICON.xWhite,
      search: ICON.searchAsh,
    },
  },

  onLoad() {
    this._all = []
    this.loadPlaces()
    this.loadRecents()
  },

  /* 全部可选地点：当前城市的场地 + 店铺（getVenues/getShops 带缓存） */
  loadPlaces() {
    const city = store.getCity()
    Promise.all([cloud.getVenues(), cloud.getShops()]).then((rs) => {
      this._all = (rs[0] || [])
        .filter((v) => !city || v.city === city)
        .map((v) => ({ id: v.id, name: v.name, kind: 'venue' }))
        .concat(
          (rs[1] || [])
            .filter((s) => !city || s.city === city)
            .map((s) => ({ id: s.id, name: s.name, kind: 'shop' }))
        )
      this.applyQuery(this.data.query)
    })
  },

  /* 最近去过：按本人签到记录聚合（cloud.getUserFrequentVenues） */
  loadRecents() {
    cloud.ensureOpenid().then((openid) => {
      if (!openid) return
      cloud.getUserFrequentVenues(openid, 10).then((rows) => {
        this.setData({ recents: rows })
        if (!this.data.query) this.applyQuery('')
      })
    })
  },

  /* ===== 地点选择 ===== */
  openPicker() {
    this.applyQuery(this.data.query)
    this.setData({ pickerOpen: true })
  },

  closePicker() {
    this.setData({ pickerOpen: false, query: '' })
  },

  onQuery(e) {
    this.applyQuery(e.detail.value)
  },

  applyQuery(query) {
    const q = (query || '').trim()
    const source = this._all
    const list = q
      ? source.filter((p) => p.name.indexOf(q) >= 0)
      : source.slice(0, LIST_LIMIT)
    this.setData({ query: q, results: list })
  },

  pickPlace(e) {
    const d = e.currentTarget.dataset
    if (!d.id) return
    this.setData({
      place: { id: d.id, name: d.name || '', kind: d.kind || 'venue' },
      pickerOpen: false,
      query: '',
    })
  },

  /* ===== 表单 ===== */
  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  /* 选媒体：图片 + 视频混选（微博式），图+视频合计上限 9 */
  chooseMedia() {
    const remain = MAX_MEDIA - this.data.media.length
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
        this.setData({ media: [...this.data.media, ...added] })
      },
    })
  },

  removeMedia(e) {
    const i = e.currentTarget.dataset.index
    const media = [...this.data.media]
    media.splice(i, 1)
    this.setData({ media: media })
  },

  /* 拆分媒体为存储结构（与详情页打卡一致）：photos / videos / order */
  splitMedia(media) {
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

  /* ===== 发布 ===== */
  publish() {
    if (this.data.submitting) return
    const p = this.data.place
    if (!p) {
      wx.showToast({ title: '请先选择场地或店铺', icon: 'none' })
      return
    }
    const note = this.data.note.trim()
    const media = this.data.media
    if (!note && !media.length) {
      wx.showToast({ title: '说点什么或添加图片/视频', icon: 'none' })
      return
    }
    const submit = () => {
      const m = this.splitMedia(media)
      /* 发布打卡：本地立即生效，媒体由 store 后台队列异步上云（零等待，失败自动排队续传） */
      store.addPost(p.id, p.name, note, m.photos, p.kind, m.videos, m.order)
      this.setData({ submitting: false })
      wx.showToast({ title: '打卡已发布', icon: 'success' })
      setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/discover/discover' }) }), 600)
    }
    this.setData({ submitting: true })
    /* 留言内容安全（复用 checkMsg 云函数，msgSecCheck v2） */
    if (note) {
      wx.cloud.callFunction({ name: 'checkMsg', data: { content: note } }).then((r) => {
        const res = (r && r.result) || {}
        if (!res.ok) {
          this.setData({ submitting: false })
          wx.showToast({ title: res.msg || '内容包含违规信息，请修改后发布', icon: 'none', duration: 3000 })
          return
        }
        submit()
      }).catch(() => submit()) /* 审核服务异常不阻塞发布（云函数侧已降级放行） */
    } else {
      submit()
    }
  },

  noop() { /* 阻止冒泡 */ },
})
