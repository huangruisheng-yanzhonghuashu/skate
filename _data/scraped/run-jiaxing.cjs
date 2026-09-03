/* 一次性执行器：city=嘉兴 定向删除 → 插入嘉兴 JSONL → 计数校验（备份已由 dump 完成） */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ENV_ID = 'cloud1-d4grizmp31acb587e'
const CITY = '嘉兴'

function tcb(args) {
  const out = execFileSync('tcb', args, { encoding: 'utf8' })
  return out
}
function cmdJson(spec) {
  return JSON.stringify([spec])
}
function readJsonl(f) {
  return fs.readFileSync(path.join(__dirname, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
}

console.log('[1] 删除 city=' + CITY + ' 的 venues/shops ...')
console.log(tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
  cmdJson({ TableName: 'venues', CommandType: 'DELETE', Command: JSON.stringify({ delete: 'venues', deletes: [{ q: { city: CITY }, limit: 0 }] }) }),
  '--json']))

console.log(tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
  cmdJson({ TableName: 'shops', CommandType: 'DELETE', Command: JSON.stringify({ delete: 'shops', deletes: [{ q: { city: CITY }, limit: 0 }] }) }),
  '--json']))

console.log('[2] 插入嘉兴数据 ...')
const venues = readJsonl('嘉兴-venues.import.jsonl')
const shops = readJsonl('嘉兴-shops.import.jsonl')
console.log(tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
  cmdJson({ TableName: 'venues', CommandType: 'INSERT', Command: JSON.stringify({ insert: 'venues', documents: venues }) }),
  '--json']))
console.log(tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
  cmdJson({ TableName: 'shops', CommandType: 'INSERT', Command: JSON.stringify({ insert: 'shops', documents: shops }) }),
  '--json']))

console.log('[3] 校验 ...')
console.log('venues 总数:', tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
  cmdJson({ TableName: 'venues', CommandType: 'COMMAND', Command: JSON.stringify({ count: 'venues', query: {} }) }),
  '--json']))
console.log('shops 总数:', tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
  cmdJson({ TableName: 'shops', CommandType: 'COMMAND', Command: JSON.stringify({ count: 'shops', query: {} }) }),
  '--json']))
console.log('嘉兴 venues:', tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
  cmdJson({ TableName: 'venues', CommandType: 'COMMAND', Command: JSON.stringify({ count: 'venues', query: { city: CITY } }) }),
  '--json']))
console.log('嘉兴 shops:', tcb(['db', 'nosql', 'execute', '--envId', ENV_ID, '--command',
  cmdJson({ TableName: 'shops', CommandType: 'COMMAND', Command: JSON.stringify({ count: 'shops', query: { city: CITY } }) }),
  '--json']))
