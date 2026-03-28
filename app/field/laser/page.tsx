'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/* ── Leica & Bosch BLE service/characteristic UUIDs ── */
const LEICA_SERVICE  = '3ab10100-f831-4395-b29d-570977d5bf94';
const LEICA_CHAR     = '3ab10101-f831-4395-b29d-570977d5bf94';
const BOSCH_SERVICE  = '00001523-1212-efde-1523-785feabcd123';
const BOSCH_CHAR     = '00001524-1212-efde-1523-785feabcd123';

type Unit = 'ft_in' | 'm' | 'cm' | 'mm' | 'in';

interface Measurement {
  id: string;
  label: string;
  value_m: number;
  unit: Unit;
  display: string;
  note: string;
  timestamp: string;
  project_id: string;
  device?: string;
  synced?: boolean;
}

/* ── unit conversion helpers ── */
function toDisplay(meters: number, unit: Unit): string {
  switch (unit) {
    case 'ft_in': {
      const totalIn = meters / 0.0254;
      const ft = Math.floor(totalIn / 12);
      const inch = (totalIn % 12).toFixed(2);
      return `${ft}' ${inch}"`;
    }
    case 'm':   return `${meters.toFixed(4)} m`;
    case 'cm':  return `${(meters * 100).toFixed(2)} cm`;
    case 'mm':  return `${(meters * 1000).toFixed(1)} mm`;
    case 'in':  return `${(meters / 0.0254).toFixed(3)}"`;
  }
}

function parseManual(value: string, unit: Unit): number | null {
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  switch (unit) {
    case 'ft_in': return n * 0.3048;
    case 'm':     return n;
    case 'cm':    return n / 100;
    case 'mm':    return n / 1000;
    case 'in':    return n * 0.0254;
  }
}

/* ── offline queue stub (matches lib/field-db) ── */
async function enqueue(action: string, payload: unknown) {
  try {
    const db: unknown = (window as unknown as Record<string,unknown>)['fieldDB'];
    if (db && typeof (db as Record<string,unknown>)['enqueue'] === 'function') {
      await (db as Record<string,unknown & { enqueue: (a:string, p:unknown)=>Promise<void> }>)['enqueue'](action, payload);
    } else {
      const q = JSON.parse(localStorage.getItem('offline_queue') || '[]');
      q.push({ action, payload, ts: Date.now() });
      localStorage.setItem('offline_queue', JSON.stringify(q));
    }
  } catch { /* silent */ }
}

export default function LaserPage() {
  const router     = useRouter();
  const params     = useSearchParams();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [device,    setDevice]    = useState<BluetoothDevice | null>(null);
  const [char,      setChar]      = useState<BluetoothRemoteGATTCharacteristic | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [liveMeter,  setLiveMeter]  = useState<number | null>(null);
  const [unit,    setUnit]    = useState<Unit>('ft_in');
  const [label,   setLabel]   = useState('');
  const [note,    setNote]    = useState('');
  const [manualVal, setManualVal] = useState('');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [online,  setOnline]  = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [bleSupported, setBleSupported] = useState(false);
  const [deviceType, setDeviceType] = useState<'leica' | 'bosch' | null>(null);
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  /* ── init ── */
  useEffect(() => {
    const pid = params.get('projectId') || localStorage.getItem('saguaro_active_project');
    setProjectId(pid);
    setOnline(navigator.onLine);
    setBleSupported('bluetooth' in navigator);
    window.addEventListener('online',  () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));

    if (pid) fetchMeasurements(pid);
  }, [params]);

  /* ── BLE data handler ── */
  const handleNotify = useCallback((event: Event) => {
    const view = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!view) return;

    // Leica Disto protocol: little-endian float32 at offset 1 (bytes 1-4)
    // Bosch PLR protocol: little-endian int32 at offset 4 (in mm)
    let meters: number | null = null;
    if (deviceType === 'leica' && view.byteLength >= 5) {
      meters = view.getFloat32(1, true);
    } else if (deviceType === 'bosch' && view.byteLength >= 8) {
      const mm = view.getInt32(4, true);
      meters = mm / 1000;
    } else if (view.byteLength >= 4) {
      // Generic: try float32 LE
      meters = view.getFloat32(0, true);
      if (isNaN(meters) || meters < 0 || meters > 200) {
        // Try int32 in mm
        meters = view.getInt32(0, true) / 1000;
      }
    }

    if (meters !== null && !isNaN(meters) && meters > 0 && meters < 300) {
      setLiveMeter(meters);
    }
  }, [deviceType]);

  /* ── connect BLE ── */
  const connectBLE = async (preferredType: 'leica' | 'bosch') => {
    if (!navigator.bluetooth) {
      setError('Web Bluetooth not supported. Use Chrome on Android or desktop.');
      return;
    }
    setConnecting(true);
    setError('');
    try {
      const services = preferredType === 'leica'
        ? [LEICA_SERVICE, BOSCH_SERVICE]
        : [BOSCH_SERVICE, LEICA_SERVICE];

      const dev = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [LEICA_SERVICE] },
          { services: [BOSCH_SERVICE] },
          { namePrefix: 'DISTO' },
          { namePrefix: 'Bosch' },
          { namePrefix: 'PLR' },
        ],
        optionalServices: [LEICA_SERVICE, BOSCH_SERVICE],
      });

      setDevice(dev);
      const server = await dev.gatt!.connect();

      let gattChar: BluetoothRemoteGATTCharacteristic | null = null;
      let detectedType: 'leica' | 'bosch' = preferredType;

      // Try Leica first
      try {
        const svc = await server.getPrimaryService(LEICA_SERVICE);
        gattChar = await svc.getCharacteristic(LEICA_CHAR);
        detectedType = 'leica';
      } catch {
        // Try Bosch
        try {
          const svc = await server.getPrimaryService(BOSCH_SERVICE);
          gattChar = await svc.getCharacteristic(BOSCH_CHAR);
          detectedType = 'bosch';
        } catch {
          throw new Error('Device connected but measurement service not found. Check device compatibility.');
        }
      }

      setDeviceType(detectedType);
      await gattChar.startNotifications();
      gattChar.addEventListener('characteristicvaluechanged', handleNotify as EventListener);
      setChar(gattChar);
      charRef.current = gattChar;

      dev.addEventListener('gattserverdisconnected', () => {
        setDevice(null);
        setChar(null);
        setLiveMeter(null);
        charRef.current = null;
      });
    } catch (err: unknown) {
      setError((err as Error).message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  /* ── disconnect ── */
  const disconnectBLE = async () => {
    if (charRef.current) {
      try {
        charRef.current.removeEventListener('characteristicvaluechanged', handleNotify as EventListener);
        await charRef.current.stopNotifications();
      } catch { /* ignore */ }
    }
    device?.gatt?.disconnect();
    setDevice(null);
    setChar(null);
    setLiveMeter(null);
    setDeviceType(null);
  };

  /* ── fetch existing measurements ── */
  async function fetchMeasurements(pid: string) {
    try {
      const res = await fetch(`/api/laser/measurements?projectId=${pid}`);
      if (res.ok) {
        const data = await res.json();
        setMeasurements(data.measurements || []);
      }
    } catch { /* offline */ }
  }

  /* ── save measurement ── */
  const saveMeasurement = async (meters: number) => {
    if (!projectId) { setError('No active project. Open a project first.'); return; }
    if (!label.trim()) { setError('Enter a label before saving.'); return; }
    setSaving(true);
    setError('');

    const meas: Measurement = {
      id:         crypto.randomUUID(),
      label:      label.trim(),
      value_m:    meters,
      unit,
      display:    toDisplay(meters, unit),
      note:       note.trim(),
      timestamp:  new Date().toISOString(),
      project_id: projectId,
      device:     device?.name || (deviceType ? `${deviceType} device` : 'manual'),
      synced:     online,
    };

    if (online) {
      try {
        const res = await fetch('/api/laser/measurements', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(meas),
        });
        if (!res.ok) throw new Error('Save failed');
      } catch {
        await enqueue('laser/measurements', meas);
        meas.synced = false;
      }
    } else {
      await enqueue('laser/measurements', meas);
      meas.synced = false;
    }

    setMeasurements(prev => [meas, ...prev]);
    setLabel('');
    setNote('');
    setManualVal('');
    setLiveMeter(null);
    setSaving(false);
  };

  /* ── manual save ── */
  const saveManual = () => {
    const meters = parseManual(manualVal, unit);
    if (!meters) { setError('Invalid measurement value.'); return; }
    saveMeasurement(meters);
  };

  /* ── delete measurement ── */
  const deleteMeasurement = async (id: string) => {
    setMeasurements(prev => prev.filter(m => m.id !== id));
    if (online) {
      await fetch(`/api/laser/measurements/${id}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  /* ── copy to clipboard ── */
  const copyAll = () => {
    const text = measurements.map(m => `${m.label}: ${m.display}${m.note ? ' (' + m.note + ')' : ''}`).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const connected = !!device?.gatt?.connected;

  /* ─────────────────────────── UI ─────────────────────────── */
  return (
    <div style={{ minHeight:'100vh', background:'#0F1419', color:'#F0F4FF', fontFamily:'system-ui,sans-serif', padding:'16px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
        <button onClick={() => router.back()}
          style={{ background:'none', border:'none', color:'#8BAAC8', cursor:'pointer', fontSize:'20px' }}>←</button>
        <div>
          <h1 style={{ margin:0, fontSize:'20px', fontWeight:700 }}>📐 Laser Measure</h1>
          <p style={{ margin:0, fontSize:'12px', color:'#8BAAC8' }}>
            {connected ? `Connected: ${device?.name || deviceType}` : 'Bluetooth laser measurement'} ·{' '}
            <span style={{ color: online ? '#22C55E' : '#EF4444' }}>{online ? 'Online' : 'Offline'}</span>
          </p>
        </div>
        {measurements.length > 0 && (
          <button onClick={copyAll}
            style={{ marginLeft:'auto', background:'#1A1F2E', border:'1px solid #1E3A5F', borderRadius:8, color:'#8BAAC8', padding:'6px 12px', cursor:'pointer', fontSize:'12px' }}>
            Copy All
          </button>
        )}
      </div>

      {error && (
        <div style={{ background:'#7F1D1D', border:'1px solid #EF4444', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#FCA5A5' }}>
          ⚠ {error}
          <button onClick={() => setError('')} style={{ float:'right', background:'none', border:'none', color:'#FCA5A5', cursor:'pointer' }}>✕</button>
        </div>
      )}

      {/* BLE Connection Panel */}
      <div style={{ background:'#1A1F2E', border:'1px solid #1E3A5F', borderRadius:12, padding:'16px', marginBottom:16 }}>
        <h3 style={{ margin:'0 0 12px', fontSize:14, color:'#8BAAC8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Bluetooth Connection</h3>

        {!bleSupported && (
          <div style={{ background:'#1c1207', border:'1px solid #D4A017', borderRadius:8, padding:'10px 12px', fontSize:13, color:'#FDE68A', marginBottom:12 }}>
            ⚠ Web Bluetooth is not supported in this browser. Use Chrome on Android or desktop for BLE connectivity.
            Use manual entry below instead.
          </div>
        )}

        {!connected ? (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={() => connectBLE('leica')} disabled={connecting || !bleSupported}
              style={{ flex:1, minWidth:140, padding:'10px', background: bleSupported ? '#1E3A5F' : '#111827', border:'1px solid #1E3A5F', borderRadius:8, color: bleSupported ? '#F0F4FF' : '#4B5563', cursor: bleSupported ? 'pointer' : 'not-allowed', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              {connecting ? '⏳ Connecting...' : '🔵 Connect Leica DISTO'}
            </button>
            <button onClick={() => connectBLE('bosch')} disabled={connecting || !bleSupported}
              style={{ flex:1, minWidth:140, padding:'10px', background: bleSupported ? '#1E3A5F' : '#111827', border:'1px solid #1E3A5F', borderRadius:8, color: bleSupported ? '#F0F4FF' : '#4B5563', cursor: bleSupported ? 'pointer' : 'not-allowed', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              {connecting ? '⏳ Connecting...' : '🔵 Connect Bosch PLR'}
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:'#22C55E', boxShadow:'0 0 6px #22C55E' }} />
              <span style={{ fontSize:14 }}>{device?.name || 'Laser Device'}</span>
              <span style={{ fontSize:12, color:'#8BAAC8' }}>({deviceType?.toUpperCase()})</span>
            </div>
            <button onClick={disconnectBLE}
              style={{ background:'#7F1D1D', border:'1px solid #EF4444', borderRadius:6, color:'#FCA5A5', padding:'6px 12px', cursor:'pointer', fontSize:12 }}>
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Live Reading */}
      {connected && (
        <div style={{ background:'#1A1F2E', border:'2px solid #D4A017', borderRadius:12, padding:'20px', marginBottom:16, textAlign:'center' }}>
          <p style={{ margin:'0 0 4px', fontSize:12, color:'#8BAAC8', textTransform:'uppercase', letterSpacing:'0.1em' }}>Live Reading</p>
          <div style={{ fontSize:48, fontWeight:800, color:'#D4A017', letterSpacing:'-1px', lineHeight:1 }}>
            {liveMeter !== null ? toDisplay(liveMeter, unit) : '—'}
          </div>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#8BAAC8' }}>
            {liveMeter !== null ? `${liveMeter.toFixed(4)} m raw` : 'Press measure button on device'}
          </p>
          {liveMeter !== null && (
            <button onClick={() => saveMeasurement(liveMeter)}
              disabled={saving || !label.trim()}
              style={{ marginTop:16, padding:'12px 32px', background: label.trim() ? '#D4A017' : '#374151', border:'none', borderRadius:8, color: label.trim() ? '#0F1419' : '#9CA3AF', fontWeight:700, fontSize:15, cursor: label.trim() ? 'pointer' : 'not-allowed' }}>
              {saving ? 'Saving...' : '💾 Save This Reading'}
            </button>
          )}
          {liveMeter !== null && !label.trim() && (
            <p style={{ margin:'8px 0 0', fontSize:11, color:'#EF4444' }}>Enter a label below before saving</p>
          )}
        </div>
      )}

      {/* Unit Selector */}
      <div style={{ background:'#1A1F2E', border:'1px solid #1E3A5F', borderRadius:12, padding:'16px', marginBottom:16 }}>
        <h3 style={{ margin:'0 0 10px', fontSize:13, color:'#8BAAC8', textTransform:'uppercase' }}>Display Unit</h3>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {(['ft_in','m','cm','mm','in'] as Unit[]).map(u => (
            <button key={u} onClick={() => setUnit(u)}
              style={{ padding:'6px 14px', borderRadius:20, border:'1px solid', borderColor: unit === u ? '#D4A017' : '#1E3A5F', background: unit === u ? '#D4A017' : 'transparent', color: unit === u ? '#0F1419' : '#8BAAC8', fontWeight: unit === u ? 700 : 400, cursor:'pointer', fontSize:13 }}>
              {u === 'ft_in' ? "ft' in"" : u}
            </button>
          ))}
        </div>
      </div>

      {/* Label + Note */}
      <div style={{ background:'#1A1F2E', border:'1px solid #1E3A5F', borderRadius:12, padding:'16px', marginBottom:16 }}>
        <h3 style={{ margin:'0 0 12px', fontSize:13, color:'#8BAAC8', textTransform:'uppercase' }}>Measurement Details</h3>
        <input
          placeholder="Label (e.g. East wall width) *"
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={{ width:'100%', background:'#0F1419', border:'1px solid #1E3A5F', borderRadius:8, color:'#F0F4FF', padding:'10px 12px', fontSize:14, marginBottom:8, boxSizing:'border-box' }}
        />
        <input
          placeholder="Note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          style={{ width:'100%', background:'#0F1419', border:'1px solid #1E3A5F', borderRadius:8, color:'#F0F4FF', padding:'10px 12px', fontSize:14, boxSizing:'border-box' }}
        />
      </div>

      {/* Manual Entry */}
      <div style={{ background:'#1A1F2E', border:'1px solid #1E3A5F', borderRadius:12, padding:'16px', marginBottom:16 }}>
        <h3 style={{ margin:'0 0 12px', fontSize:13, color:'#8BAAC8', textTransform:'uppercase' }}>Manual Entry</h3>
        <div style={{ display:'flex', gap:8 }}>
          <input
            type="number"
            placeholder={`Value in ${unit === 'ft_in' ? 'feet (decimal)' : unit}`}
            value={manualVal}
            onChange={e => setManualVal(e.target.value)}
            style={{ flex:1, background:'#0F1419', border:'1px solid #1E3A5F', borderRadius:8, color:'#F0F4FF', padding:'10px 12px', fontSize:14 }}
          />
          <button onClick={saveManual} disabled={saving || !manualVal || !label.trim()}
            style={{ padding:'10px 20px', background: (manualVal && label.trim()) ? '#3B82F6' : '#1E3A5F', border:'none', borderRadius:8, color:'#F0F4FF', fontWeight:600, cursor: (manualVal && label.trim()) ? 'pointer' : 'not-allowed', fontSize:14 }}>
            {saving ? '...' : 'Add'}
          </button>
        </div>
        {!projectId && (
          <p style={{ margin:'8px 0 0', fontSize:11, color:'#EF4444' }}>
            ⚠ No active project. Select a project from the dashboard first.
          </p>
        )}
      </div>

      {/* Measurement History */}
      <div style={{ background:'#1A1F2E', border:'1px solid #1E3A5F', borderRadius:12, padding:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <h3 style={{ margin:0, fontSize:14, fontWeight:600 }}>Measurements ({measurements.length})</h3>
          {!online && <span style={{ fontSize:11, color:'#D4A017' }}>⚠ Offline — queued</span>}
        </div>

        {measurements.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 0', color:'#8BAAC8' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>📐</div>
            <p style={{ margin:0, fontSize:14 }}>No measurements yet</p>
            <p style={{ margin:'4px 0 0', fontSize:12 }}>Connect a laser device or use manual entry above</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {measurements.map(m => (
              <div key={m.id} style={{ background:'#0F1419', border:'1px solid #1E3A5F', borderRadius:8, padding:'12px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                      <span style={{ fontWeight:600, fontSize:14 }}>{m.label}</span>
                      {!m.synced && <span style={{ fontSize:10, background:'#D4A017', color:'#0F1419', padding:'1px 6px', borderRadius:10, fontWeight:600 }}>QUEUED</span>}
                    </div>
                    <div style={{ fontSize:22, fontWeight:700, color:'#D4A017' }}>{m.display}</div>
                    <div style={{ display:'flex', gap:12, marginTop:4, fontSize:11, color:'#8BAAC8' }}>
                      <span>{m.device || 'manual'}</span>
                      <span>{new Date(m.timestamp).toLocaleString()}</span>
                    </div>
                    {m.note && <p style={{ margin:'4px 0 0', fontSize:12, color:'#8BAAC8', fontStyle:'italic' }}>{m.note}</p>}
                  </div>
                  <div style={{ display:'flex', gap:6, marginLeft:8 }}>
                    <button onClick={() => navigator.clipboard.writeText(m.display).catch(()=>{})}
                      style={{ background:'#1A1F2E', border:'1px solid #1E3A5F', borderRadius:6, color:'#8BAAC8', padding:'4px 8px', cursor:'pointer', fontSize:11 }}>
                      Copy
                    </button>
                    <button onClick={() => deleteMeasurement(m.id)}
                      style={{ background:'none', border:'none', color:'#EF4444', cursor:'pointer', fontSize:14 }}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
