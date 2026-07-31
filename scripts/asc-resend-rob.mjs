import fs from 'node:fs'; import crypto from 'node:crypto'
const key=fs.readFileSync('D:/saguaro-mobile/asc-key.p8','utf8')
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const now=Math.floor(Date.now()/1000)
const si=`${b64({alg:'ES256',kid:'5K68FJU2Y4',typ:'JWT'})}.${b64({iss:'5e02d4b3-9be8-4773-8c11-8018b7973dd8',iat:now,exp:now+1100,aud:'appstoreconnect-v1'})}`
const JWT=`${si}.${crypto.sign('SHA256',Buffer.from(si),{key,dsaEncoding:'ieee-p1363'}).toString('base64url')}`
const APP='6775089200'; const EMAIL='rob@copperstatedevelopments.com'
const call=async(p,opts={})=>{const r=await fetch(`https://api.appstoreconnect.apple.com${p}`,{headers:{Authorization:`Bearer ${JWT}`,'Content-Type':'application/json'},...opts});let b={};try{b=await r.json()}catch{};return{ok:r.ok,status:r.status,b}}
const look=await call(`/v1/betaTesters?filter[email]=${encodeURIComponent(EMAIL)}&include=betaGroups&fields[betaTesters]=email,firstName,lastName,state,inviteType&fields[betaGroups]=name,isInternalGroup`)
const t=(look.b.data||[])[0]
if(!t){console.log('NOT a TestFlight tester:',EMAIL);process.exit(0)}
const ginc={};for(const i of look.b.included||[])ginc[i.id]=i.attributes
const grps=(t.relationships?.betaGroups?.data||[]).map(g=>ginc[g.id]).filter(Boolean).map(g=>`${g.name}${g.isInternalGroup?'(int)':'(ext)'}`)
console.log(`tester: ${t.attributes.firstName||''} ${t.attributes.lastName||''} <${t.attributes.email}>`)
console.log(`  id=${t.id}  state=${t.attributes.state}  invite=${t.attributes.inviteType}  groups=${grps.join(',')||'(none-rel)'}`)
const res=await call('/v1/betaTesterInvitations',{method:'POST',body:JSON.stringify({data:{type:'betaTesterInvitations',relationships:{betaTester:{data:{type:'betaTesters',id:t.id}},app:{data:{type:'apps',id:APP}}}}})})
console.log(`\nRESEND INVITE -> HTTP ${res.status} ${res.ok?'OK ✅':'FAILED ❌'}`)
if(!res.ok)console.log('  ',JSON.stringify(res.b).slice(0,300))
