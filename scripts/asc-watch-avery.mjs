import fs from 'node:fs'; import crypto from 'node:crypto'
const key=fs.readFileSync('D:/saguaro-mobile/asc-key.p8','utf8')
const mkjwt=()=>{const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const now=Math.floor(Date.now()/1000)
 const si=`${b64({alg:'ES256',kid:'5K68FJU2Y4',typ:'JWT'})}.${b64({iss:'5e02d4b3-9be8-4773-8c11-8018b7973dd8',iat:now,exp:now+1100,aud:'appstoreconnect-v1'})}`
 return `${si}.${crypto.sign('SHA256',Buffer.from(si),{key,dsaEncoding:'ieee-p1363'}).toString('base64url')}`}
const getState=async()=>{const r=await fetch('https://api.appstoreconnect.apple.com/v1/betaTesters?filter[email]=avery%40tntcyber.com&fields[betaTesters]=email,state,inviteType',{headers:{Authorization:`Bearer ${mkjwt()}`}});const b=await r.json();const t=(b.data||[])[0];return t?String(t.attributes.state):'NOTFOUND'}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const MAX=20, INTERVAL=120000
let baseline=await getState()
console.log(`baseline state=${baseline} @ check 0`)
for(let i=1;i<=MAX;i++){
  await sleep(INTERVAL)
  let s
  try{ s=await getState() }catch(e){ console.log(`check ${i}: error ${e.message}`); continue }
  console.log(`check ${i}/${MAX}: state=${s}`)
  if(s!==baseline && s!=='null'){ console.log(`\n*** CHANGED: Avery is now "${s}" — he accepted/installed! ***`); process.exit(0) }
}
console.log('\n--- no change after ~40 min; Avery still has not accepted the invite ---')
