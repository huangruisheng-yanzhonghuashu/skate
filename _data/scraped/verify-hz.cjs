/* 校验：杭州计数 + 抽样 photo fileID */
const { execFileSync } = require('child_process')
const ENV_ID = 'cloud1-d4grizmp31acb587e'
function cmdJson(spec) {
  return JSON.stringify([spec])
}
function q(cmd) {
  return execFileSync('tcb', ['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: 'x', CommandType: 'COMMAND', Command: JSON.stringify(cmd) }), '--json'], { encoding: 'utf8' })
}
function n(cmd) {
  const m = q(cmd).match(/numberInt[^0-9]*(\d+)/)
  return m ? m[1] : '?'
}
console.log('杭州 venues:', n({ count: 'venues', query: { city: '杭州' } }))
console.log('杭州 shops:', n({ count: 'shops', query: { city: '杭州' } }))
console.log('全国 venues:', n({ count: 'venues', query: {} }))
console.log('全国 shops:', n({ count: 'shops', query: {} }))
const sample = q({ find: 'venues', filter: { name: '滨江陆冲双翘滑板场地' }, projection: { name: 1, photos: 1, cover: 1 }, limit: 1 })
console.log('抽样 photos:', (sample.match(/cloud:\/\/[^"\\]+/g) || []).join('\n'))
