/* 第二轮同步：
 * 嘉兴 12 条补图（UPDATE by name）
 * 杭州：UPDATE 钱塘（补电话/营业时间）；INSERT 临平inPARK/桐庐滑板公园/创能体育（带 city!）；DELETE 千岛湖沪马（非滑板场地，系山地滑板车项目）
 * 回写嘉兴.json / 杭州.json
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ENV_ID = 'cloud1-d4grizmp31acb587e'
const BUCKET = 'cloud://cloud1-d4grizmp31acb587e.636c-cloud1-d4grizmp31acb587e-1477671117/'
const DIRS = { 嘉兴: path.join(__dirname, '..', 'images', 'jx'), 杭州: path.join(__dirname, '..', 'images', 'hz') }

function tcb(args) {
  return execFileSync('tcb', args, { encoding: 'utf8' })
}
function cmdJson(spec) {
  return JSON.stringify([spec])
}
function findImg(city, prefix) {
  const f = fs.readdirSync(DIRS[city]).find((x) => x.indexOf(prefix) === 0)
  if (!f) throw new Error('找不到图片: ' + prefix)
  return path.join(DIRS[city], f)
}
function uploadAndSet(coll, name, city, prefix, slug) {
  const local = findImg(city, prefix)
  const cloudPath = 'photos/' + (city === '嘉兴' ? 'jx' : 'hz') + '/' + slug + '.png'
  tcb(['storage', 'upload', local, cloudPath, '--envId', ENV_ID])
  const fileID = BUCKET + cloudPath
  tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: coll, CommandType: 'UPDATE', Command: JSON.stringify({ update: coll, updates: [{ q: { name: name }, u: { $set: { photos: [fileID], cover: fileID } } }] }) }),
    '--json'])
  console.log('[set]', coll, name, '→', cloudPath)
  return fileID
}

/* ===== 嘉兴补图 ===== */
const JX_VENUES = [
  ['嘉兴火车站南广场滑板公园', 'wide_angle_photo_of_a_modern_f_2026-09-03T15-51-58.png', 'railway-station-park'],
  ['中央公园泵道滑板公园', 'photo_of_an_asphalt_pump_track_2026-09-03T15-51-57.png', 'central-park-pump'],
  ['长纤塘公园滑板泵道', 'photo_of_a_small_pump_track_be_2026-09-03T15-51-59.png', 'changxiantang'],
  ['筒仓艺术中心滑板运动场', 'photo_of_a_skateboarding_spot__2026-09-03T15-52-08.png', 'silo-art'],
  ['万朵城体育公园极限运动场', 'photo_of_a_concrete_street_cou_2026-09-03T15-52-28.png', 'wanduocheng'],
  ['凌公塘公园街式区', 'photo_of_a_park_skateboarding__2026-09-03T15-52-30.png', 'linggongtang'],
  ['秀湖公园平地广场', 'photo_of_a_wide_flat_plaza_bes_2026-09-03T15-52-33.png', 'xiuhu'],
  ['湘家荡环湖广场', 'photo_of_a_lakeside_loop_road__2026-09-03T15-52-33.png', 'xiangjiadang'],
]
const JX_SHOPS = [
  ['爱滑板俱乐部', 'photo_of_a_skateboard_training_2026-09-03T15-52-57.png', 'aihuaban'],
  ['爱嘉滑板俱乐部', 'photo_of_a_small_neighborhood__2026-09-03T15-52-58.png', 'aijia'],
  ['劲益轮滑·滑板俱乐部（嘉善）', 'photo_of_a_youth_skateboard_co_2026-09-03T15-53-02.png', 'jingyi'],
  ['BIG兔极限运动（海宁）', 'photo_of_a_skateboarding_coach_2026-09-03T15-53-03.png', 'bigrabbit'],
]

console.log('==== 嘉兴补图 ====')
const jxFileIds = {}
JX_VENUES.forEach(([name, prefix, slug]) => { jxFileIds[name] = uploadAndSet('venues', name, '嘉兴', prefix, slug) })
JX_SHOPS.forEach(([name, prefix, slug]) => { jxFileIds[name] = uploadAndSet('shops', name, '嘉兴', prefix, slug) })

/* ===== 杭州：钱塘补电话/时间 ===== */
console.log('==== 杭州 ====')
tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
  cmdJson({ TableName: 'venues', CommandType: 'UPDATE', Command: JSON.stringify({ update: 'venues', updates: [{ q: { name: '钱塘轮滑中心滑板公园' }, u: { $set: { phone: '13666678926', hours: { open: '10:00', close: '21:00' } } } }] }) }),
  '--json'])
console.log('[update] 钱塘轮滑中心滑板公园 +phone/hours')

/* ===== 杭州：新增 3 实体（注意 city 字段！） ===== */
const inpark = 'photo_of_a_concrete_bowl_and_q_2026-09-03T15-53-04.png'
const tonglu = 'photo_of_a_street_style_skatep_2026-09-03T15-53-06.png'
const chuangneng = 'photo_of_a_roller_skating_and__2026-09-03T15-53-07.png'

function insertOne(coll, doc, city, prefix) {
  const local = findImg(city, prefix)
  const cloudPath = 'photos/hz/' + doc.id + '.png'
  tcb(['storage', 'upload', local, cloudPath, '--envId', ENV_ID])
  doc.photos = [BUCKET + cloudPath]
  doc.cover = doc.photos[0]
  tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: coll, CommandType: 'INSERT', Command: JSON.stringify({ insert: coll, documents: [doc] }) }),
    '--json'])
  console.log('[insert]', coll, doc.name)
}

insertOne('venues', {
  id: 'hz2-linping-inpark', kind: 'venue', city: '杭州', name: '临平银泰inPARK滑手空间',
  category: '混合', tags: [{ label: '免费', icon: 'tagFree' }, { label: '有灯', icon: 'tagLight' }],
  address: '临平区银泰inPARK潮流街区（滑手空间）', shortAddr: '临平银泰inPARK',
  latitude: null, longitude: null, rating: 0, distance: '', online: 0, hot: true,
  features: ['潮流街区滑板区', '碗池+抛台', '临平区首届青年滑板遛遛赛举办地'],
  operator: '', fee: '免费', status: '营业中',
}, '杭州', inpark)

insertOne('venues', {
  id: 'hz2-tonglu-park', kind: 'venue', city: '杭州', name: '桐庐滑板公园',
  category: '混合', tags: [{ label: '免费', icon: 'tagFree' }, { label: '水泥', icon: 'tagCement' }],
  address: '桐庐县春江东路洋洲小学西侧约210米', shortAddr: '春江东路洋洲小学西',
  latitude: null, longitude: null, rating: 0, distance: '', online: 0, hot: false,
  features: ['碗池+U型台+平地练习区', '工业风涂鸦墙', '新手到进阶全覆盖'],
  operator: '', fee: '免费', status: '营业中',
}, '杭州', tonglu)

insertOne('shops', {
  id: 'hz2-chuangneng', kind: 'shop', city: '杭州', name: '创能体育·轮滑·滑板（金沙湖店）',
  category: '培训机构', services: ['教学'],
  address: '钱塘区下沙街道金沙湖大剧院一层', shortAddr: '金沙湖大剧院一层',
  latitude: null, longitude: null, phone: '', hours: { open: '09:00', close: '21:00' },
  partnerVenues: [], legalName: '杭州创能体育发展有限公司', courses: ['轮滑/滑板少儿培训'],
  hot: false, status: '待核实',
}, '杭州', chuangneng)

/* ===== 删除千岛湖沪马（山地滑板车项目，非滑板场地） ===== */
tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
  cmdJson({ TableName: 'venues', CommandType: 'DELETE', Command: JSON.stringify({ delete: 'venues', deletes: [{ q: { name: '千岛湖沪马探险乐园泵道' }, limit: 0 }] }) }),
  '--json'])
console.log('[delete] 千岛湖沪马探险乐园泵道（非滑板场地）')

/* ===== 回写本地 JSON ===== */
function fillLocal(fileName, city, venueImgs, shopImgs) {
  const f = fs.readdirSync(__dirname).find((x) => {
    if (!x.endsWith('.json') || x.indexOf('import') >= 0) return false
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, x), 'utf8')).city === city } catch (e) { return false }
  })
  const jp = path.join(__dirname, f)
  const data = JSON.parse(fs.readFileSync(jp, 'utf8'))
  data.venues.forEach((v) => { if (venueImgs[v.name]) { v.photos = venueImgs[v.name]; v.cover = venueImgs[v.name][0] } })
  data.orgs.forEach((s) => { if (shopImgs[s.name]) { s.photos = shopImgs[s.name]; s.cover = shopImgs[s.name][0] } })
  data.summary = { venues: data.venues.length, orgs: data.orgs.length, relations: (data.relations || []).length, dropped: (data.dropped || []).length, needVerify: data.venues.filter((v) => v.needVerify).length + data.orgs.filter((s) => s.needVerify).length }
  fs.writeFileSync(jp, JSON.stringify(data, null, 2), 'utf8')
  console.log('[local]', f, 'venues', data.venues.length, '/ orgs', data.orgs.length)
}

fillLocal(null, '嘉兴', jxFileIds, jxFileIds)
