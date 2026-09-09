/* 视频打卡预览页（原生页面）：视频预览从 media-viewer 浮层迁出，
 * 右滑返回直接使用系统页面手势（返回钮随转场移动、底下可见上一页，
 * 体验对齐场地详情页）。数据经 EventChannel 传入（sources/current/计数），
 * 点赞/评论结果经事件回传打开页同步卡片。 */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { ICON } = require('../../utils/icons.js')
const { getStatusBarHeight, goBack } = require('../../utils/nav.js')

Page({
  data: {
    sources: [],
    idx: 0,
    playingIdx: -1,
    commentsOpen: false,
    checkinId: '',
    user: '',
    liked: false,
    likeCount: 0,
    commentCount: 0,
    statusBarHeight: 20, /* 顶部返回与自绘导航行对齐 */
    icons: {
      back: ICON.chevronLeftWhite,
      heartWhite: ICON.heartWhite,
      heartOrange: ICON.heartOrange,
      commentWhite: ICON.commentWhite,
      shareWhite: ICON.shareNodesWhite,
      x: ICON.xWhite,
    },
  },

  onLoad() {
    this.setData({ statusBarHeight: getStatusBarHeight() })
    const ec = this.getOpenerEventChannel && this.getOpenerEventChannel()
    this._ec = ec && ec.on ? ec : null
    if (!this._ec) return
    this._ec.on('init', (d) => {
      d = d || {}
      this.setData({
        sources: d.sources || [],
        idx: d.current || 0,
        checkinId: d.id || '',
        user: d.user || '',
        liked: !!d.liked,
        likeCount: d.likeCount || 0,
        commentCount: d.commentCount || 0,
      })
      /* 打开页未持计数（场地/门店/打卡列表路径）→ 页面自拉云端计数 */
      if (d.id && (d.likeCount === undefined || d.commentCount === undefined)) {
        this.loadCounts(d.id)
      }
    })
  },

  /* 自拉计数：点赞态本地读，计数云端聚合（与页面卡片同口径） */
  loadCounts(id) {
    this.setData({ liked: store.isLiked(id) })
    cloud.getLikeCounts([id]).then((map) => {
      this.setData({ likeCount: map[id] || 0 })
    })
    cloud.getCommentCounts([id]).then((map) => {
      this.setData({ commentCount: map[id] || 0 })
    })
  },

  onSwiperChange(e) {
    /* 切换时 playingIdx 归位：播放中的 video（wx:if）随之卸载、自动停止 */
    this.setData({ idx: e.detail.current, playingIdx: -1 })
  },

  onPlayTap(e) {
    this.setData({ playingIdx: e.currentTarget.dataset.index })
  },

  goBack() {
    goBack()
  },

  /* 点赞：与卡片同源（store.toggleLike，含云端写入/重试），结果回传打开页 */
  toggleLike() {
    if (!this.data.checkinId) return
    const nowLiked = store.toggleLike(this.data.checkinId)
    const next = nowLiked ? this.data.likeCount + 1 : Math.max(0, this.data.likeCount - 1)
    this.setData({ liked: nowLiked, likeCount: next })
    this._emit('likechange', { liked: nowLiked, likeCount: next })
  },

  toggleComments() {
    this.setData({ commentsOpen: true })
  },

  closeComments() {
    this.setData({ commentsOpen: false })
  },

  /* 评论面板内发布/删除 → 计数同步 + 回传打开页 */
  onCommentChange(e) {
    const delta = (e.detail && e.detail.delta) || 0
    const next = Math.max(0, this.data.commentCount + delta)
    this.setData({ commentCount: next })
    this._emit('commentchange', { delta: delta })
  },

  /* 视频打卡转发：无静态封面走默认截图，标题区分（与发现页卡片视频口径一致） */
  onShareAppMessage() {
    const user = this.data.user
    return {
      title: user ? user + ' 的滑板视频' : '滑板视频 · 去哪滑',
      path: '/pages/discover/discover',
    }
  },

  _emit(evt, data) {
    if (this._ec) this._ec.emit(evt, data)
  },

  noop() {},
})
