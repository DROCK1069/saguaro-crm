import fs from 'node:fs'; import crypto from 'node:crypto'
const key=fs.readFileSync('D:/saguaro-mobile/asc-key.p8','utf8')
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const now=Math.floor(Date.now()/1000)
const si=`${b64({alg:'ES256',kid:'5K68FJU2Y4',typ:'JWT'})}.${b64({iss:'5e02d4b3-9be8-4773-8c11-8018b7973dd8',iat:now,exp:now+1100,aud:'appstoreconnect-v1'})}`
const JWT=`${si}.${crypto.sign('SHA256',Buffer.from(si),{key,dsaEncoding:'ieee-p1363'}).toString('base64url')}`
const r=await fetch(`https://api.appstoreconnect.apple.com/v1/betaTesters?filter[email]=avery%40tntcyber.com&fields[betaTesters]=email,state,inviteType`,{headers:{Authorization:`Bearer ${JWT}`}})
const b=await r.json(); const t=(b.data||[])[0]
console.log(t?`state=${t.attributes.state} invite=${t.attributes.inviteType}`:'NOT FOUND')
