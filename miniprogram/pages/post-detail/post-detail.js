/* 打卡详情：单条打卡的完整视图（素材预览 + 点赞 + 评论 + 编辑/删除）
 * 数据：本地 store 按 id 取记录（含未同步云端的本机记录）；
 * 点赞走 store.toggleLike + 云端计数（getLikeCounts），评论用 comment-box 组件（countchange 同步计数）；
 * 编辑复用 store.updatePost（云 doc 更新 + 临时媒体异步上云），删除复用 deleteCheckin */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { toMedia } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')
const nav = require('../../utils/nav.js')

const MAX_MEDIA = 9

/* shops.category → 徽章文案（板店对外叫「门店」，与「场地、门店与俱乐部」文案统一） */
const CAT_TEXT = { '板店': '门店', '俱乐部': '俱乐部', '培训机构': '培训机构' }

Page({
  data: {
    loaded: false,
    postId: '',
    kind: 'venue',
    kindText: '场地',
    venueId: '',
    venueName: '',
    timeText: '',
    note: '',
    media: [],
    liked: false,
    likeCount: 0,
    commentCount: 0,
    statusBarHeight: 20,
    /* 编辑弹窗 */
    editOpen: false,
    editNote: '',
    editMedia: [],
    saving: false,
    icons: {
      back: ICON.chevronLeftWhite,
      chevron: ICON.chevronRightAsh,
      x: ICON.xWhite,
      pin: ICON.pinOrangeSmall,
      plus: ICON.plusAsh,
      edit: ICON.editAsh,
      trash: ICON.trashRed,
      heartAsh: ICON.heartAsh,
      heartOrange: ICON.heartOrange,
      commentAsh: ICON.commentAsh,
    },
  },

  onLoad(options) {
    this._counts = {}
    this.setData({ statusBarHeight: nav.getStatusBarHeight() })
    const id = decodeURIComponent(options.id || '')
    if (!id) {
      wx.showToast({ title: '记录不存在', icon: 'none' })
      setTimeout(() => nav.goBack(), 600)
      return
    }
    this.setData({ postId: id })
  },

  onShow() {
    if (this.data.postId) this.loadRec()
  },

  goBack() {
    nav.goBack()
  },

  noop() { /* 阻止冒泡关闭弹窗 */ },

  /* 读取记录（onShow 重入：编辑保存/评论增删后刷新） */
  loadRec() {
    const id = this.data.postId
    const rec = store.getState().checkins.find(function (c) { return c.id === id })
    if (!rec) {
      wx.showToast({ title: '记录不存在或已删除', icon: 'none' })
      setTimeout(() => nav.goBack(), 600)
      return
    }
    const d = new Date(rec.at)
    const pad = function (n) { return n < 10 ? '0' + n : '' + n }
    this.setData({
      loaded: true,
      kind: rec.kind || 'venue',
      kindText: (rec.kind || 'venue') === 'shop' ? '门店' : '场地',
      venueId: rec.venueId || '',
      venueName: rec.venueName || '',
      timeText: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()),
      note: rec.note || '',
      media: toMedia(rec.photos, rec.videos, rec.mediaOrder),
      liked: store.isLiked(rec.id),
      likeCount: this._counts[rec.id] || 0,
    })
    this.loadCounts()
    this.loadKindText(rec)
  },

  /* 机构类型徽章：shops.category 精确显示（场地固定「场地」，机构兜底「俱乐部」） */
  loadKindText(rec) {
    if ((rec.kind || 'venue') !== 'shop') return
    cloud.getShops().then((shops) => {
      const hit = (shops || []).find((s) => s.id === rec.venueId)
      if (!hit) return
      const cat = hit.category || '俱乐部'
      this.setData({ kindText: CAT_TEXT[cat] || cat })
    })
  },

  /* 点赞/评论计数（云端聚合，与发现页口径一致） */
  loadCounts() {
    const ids = [this.data.postId]
    Promise.all([cloud.getLikeCounts(ids), cloud.getCommentCounts(ids)]).then((rs) => {
      Object.assign(this._counts, rs[0])
      const cCounts = rs[1]
      this.setData({
        likeCount: this._counts[this.data.postId] || 0,
        commentCount: cCounts[this.data.postId] || 0,
      })
    })
  },

  /* 点赞（本地立即生效 + 云端异步） */
  toggleLike() {
    const id = this.data.postId
    const nowLiked = store.toggleLike(id)
    const count = this._counts[id] || 0
    const next = nowLiked ? count + 1 : Math.max(0, count - 1)
    this._counts[id] = next
    this.setData({ liked: nowLiked, likeCount: next })
  },

  /* 评论增删后计数同步（comment-box countchange） */
  onCommentCount(e) {
    const delta = e.detail.delta
    this.setData({ commentCount: Math.max(0, this.data.commentCount + delta) })
  },

  /* 地点名 → 对应详情页 */
  goPlace(e) {
    const { id, kind } = e.currentTarget.dataset
    if (!id) return
    if (kind === 'shop') {
      wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + id })
    }
  },

  /* 素材预览（media-viewer 全屏滑动，视频封面点播） */
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

  /* ===== 编辑打卡 ===== */
  openEdit() {
    const rec = store.getState().checkins.find((c) => c.id === this.data.postId)
    if (!rec) return
    this.setData({
      editOpen: true,
      editNote: rec.note || '',
      editMedia: toMedia(rec.photos, rec.videos, rec.mediaOrder),
      saving: false,
    })
  },

  closeEdit() {
    if (this.data.saving) return
    this.setData({ editOpen: false })
  },

  onNoteInput(e) {
    this.setData({ editNote: e.detail.value })
  },

  /* 选媒体：图片 + 视频混选（微博式），图+视频合计上限 9 */
  chooseMedia() {
    const remain = MAX_MEDIA - this.data.editMedia.length
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
        this.setData({ editMedia: this.data.editMedia.concat(added) })
      },
    })
  },

  removeMedia(e) {
    const i = e.currentTarget.dataset.index
    const media = this.data.editMedia.slice()
    media.splice(i, 1)
    this.setData({ editMedia: media })
  },

  /* 拆分媒体为存储结构（与发布打卡一致）：photos / videos / order */
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

  saveEdit() {
    if (this.data.saving) return
    const note = this.data.editNote.trim()
    const media = this.data.editMedia
    if (!note && !media.length) {
      wx.showToast({ title: '说点什么或添加图片/视频', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    const submit = () => {
      const m = this.splitMedia(media)
      store.updatePost(this.data.postId, note, m.photos, m.videos, m.order).then(() => {
        this.setData({ editOpen: false, saving: false })
        wx.showToast({ title: '打卡已更新', icon: 'success' })
        this.loadRec()
      })
    }
    /* 留言有改动才走内容安全（复用 checkMsg 云函数，msgSecCheck v2） */
    const rec = store.getState().checkins.find((c) => c.id === this.data.postId)
    if (note && note !== (rec && rec.note)) {
      wx.cloud.callFunction({ name: 'checkMsg', data: { content: note } }).then((r) => {
        const res = (r && r.result) || {}
        if (!res.ok) {
          this.setData({ saving: false })
          wx.showToast({ title: res.msg || '内容包含违规信息，请修改后再保存', icon: 'none', duration: 3000 })
          return
        }
        submit()
      }).catch(() => submit()) /* 审核服务异常不阻塞保存（云函数侧已降级放行） */
    } else {
      submit()
    }
  },

  /* ===== 删除打卡（二次确认，本地+云端；成功后返回列表） ===== */
  delPost() {
    wx.showModal({
      title: '删除打卡',
      content: '删除在「' + (this.data.venueName || '该地点') + '」的这条打卡？删除后不可恢复',
      confirmColor: '#E5484D',
      success: (r) => {
        if (!r.confirm) return
        store.deleteCheckin(this.data.postId).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => nav.goBack(), 400)
        })
      },
    })
  },
})
