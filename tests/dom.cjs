// Loads index.html in jsdom with its local scripts inlined in document order, so tests run the
// exact files the browser loads without needing a server.
const fs=require('node:fs'),path=require('node:path');const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..');
function page(){return fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script src="([^"]+)"><\/script>/g,(_,src)=>{
  const code=fs.readFileSync(path.join(root,src),'utf8');if(code.includes('</script'))throw Error(src+' cannot be inlined');return `<script>${code}</script>`})}
function fixture(options={}){const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(page(),{url:options.url||'https://case.example/',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.speechSynthesis={getVoices:()=>[],addEventListener(){},cancel(){},speak(u){(w.__spoken=w.__spoken||[]).push(u.text)}};w.SpeechSynthesisUtterance=function(text){this.text=text};if(options.storage)for(const [k,v] of Object.entries(options.storage))w.localStorage.setItem(k,v)}});const w=dom.window;return {dom,w,errors,$:id=>w.document.getElementById(id),run:s=>w.eval(s)}}
async function settle(){for(let i=0;i<5;i++)await new Promise(r=>setTimeout(r,0))}
module.exports={fixture,settle,page};
