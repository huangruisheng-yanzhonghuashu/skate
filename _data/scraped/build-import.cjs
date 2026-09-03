/* 抓取产物 → TCB 控制台导入文件（JSON Lines，每行一个完整文档）
 * 用法：node build-import.cjs [jiaxing|hangzhou]   （缺省 hangzhou，兼容旧用法）
 * 输入：./{城市}.json   输出：./{城市}-venues.import.jsonl / ./{城市}-shops.import.jsonl
 *
 * 去重规则（对齐云端种子数据 functions/seed/index.js，仅杭州需要）：
 * - 场地「钱塘轮滑中心滑板公园」已存在（hz-qiantang-wheel），跳过
 * - 场地「50滑板俱乐部（杭州大厦中央商城店）」与种子店铺 hz-50-central 同址同实体，跳过
 * - 机构名以「50滑板」开头的种子店铺已存在 4 家分店，跳过品牌级重复
 */
const fs = require('fs')
const path = require('path')

const CITY_KEY = (process.argv[2] || 'hangzhou').toLowerCase()
const CITIES = { jiaxing: '嘉兴', hangzhou: '杭州' }
const CITY = CITIES[CITY_KEY]
if (!CITY) {
  console.error('不支持的城市 key，可选：' + Object.keys(CITIES).join(' / '))
  process.exit(1)
}

const SRC = path.join(__dirname, CITY + '.json')
const data = JSON.parse(fs.readFileSync(SRC, 'utf8'))

/* 杭州专用：与旧种子去重 */
const SKIP_VENUES = CITY === '杭州' ? ['钱塘轮滑中心滑板公园', '50滑板俱乐部（杭州大厦中央商城店）'] : []
const SKIP_SHOP_PREFIX = CITY === '杭州' ? '50滑板' : '\u0000'

const CITY_SLUG = { 嘉兴: 'jx', 杭州: 'hz' }[CITY]

/* 抓取 services 词汇 → 入库 services 枚举（admin.js SERVICES） */
function mapServices(list) {
  const mapped = (list || []).map((s) => (s === '零售' ? '卖板' : s))
  const allowed = ['卖板', '教学', '维修', '配件', '服装', '组织活动', '装备租赁', '场地运营']
  const out = mapped.filter((s) => allowed.indexOf(s) >= 0)
  return out.length ? out : ['卖板']
}

function normHours(h) {
  return { open: (h && h.open) || '09:00', close: (h && h.close) || '21:00' }
}

let vi = 0
const venueLines = []
for (const v of data.venues) {
  if (SKIP_VENUES.indexOf(v.name) >= 0) continue
  vi += 1
  venueLines.push(JSON.stringify({
    id: 'imp-' + CITY_SLUG + '-v-' + String(vi).padStart(3, '0'),
    city: v.city,
    name: v.name,
    rating: 0,
    distance: '',
    latitude: v.latitude,
    longitude: v.longitude,
    category: v.category,
    online: 0,
    hot: !!v.hot,
    address: v.address || '',
    shortAddr: v.shortAddr || v.address || '',
    tags: v.tags || [],
    photos: [],
    feed: [],
    operator: v.operator || '',
    fee: v.fee || '',
    features: v.features || [],
    status: v.status || '待核实',
  }))
}

let si = 0
const shopLines = []
const skippedShops = []
for (const s of data.orgs) {
  if (SKIP_SHOP_PREFIX !== '\u0000' && s.name.indexOf(SKIP_SHOP_PREFIX) === 0) {
    skippedShops.push(s.name)
    continue
  }
  si += 1
  shopLines.push(JSON.stringify({
    id: 'imp-' + CITY_SLUG + '-s-' + String(si).padStart(3, '0'),
    city: s.city,
    name: s.name,
    category: s.category || '俱乐部',
    services: mapServices(s.services),
    address: s.address || '',
    shortAddr: s.shortAddr || s.address || '',
    latitude: s.latitude,
    longitude: s.longitude,
    phone: s.phone || '',
    hours: normHours(s.hours),
    partnerVenues: s.partnerVenues || [],
    legalName: s.legalName || '',
    courses: s.courses || [],
    photos: [],
    hot: !!s.hot,
    status: s.status || '待核实',
  }))
}

fs.writeFileSync(path.join(__dirname, CITY + '-venues.import.jsonl'), venueLines.join('\n') + '\n', 'utf8')
fs.writeFileSync(path.join(__dirname, CITY + '-shops.import.jsonl'), shopLines.join('\n') + '\n', 'utf8')

console.log('[' + CITY + '] venues:', venueLines.length, '/ orgs:', shopLines.length)
if (skippedShops.length) console.log('skipped shops(种子已有分店):', skippedShops.join(', '))
