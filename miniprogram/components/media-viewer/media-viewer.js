/* 微博式媒体查看器：图片+视频按混排顺序左右滑动；
 * 视频显示封面 + 播放按钮，点击才播放（不自动播放）；点图片或左上返回关闭；
 * 顶部计数器 + 底部圆点（多图）。
 * 传入 checkinId 时开启预览内互动（设计稿 v1.5 状态 A/C）：图片/视频一致，
 * 右下角点赞/评论/转发操作组 + 半屏评论面板。
 * 两种计数来源：页面已持有计数 → 传 liked/like-count/comment-count（发现页/详情页）；
 * 页面无计数 → 传 auto-counts，查看器打开时自动拉取点赞/评论数与点赞态 */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { ICON } = require('../../utils/icons.js')
const { getStatusBarHeight } = require('../../utils/nav.js')

Component({
  properties: {
    visible: { type: Boolean, value: false },
    sources: { type: Array, value: [] },
    current: { type: Number, value: 0 },
    /* 互动上下文（可选）：checkinId 为空则不显示操作组 */
    checkinId: { type: String, value: '' },
    liked: { type: Boolean, value: false },
    likeCount: { type: Number, value: 0 },
    commentCount: { type: Number, value: 0 },
    /* 页面无计数时开启：查看器自拉云端计数 */
    autoCounts: { type: Boolean, value: false },
  },

  data: {
    idx: 0,
    playingIdx: -1,
    commentsOpen: false,
    videoMode: false, /* 视频预览态（打卡图视频互斥）：显示左上返回；图片预览点图关闭 */
    canDragClose: false, /* 单视频预览才接管横滑做右滑关闭（多图横滑留给 swiper 切图） */
    dragX: 0, /* 右滑关闭：整层浮层跟手位移（px），露出底下页面 */
    anim: false, /* true 时浮层位移带过渡（回弹/退场动画），跟手过程中必须为 false */
    statusBarHeight: 20, /* 顶部返回/计数器与页面自绘导航行对齐 */
    icons: {
      back: ICON.chevronLeftWhite,
      heartWhite: ICON.heartWhite,
      heartOrange: ICON.heartOrange,
      commentWhite: ICON.commentWhite,
      shareWhite: ICON.shareNodesWhite,
      x: ICON.xWhite,
    },
  },

  lifetimes: {
    attached() {
      this.setData({ statusBarHeight: getStatusBarHeight() })
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      this._winWidth = info.windowWidth || 375
    },
  },

  observers: {
    sources: function (sources) {
      const list = sources || []
      const videoMode = list.some(function (s) { return s.type === 'video' })
      this.setData({ videoMode: videoMode, canDragClose: videoMode && list.length === 1 })
    },
    'visible, checkinId': function (v, id) {
      if (!v) return
      this.setData({ idx: this.data.current, playingIdx: -1, commentsOpen: false, dragX: 0, anim: false })
      if (id && this.data.autoCounts) {
        this.loadCounts(id)
      }
    },
  },

  methods: {
    /* 自动计数：点赞态本地读，计数云端聚合（与页面卡片同口径）；每次打开刷新 */
    loadCounts: function (id) {
      this.setData({ liked: store.isLiked(id) })
      cloud.getLikeCounts([id]).then((map) => {
        if (this.data.visible && this.data.checkinId === id) {
          this.setData({ likeCount: map[id] || 0 })
        }
      })
      cloud.getCommentCounts([id]).then((map) => {
        if (this.data.visible && this.data.checkinId === id) {
          this.setData({ commentCount: map[id] || 0 })
        }
      })
    },

    onSwiperChange: function (e) {
      /* 切换时 playingIdx 归位：播放中的 video（wx:if）随之卸载、自动停止 */
      this.setData({ idx: e.detail.current, playingIdx: -1 })
    },

    onClose: function () {
      this.setData({ playingIdx: -1 })
      this.triggerEvent('close')
    },

    onPlayTap: function (e) {
      this.setData({ playingIdx: e.currentTarget.dataset.index })
    },

    /* 视频预览右滑关闭（对齐场地详情页系统右滑返回的体验）：
     * 整层浮层（含返回钮、黑底）跟手右移，露出底下页面；
     * 松手时横向位移超 60px 或快速轻甩（速度判定）即滑出退场，否则带动画回弹。
     * 仅单视频预览接管横滑（多图横滑留给 swiper 切图） */
    onTouchStart: function (e) {
      if (this._closing) return
      const t = e.touches && e.touches[0]
      if (!t) return
      this._touch = { x: t.clientX, y: t.clientY, time: Date.now() }
      this._moved = false
    },

    onTouchMove: function (e) {
      if (!this._touch || !this.data.canDragClose) return
      const t = e.touches && e.touches[0]
      if (!t) return
      const dx = t.clientX - this._touch.x
      const dy = t.clientY - this._touch.y
      /* 仅右向且横向主导时跟手 */
      if (dx > 0 && Math.abs(dx) > Math.abs(dy)) {
        this._moved = true
        this.setData({ dragX: dx, anim: false })
      }
    },

    onTouchEnd: function (e) {
      if (!this._touch) return
      const t = (e.changedTouches && e.changedTouches[0]) || {}
      const dx = (t.clientX || 0) - this._touch.x
      const dy = (t.clientY || 0) - this._touch.y
      const dt = Math.max(1, Date.now() - this._touch.time)
      this._touch = null
      if (!this._moved) return
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.5
      const flick = dx > 20 && dx / dt > 0.4 /* 快速轻甩：小位移也可关 */
      if (horizontal && (dx > 60 || flick)) {
        /* 退场：整层带动画滑出屏幕，结束后再真正关闭（不复位 dragX，避免闪黑） */
        this._closing = true
        this.setData({ anim: true, dragX: this._winWidth })
        setTimeout(() => {
          this.onClose()
          this._closing = false
        }, 240)
      } else if (this.data.dragX) {
        /* 回弹归位 */
        this.setData({ anim: true, dragX: 0 })
      }
    },

    /* 点赞：与页面同源（store.toggleLike，含云端写入/重试），结果通过 likechange 同步页面 */
    toggleLike: function () {
      if (!this.data.checkinId) return
      const nowLiked = store.toggleLike(this.data.checkinId)
      const next = nowLiked ? this.data.likeCount + 1 : Math.max(0, this.data.likeCount - 1)
      this.setData({ liked: nowLiked, likeCount: next })
      this.triggerEvent('likechange', { liked: nowLiked, likeCount: next })
    },

    toggleComments: function () {
      this.setData({ commentsOpen: true })
    },

    closeComments: function () {
      this.setData({ commentsOpen: false })
    },

    /* 评论面板内发布/删除 → 计数同步页面（comment-box countchange 透传） */
    onCommentChange: function (e) {
      const delta = (e.detail && e.detail.delta) || 0
      const next = Math.max(0, this.data.commentCount + delta)
      this.setData({ commentCount: next })
      this.triggerEvent('commentchange', { delta: delta })
    },

    noop: function () {},
  },
})
