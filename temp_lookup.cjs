const fs = require('fs');
const { TraceMap, originalPositionFor } = require('@jridgewell/trace-mapping');
const rawMap = fs.readFileSync('dist/assets/index-DymOJ01j.js.map', 'utf8');
const map = new TraceMap(JSON.parse(rawMap));
const payload = Buffer.from(process.argv[2], 'base64').toString('utf8');
const positions = JSON.parse(payload);
for (const pos of positions) {
  const result = originalPositionFor(map, pos);
  console.log(pos, '=>', result);
}
