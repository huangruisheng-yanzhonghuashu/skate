/* 我的：签到统计 + 编辑资料 + 入口 */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { fmtRel } = require('../../utils/format.js')
const { ICON } = require('../../utils/icons.js')

const SKATE_YEARS = ['1年内', '1-3年', '3-5年', '5年以上']
/* 擅长标签预设词表（多选上限 MAX_SKILLS，展示在个人卡片） */
const TAG_OPTIONS = ['街式', '碗池', 'U池', '平花', '长板', '鱼板', '速降', '刷街', '道具', '教学']
const MAX_SKILLS = 5

Page({
  data: {
    user: store.getUser(),
    profileComplete: store.isProfileComplete(),
    city: '嘉兴',
    checkinCount: 0,
    reportCount: 0,
    feedbackCount: 0,
    submissionCount: 0,
    recent: [],
    /* 编辑资料弹窗 */
    editOpen: false,
    saving: false,
    form: { nickname: '', skateYears: '', avatarFileID: '', avatarTemp: '', skills: [] },
    years: SKATE_YEARS,
    tagOptions: TAG_OPTIONS,
    tagSel: {},
    icons: {
      chevron: ICON.chevronRightAsh,
      flame: ICON.flameOrange,
      pin: ICON.pinOrangeSmall,
      file: ICON.fileOrange,
      settings: ICON.settingsOrange,
      admin: ICON.venueOrange,
      send: ICON.sendOrange,
      plus: ICON.plusOrange,
      close: ICON.xWhite,
      camera: ICON.cameraWhite,
    },
  },

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ selected: 3 })
    this.refresh()
    this.loadCounts()
  },

  refresh() {
    const s = store.calcStats()
    const recent = store.getState().checkins.slice(0, 3).map((c) => ({
      id: c.id,
      venueId: c.venueId,
      venueName: c.venueName,
      timeText: fmtRel(c.at),
    }))
    this.setData({
      checkinCount: s.total,
      recent: recent,
      city: store.getCity(),
      user: store.getUser(),
      profileComplete: store.isProfileComplete(),
    })
  },

  /* 报错/建议/推荐计数（真实云数据，互相独立） */
  loadCounts() {
    cloud.countMyReports().then((n) => {
      this.setData({ reportCount: n })
    })
    cloud.countMyFeedback().then((n) => {
      this.setData({ feedbackCount: n })
    })
    cloud.countMySubmissions().then((n) => {
      this.setData({ submissionCount: n })
    })
  },

  /* ===== 编辑资料 ===== */
  openEdit() {
    const u = store.getUser()
    const skills = Array.isArray(u.skills) ? u.skills.slice() : []
    const tagSel = {}
    skills.forEach(function (t) { tagSel[t] = true })
    this.setData({
      editOpen: true,
      saving: false,
      form: { nickname: u.nickname, skateYears: u.skateYears, avatarFileID: u.avatarFileID, avatarTemp: '', skills: skills },
      tagSel: tagSel,
    })
  },

  closeEdit() {
    if (this.data.saving) return
    this.setData({ editOpen: false })
  },

  noop() { /* 阻止冒泡关闭弹窗 */ },

  /* 微信官方头像填写能力：返回临时文件路径 */
  onChooseAvatar(e) {
    this.setData({ 'form.avatarTemp': e.detail.avatarUrl })
  },

  onNicknameInput(e) {
    this.setData({ 'form.nickname': e.detail.value })
  },

  /* 滑龄：行内 chip 单选 */
  onYearTap(e) {
    this.setData({ 'form.skateYears': e.currentTarget.dataset.year })
  },

  /* 擅长标签点选（上限 MAX_SKILLS） */
  onTagToggle(e) {
    const tag = e.currentTarget.dataset.tag
    const sel = this.data.tagSel
    if (sel[tag]) {
      delete sel[tag]
    } else {
      if (Object.keys(sel).length >= MAX_SKILLS) {
        wx.showToast({ title: '最多选 ' + MAX_SKILLS + ' 个', icon: 'none' })
        return
      }
      sel[tag] = true
    }
    this.setData({
      tagSel: sel,
      'form.skills': Object.keys(sel),
    })
  },

  saveProfile() {
    if (this.data.saving) return
    const f = this.data.form
    const nickname = (f.nickname || '').trim()
    if (!nickname) {
      wx.showToast({ title: '请填写昵称', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    const apply = (avatarFileID) => {
      store.saveProfile({
        nickname: nickname,
        avatarFileID: avatarFileID || f.avatarFileID,
        skateYears: f.skateYears,
        skills: f.skills || [],
      }).then(() => {
        this.setData({ editOpen: false, saving: false })
        this.refresh()
        wx.showToast({ title: '资料已保存', icon: 'success' })
      }).catch((e) => {
        this.setData({ saving: false })
        wx.showToast({ title: '保存失败，请重试', icon: 'none' })
        console.warn('[profile] 资料保存失败', (e && e.errCode) || (e && e.message))
      })
    }
    if (f.avatarTemp) {
      /* 新选了头像：先传云存储拿 fileID，再保存资料 */
      cloud.uploadAvatar(f.avatarTemp).then(apply).catch((e) => {
        this.setData({ saving: false })
        wx.showToast({ title: '头像上传失败，请重试', icon: 'none' })
        console.warn('[profile] 头像上传失败', (e && e.errCode) || (e && e.message))
      })
    } else {
      apply('')
    }
  },

  /* ===== 菜单跳转 ===== */
  goHome() { wx.switchTab({ url: '/pages/home/home' }) },
  goCheckins() { wx.switchTab({ url: '/pages/checkins/checkins' }) },
  goReports() { wx.navigateTo({ url: '/pages/reports/reports' }) },
  goFeedback() { wx.navigateTo({ url: '/pages/feedback/feedback' }) },
  goRecommend() { wx.navigateTo({ url: '/pages/recommend/recommend' }) },
  goAdmin() { wx.navigateTo({ url: '/pages/admin/admin' }) },
  goCityPicker() { wx.navigateTo({ url: '/pages/city-picker/city-picker' }) },
  goSettings() { wx.showToast({ title: '设置即将上线', icon: 'none' }) },
  goVenue(e) { wx.navigateTo({ url: '/pages/venue-detail/venue-detail?id=' + e.currentTarget.dataset.id }) },
})
