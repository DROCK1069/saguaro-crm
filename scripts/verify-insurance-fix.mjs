import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(fs.readFileSync('D:/saguaro-mobile/.env','utf8').split('\n').map(l=>l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2]]))
const supa = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
const API='https://www.saguarocontrol.net/api'
const { data:s } = await supa.auth.signInWithPassword({ email:'tntcybersolutions@gmail.com', password:'Saltlife69!' })
const hdr={ Authorization:`Bearer ${s.session.access_token}` }
const PID='11111111-1111-1111-1111-111111111104'
const { data: proj } = await supa.from('projects').select('tenant_id').eq('id',PID).maybeSingle()
const TENANT = proj?.tenant_id
const out=[]
const jcall=async(p,b)=>{const r=await fetch(`${API}${p}`,{method:'POST',headers:{...hdr,'Content-Type':'application/json'},body:JSON.stringify(b)});let j={};try{j=JSON.parse(await r.text())}catch{};return{status:r.status,j}}

let coiId
// 1) request() — should INSERT a pending row with real columns (was 42703)
{
  const r=await jcall('/insurance/request',{tenantId:TENANT,projectId:PID,vendorName:'ZZ Test Sub',vendorEmail:'zztest@example.com'})
  coiId=r.j.coiId
  const {data}=coiId?await supa.from('insurance_certificates').select('sub_name,status,project_id,tenant_id').eq('id',coiId).maybeSingle():{data:null}
  const ok = r.status===200 && data?.sub_name==='ZZ Test Sub' && data?.status==='pending' && data?.tenant_id===TENANT
  out.push(`request(): [${r.status}] coiId=${coiId?'yes':'NO'} row.sub_name=${data?.sub_name} status=${data?.status} ${ok?'✓':'✗'}`)
}
// 2) upload() — attach a PDF, expect pdf_url set to a reachable public URL (was false-200 data loss)
if(coiId){
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF') // minimal pdf bytes
  const fd = new FormData()
  fd.append('coiId', coiId)
  fd.append('tenantId', TENANT)
  fd.append('file', new Blob([pdf],{type:'application/pdf'}), 'zz-coi.pdf')
  const r = await fetch(`${API}/insurance/upload`,{method:'POST',headers:hdr,body:fd})
  let j={};try{j=JSON.parse(await r.text())}catch{}
  const {data}=await supa.from('insurance_certificates').select('pdf_url,status').eq('id',coiId).maybeSingle()
  let urlOk=false
  if(data?.pdf_url){ try{ const h=await fetch(data.pdf_url,{method:'GET'}); urlOk = h.status===200 }catch{} }
  const ok = r.status===200 && !!data?.pdf_url && data.pdf_url.includes('project-files') && urlOk
  out.push(`upload(): [${r.status}] pdf_url=${data?.pdf_url?'set':'NULL'} reachable=${urlOk} status=${data?.status} ${ok?'✓':'✗'}`)
}
// 3) error path — bogus coiId must 404 (not false 200)
{
  const pdf=Buffer.from('%PDF-1.4\n%%EOF'); const fd=new FormData()
  fd.append('coiId','00000000-0000-0000-0000-000000000000'); fd.append('tenantId',TENANT)
  fd.append('file', new Blob([pdf],{type:'application/pdf'}),'x.pdf')
  const r=await fetch(`${API}/insurance/upload`,{method:'POST',headers:hdr,body:fd})
  out.push(`upload() bogus id -> [${r.status}] ${r.status===404?'✓ (honest error)':'✗ FALSE SUCCESS'}`)
}
// cleanup
if(coiId) await supa.from('insurance_certificates').delete().eq('id',coiId)
console.log('=== INSURANCE FIX ==='); console.log('tenant:',TENANT); out.forEach(r=>console.log(r))
