const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
// Everything the browser loads. index.html references these paths relatively, so the same layout
// works from public/, from Vercel and when index.html is opened directly from disk.
const STATIC = ['index.html', 'assets', 'content', 'src'];
function catalog() {
  const source = fs.readFileSync(path.join(root, 'content/cases.js'), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source, context, { timeout: 1000, filename: 'content/cases.js' });
  return JSON.parse(vm.runInContext('JSON.stringify({ cases: CASES, rich: RICH })', context));
}
function build() {
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/cases.json'), JSON.stringify(catalog(), null, 2) + '\n');
  const out = path.join(root, 'public');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const entry of STATIC) fs.cpSync(path.join(root, entry), path.join(out, entry), { recursive: true });
  console.log('Built static app and canonical case catalog.');
}
module.exports = { catalog, build, STATIC };
if (require.main === module) build();
