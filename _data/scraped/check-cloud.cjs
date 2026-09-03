/* 查询云端 city=杭州 的现存文档（id/name/photos 状态） */
const { execFileSync } = require('child_process')
const ENV_ID = 'cloud1-d4grizmp31acb587e'

function cmdJson(spec) {
  return JSON.stringify([spec])
}
function query(coll) {
  const out = execFileSync('tcb', ['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
    cmdJson({ TableName: coll, CommandType: 'COMMAND', Command: JSON.stringify({ find: coll, filter: { city: '杭州' }, projection: { name: 1, photos: 1, category: 1 }, limit: 50 }) }),
    '--json'], { encoding: 'utf8' })
  return out
}
console.log('== venues ==')
console.log(query('venues'))
console.log('== shops ==')
console.log(query('shops'))
