const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
function files(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
for (const f of files('public')) assert(!/\.(apk|aab|apks|xapk|dex|jar|exe|so)$/i.test(f), 'Executable distribution in public: '+f);
for (const f of [...files('app'), ...files('components'), ...files('lib')].filter(f=>/\.[jt]sx?$/.test(f))) {
 const source=fs.readFileSync(f,'utf8');
 assert(!/(?:href|src)=[^\n]*\.(?:apk|aab|xapk|apks)\b/i.test(source), 'Executable download link: '+f);
 assert(!/permite instalarea din browser|surse necunoscute/i.test(source), 'Sideloading instructions: '+f);
}
require('typescript');
const ts=require('typescript'),vm=require('node:vm');
const route=ts.transpileModule(fs.readFileSync('app/downloads/[...path]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{},Response};vm.runInNewContext(route,context);
const response=context.exports.GET();assert.equal(response.status,410);assert.equal(response.headers.get('Cache-Control'),'no-store');
console.log('PASS: no public executable packages, no APK UI links or sideloading instructions, retired download route returns 410.');
