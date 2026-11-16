const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function catalog() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]);
  const context = vm.createContext({});
  for (const script of scripts.slice(0, 2)) vm.runInContext(script, context, { timeout: 1000 });
  return JSON.parse(vm.runInContext('JSON.stringify({ cases: CASES, rich: RICH })', context));
}
function build() {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/cases.json'), JSON.stringify(catalog(), null, 2) + '\n');
  fs.mkdirSync(path.join(root, 'public'), { recursive: true });
  for (const file of ['index.html', 'ai-client.js']) fs.copyFileSync(path.join(root, file), path.join(root, 'public', file));
  console.log('Built static app and canonical case catalog.');
}
module.exports = { catalog, build };
if (require.main === module) build();
