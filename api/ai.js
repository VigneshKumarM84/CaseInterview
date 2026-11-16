const { handle, AppError } = require('../lib/ai.cjs');
module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST for AI requests.'})}
  const origin=req.headers.origin;
  try {
    if(origin&&new URL(origin).host!==req.headers.host)return res.status(403).json({error:'Use AI from this app’s own page.'});
  } catch {return res.status(403).json({error:'Invalid origin.'})}
  if(!String(req.headers['content-type']||'').includes('application/json'))return res.status(415).json({error:'JSON is required.'});
  try {
    const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
    if(Buffer.byteLength(raw)>100000)return res.status(413).json({error:'This session is too long for one AI request. Shorten answers or use the downloadable review package.'});
    let body;try{body=JSON.parse(raw)}catch{return res.status(400).json({error:'Invalid JSON request.'})}
    const output=await handle(body,req.headers['x-ai-key']);
    return res.status(200).json(output);
  } catch(e) {
    // Never log request bodies, headers, keys, or raw provider errors.
    return res.status(e instanceof AppError?e.status:500).json({error:e instanceof AppError?e.message:'AI processing failed. Your saved answers are unaffected.'});
  }
};
