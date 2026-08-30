/* 你提我改：提交建议 + 查看官方处理进度（feedback 集合，仅创建者可读写） */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { fmtRel } = require('../../utils/format.js')

const TYPES = ['功能建议', '场地纠错', '体验问题', '其他']
const STATUS_TEXT = { pending: '待处理', done: '已处理', rejected: '已驳回' }

/* 数据库记录 → 展示结构（状态文字/时间格式化在页面侧完成） */
function mapFeedback(d) {
  const status = d.status || 'pending'
  return {
    id: d._id,
    type: d.type || '其他',
    desc: d.desc || '',
    photos: d.photos || [],
    status: status,
    statusText: STATUS_TEXT[status] || STATUS_TEXT.pending,
    reply: d.reply || '',
    replyAt: d.replyAt ? fmtRel(d.replyAt) : '',
    timeText: fmtRel(d.at),
  }
}

const emptyForm = function () {
  return { type: TYPES[0], desc: '', photos: [] }
}

Page({
  data: {
    list: [],
    loading: true,
    /* 提交弹窗 */
    formOpen: false,
    submitting: false,
    uploading: false,
    form: emptyForm(),
    types: TYPES,
  },

  onShow() {
    this.load()
  },

  load() {
    cloud.getMyFeedback().then((list) => {
      this.setData({ list: list.map(mapFeedback), loading: false })
    })
  },

  /* ===== 提交弹窗 ===== */
  openForm() {
    this.setData({ formOpen: true, submitting: false, form: emptyForm() })
  },

  /* 有未提交内容时二次确认，防误触丢失（与场地管理表单一致） */
  closeForm() {
    if (this.data.submitting || this.data.uploading) return
    const f = this.data.form
    if (!f.desc.trim() && !f.photos.length) {
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

  onTypeChange(e) {
    this.setData({ 'form.type': this.data.types[Number(e.detail.value)] })
  },

  onDescInput(e) {
    this.setData({ 'form.desc': e.detail.value })
  },

  /* 图片选择即上传云存储（表单里保存 fileID），最多 3 张 */
  choosePhotos() {
    const left = 3 - this.data.form.photos.length
    if (left <= 0) {
      wx.showToast({ title: '最多 3 张', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: left,
      mediaType: ['image'],
      success: (r) => {
        const temps = r.tempFiles.map((f) => f.tempFilePath)
        this.setData({ uploading: true })
        Promise.all(temps.map((p) => cloud.uploadFileTo('feedback', p))).then((fileIDs) => {
          this.setData({
            'form.photos': this.data.form.photos.concat(fileIDs),
            uploading: false,
          })
        }).catch((e) => {
          this.setData({ uploading: false })
          wx.showToast({ title: '图片上传失败', icon: 'none' })
          console.warn('[feedback] 图片上传失败', (e && e.errCode) || (e && e.message))
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

  /* 提交建议（状态与回复字段初始为 pending/空，管理员处理后由云函数更新） */
  submit() {
    if (this.data.submitting) return
    const f = this.data.form
    const desc = (f.desc || '').trim()
    if (!desc) {
      wx.showToast({ title: '请描述你的建议', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    cloud.addFeedback({
      type: f.type,
      desc: desc,
      photos: f.photos,
      status: 'pending',
      reply: '',
      replyAt: '',
      userName: store.getUser().nickname || '滑手',
      at: new Date().toISOString(),
    }).then(() => {
      this.setData({ formOpen: false, submitting: false })
      wx.showToast({ title: '已提交，感谢反馈', icon: 'success' })
      this.load()
    }).catch((e) => {
      this.setData({ submitting: false })
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
      console.warn('[feedback] 提交失败', (e && e.errCode) || (e && e.message))
    })
  },
})
