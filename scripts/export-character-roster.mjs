import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const root=process.cwd();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url||'/', 'http://127.0.0.1').pathname);
  const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if(!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');
  fs.createReadStream(target).pipe(res);
});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  page.setDefaultTimeout(45000);
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>typeof cards!=='undefined'&&Array.isArray(cards)&&cards.some(c=>c&&c.name==='最高神:ゼウス'),null,{timeout:45000});
  await page.addScriptTag({path:path.join(root,'hastur.js')});
  await page.waitForFunction(()=>Array.isArray(window.KINOSHITA_CHARACTER_ROSTER)&&window.KINOSHITA_CHARACTER_ID_AUDIT?.phase==='final-runtime-roster',null,{timeout:15000});
  const audit=await page.evaluate(()=>window.KINOSHITA_CHARACTER_ID_AUDIT);
  if(!audit||!Array.isArray(audit.roster)||audit.total!==audit.roster.length||!audit.idsAligned)throw new Error('Runtime character roster audit is inconsistent');
  if(audit.roster.some((c,i)=>!c||c.id!==i||!c.name))throw new Error('Character roster contains an unregistered or misaligned ID');
  const eventRewards=audit.roster.filter(c=>c.rewardStage).map(c=>({id:c.id,name:c.name,stageName:c.rewardStage}));
  const manifest={schemaVersion:1,sourceCommit:process.env.GITHUB_SHA||null,generatedAt:new Date().toISOString(),count:audit.total,characters:audit.roster,eventRewards};
  fs.writeFileSync(path.join(root,'character-roster.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log('Character roster exported: '+manifest.count+' cards; ID 121: '+JSON.stringify(manifest.characters[121]||null));
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
