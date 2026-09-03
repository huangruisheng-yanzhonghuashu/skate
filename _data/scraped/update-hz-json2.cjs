/* 回写杭州.json：新增3实体 + 千岛湖移入dropped + 补充钱塘电话 */
const fs = require('fs')
const path = require('path')
const BUCKET = 'cloud://cloud1-d4grizmp31acb587e.636c-cloud1-d4grizmp31acb587e-1477671117/'
const f = fs.readdirSync(__dirname).find((x) => {
  if (!x.endsWith('.json') || x.indexOf('import') >= 0) return false
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, x), 'utf8')).city === '杭州' } catch (e) { return false }
})
const jp = path.join(__dirname, f)
const data = JSON.parse(fs.readFileSync(jp, 'utf8'))

/* 千岛湖 → dropped */
const qtIdx = data.venues.findIndex((v) => v.name === '千岛湖沪马探险乐园泵道')
if (qtIdx >= 0) {
  const [removed] = data.venues.splice(qtIdx, 1)
  data.dropped.push({ name: removed.name, reason: '核实为山地滑板车（luge）赛道，非滑板场地' })
}

/* 新增 3 实体 */
if (!data.venues.some((v) => v.name === '临平银泰inPARK滑手空间')) {
  data.venues.push({
    kind: 'venue', name: '临平银泰inPARK滑手空间', city: '杭州', category: '混合',
    tags: [{ label: '免费', icon: 'tagFree' }, { label: '有灯', icon: 'tagLight' }],
    address: '临平区银泰inPARK潮流街区（滑手空间）', shortAddr: '临平银泰inPARK',
    latitude: null, longitude: null, indoor: false, lighting: true, fee: '免费',
    features: ['碗池+抛台', '临平区首届青年滑板遛遛赛举办地'], operator: '',
    photos: [BUCKET + 'photos/hz/hz2-linping-inpark.png'], cover: BUCKET + 'photos/hz/hz2-linping-inpark.png',
    hot: true, status: '营业中', confidence: '中', needVerify: false,
    sources: ['https://mp.weixin.qq.com/s?__biz=MzAxNjA3MzEyMQ==&mid=2662028067&idx=1&sn=fd1759ac000ccd460bceb2e1b5fb04a6', 'https://paper.hi-lp.cn/html/2025-07/14/content_135658_2401480.htm'],
  })
}
if (!data.venues.some((v) => v.name === '桐庐滑板公园')) {
  data.venues.push({
    kind: 'venue', name: '桐庐滑板公园', city: '杭州', category: '混合',
    tags: [{ label: '免费', icon: 'tagFree' }, { label: '水泥', icon: 'tagCement' }],
    address: '桐庐县春江东路洋洲小学西侧约210米', shortAddr: '春江东路洋洲小学西',
    latitude: null, longitude: null, indoor: false, lighting: false, fee: '免费',
    features: ['碗池+U型台+平地练习区', '工业风涂鸦墙'], operator: '',
    photos: [BUCKET + 'photos/hz/hz2-tonglu-park.png'], cover: BUCKET + 'photos/hz/hz2-tonglu-park.png',
    hot: false, status: '营业中', confidence: '中', needVerify: false,
    sources: ['https://hk.trip.com/moments/detail/tonglu-688-140081131/'],
  })
}
if (!data.orgs.some((s) => s.name === '创能体育·轮滑·滑板（金沙湖店）')) {
  data.orgs.push({
    kind: 'shop', name: '创能体育·轮滑·滑板（金沙湖店）', legalName: '杭州创能体育发展有限公司', city: '杭州',
    category: '培训机构', services: ['教学'],
    address: '钱塘区下沙街道金沙湖大剧院一层', shortAddr: '金沙湖大剧院一层',
    latitude: null, longitude: null, phone: '', hours: { open: '09:00', close: '21:00' },
    partnerVenues: [], courses: ['轮滑/滑板少儿培训'], social: {},
    photos: [BUCKET + 'photos/hz/hz2-chuangneng.png'], cover: BUCKET + 'photos/hz/hz2-chuangneng.png',
    hot: false, status: '待核实', confidence: '中', needVerify: true,
    sources: ['https://map.360.cn/site/k/%E8%BD%AE%E6%BB%91_%E5%98%89%E5%85%B4%E5%B8%82', 'https://www.zhipin.com/job_detail/8cb8bd7c028024131HN43tW9GFtZ.html'],
  })
}

/* 钱塘补电话/时间 */
const qt = data.venues.find((v) => v.name === '钱塘轮滑中心滑板公园')
if (qt) { qt.phone = '13666678926'; qt.hours = { open: '10:00', close: '21:00' } }

data.summary = {
  venues: data.venues.length, orgs: data.orgs.length,
  relations: (data.relations || []).length, dropped: (data.dropped || []).length,
  needVerify: data.venues.filter((v) => v.needVerify).length + data.orgs.filter((s) => s.needVerify).length,
}
fs.writeFileSync(jp, JSON.stringify(data, null, 2), 'utf8')
console.log('[local]', f, '→ venues', data.venues.length, '/ orgs', data.orgs.length, '/ dropped', data.dropped.length)
