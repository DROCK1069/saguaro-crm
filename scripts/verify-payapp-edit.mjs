import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(fs.readFileSync('D:/saguaro-mobile/.env','utf8').split('\n').map(l=>l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2]]))
const supa = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
const API='https://www.saguarocontrol.net/api'
const { data:s } = await supa.auth.signInWithPassword({ email:'tntcybersolutions@gmail.com', password:'Saltlife69!' })
const hdr={ Authorization:`Bearer ${s.session.access_token}`,'Content-Type':'application/json' }
const PID='11111111-1111-1111-1111-111111111104'
const call=async(m,p,b)=>{const r=await fetch(`${API}${p}`,{method:m,headers:hdr,body:b?JSON.stringify(b):undefined});let j={};try{j=JSON.parse(await r.text())}catch{};return{status:r.status,j}}
const c=await call('POST','/pay-apps/create',{project_id:PID,period_to:'2026-04-30',work_completed:100})
const id=c.j.payApp?.id
if(!id){console.log('create failed',c.status);process.exit()}
const u=await call('PUT',`/pay-apps/${id}`,{this_period:4242, notes:'ZZ edited note'})
const {data}=await supa.from('pay_applications').select('this_period,notes').eq('id',id).maybeSingle()
console.log(`Pay-app PUT header: edit[${u.status}] this_period=${data?.this_period} notes=${data?.notes}`)
await supa.from('pay_applications').delete().eq('id',id)
