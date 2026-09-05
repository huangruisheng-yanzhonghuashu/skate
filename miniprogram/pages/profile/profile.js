/* 我的：签到统计（快捷入口） + 编辑资料 + 打卡/报错/建议/推荐管理入口 */
const store = require('../../utils/store.js')
const cloud = require('../../utils/cloud.js')
const { ICON } = require('../../utils/icons.js')

const SKATE_YEARS = ['1年内', '1-3年', '3-5年', '5年以上']
/* 擅长标签预设词表（多选上限 MAX_SKILLS，展示在个人卡片） */
const TAG_OPTIONS = ['街式', '碗池', 'U池', '平花', '长板', '鱼板', '速降', '刷街', '道具', '教学']
const MAX_SKILLS = 5

/* 管理员标识缓存（config/admins 白名单，复用 manageVenue 的 check 校验，成功后本会话不再重复请求） */
let _adminChecked = false
let _isAdmin = false

Page({
  data: {
    user: store.getUser(),
    profileComplete: store.isProfileComplete(),
    city: '嘉兴',
    checkinCount: 0,
    postCount: 0,
    reportCount: 0,
    feedbackCount: 0,
    submissionCount: 0,
    isAdmin: false,
    /* 编辑资料弹窗 */
    editOpen: false,
    saving: false,
    form: { nickname: '', skateYears: '', avatarFileID: '', avatarTemp: '', skills: [] },
    years: SKATE_YEARS,
    tagOptions: TAG_OPTIONS,
    tagSel: {},
    icons: {
      chevron: ICON.chevronRightAsh,
      pin: ICON.pinOrangeSmall,
      file: ICON.fileOrange,
      admin: ICON.venueOrange,
      send: ICON.sendOrange,
      camera: ICON.cameraWhite,
      close: ICON.xWhite,
    },
  },

  onShow() {
    const tb = typeof this.getTabBar === 'function' && this.getTabBar()
    if (tb) tb.setData({ selected: 3 })
    this.refresh()
    this.loadCounts()
    this.loadAdmin()
  },

  refresh() {
    const s = store.calcStats()
    /* 打卡条数：内容记录（type=post，或旧数据有留言/媒体） */
    const postCount = store.getState().checkins.filter(store.isPostRec).length
    this.setData({
      checkinCount: s.total,
      postCount: postCount,
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

  /* 运营管理入口显隐：仅管理员（config/admins 白名单，走 manageVenue check）
   * 校验成功/失败后写模块级缓存，本会话不再重复调用 */
  loadAdmin() {
    if (_adminChecked) {
      this.setData({ isAdmin: _isAdmin })
      return
    }
    wx.cloud.callFunction({ name: 'manageVenue', data: { action: 'check', data: {} } })
      .then((r) => {
        _isAdmin = !!(r.result && r.result.ok)
        _adminChecked = true
        this.setData({ isAdmin: _isAdmin })
      })
      .catch((e) => {
        /* 云函数不可用/网络错误：按非管理员隐藏入口 */
        _isAdmin = false
        _adminChecked = true
        this.setData({ isAdmin: false })
        console.warn('[profile] 管理员校验失败', (e && e.errMsg) || (e && e.message) || e)
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
  goCheckins() { wx.switchTab({ url: '/pages/checkins/checkins' }) },
  goMyPosts() { wx.navigateTo({ url: '/pages/my-posts/my-posts' }) },
  goReports() { wx.navigateTo({ url: '/pages/reports/reports' }) },
  goFeedback() { wx.navigateTo({ url: '/pages/feedback/feedback' }) },
  goRecommend() { wx.navigateTo({ url: '/pages/submit/submit' }) },
  goAdmin() { wx.navigateTo({ url: '/pages/admin/admin' }) },
  goCityPicker() { wx.navigateTo({ url: '/pages/city-picker/city-picker' }) },
})
