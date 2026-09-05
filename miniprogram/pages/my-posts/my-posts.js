/* 我的打卡：本人打卡记录卡片列表（封面缩略图 + 留言摘要 + 点赞/评论）
 * 顶部实体类型过滤 chips（全部/场地/门店/俱乐部/培训机构，客户端过滤）；
 * 导航栏相机 → 发打卡；点击卡片 → 详情页（post-detail）；长按 → 删除
 * 口径与数据层一致：本地 store 过滤 isPostRec（含未同步云端的本机记录）；
 * 计数走云端聚合（getLikeCounts/getCommentCounts），机构类型从 shops.category 解析 */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { ICON } = require('../../utils/icons.js')
const nav = require('../../utils/nav.js')

/* shops.category → 徽章文案 + 过滤 key（板店对外叫「门店」，与「场地、门店与俱乐部」文案统一） */
const CAT_TEXT = { '板店': '门店', '俱乐部': '俱乐部', '培训机构': '培训机构' }
const CAT_KEY = { '板店': 'shop', '俱乐部': 'club', '培训机构': 'training' }

/* 实体类型过滤 chips（客户端过滤，数据已全在本地） */
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'venue', label: '场地' },
  { key: 'shop', label: '门店' },
  { key: 'club', label: '俱乐部' },
  { key: 'training', label: '培训机构' },
]

Page({
  data: {
    list: [],
    loading: true,
    filter: 'all',
    filters: FILTERS,
    hasRecords: false, /* 本地是否有打卡记录（区分空态/过滤无匹配） */
    noMatch: false, /* 有记录但当前过滤无匹配 */
    statusBarHeight: 20,
    icons: {
      back: ICON.chevronLeftWhite,
      camera: ICON.cameraWhite,
      chevron: ICON.chevronRightAsh,
      heart: ICON.heartAsh,
      comment: ICON.commentAsh,
      play: ICON.playWhite,
    },
  },

  onLoad() {
    this._counts = {}
    this._catMap = {}
    this._all = [] /* 全量列表（过滤前） */
    this.setData({ statusBarHeight: nav.getStatusBarHeight() })
  },

  onShow() {
    this.loadList()
  },

  goBack() {
    nav.goBack()
  },

  noop() { /* 阻止冒泡 */ },

  /* 全量列表：本地打卡内容记录倒序（最新在前）；封面取首个图片，视频-only 用播放角标占位 */
  loadList() {
    const pad = function (n) { return n < 10 ? '0' + n : '' + n }
    const list = store.getState().checkins
      .filter(store.isPostRec)
      .map(function (c) {
        const d = new Date(c.at)
        const photos = c.photos || []
        const videos = c.videos || []
        const videoSet = {}
        videos.forEach(function (v) { videoSet[v] = true })
        /* 封面：mediaOrder 里首个图片（非视频），无 order 兜底 photos[0] */
        let cover = ''
        const order = c.mediaOrder || []
        for (let i = 0; i < order.length; i++) {
          if (!videoSet[order[i]]) { cover = order[i]; break }
        }
        if (!cover) cover = photos[0] || ''
        return {
          id: c.id,
          kind: c.kind || 'venue',
          venueId: c.venueId || '',
          dateText: pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
          venueName: c.venueName || '',
          noteText: (c.note || '').trim(),
          kindText: (c.kind || 'venue') === 'shop' ? '门店' : '场地',
          cover: cover,
          coverVideo: !cover && videos.length > 0,
          likeCount: 0,
          commentCount: 0,
        }
      })
    this._all = list
    this.setData({ hasRecords: list.length > 0, loading: false })
    this.applyFilter()
    this.loadExtras()
  },

  /* 客户端过滤：场地直接按 kind；机构按 shops.category 映射
   * （shops 未加载完成前机构兜底「俱乐部」，加载后 applyFilter 重算） */
  applyFilter() {
    const page = this
    const f = this.data.filter
    const list = this._all.filter(function (item) {
      if (f === 'all') return true
      if (f === 'venue') return item.kind === 'venue'
      if (item.kind !== 'shop') return false
      const cat = page._catMap[item.venueId] || '俱乐部'
      return CAT_KEY[cat] === f
    })
    this.setData({ list: list, noMatch: !list.length && this._all.length > 0 })
  },

  /* chip 点击切换过滤 */
  onFilterTap(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.filter) return
    this.setData({ filter: key })
    this.applyFilter()
  },

  /* 过滤空态：一键切回全部 */
  goShowAll() {
    this.setData({ filter: 'all' })
    this.applyFilter()
  },

  /* 实体类型（shops.category）+ 点赞/评论计数批量聚合，完成后重算过滤 */
  loadExtras() {
    const ids = this._all.map(function (i) { return i.id })
    if (!ids.length) return
    Promise.all([cloud.getShops(), cloud.getLikeCounts(ids), cloud.getCommentCounts(ids)]).then((rs) => {
      const shops = rs[0] || []
      for (let i = 0; i < shops.length; i++) {
        this._catMap[shops[i].id] = shops[i].category || '俱乐部'
      }
      Object.assign(this._counts, rs[1])
      const cCounts = rs[2]
      const page = this
      const list = this._all.map(function (item) {
        return Object.assign({}, item, {
          kindText: page.kindText(item),
          likeCount: page._counts[item.id] || 0,
          commentCount: cCounts[item.id] || 0,
        })
      })
      this._all = list
      this.applyFilter()
    })
  },

  /* 行徽章：场地固定「场地」；机构按 category 显示（旧数据兜底「俱乐部」） */
  kindText(item) {
    if (item.kind !== 'shop') return '场地'
    const cat = this._catMap[item.venueId] || '俱乐部'
    return CAT_TEXT[cat] || cat
  },

  /* 卡片点击 → 打卡详情页 */
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/post-detail/post-detail?id=' + encodeURIComponent(id) })
  },

  /* 长按删除（二次确认，本地+云端；与签到页删除手势一致） */
  delPost(e) {
    const id = e.currentTarget.dataset.id
    const rec = this._all.find(function (r) { return r.id === id })
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

  /* 发打卡入口（导航栏相机 / 空态引导） */
  goPostPublish() {
    wx.navigateTo({ url: '/pages/post-publish/post-publish' })
  },
})
