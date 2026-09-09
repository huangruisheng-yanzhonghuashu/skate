/* 发现页：打卡社区流（最新/热门）+ 站内搜索（最近搜索/结果/无结果）+ 发打卡 FAB */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { fmtAgo, toMedia } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')
const { getStatusBarHeight } = require('../../utils/nav.js')
const preview = require('../../utils/preview.js')

const PAGE_SIZE = 20
const SEARCH_LIMIT = 30
const RECENT_KEY = 'skatespot-discover-searches-v1'
const RECENT_MAX = 10

/* 关键词高亮分段：命中段 hit=true（不区分大小写；空词/正则异常时返回整段） */
function splitSegs(text, kw) {
  const t = text || ''
  if (!kw) return [{ t: t, hit: false, i: 0 }]
  let re
  try {
    re = new RegExp('(' + String(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')
  } catch (e) {
    return [{ t: t, hit: false, i: 0 }]
  }
  return t
    .split(re)
    .filter(function (s) { return s !== '' })
    .map(function (s, i) {
      return { t: s, hit: s.toLowerCase() === String(kw).toLowerCase(), i: i }
    })
}

Page({
  data: {
    tab: 'latest',
    list: [],
    loading: false,
    finished: false,
    empty: false,
    error: false,
    fabHide: false, /* 评论展开时隐藏 FAB，避免遮挡评论输入行 */
    statusBarHeight: 20,
    /* ===== 搜索态 ===== */
    searchMode: false,
    keyword: '',
    searching: false,
    searched: false,
    results: [],
    recent: [],
    /* ===== 媒体查看器（互动上下文：预览内点赞/评论/转发） ===== */
    viewerShow: false,
    viewerSources: [],
    viewerCurrent: 0,
    viewerId: '',
    viewerLiked: false,
    viewerLikeCount: 0,
    viewerCommentCount: 0,
    icons: {
      heartAsh: ICON.heartAsh,
      heartOrange: ICON.heartOrange,
      commentAsh: ICON.commentAsh,
      share: ICON.shareNodesAsh,
      camera: ICON.cameraWhite,
      search: ICON.searchT4,
      xCircle: ICON.xCircleAsh,
      pin: ICON.pinOrangeSmall,
      emptySkate: ICON.emptySkate,
      emptySearch: ICON.emptySearch,
    },
  },

  onLoad() {
    this._skip = 0
    this._counts = {} /* feedId → 点赞数（聚合结果缓存） */
    this.setData({ statusBarHeight: getStatusBarHeight(), recent: this.loadRecent() })
    this.loadMore()
  },

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) {
      tb.setData({ selected: 1, hidden: false }) /* 防御：任何路径回页都恢复 TabBar */
    }
    if (this._backFromVideoPreview) {
      this._backFromVideoPreview = false
      return /* 视频预览返回：点赞/评论已事件同步进卡片，不整页刷新 */
    }
    if (this.data.searchMode) return /* 搜索态返回本页不打断 */
    /* 打卡/点赞可能已变化：重置分页重新加载 */
    this.reload()
  },

  reload() {
    this._skip = 0
    this._counts = {}
    this.setData({ list: [], finished: false, empty: false, error: false })
    return this.loadMore()
  },

  /* 云端行 → 卡片数据（kw 传入时生成关键词高亮分段，搜索结果用） */
  mapRow(r, kw) {
    return {
      id: r.id,
      openid: r.openid,
      kind: r.kind,
      venueId: r.venueId,
      venueName: r.venueName,
      user: r.user,
      avatarFile: r.avatarFile,
      avatarText: r.avatarText,
      note: r.note,
      noteSegs: splitSegs(r.note, kw),
      venueSegs: splitSegs(r.venueName, kw),
      photos: r.photos,
      media: toMedia(r.photos, r.videos, r.mediaOrder),
      timeText: fmtAgo(r.at),
      liked: store.isLiked(r.id),
      likeCount: this._counts[r.id] || 0,
      commentCount: 0,
      commentsOpen: false,
    }
  },

  loadMore() {
    if (this.data.loading || this.data.finished) return Promise.resolve()
    this.setData({ loading: true })
    return cloud.getPublicCheckins({ skip: this._skip, limit: PAGE_SIZE }).then((rows) => {
      this._skip += rows.length
      const ids = rows.map((r) => r.id)
      return Promise.all([cloud.getLikeCounts(ids), cloud.getCommentCounts(ids)]).then((rs) => {
        Object.assign(this._counts, rs[0])
        const cCounts = rs[1]
        /* 兜底过滤：只展示有内容的打卡（留言或媒体），无内容的签到类记录不出现在社区流 */
        const base = this.data.list.length
        const mapped = rows.map((r, i) => {
          const item = this.mapRow(r)
          item.commentCount = cCounts[r.id] || 0
          /* 卡片错峰入场延迟（前 10 张，JS 侧预算避免 WXML 三元解析问题） */
          const pos = base + i
          item.delay = pos < 10 ? pos * 60 : 0
          return item
        }).filter((item) => item.note || (item.media && item.media.length))
        const list = this.data.list.concat(mapped)
        this.setData({
          list: this.sortList(list),
          loading: false,
          finished: rows.length < PAGE_SIZE,
          empty: list.length === 0,
          error: false,
        })
      })
    }).catch(() => {
      /* 首屏失败 → 失败态页面；加载更多失败 → toast 提示，保留已有内容 */
      this.setData({ loading: false, error: this.data.list.length === 0 })
      if (this.data.list.length) {
        wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      }
    })
  },

  /* 失败态重试 */
  onRetry() {
    this.setData({ error: false })
    this.loadMore()
  },

  /* 展开/收起评论区（展开时隐藏 FAB 避让输入行；列表与搜索结果双同步） */
  toggleComments(e) {
    const id = e.currentTarget.dataset.id
    const apply = (arr) => arr.map((item) => (item.id === id ? { ...item, commentsOpen: !item.commentsOpen } : item))
    this.setData({ list: apply(this.data.list), results: apply(this.data.results) })
    this.syncFab()
  },

  /* comment-box 发布/删除评论后计数联动 */
  onCommentCount(e) {
    const id = e.currentTarget.dataset.id
    const delta = e.detail.delta
    const apply = (arr) => arr.map((item) => (
      item.id === id ? { ...item, commentCount: Math.max(0, (item.commentCount || 0) + delta) } : item
    ))
    this.setData({ list: this.sortList(apply(this.data.list)), results: apply(this.data.results) })
  },

  onReachBottom() {
    this.loadMore()
  },

  onPullDownRefresh() {
    this.reload().then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh())
  },

  /* 最新：时间倒序（已是查询序）；热门：点赞×2 + 评论×3 混合权重（互动加权，避免纯点赞冷启动全 0 失真） */
  sortList(list) {
    if (this.data.tab === 'hot') {
      const score = (x) => (x.likeCount || 0) * 2 + (x.commentCount || 0) * 3
      return list.slice().sort((a, b) => score(b) - score(a))
    }
    return list
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    this.setData({ list: this.sortList(this.data.list) })
  },

  toggleLike(e) {
    const id = e.currentTarget.dataset.id
    const nowLiked = store.toggleLike(id)
    /* 本地即时更新：计数 ±1 + 状态翻转（下次聚合会给出准确值）；列表与搜索结果双同步 */
    const count = this._counts[id] || 0
    const next = nowLiked ? count + 1 : Math.max(0, count - 1)
    this._counts[id] = next
    const apply = (arr) => arr.map((item) => (item.id === id ? { ...item, liked: nowLiked, likeCount: next } : item))
    this.setData({ list: this.sortList(apply(this.data.list)), results: apply(this.data.results) })
  },

  /* ===== 搜索 ===== */
  openSearch() {
    this.setData({ searchMode: true, keyword: '', searched: false, searching: false, results: [] })
  },

  closeSearch() {
    this.setData({ searchMode: false, keyword: '', searched: false, searching: false, results: [] })
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearchConfirm() {
    this.runSearch(this.data.keyword)
  },

  clearKeyword() {
    this.setData({ keyword: '', searched: false, searching: false, results: [] })
  },

  tapRecent(e) {
    const kw = e.currentTarget.dataset.kw || ''
    this.setData({ keyword: kw })
    this.runSearch(kw)
  },

  clearRecent() {
    try { wx.removeStorageSync(RECENT_KEY) } catch (err) { /* ignore */ }
    this.setData({ recent: [] })
  },

  loadRecent() {
    try {
      const v = wx.getStorageSync(RECENT_KEY)
      return Array.isArray(v) ? v : []
    } catch (e) {
      return []
    }
  },

  saveRecent(kw) {
    let list = this.loadRecent().filter((x) => x !== kw)
    list.unshift(kw)
    list = list.slice(0, RECENT_MAX)
    try { wx.setStorageSync(RECENT_KEY, list) } catch (e) { /* ignore */ }
    this.setData({ recent: list })
  },

  runSearch(raw) {
    const kw = (raw || '').trim()
    if (!kw || this.data.searching) return
    this.saveRecent(kw)
    this.setData({ keyword: kw, searching: true, searched: true })
    cloud.searchPublicCheckins(kw, { limit: SEARCH_LIMIT }).then((rows) => {
      const ids = rows.map((r) => r.id)
      return Promise.all([cloud.getLikeCounts(ids), cloud.getCommentCounts(ids)]).then((rs) => {
        Object.assign(this._counts, rs[0])
        const cCounts = rs[1]
        /* 与社区流同口径：纯签到（无留言无媒体）不进结果 */
        const results = rows.map((r) => {
          const item = this.mapRow(r, kw)
          item.commentCount = cCounts[r.id] || 0
          return item
        }).filter((item) => item.note || (item.media && item.media.length))
        this.setData({ results, searching: false })
      })
    }).catch(() => {
      this.setData({ searching: false, results: [] })
      wx.showToast({ title: '搜索失败，请重试', icon: 'none' })
    })
  },

  /* ===== FAB ===== */
  onFabTap() {
    /* 空态：引导去首页附近场地签到；常态：发打卡 */
    if (this.data.empty && !this.data.error) {
      wx.switchTab({ url: '/pages/home/home' })
      return
    }
    wx.navigateTo({ url: '/pages/post-publish/post-publish' })
  },

  /* 空态 CTA：去附近场地签到（首页地图） */
  goNearby() {
    wx.switchTab({ url: '/pages/home/home' })
  },

  /* FAB 显隐：任一卡片评论展开时隐藏 */
  syncFab() {
    const open = this.data.list.some((i) => i.commentsOpen) || this.data.results.some((i) => i.commentsOpen)
    this.setData({ fabHide: !!open })
  },

  /* 打卡人头像/昵称 → 滑手主页（本人也进新页面：openid 缺失时兜底用本人 openid） */
  goUserProfile(e) {
    const d = e.currentTarget.dataset
    cloud.ensureOpenid().then((my) => {
      const openid = d.openid || my || ''
      wx.navigateTo({
        url: '/pages/user-profile/user-profile?openid=' + encodeURIComponent(openid) +
          '&u=' + encodeURIComponent(d.user || '') +
          '&avatar=' + encodeURIComponent(d.avatar || ''),
      })
    })
  },

  goPlace(e) {
    const { id, kind } = e.currentTarget.dataset
    if (kind === 'shop') {
      wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + id })
    }
  },

  /* 打卡媒体预览：图片走 media-viewer 浮层，视频跳原生 video-preview 页（系统右滑返回）
   * 浮层路径 Tab 页特有：预览期间隐藏底部 TabBar（全屏沉浸），关闭恢复 */
  previewMedia(e) {
    const d = e.currentTarget.dataset
    const media = d.media || []
    const id = d.id
    const current = Number(d.index) || 0
    const item = this.data.list.find((x) => x.id === id) || this.data.results.find((x) => x.id === id)
    cloud.getMediaPreviewSources(media).then((sources) => {
      /* 视频走原生页面：标记来源，返回时 onShow 跳过整页 reload */
      if (sources.some((s) => s.type === 'video')) this._backFromVideoPreview = true
      preview.open(this, {
        sources: sources,
        current: current,
        id: id,
        liked: item && item.liked,
        likeCount: item && item.likeCount,
        commentCount: item && item.commentCount,
        user: item && item.user,
      })
    })
  },

  onViewerClose() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ hidden: false })
    this.setData({ viewerShow: false })
  },

  /* 查看器内点赞 → 同步列表/结果卡片 */
  onViewerLike(e) {
    const id = this.data.viewerId
    const { liked, likeCount } = e.detail
    this._counts[id] = likeCount
    this.patchItem(id, { liked: liked, likeCount: likeCount })
  },

  /* 查看器内评论增删 → 计数同步卡片 */
  onViewerComment(e) {
    const id = this.data.viewerId
    const delta = e.detail.delta || 0
    const item = this.data.list.find((x) => x.id === id) || this.data.results.find((x) => x.id === id)
    if (!item) return
    this.patchItem(id, { commentCount: Math.max(0, (item.commentCount || 0) + delta) })
  },

  /* 就地更新一条卡片数据（列表与搜索结果都可能是来源） */
  patchItem(id, patch) {
    const apply = (arr) => arr.map((item) => (item.id === id ? { ...item, ...patch } : item))
    const list = apply(this.data.list)
    const results = apply(this.data.results)
    this.setData({ list: this.sortList(list), results })
  },

  /* 卡片转发：open-type=share 按钮 + 页面级 onShareAppMessage
   * 图片打卡与视频打卡区分：图片用首图作封面（cloud:// 异步换临时链接，promise 形式）；
   * 视频打卡无静态封面，标题区分并走默认截图 */
  onShareAppMessage(e) {
    const d = (e && e.target && e.target.dataset) || {}
    const item = d.id
      ? (this.data.list.find((x) => x.id === d.id) || this.data.results.find((x) => x.id === d.id))
      : null
    const isVideo = !!(item && (item.media || []).some((m) => m.type === 'video'))
    const title = item
      ? item.user + (isVideo ? ' 的滑板视频' : ' 的滑板打卡')
      : (d.user ? d.user + ' 的滑板打卡' : '去哪滑 · 发现')
    const base = { title: title, path: '/pages/discover/discover' }
    const firstImg = item && (item.media || []).find((m) => m.type === 'image')
    if (firstImg) {
      return {
        ...base,
        promise: cloud.getMediaPreviewSources([firstImg]).then((s) => (
          s && s.length ? { title: base.title, path: base.path, imageUrl: s[0].url } : base
        )),
      }
    }
    return base
  },
})
