/* 媒体预览分流助手：图片走 media-viewer 浮层（页内 setData，swiper 切图）；
 * 视频走原生 video-preview 页面（navigateTo，系统右滑返回，体验对齐场地详情页）。
 *
 * 打开方约定：
 * - 浮层路径：页面需有 viewerShow/viewerSources/viewerCurrent/viewerId 数据与
 *   onViewerClose（Tab 页的 TabBar 隐藏/恢复由本助手与页面各自处理）
 * - 视频页路径：页面可选实现 onViewerLike/onViewerComment（接收 { detail } 形参，
 *   与浮层组件 bind 事件同构），点赞/评论结果经 EventChannel 回传同步卡片 */
function open(page, opts) {
  const sources = opts.sources || []
  if (!sources.length) return
  const hasVideo = sources.some(function (s) { return s.type === 'video' })

  /* 纯图片：media-viewer 浮层（Tab 页需先藏 TabBar，关闭时页面恢复） */
  if (!hasVideo) {
    const tb = typeof page.getTabBar === 'function' && page.getTabBar()
    if (tb) tb.setData({ hidden: true })
    page.setData({
      viewerShow: true,
      viewerSources: sources,
      viewerCurrent: opts.current || 0,
      viewerId: opts.id || '',
      viewerLiked: !!opts.liked,
      viewerLikeCount: opts.likeCount || 0,
      viewerCommentCount: opts.commentCount || 0,
    })
    return
  }

  /* 视频打卡：跳原生页面。viewerId 先写入打开页，使 onViewerLike/onViewerComment
   * 沿用浮层时代的实现（内部读 this.data.viewerId 定位卡片） */
  if (page.data.viewerId !== undefined) page.setData({ viewerId: opts.id || '' })
  wx.navigateTo({
    url: '/pages/video-preview/video-preview',
    events: {
      likechange: function (data) {
        if (page.onViewerLike) page.onViewerLike({ detail: data })
      },
      commentchange: function (data) {
        if (page.onViewerComment) page.onViewerComment({ detail: data })
      },
    },
    success: function (res) {
      res.eventChannel.emit('init', {
        sources: sources,
        current: opts.current || 0,
        id: opts.id || '',
        liked: opts.liked,
        likeCount: opts.likeCount,
        commentCount: opts.commentCount,
        user: opts.user || '',
      })
    },
  })
}

module.exports = { open: open }
