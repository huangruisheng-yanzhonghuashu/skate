/* 抽样确认嘉兴图片 fileID 落库 */
const { execFileSync } = require('child_process')
const ENV_ID = 'cloud1-d4grizmp31acb587e'
function cmdJson(spec) {
  return JSON.stringify([spec])
}
const out = execFileSync('tcb', ['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
  cmdJson({ TableName: 'x', CommandType: 'COMMAND', Command: JSON.stringify({ find: 'shops', filter: { name: '爱滑板俱乐部' }, projection: { name: 1, photos: 1, cover: 1 }, limit: 1 }) }),
  '--json'], { encoding: 'utf8' })
console.log('爱滑板 photos:', (out.match(/cloud:\/\/[^"\\]+/g) || []).join(' | '))
const out2 = execFileSync('tcb', ['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
  cmdJson({ TableName: 'x', CommandType: 'COMMAND', Command: JSON.stringify({ find: 'venues', filter: { name: '临平银泰inPARK滑手空间' }, projection: { name: 1, photos: 1, cover: 1 }, limit: 1 }) }),
  '--json'], { encoding: 'utf8' })
console.log('临平inPARK photos:', (out2.match(/cloud:\/\/[^"\\]+/g) || []).join(' | '))
