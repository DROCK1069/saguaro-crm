import fs from 'node:fs'; import crypto from 'node:crypto'
const key = fs.readFileSync('D:/saguaro-mobile/asc-key.p8','utf8')
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url'); const now=Math.floor(Date.now()/1000)
const si=`${b64({alg:'ES256',kid:'5K68FJU2Y4',typ:'JWT'})}.${b64({iss:'5e02d4b3-9be8-4773-8c11-8018b7973dd8',iat:now,exp:now+1100,aud:'appstoreconnect-v1'})}`
const JWT=`${si}.${crypto.sign('SHA256',Buffer.from(si),{key,dsaEncoding:'ieee-p1363'}).toString('base64url')}`
const APP='6775089200'; const EMAIL='avery@tntcyber.com'
const call=async(p,opts={})=>{const r=await fetch(`https://api.appstoreconnect.apple.com${p}`,{headers:{Authorization:`Bearer ${JWT}`,'Content-Type':'application/json'},...opts});let b={};try{b=await r.json()}catch{};return{ok:r.ok,status:r.status,b}}

// 1. find Avery's betaTester id
const look = await call(`/v1/betaTesters?filter[email]=${encodeURIComponent(EMAIL)}&fields[betaTesters]=email,firstName,lastName,state,inviteType`)
if(!look.ok){console.log('lookup failed',look.status,JSON.stringify(look.b).slice(0,300));process.exit(1)}
const tester=(look.b.data||[])[0]
if(!tester){console.log('NO TESTER FOUND for',EMAIL);process.exit(1)}
console.log('tester id:',tester.id,'| state before:',tester.attributes.state,'| invite:',tester.attributes.inviteType)

// 2. resend the email invitation
const res = await call('/v1/betaTesterInvitations',{method:'POST',body:JSON.stringify({data:{type:'betaTesterInvitations',relationships:{betaTester:{data:{type:'betaTesters',id:tester.id}},app:{data:{type:'apps',id:APP}}}}})})
console.log('\nINVITE POST -> HTTP',res.status, res.ok?'OK ✅':'FAILED ❌')
console.log(JSON.stringify(res.b).slice(0,400))

// 3. confirm state after
const after = await call(`/v1/betaTesters?filter[email]=${encodeURIComponent(EMAIL)}&fields[betaTesters]=email,state,inviteType`)
const t2=(after.b.data||[])[0]
if(t2) console.log('\nstate after:',t2.attributes.state,'| invite:',t2.attributes.inviteType)
