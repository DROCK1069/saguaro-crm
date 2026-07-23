import fs from 'node:fs'; import crypto from 'node:crypto'
const key = fs.readFileSync('D:/saguaro-mobile/asc-key.p8','utf8')
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url'); const now=Math.floor(Date.now()/1000)
const si=`${b64({alg:'ES256',kid:'5K68FJU2Y4',typ:'JWT'})}.${b64({iss:'5e02d4b3-9be8-4773-8c11-8018b7973dd8',iat:now,exp:now+1100,aud:'appstoreconnect-v1'})}`
const JWT=`${si}.${crypto.sign('SHA256',Buffer.from(si),{key,dsaEncoding:'ieee-p1363'}).toString('base64url')}`
const api=async p=>{const r=await fetch(`https://api.appstoreconnect.apple.com${p}`,{headers:{Authorization:`Bearer ${JWT}`}});const b=await r.json().catch(()=>({}));return r.ok?b:{error:r.status,detail:JSON.stringify(b).slice(0,300)}}
for (const [name,id] of [['PUBLIC BETA (external)','74bfacd1-9b90-4b1d-ab1b-47a8e3150461'],['INTERNAL','2d1d68e8-4a08-4cee-8366-6609ce8d7887']]) {
  const r = await api(`/v1/betaGroups/${id}/builds?limit=20&fields[builds]=version,processingState,expired,uploadedDate`)
  console.log(`\n=== ${name} builds ===`)
  if (r.error) { console.log('  err',r.error,r.detail); continue }
  if (!(r.data||[]).length) { console.log('  (NONE attached — public link shows "no builds available to test")'); continue }
  for (const b of r.data) console.log(`  build ${b.attributes.version}  proc=${b.attributes.processingState}  expired=${b.attributes.expired}  uploaded=${b.attributes.uploadedDate}`)
}
