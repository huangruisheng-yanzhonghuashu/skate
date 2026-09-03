const c = require('./cities.js')
let miss = []
c.CITY_GROUPS.forEach((g) => g.cities.forEach((x) => { if (!c.CITY_INITIALS[x]) miss.push(x) }))
const has = (q, name) => c.searchCities(q).indexOf(name) >= 0
console.log('missing map entries:', miss.length, miss.join('|'))
console.log('jx -> jiaxing:', has('jx', '嘉兴市'), '| count:', c.searchCities('jx').length)
console.log('bj -> beijing:', has('bj', '北京市'), '| count:', c.searchCities('bj').length)
console.log('cd -> chengdu:', has('cd', '成都市'), '| count:', c.searchCities('cd').length)
console.log('chinese beijing:', has('北京', '北京市'))
console.log('sh count:', c.searchCities('sh').length)
console.log('no-match xyz:', c.searchCities('xyz').length)
console.log('empty query:', c.searchCities('').length)
console.log('uppercase JX:', has('JX', '嘉兴市'))
