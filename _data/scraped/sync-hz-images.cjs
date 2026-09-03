/* 杭州图片同步 + 数据补缺
 * 1. 上传 _data/images/hz/*.png → 云存储 photos/hz/<slug>.png
 * 2. 按 name UPDATE 现有 venues/shops 的 photos/cover
 * 3. 补插被全量重置清掉的历史种子实体（钱塘/亚运/BAC/大莲花/黄龙 + 50滑板4分店）
 * 4. 回写本地 杭州.json（photos/cover + 新补实体）
 * 依赖：tcb 已登录；图片已由 image_gen 生成
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ENV_ID = 'cloud1-d4grizmp31acb587e'
const BUCKET = 'cloud://cloud1-d4grizmp31acb587e.636c-cloud1-d4grizmp31acb587e-1477671117/'
const IMG_DIR = path.join(__dirname, '..', 'images', 'hz')

/* 实体名 → 图片文件前缀（image_gen 生成文件名前缀） */
const MAP = {
  venues: {
    '钱塘轮滑中心滑板公园': 'wide_angle_photo_of_a_professi_2026-09-03T15-33-00.png',
    '滨江陆冲双翘滑板场地': 'photo_of_a_small_outdoor_stree_2026-09-03T15-33-04.png',
    '天天滑板（萧山福尔特体育公园店）': 'photo_of_an_indoor_skatepark_i_2026-09-03T15-33-04.png',
    '湖滨滑板场': 'photo_of_a_street_skateboardin_2026-09-03T15-33-08.png',
    'FIGHTING时尚运动公园': 'photo_of_a_modern_indoor_skate_2026-09-03T15-33-39.png',
    'TTSKATEPARK进来滑板': 'photo_of_an_indoor_wooden_and__2026-09-03T15-33-38.png',
    '聚极地滑板场': 'aerial_photo_of_an_asphalt_pum_2026-09-03T15-33-40.png',
    '千岛湖沪马探险乐园泵道': 'photo_of_a_pump_track_and_adve_2026-09-03T15-33-44.png',
    '亚运滑板公园': 'photo_of_an_asian_games_skateb_2026-09-03T15-37-57.png',
    'BAC 社区滑板场（MOREPRK）': 'photo_of_a_community_concrete__2026-09-03T15-37-53.png',
    '奥体“大莲花”极限广场': 'photo_of_a_huge_flat_concrete__2026-09-03T15-37-54.png',
    '黄龙体育中心室外广场': 'photo_of_an_open_plaza_beside__2026-09-03T15-37-58.png',
  },
  shops: {
    '天天滑板': 'photo_of_a_kids_skateboard_tra_2026-09-03T15-34-14.png',
    '逆山长板滑板潮玩馆': 'photo_of_a_longboard_and_surf__2026-09-03T15-34-16.png',
    '逆山长板陆冲滑板店（23号大街店）': 'photo_of_a_small_skateboard_sh_2026-09-03T15-34-15.png',
    'FREEDOM滑板店': 'photo_of_a_classic_independent_2026-09-03T15-34-18.png',
    '果速空间轮滑滑板运动中心': 'photo_of_a_roller_skating_and__2026-09-03T15-34-20.png',
    '94CLUB·滑步车·滑板（港龙悠乐城店）': 'photo_of_a_kids_balance_bike_a_2026-09-03T15-34-23.png',
    '轮子公园（金海百货A馆店）': 'photo_of_an_indoor_roller_spor_2026-09-03T15-34-42.png',
    '炫动轮滑（上环桥店）': 'photo_of_an_indoor_roller_skat_2026-09-03T15-34-45.png',
    '艾溜轮滑（青山湖宝龙广场店）': 'photo_of_a_roller_and_skateboa_2026-09-03T15-34-49.png',
    'Hangzhou Skate Crew': 'photo_of_a_group_of_young_skat_2026-09-03T15-34-49.png',
    'POPO小酒馆·POPOSTAR': 'photo_of_a_cozy_skate_culture__2026-09-03T15-34-53.png',
    '50滑板俱乐部（杭州大厦中央商城店）': 'photo_of_a_busy_indoor_skatebo_2026-09-03T15-37-56.png',
    '50滑板俱乐部（运河体育公园店）': 'photo_of_a_busy_indoor_skatebo_2026-09-03T15-37-56.png',
    '50滑板俱乐部（加州阳光·开元广场店）': 'photo_of_a_busy_indoor_skatebo_2026-09-03T15-37-56.png',
    '50滑板店（东站西子国际店）': 'photo_of_a_busy_indoor_skatebo_2026-09-03T15-37-56.png',
  },
}

const SLUG = {
  venues: {
    '钱塘轮滑中心滑板公园': 'qiantang-wheel-park',
    '滨江陆冲双翘滑板场地': 'binjiang-luchong',
    '天天滑板（萧山福尔特体育公园店）': 'tiantian-xiaoshan',
    '湖滨滑板场': 'hubin',
    'FIGHTING时尚运动公园': 'fighting',
    'TTSKATEPARK进来滑板': 'tts',
    '聚极地滑板场': 'jujidi',
    '千岛湖沪马探险乐园泵道': 'qiandaohu',
    '亚运滑板公园': 'asiad-park',
    'BAC 社区滑板场（MOREPRK）': 'bac',
    '奥体“大莲花”极限广场': 'olotus',
    '黄龙体育中心室外广场': 'huanglong',
  },
  shops: {
    '天天滑板': 'tiantian-main',
    '逆山长板滑板潮玩馆': 'nishan-port',
    '逆山长板陆冲滑板店（23号大街店）': 'nishan-23rd',
    'FREEDOM滑板店': 'freedom',
    '果速空间轮滑滑板运动中心': 'guosu',
    '94CLUB·滑步车·滑板（港龙悠乐城店）': '94club',
    '轮子公园（金海百货A馆店）': 'wheelpark',
    '炫动轮滑（上环桥店）': 'xuanmove',
    '艾溜轮滑（青山湖宝龙广场店）': 'ailu',
    'Hangzhou Skate Crew': 'skate-crew',
    'POPO小酒馆·POPOSTAR': 'popo',
    '50滑板俱乐部（杭州大厦中央商城店）': 'fifty-central',
    '50滑板俱乐部（运河体育公园店）': 'fifty-canal',
    '50滑板俱乐部（加州阳光·开元广场店）': 'fifty-kaiyuan',
    '50滑板店（东站西子国际店）': 'fifty-east',
  },
}

function tcb(args) {
  return execFileSync('tcb', args, { encoding: 'utf8' })
}
function cmdJson(spec) {
  return JSON.stringify([spec])
}
function upload(local, cloudPath) {
  tcb(['storage', 'upload', local, cloudPath, '--envId', ENV_ID])
  console.log('[upload]', cloudPath)
  return BUCKET + cloudPath
}
function updateByName(coll, name, photos) {
  return tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: coll, CommandType: 'UPDATE', Command: JSON.stringify({ update: coll, updates: [{ q: { name: name }, u: { $set: { photos: photos, cover: photos[0] } } }] }) }),
    '--json'])
}
function insert(coll, docs) {
  return tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: coll, CommandType: 'INSERT', Command: JSON.stringify({ insert: coll, documents: docs }) }),
    '--json'])
}

/* 补插的历史种子实体（真实地点，坐标沿用 seed 云函数） */
const RESTORE_VENUES = [
  { id: 'hz-qiantang-wheel', name: '钱塘轮滑中心滑板公园', category: '混合', tags: [{ label: '混合', icon: 'tagMixed' }, { label: '免费', icon: 'tagFree' }, { label: '有灯', icon: 'tagLight' }, { label: '水泥', icon: 'tagCement' }], address: '钱塘区拾里路100号钱塘轮滑中心北侧', shortAddr: '钱塘轮滑中心（拾里路）', latitude: 30.314, longitude: 120.3655, hot: true, fee: '免费', operator: '', status: '营业中' },
  { id: 'hz-asiad-park', name: '亚运滑板公园', category: '混合', tags: [{ label: '混合', icon: 'tagMixed' }, { label: '免费', icon: 'tagFree' }, { label: '无灯', icon: 'tagLight' }], address: '钱塘区东部湾总部基地，22号大街与之江东路交叉口', shortAddr: '东部湾（之江东路）', latitude: 30.3095, longitude: 120.3925, hot: false, fee: '免费', operator: '', status: '待核实' },
  { id: 'hz-bac-moreprk', name: 'BAC 社区滑板场（MOREPRK）', category: '街式', tags: [{ label: '街式', icon: 'tagMixed' }, { label: '收费', icon: 'tagFree' }, { label: '有灯', icon: 'tagLight' }], address: '滨江区 MOREPRK 滑板公园', shortAddr: '滨江区（MOREPRK）', latitude: 30.2075, longitude: 120.205, hot: false, fee: '付费', operator: '', status: '待核实' },
  { id: 'hz-olotus-plaza', name: '奥体“大莲花”极限广场', category: '平地', tags: [{ label: '平地', icon: 'tagMixed' }, { label: '免费', icon: 'tagFree' }, { label: '有灯', icon: 'tagLight' }], address: '滨江区飞虹路3号奥体博览城', shortAddr: '奥体博览城（飞虹路）', latitude: 30.228, longitude: 120.226, hot: true, fee: '免费', operator: '', status: '待核实' },
  { id: 'hz-huanglong', name: '黄龙体育中心室外广场', category: '平地', tags: [{ label: '平地', icon: 'tagMixed' }, { label: '免费', icon: 'tagFree' }, { label: '有灯', icon: 'tagLight' }], address: '西湖区黄龙路1号黄龙体育中心', shortAddr: '黄龙体育中心', latitude: 30.2665, longitude: 120.1335, hot: false, fee: '免费', operator: '', status: '待核实' },
]
const RESTORE_SHOPS = [
  { id: 'hz-50-central', name: '50滑板俱乐部（杭州大厦中央商城店）', category: '俱乐部', services: ['卖板', '教学', '维修', '服装'], address: '拱墅区杭州大厦购物城中央商城', shortAddr: '杭州大厦中央商城', latitude: 30.274, longitude: 120.161, phone: '18758551949', hours: { open: '10:00', close: '22:00' }, hot: true, partnerVenues: ['钱塘轮滑中心滑板公园'] },
  { id: 'hz-50-canal', name: '50滑板俱乐部（运河体育公园店）', category: '俱乐部', services: ['卖板', '教学'], address: '拱墅区丰潭路690号运河体育公园', shortAddr: '丰潭路690号', latitude: 30.287, longitude: 120.106, phone: '', hours: { open: '09:00', close: '21:00' }, hot: false, partnerVenues: [] },
  { id: 'hz-50-kaiyuan', name: '50滑板俱乐部（加州阳光·开元广场店）', category: '俱乐部', services: ['卖板', '教学', '维修'], address: '萧山区金城路333号加州阳光·开元广场', shortAddr: '萧山金城路333号', latitude: 30.163, longitude: 120.264, phone: '17767105967', hours: { open: '10:00', close: '21:30' }, hot: false, partnerVenues: [] },
  { id: 'hz-50-east', name: '50滑板店（东站西子国际店）', category: '板店', services: ['卖板', '配件'], address: '上城区和兴路东站西子国际大厦', shortAddr: '东站西子国际', latitude: 30.2905, longitude: 120.2125, phone: '', hours: { open: '10:00', close: '21:00' }, hot: false, partnerVenues: [] },
]

function findImg(prefix) {
  const f = fs.readdirSync(IMG_DIR).find((x) => x.indexOf(prefix) === 0)
  if (!f) throw new Error('找不到图片：' + prefix)
  return path.join(IMG_DIR, f)
}

function main() {
  const all = { venues: { ...MAP.venues }, shops: { ...MAP.shops } }
  const fileIds = {} // name -> [fileID]

  for (const coll of ['venues', 'shops']) {
    for (const name of Object.keys(all[coll])) {
      const local = findImg(all[coll][name])
      const cloudPath = 'photos/hz/' + SLUG[coll][name] + '.png'
      upload(local, cloudPath)
      fileIds[name] = [BUCKET + cloudPath]
    }
  }

  console.log('---- 更新现有文档 ----')
  for (const name of Object.keys(MAP.venues)) {
    updateByName('venues', name, fileIds[name])
    console.log('[update venue]', name)
  }
  for (const name of Object.keys(MAP.shops)) {
    updateByName('shops', name, fileIds[name])
    console.log('[update shop]', name)
  }

  console.log('---- 补插缺失实体 ----')
  const vDocs = RESTORE_VENUES.map((v) => ({
    ...v,
    rating: 0, distance: '', online: 0,
    photos: fileIds[v.name] || [],
    cover: (fileIds[v.name] || [])[0] || '',
    features: [], feed: [],
  }))
  const sDocs = RESTORE_SHOPS.map((s) => ({
    ...s,
    legalName: '',
    courses: [],
    photos: fileIds[s.name] || [],
    cover: (fileIds[s.name] || [])[0] || '',
  }))
  insert('venues', vDocs)
  insert('shops', sDocs)
  console.log('[insert]', 'venues', vDocs.length, 'shops', sDocs.length)

  /* 回写本地 杭州.json */
  const jp = path.join(__dirname, '杭州.json')
  const data = JSON.parse(fs.readFileSync(jp, 'utf8'))
  const byNameV = {}
  data.venues.forEach((v) => { byNameV[v.name] = v })
  for (const v of RESTORE_VENUES) {
    if (!byNameV[v.name]) data.venues.push({
      kind: 'venue', name: v.name, city: '杭州', category: v.category, tags: v.tags,
      address: v.address, shortAddr: v.shortAddr, latitude: v.latitude, longitude: v.longitude,
      indoor: false, lighting: (v.tags || []).some((t) => t.label === '有灯'), fee: v.fee,
      features: [], operator: '', photos: fileIds[v.name] || [], cover: (fileIds[v.name] || [])[0] || '',
      hot: !!v.hot, status: v.status, confidence: '中', needVerify: true, sources: [],
      _merge_note: '恢复自小程序历史种子（真实地点，坐标沿用）',
    })
  }
  const byNameS = {}
  data.orgs.forEach((s) => { byNameS[s.name] = s })
  for (const s of RESTORE_SHOPS) {
    if (!byNameS[s.name]) data.orgs.push({
      kind: 'shop', name: s.name, legalName: '', city: '杭州', category: s.category, services: s.services,
      address: s.address, shortAddr: s.shortAddr, latitude: s.latitude, longitude: s.longitude,
      phone: s.phone, hours: s.hours, partnerVenues: s.partnerVenues, courses: [], social: {},
      photos: fileIds[s.name] || [], cover: (fileIds[s.name] || [])[0] || '',
      hot: !!s.hot, status: '待核实', confidence: '中', needVerify: true, sources: [],
      _merge_note: '恢复自小程序历史种子（真实地点，坐标沿用）',
    })
  }
  const setPhotos = (list, coll) => list.forEach((e) => {
    if (fileIds[e.name]) { e.photos = fileIds[e.name]; e.cover = fileIds[e.name][0] }
  })
  setPhotos(data.venues, 'venues')
  setPhotos(data.orgs, 'shops')
  data.summary = { venues: data.venues.length, orgs: data.orgs.length, relations: (data.relations || []).length, dropped: (data.dropped || []).length, needVerify: data.venues.filter((v) => v.needVerify).length + data.orgs.filter((s) => s.needVerify).length }
  fs.writeFileSync(jp, JSON.stringify(data, null, 2), 'utf8')
  console.log('[local] 杭州.json 已回写：venues', data.venues.length, '/ orgs', data.orgs.length)
}

main()
