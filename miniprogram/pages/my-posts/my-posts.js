/* 我的打卡：本人打卡记录行式列表（签到页最近记录同款）
 * 点击行 → 打卡详情页（pages/post-detail：素材/点赞/评论/编辑/删除）；长按行 → 删除
 * 口径与数据层一致：本地 store 过滤 isPostRec（含未同步云端的本机记录） */
const store = require('../../utils/store.js')
const { ICON } = require('../../utils/icons.js')
const nav = require('../../utils/nav.js')

Page({
  data: {
    list: [],
    loading: true,
    statusBarHeight: 20,
    icons: {
      back: ICON.chevronLeftWhite,
      chevron: ICON.chevronRightAsh,
      camera: ICON.cameraOrange,
    },
  },

  onLoad() {
    this.setData({ statusBarHeight: nav.getStatusBarHeight() })
  },

  onShow() {
    this.loadList()
  },

  goBack() {
    nav.goBack()
  },

  noop() { /* 阻止冒泡 */ },

  /* 列表：本地打卡记录过滤出内容记录，倒序（最新在前） */
  loadList() {
    const pad = function (n) { return n < 10 ? '0' + n : '' + n }
    const list = store.getState().checkins
      .filter(store.isPostRec)
      .map(function (c) {
        const d = new Date(c.at)
        return {
          id: c.id,
          kind: c.kind || 'venue',
          dateText: pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
          venueName: c.venueName || '',
        }
      })
    this.setData({ list: list, loading: false })
  },

  /* 行点击 → 打卡详情页 */
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/post-detail/post-detail?id=' + encodeURIComponent(id) })
  },

  /* 长按删除（二次确认，本地+云端；与签到页删除手势一致） */
  delPost(e) {
    const id = e.currentTarget.dataset.id
    const rec = this.data.list.find(function (r) { return r.id === id })
    wx.showModal({
      title: '删除打卡',
      content: '删除在「' + (rec ? rec.venueName : '该地点') + '」的这条打卡？删除后不可恢复',
      confirmColor: '#E5484D',
      success: (r) => {
        if (!r.confirm) return
        store.deleteCheckin(id).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadList()
        })
      },
    })
  },

  /* 空态引导 → 发打卡 */
  goPostPublish() {
    wx.navigateTo({ url: '/pages/post-publish/post-publish' })
  },
})
