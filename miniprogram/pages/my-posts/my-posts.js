/* 我的打卡：本人打卡记录行式列表（签到页最近记录同款）
 * 点击行 → 打卡详情页（pages/post-detail：素材/点赞/评论/编辑/删除）；长按行 → 删除
 * 行内展示：日期 + 地点 + 实体类型（场地/门店/俱乐部/培训机构）+ 点赞数 + 评论数
 * 口径与数据层一致：本地 store 过滤 isPostRec（含未同步云端的本机记录）；
 * 计数走云端聚合（getLikeCounts/getCommentCounts），机构类型从 shops.category 解析 */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { ICON } = require('../../utils/icons.js')
const nav = require('../../utils/nav.js')

/* shops.category → 行徽章文案（板店对外叫「门店」，与「场地、门店与俱乐部」文案统一） */
const CAT_TEXT = { '板店': '门店', '俱乐部': '俱乐部', '培训机构': '培训机构' }

Page({
  data: {
    list: [],
    loading: true,
    statusBarHeight: 20,
    icons: {
      back: ICON.chevronLeftWhite,
      chevron: ICON.chevronRightAsh,
      camera: ICON.cameraOrange,
      heart: ICON.heartAsh,
      comment: ICON.commentAsh,
    },
  },

  onLoad() {
    this._counts = {}
    this._catMap = {}
    this.setData({ statusBarHeight: nav.getStatusBarHeight() })
  },

  onShow() {
    this.loadList()
  },

  goBack() {
    nav.goBack()
  },

  noop() { /* 阻止冒泡 */ },

  /* 列表：本地打卡记录过滤出内容记录，倒序（最新在前）；类型/计数异步补齐 */
  loadList() {
    const pad = function (n) { return n < 10 ? '0' + n : '' + n }
    const list = store.getState().checkins
      .filter(store.isPostRec)
      .map(function (c) {
        const d = new Date(c.at)
        return {
          id: c.id,
          kind: c.kind || 'venue',
          venueId: c.venueId || '',
          dateText: pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
          venueName: c.venueName || '',
          kindText: (c.kind || 'venue') === 'shop' ? '门店' : '场地',
          likeCount: 0,
          commentCount: 0,
        }
      })
    this.setData({ list: list, loading: false })
    this.loadExtras()
  },

  /* 实体类型（shops.category）+ 点赞/评论计数批量聚合 */
  loadExtras() {
    const ids = this.data.list.map(function (i) { return i.id })
    if (!ids.length) return
    Promise.all([cloud.getShops(), cloud.getLikeCounts(ids), cloud.getCommentCounts(ids)]).then((rs) => {
      const shops = rs[0] || []
      for (let i = 0; i < shops.length; i++) {
        this._catMap[shops[i].id] = shops[i].category || '俱乐部'
      }
      Object.assign(this._counts, rs[1])
      const cCounts = rs[2]
      const page = this
      const list = this.data.list.map(function (item) {
        return Object.assign({}, item, {
          kindText: page.kindText(item),
          likeCount: page._counts[item.id] || 0,
          commentCount: cCounts[item.id] || 0,
        })
      })
      this.setData({ list: list })
    })
  },

  /* 行徽章：场地固定「场地」；机构按 category 显示（旧数据兜底「俱乐部」） */
  kindText(item) {
    if (item.kind !== 'shop') return '场地'
    const cat = this._catMap[item.venueId] || '俱乐部'
    return CAT_TEXT[cat] || cat
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
