/* 最终校验：全国/城市计数 + 图片覆盖率 */
const { execFileSync } = require('child_process')
const ENV_ID = 'cloud1-d4grizmp31acb587e'
function cmdJson(spec) {
  return JSON.stringify([spec])
}
function count(coll, query) {
  const out = execFileSync('tcb', ['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: 'x', CommandType: 'COMMAND', Command: JSON.stringify({ count: coll, query: query }) }),
    '--json'], { encoding: 'utf8' })
  const m = out.match(/numberInt[^0-9]*(\d+)/)
  return m ? m[1] : '?'
}
function photosCovered(coll, city) {
  const out = execFileSync('tcb', ['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: 'x', CommandType: 'COMMAND', Command: JSON.stringify({ find: coll, filter: city ? { city: city } : {}, projection: { name: 1, photos: 1 }, limit: 50 }) }),
    '--json'], { encoding: 'utf8' })
  const names = out.match(/\\?"name\\?":\\?"[^\\]+\\?"/g) || []
  const withPhoto = (out.match(/photos\\":\[/g) || []).length
  return { total: names.length, withPhoto: withPhoto }
}
console.log('== 计数 ==')
console.log('venues: 全国', count('venues', {}), '/ 嘉兴', count('venues', { city: '嘉兴' }), '/ 杭州', count('venues', { city: '杭州' }))
console.log('shops:  全国', count('shops', {}), '/ 嘉兴', count('shops', { city: '嘉兴' }), '/ 杭州', count('shops', { city: '杭州' }))
console.log('== 图片覆盖 ==')
const vJx = photosCovered('venues', '嘉兴')
const vHz = photosCovered('venues', '杭州')
const sJx = photosCovered('shops', '嘉兴')
const sHz = photosCovered('shops', '杭州')
console.log('嘉兴 venues:', vJx, '/ shops:', sJx)
console.log('杭州 venues:', vHz, '/ shops:', sHz)
