/* 我的签到：本月统计带 + 日历（可切月） + 本月签到榜 + 最近签到记录（长按删除）
 * 口径：统计/日历/榜单/记录只数"签到"（现场记录），打卡（内容记录）不参与 */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { ICON } = require('../../utils/icons.js')

/* 设计稿：周一起始 */
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const BOARD_LIMIT = 20

Page({
  data: {
    stats: { total: 0, streak: 0, month: 0 },
    weekLabels: WEEK_LABELS,
    cells: [],
    monthTitle: '',
    monthChip: '',
    isCurrentMonth: true,
    board: [],
    boardExpanded: false,
    boardLoaded: false,
    myCount: 0,
    myRank: 0,
    records: [],
    icons: {
      chevronLeft: ICON.chevronLeftWhite,
      chevronRight: ICON.chevronRightAsh,
    },
  },

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ selected: 2 })
    const now = new Date()
    /* 仅冷进入归位当月；从详情页返回保留所看月份 */
    if (!this._inited) {
      this._viewYear = now.getFullYear()
      this._viewMonth = now.getMonth()
      this._inited = true
    }
    this.setData({ monthChip: (now.getMonth() + 1) + '月' })
    this.refresh()
    if (!this.data.boardLoaded) this.loadBoard(this.data.boardExpanded)
  },

  /* 本月边界（ISO 字符串；云端 at 为 ISO 串，可字典序比较） */
  monthRange() {
    const now = new Date()
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    }
  },

  /* 云端排行榜（本月）：聚合所有人场地"签到"数（店铺与打卡记录不计入），需 checkins"所有用户可读"权限 */
  loadBoard(expanded) {
    return cloud.getLeaderboard(expanded ? BOARD_LIMIT : 5, this.monthRange()).then((rows) => {
      const board = rows.map((b) => Object.assign({}, b, { char: (b.user || '滑').slice(0, 1) }))
      const me = board.find((b) => b.self)
      this.setData({ board, boardLoaded: true, myRank: me ? me.rank : 0 })
    })
  },

  /* 下拉刷新：统计/日历/记录同步重取，榜单回来后再收起刷新圈 */
  onPullDownRefresh() {
    this.refresh()
    this.loadBoard(this.data.boardExpanded).then(() => wx.stopPullDownRefresh())
  },

  toggleBoard() {
    const expanded = !this.data.boardExpanded
    this.setData({ boardExpanded: expanded })
    this.loadBoard(expanded)
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
    const state = store.getState()

    /* 本月签到次数（条数）：统计带"本月"与榜单底栏"我"共用 */
    const monthCount = state.checkins.filter((c) => {
      if (!store.isCheckinRec(c)) return false
      const d = new Date(c.at)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length

    /* 所看月份的签到日集合（本地口径，支持回看历史月份） */
    const checkedSet = new Set(
      state.checkins
        .filter((c) => {
          if (!store.isCheckinRec(c)) return false
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

    /* 最近签到记录（30条，不含打卡）：MM-DD + 地点 */
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    const records = state.checkins
      .filter(store.isCheckinRec)
      .slice(0, 30)
      .map((c) => {
        const d = new Date(c.at)
        return {
          id: c.id,
          venueId: c.venueId,
          venueName: c.venueName,
          kind: c.kind || 'venue',
          dateText: pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
        }
      })

    this.setData({
      stats: { total: s.total, streak: s.streak, month: monthCount },
      myCount: monthCount,
      cells,
      records,
      isCurrentMonth,
      monthTitle: viewYear + '年' + (viewMonth + 1) + '月',
    })
  },

  /* 记录点击 → 对应详情页 */
  goRecord(e) {
    const { id, kind } = e.currentTarget.dataset
    if (kind === 'shop') {
      wx.navigateTo({ url: '/pages/shop-detail/shop-detail?id=' + id })
    } else {
      wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + id })
    }
  },

  /* 记录长按删除（二次确认，本地+云端；榜单同步重取） */
  delRecord(e) {
    const id = e.currentTarget.dataset.id
    const rec = this.data.records.find((r) => r.id === id)
    wx.showModal({
      title: '删除记录',
      content: '删除「' + (rec ? rec.venueName : '该记录') + '」的这条签到记录？',
      confirmColor: '#E5484D',
      success: (r) => {
        if (!r.confirm) return
        store.deleteCheckin(id).then(() => {
          wx.showToast({ title: '已删除', icon: 'success' })
          this.refresh()
          this.loadBoard(this.data.boardExpanded)
        })
      },
    })
  },
})
