/* 微博式媒体查看器：图片+视频按混排顺序左右滑动；
 * 视频显示封面 + 播放按钮，点击才播放（不自动播放）；点图片或右上角 × 关闭 */
Component({
  properties: {
    visible: { type: Boolean, value: false },
    sources: { type: Array, value: [] },
    current: { type: Number, value: 0 },
  },

  data: {
    idx: 0,
    playingIdx: -1,
  },

  observers: {
    visible: function (v) {
      if (v) this.setData({ idx: this.data.current, playingIdx: -1 })
    },
  },

  methods: {
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

    noop: function () {},
  },
})
