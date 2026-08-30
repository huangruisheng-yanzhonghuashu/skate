/* 评论区组件：内嵌展开式，最小版 UGC（发布即显示，仅可删自己的评论） */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { fmtAgo } = require('../../utils/format.js')

const PAGE_SIZE = 20

Component({
  properties: {
    checkinId: { type: String, value: '' },
  },

  data: {
    list: [],
    note: '',
    loading: false,
    finished: false,
    submitting: false,
    myAvatarFile: '',
    myAvatarText: '滑',
  },

  lifetimes: {
    attached() {
      const u = store.getUser()
      this.setData({
        myAvatarFile: u.avatarFileID || '',
        myAvatarText: (u.nickname || '滑').slice(0, 1),
      })
      this._skip = 0
      this.load()
    },
  },

  methods: {
    load() {
      if (this.data.loading) return
      this.setData({ loading: true })
      cloud.getComments(this.data.checkinId, { skip: this._skip, limit: PAGE_SIZE }).then((rows) => {
        this._skip += rows.length
        this.setData({
          list: this.data.list.concat(rows),
          loading: false,
          finished: rows.length < PAGE_SIZE,
        })
      })
    },

    onNoteInput(e) {
      this.setData({ note: e.detail.value })
    },

    /* 发布前内容安全校验（服务端 msgSecCheck）：通过才落库 */
    submit() {
      if (this.data.submitting) return
      const note = this.data.note.trim()
      if (!note) {
        wx.showToast({ title: '说点什么吧', icon: 'none' })
        return
      }
      this.setData({ submitting: true })
      wx.cloud.callFunction({ name: 'checkMsg', data: { content: note } })
        .then((r) => {
          const res = (r.result && typeof r.result === 'object') ? r.result : { ok: false, msg: '校验服务异常' }
          if (!res.ok) {
            this.setData({ submitting: false })
            wx.showToast({ title: res.msg || '内容包含违规信息，请修改后发布', icon: 'none' })
            return null
          }
          if (res.degraded) {
            console.warn('[comment-box] 安全校验降级放行：', res.msg)
          }
          return cloud.addCommentDoc(this.data.checkinId, note, store.getUser())
        })
        .then((r) => {
          if (!r) return /* 被拦截，toast 已提示 */
          const u = store.getUser()
          this.setData({
            list: this.data.list.concat([{
              id: r.id,
              user: u.nickname || '滑手',
              avatarFile: u.avatarFileID || '',
              avatarText: (u.nickname || '滑').slice(0, 1),
              note: note,
              at: new Date().toISOString(),
            }]),
            note: '',
            submitting: false,
          })
          this.triggerEvent('countchange', { delta: 1 })
        })
        .catch((e) => {
          this.setData({ submitting: false })
          wx.showToast({ title: '评论发布失败，请重试', icon: 'none' })
          console.warn('[comment-box] 发布失败', (e && e.errCode) || (e && e.message))
        })
    },

    /* 长按删除自己的评论：云端 remove 只能删自己的（"仅创建者可写"），
     * 删别人的会失败——统一 try-catch 后给不同提示 */
    del(e) {
      const id = e.currentTarget.dataset.id
      wx.showModal({
        title: '删除评论',
        content: '删除这条评论？',
        confirmColor: '#E5484D',
        success: (r) => {
          if (!r.confirm) return
          cloud.removeCommentDoc(id).then(() => {
            this.setData({ list: this.data.list.filter((c) => c.id !== id) })
            this.triggerEvent('countchange', { delta: -1 })
          }).catch(() => {
            wx.showToast({ title: '只能删除自己的评论', icon: 'none' })
          })
        },
      })
    },

    noop() { /* 阻止滚动穿透 */ },
  },
})
