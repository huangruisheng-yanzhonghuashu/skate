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
    dragX: 0, /* 视频预览右滑关闭：跟手位移（px） */
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
    },
  },

  observers: {
    sources: function (sources) {
      const list = sources || []
      this.setData({ videoMode: list.some(function (s) { return s.type === 'video' }) })
    },
    'visible, checkinId': function (v, id) {
      if (!v) return
      this.setData({ idx: this.data.current, playingIdx: -1, commentsOpen: false, dragX: 0 })
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

    /* 视频预览右滑关闭（体验对齐场地详情页的系统右滑返回）：
     * 手指跟手位移，松手时横向位移超过 60px 且明显大于纵向即关闭，否则回弹。
     * 单视频预览横滑无导航用途，可安全接管；图片多图预览的横滑留给 swiper 切图 */
    onTouchStart: function (e) {
      const t = e.touches && e.touches[0]
      if (!t) return
      this._touch = { x: t.clientX, y: t.clientY }
    },

    onTouchMove: function (e) {
      if (!this._touch) return
      const t = e.touches && e.touches[0]
      if (!t) return
      const dx = t.clientX - this._touch.x
      const dy = t.clientY - this._touch.y
      /* 仅右向且横向主导时跟手 */
      if (dx > 0 && Math.abs(dx) > Math.abs(dy)) {
        this.setData({ dragX: dx })
      }
    },

    onTouchEnd: function (e) {
      if (!this._touch) return
      const t = (e.changedTouches && e.changedTouches[0]) || {}
      const dx = (t.clientX || 0) - this._touch.x
      const dy = (t.clientY || 0) - this._touch.y
      this._touch = null
      this.setData({ dragX: 0 })
      if (dx > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        this.onClose()
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
