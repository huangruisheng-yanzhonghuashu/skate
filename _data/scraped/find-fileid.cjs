/* 从 checkins/venue_reports 里找一条 cloud:// fileID 样例，解析 bucket 前缀 */
const { execFileSync } = require('child_process')
const ENV_ID = 'cloud1-d4grizmp31acb587e'

function cmdJson(spec) {
  return JSON.stringify([spec])
}
function query(coll) {
  let out = ''
  try {
    out = execFileSync('tcb', ['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
      cmdJson({ TableName: coll, CommandType: 'COMMAND', Command: JSON.stringify({ find: coll, filter: {}, limit: 20 }) }),
      '--json'], { encoding: 'utf8' })
  } catch (e) {
    out = e.stdout || ''
  }
  const m = out.match(/cloud:\/\/[^"\\]+/g)
  return m || []
}

for (const coll of ['checkins', 'venue_reports', 'feedback', 'venues']) {
  const ids = query(coll)
  if (ids.length) {
    console.log('[' + coll + ']')
    ids.slice(0, 3).forEach((x) => console.log('  ' + x))
    break
  } else {
    console.log('[' + coll + '] 无 cloud:// 样例')
  }
}
