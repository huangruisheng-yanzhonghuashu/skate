/* 修复：补插的 9 条文档漏了 city 字段，按 id 回填 city=杭州 */
const { execFileSync } = require('child_process')
const ENV_ID = 'cloud1-d4grizmp31acb587e'
function cmdJson(spec) {
  return JSON.stringify([spec])
}
function updateById(coll, id) {
  const out = execFileSync('tcb', ['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: coll, CommandType: 'UPDATE', Command: JSON.stringify({ update: coll, updates: [{ q: { id: id }, u: { $set: { city: '杭州' } } }] }) }),
    '--json'], { encoding: 'utf8' })
  console.log('[fix]', coll, id)
}
const VENUES = ['hz-qiantang-wheel', 'hz-asiad-park', 'hz-bac-moreprk', 'hz-olotus-plaza', 'hz-huanglong']
const SHOPS = ['hz-50-central', 'hz-50-canal', 'hz-50-kaiyuan', 'hz-50-east']
VENUES.forEach((id) => updateById('venues', id))
SHOPS.forEach((id) => updateById('shops', id))

/* 校验 */
function count(coll, query) {
  const out = execFileSync('tcb', ['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: 'x', CommandType: 'COMMAND', Command: JSON.stringify({ count: coll, query: query }) }),
    '--json'], { encoding: 'utf8' })
  const m = out.match(/numberInt[^0-9]*(\d+)/)
  return m ? m[1] : '?'
}
console.log('杭州 venues:', count('venues', { city: '杭州' }))
console.log('杭州 shops:', count('shops', { city: '杭州' }))
console.log('全国 venues:', count('venues', {}))
console.log('全国 shops:', count('shops', {}))
