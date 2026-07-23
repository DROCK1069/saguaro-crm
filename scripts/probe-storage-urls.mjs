import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(fs.readFileSync('D:/saguaro-mobile/.env','utf8').split('\n').map(l=>l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2]]))
const supa = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
const { data:dr } = await supa.from('drawings').select('id,url').not('url','is',null).limit(3)
const { data:ph } = await supa.from('photos').select('id,url').not('url','is',null).limit(3)
const probe=async(u)=>{ if(!u) return 'no-url'; try{const r=await fetch(u,{method:'GET'});return r.status}catch(e){return 'ERR'} }
console.log('=== existing drawings urls ===')
for(const d of (dr||[])) console.log(`  [${await probe(d.url)}] ${String(d.url).slice(0,90)}`)
console.log('=== existing photos urls ===')
for(const p of (ph||[])) console.log(`  [${await probe(p.url)}] ${String(p.url).slice(0,90)}`)
if(!dr?.length) console.log('  (no drawings rows with url)')
if(!ph?.length) console.log('  (no photos rows with url)')
