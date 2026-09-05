/* 我的签到：统计 + 日历（可切月） + 排行榜 + 打卡记录（长按删除） */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { fmtRel } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')

/* 设计稿：周一起始 */
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const BOARD_LIMIT = 20

Page({
  data: {
    stats: { total: 0, streak: 0, weekDays: 0 },
    weekLabels: WEEK_LABELS,
    cells: [],
    monthTitle: '',
    isCurrentMonth: true,
    board: [],
    boardExpanded: false,
    boardLoaded: false,
    records: [],
    icons: {
      trophy: ICON.trophyOrange,
      flame: ICON.flameOrangeStat,
      calendar: ICON.calendarOrange,
      chevronLeft: ICON.chevronLeftWhite,
      chevronRight: ICON.chevronRightAsh,
    },
  },

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ selected: 2 })
    /* 回到当月（跨月停留后回到页面时归位） */
    const now = new Date()
    this._viewYear = now.getFullYear()
    this._viewMonth = now.getMonth()
    this.refresh()
    if (!this.data.boardLoaded) this.loadBoard(this.data.boardExpanded)
  },

  /* 云端排行榜：聚合所有人场地签到数（店铺打卡不计入），需 checkins"所有用户可读"权限 */
  loadBoard(expanded) {
    cloud.getLeaderboard(expanded ? BOARD_LIMIT : 5).then((board) => {
      this.setData({ board, boardLoaded: true })
    })
  },

  /* 下拉刷新：统计/日历/记录/榜单全量重取 */
  onPullDownRefresh() {
    this.refresh()
    this.loadBoard(this.data.boardExpanded)
    wx.stopPullDownRefresh()
  },

  toggleBoard() {
    const expanded = !this.data.boardExpanded
    this.setData({ boardExpanded: expanded })
    if (expanded) {
      this.loadBoard(true)
      wx.showToast({ title: '已展开完整榜单', icon: 'none' })
    } else {
      this.loadBoard(false)
    }
  },

  /* 榜单行 → 滑手主页（本人也进新页面：openid 缺失时兜底用本人 openid） */
  goUserProfile(e) {
    const d = e.currentTarget.dataset
    cloud.ensureOpenid().then((my) => {
      const openid = d.openid || my || ''
      wx.navigateTo({
        url: '/pages/user-profile/user-profile?openid=' + encodeURIComponent(openid) +
          '&u=' + encodeURIComponent(d.user || ''),
      })
    })
  },

  /* 切月：delta ±1，跨年自动进位；不允许看未来月份 */
  switchMonth(e) {
    const delta = Number(e.currentTarget.dataset.delta) || 0
    let y = this._viewYear
    let m = this._viewMonth + delta
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    const now = new Date()
    if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth())) return
    this._viewYear = y
    this._viewMonth = m
    this.refresh()
  },

  refresh() {
    const s = store.calcStats()
    const now = new Date()
    const viewYear = this._viewYear
    const viewMonth = this._viewMonth

    /* 所看月份的签到日集合（本地记录口径，支持回看历史月份） */
    const checkedSet = new Set(
      store.getState().checkins
        .filter((c) => {
          const d = new Date(c.at)
          return d.getFullYear() === viewYear && d.getMonth() === viewMonth
        })
        .map((c) => new Date(c.at).getDate())
    )

    const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()

    const cells = []
    for (let i = 0; i < firstWeekday; i++) cells.push({ day: 0 })
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        checked: checkedSet.has(d),
        isToday: isCurrentMonth && d === now.getDate(),
        future: isCurrentMonth && d > now.getDate(),
      })
    }
    while (cells.length % 7 !== 0) cells.push({ day: 0 })

    /* 打卡记录（最近 30 条）：地点 + 类型 + 时间 + 留言 + 首图 */
    const records = store.getState().checkins.slice(0, 30).map((c) => ({
      id: c.id,
      venueId: c.venueId,
      venueName: c.venueName,
      kind: c.kind || 'venue',
      timeText: fmtRel(c.at),
      note: c.note || '',
      photo: (c.photos && c.photos[0]) || '',
    }))

    this.setData({
      stats: { total: s.total, streak: s.streak, weekDays: s.weekDays },
      cells,
      records,
      isCurrentMonth,
      monthTitle: viewYear + '年' + (viewMonth + 1) + '月',
    })
  },

  /* 打卡记录：点击进对应详情页 */
  goRecord(e) {
    const { id, kind } = e.currentTarget.dataset
    if (kind === 'shop') {
      wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + id })
    }
  },

  /* 打卡记录：长按删除（二次确认，本地+云端；替代常驻删除按钮防误触） */
  delRecord(e) {
    const id = e.currentTarget.dataset.id
    const rec = this.data.records.find((r) => r.id === id)
    wx.showModal({
      title: '删除打卡',
      content: '删除「' + (rec ? rec.venueName : '该打卡') + '」的这条打卡记录？',
      confirmColor: '#E5484D',
      success: (r) => {
        if (!r.confirm) return
        store.deleteCheckin(id).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' })
          this.refresh()
        })
      },
    })
  },

  previewRecordPhoto(e) {
    wx.previewImage({ urls: [e.currentTarget.dataset.url] })
  },
})
