// Minimal local server for the same API handler used on Vercel.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
require('./build.cjs').build();
const handler=require('../api/ai.js');
const root=path.resolve(__dirname,'..','public');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  if(req.url==='/api/ai'){
    let body='';try{for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>100000){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Request too large.'}));return}}}catch{return}
    req.body=body;res.status=n=>{res.statusCode=n;return res};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))};return handler(req,res);
  }
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);return res.end('Bad request')}
  const file=path.join(root,pathname==='/'?'index.html':pathname);
  // Serve only files inside public/ with a known type.
  if(!file.startsWith(root+path.sep)||!TYPES[path.extname(file)]||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'Content-Type':TYPES[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res);
});
server.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log('Case Room: http://127.0.0.1:'+(process.env.PORT||3000)));
