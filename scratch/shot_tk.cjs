const puppeteer=require('puppeteer');
(async()=>{const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox']});
const p=await b.newPage();await p.setViewport({width:1400,height:1100,deviceScaleFactor:2});
await p.goto('http://localhost:3017/tk-demo',{waitUntil:'networkidle0',timeout:120000});
await new Promise(r=>setTimeout(r,3000));
await p.screenshot({path:'scratch/tk_upload.png',fullPage:true});
console.log('title:',await p.title());await b.close();})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
