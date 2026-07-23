import fs from 'node:fs'; import crypto from 'node:crypto'
const key=fs.readFileSync('D:/saguaro-mobile/asc-key.p8','utf8')
const mkjwt=()=>{const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const now=Math.floor(Date.now()/1000)
 const si=`${b64({alg:'ES256',kid:'5K68FJU2Y4',typ:'JWT'})}.${b64({iss:'5e02d4b3-9be8-4773-8c11-8018b7973dd8',iat:now,exp:now+1100,aud:'appstoreconnect-v1'})}`
 return `${si}.${crypto.sign('SHA256',Buffer.from(si),{key,dsaEncoding:'ieee-p1363'}).toString('base64url')}`}
const getState=async(email)=>{const r=await fetch(`https://api.appstoreconnect.apple.com/v1/betaTesters?filter[email]=${encodeURIComponent(email)}&fields[betaTesters]=email,state`,{headers:{Authorization:`Bearer ${mkjwt()}`}});const b=await r.json();const t=(b.data||[])[0];return t?String(t.attributes.state):'NOTFOUND'}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const people=[['Avery','avery@tntcyber.com'],['Rob','rob@copperstatedevelopments.com']]
const MAX=30, INTERVAL=120000  // every 2 min for ~60 min
const base={}; for(const [n,e] of people){ base[n]=await getState(e); console.log(`baseline ${n}=${base[n]}`) }
let pending=people.map(p=>p[0])
for(let i=1;i<=MAX && pending.length;i++){
  await sleep(INTERVAL)
  for(const [n,e] of people){
    if(!pending.includes(n)) continue
    let s; try{ s=await getState(e) }catch{ continue }
    if(s!==base[n] && s!=='null' && s!=='NOTFOUND'){ console.log(`\n*** ${n} is now "${s}" — accepted/installed! (check ${i}) ***`); pending=pending.filter(x=>x!==n) }
  }
  console.log(`check ${i}/${MAX}: still pending -> ${pending.join(', ')||'none'}`)
}
console.log(pending.length?`\n--- window ended; still not installed: ${pending.join(', ')} ---`:`\n--- all installed ---`)
