import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(fs.readFileSync('D:/saguaro-mobile/.env','utf8').split('\n').map(l=>l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2]]))
const supa = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
const API='https://www.saguarocontrol.net/api'
const { data:s } = await supa.auth.signInWithPassword({ email:'tntcybersolutions@gmail.com', password:'Saltlife69!' })
const hdr={ Authorization:`Bearer ${s.session.access_token}`,'Content-Type':'application/json' }
const PID='11111111-1111-1111-1111-111111111104'
const call=async(m,p,b)=>{const r=await fetch(`${API}${p}`,{method:m,headers:hdr,body:b?JSON.stringify(b):undefined});let j={};try{j=JSON.parse(await r.text())}catch{};return{status:r.status,j}}
const out=[]

// 1) Pay-app PUT amount edit + recompute (was silent data loss)
{
  const c=await call('POST','/pay-apps/create',{project_id:PID,period_to:'2026-04-30',work_completed:1000})
  const id=c.j.payApp?.id
  if(id){
    const u=await call('PUT',`/pay-apps/${id}`,{work_completed:5000})
    const {data}=await supa.from('pay_applications').select('this_period,total_retainage,current_payment_due,net_payment_due').eq('id',id).maybeSingle()
    const ok = data?.this_period==5000 && Number(data?.total_retainage)==500 && Number(data?.current_payment_due)==4500
    out.push(`Pay-app edit amount: PUT[${u.status}] this_period=${data?.this_period} retainage=${data?.total_retainage} due=${data?.current_payment_due} ${ok?'✓':'✗'}`)
    await supa.from('pay_applications').delete().eq('id',id)
  } else out.push(`Pay-app create failed [${c.status}]`)
}
// 2) Lien-waiver sign: tenant guard + metadata (signed_at/signed_name/signature_method)
{
  // find an unsigned lien waiver for this tenant
  const {data:lw}=await supa.from('lien_waivers').select('id,status').neq('status','signed').limit(1)
  if(lw && lw[0]){
    const id=lw[0].id
    const r=await call('POST',`/lien-waivers/${id}/sign`,{signedBy:'tntcybersolutions@gmail.com',signedName:'Chad D'})
    const {data}=await supa.from('lien_waivers').select('status,signed_at,signed_name,signature_method,signed_by').eq('id',id).maybeSingle()
    const ok = data?.status==='signed' && data?.signed_at && data?.signed_name && data?.signature_method
    out.push(`Lien sign own-tenant: [${r.status}] status=${data?.status} signed_at=${!!data?.signed_at} name=${data?.signed_name} method=${data?.signature_method} ${ok?'✓':'✗'}`)
  } else out.push('Lien sign: no unsigned waiver to test (skipped own-tenant)')
  // bogus id -> 404 proves the guard/.maybeSingle path returns not-found instead of silent 200
  const r2=await call('POST',`/lien-waivers/00000000-0000-0000-0000-000000000000/sign`,{signedBy:'x'})
  out.push(`Lien sign bogus id -> [${r2.status}] ${r2.status===404?'✓ (guarded)':'✗'}`)
}
console.log('=== W4C FIXES ==='); out.forEach(r=>console.log(r))
