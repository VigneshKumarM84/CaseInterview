// Minimal local server for the same API handler used on Vercel.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
require('./build.cjs').build();
const handler=require('../api/ai.js');
const root=path.resolve(__dirname,'..','public');
const server=http.createServer(async(req,res)=>{
  if(req.url==='/api/ai'){
    let body='';try{for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>100000){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Request too large.'}));return}}}catch{return}
    req.body=body;res.status=n=>{res.statusCode=n;return res};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))};return handler(req,res);
  }
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=pathname==='/'? 'index.html':pathname==='/ai-client.js'?'ai-client.js':null;
  if(!file){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});fs.createReadStream(path.join(root,file)).pipe(res);
});
server.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log('Case Room: http://127.0.0.1:'+(process.env.PORT||3000)));
