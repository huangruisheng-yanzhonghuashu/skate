/* 云数据导入脚本（按城市）
 * 用法：
 *   node cloud-import.cjs jiaxing   → 只替换嘉兴：备份 → 删 city=嘉兴 → 插入嘉兴数据
 *   node cloud-import.cjs hangzhou  → 只替换杭州
 *   node cloud-import.cjs           → 全量重置：备份 → 清空 venues/shops → 导入全部 JSONL
 * 依赖：CloudBase CLI 3.8+ 且已 tcb login（execFileSync 直调，无 shell 转义问题）
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ENV_ID = 'cloud1-d4grizmp31acb587e'
const BACKUP_DIR = path.join(__dirname, '..', 'backup')
const CITIES = { jiaxing: '嘉兴', hangzhou: '杭州' }

function readJsonl(f) {
  return fs.readFileSync(path.join(__dirname, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
}
function tcb(args) {
  const out = execFileSync('tcb', args, { encoding: 'utf8' })
  console.log('[tcb]', args.slice(0, 3).join(' '), '→ ok')
  return out
}
function cmdJson(spec) {
  return JSON.stringify([spec])
}
function deleteAll(coll) {
  return tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: coll, CommandType: 'DELETE', Command: JSON.stringify({ delete: coll, deletes: [{ q: {}, limit: 0 }] }) }),
    '--json'])
}
function deleteByCity(coll, city) {
  return tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: coll, CommandType: 'DELETE', Command: JSON.stringify({ delete: coll, deletes: [{ q: { city: city }, limit: 0 }] }) }),
    '--json'])
}
function insertDocs(coll, docs) {
  if (!docs.length) return
  return tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: coll, CommandType: 'INSERT', Command: JSON.stringify({ insert: coll, documents: docs }) }),
    '--json'])
}
function count(coll) {
  return tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: coll, CommandType: 'COMMAND', Command: JSON.stringify({ count: coll, query: {} }) }),
    '--json'])
}

function main() {
  const arg = (process.argv[2] || '').toLowerCase()
  const tasks = [] // [{city|null, venueFile, shopFile}]

  if (arg) {
    const city = CITIES[arg]
    if (!city) {
      console.error('不支持的城市 key，可选：' + Object.keys(CITIES).join(' / ') + '，或不带参数做全量重置')
      process.exit(1)
    }
    tasks.push({ city: city, venueFile: city + '-venues.import.jsonl', shopFile: city + '-shops.import.jsonl' })
  } else {
    for (const key of Object.keys(CITIES)) {
      const city = CITIES[key]
      tasks.push({ city: null, venueFile: city + '-venues.import.jsonl', shopFile: city + '-shops.import.jsonl' })
    }
  }

  /* 1. 备份现有数据（删除前必做） */
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
  tcb(['db', 'nosql', 'dump', 'venues', '--envId', ENV_ID, '--file-type', 'json', '--output-dir', BACKUP_DIR, '--json'])
  tcb(['db', 'nosql', 'dump', 'shops', '--envId', ENV_ID, '--file-type', 'json', '--output-dir', BACKUP_DIR, '--json'])

  for (const t of tasks) {
    const venues = readJsonl(t.venueFile)
    const shops = readJsonl(t.shopFile)
    console.log(`---- ${t.city || '全量'}：venues ${venues.length} 条 / shops ${shops.length} 条 ----`)

    /* 2. 删除（城市级 or 全量） */
    if (t.city) {
      deleteByCity('venues', t.city)
      deleteByCity('shops', t.city)
    } else {
      deleteAll('venues')
      deleteAll('shops')
    }

    /* 3. 插入 */
    insertDocs('venues', venues)
    insertDocs('shops', shops)
  }

  /* 4. 校验计数 */
  console.log('---- 校验 ----')
  console.log('venues:', count('venues'))
  console.log('shops:', count('shops'))
  console.log('备份目录：' + BACKUP_DIR)
}

main()
