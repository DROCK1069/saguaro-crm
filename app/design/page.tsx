'use client';
import React, { useState, useRef, useCallback } from 'react';

/* ─── Palette ─── */
const BG = '#0F1419', CARD = '#1A1F2E', GOLD = '#D4A017', GREEN = '#22C55E';
const BORDER = '#2A3040', TEXT = '#F0F4FF', DIM = '#8B9DB8', DARK = '#141922';

/* ─── Room Types ─── */
const ROOMS = [
  { id: 'kitchen', label: 'Kitchen', icon: '🍳' },
  { id: 'bathroom', label: 'Bathroom', icon: '🚿' },
  { id: 'living_room', label: 'Living Room', icon: '🛋️' },
  { id: 'bedroom', label: 'Bedroom', icon: '🛏️' },
  { id: 'exterior', label: 'Exterior', icon: '🏠' },
  { id: 'backyard', label: 'Backyard', icon: '🌿' },
  { id: 'office', label: 'Office', icon: '💼' },
  { id: 'garage', label: 'Garage', icon: '🔧' },
];

/* ─── Design Styles ─── */
const STYLES = [
  { id: 'modern', label: 'Modern', img: '/images/styles/modern.jpg' },
  { id: 'farmhouse', label: 'Farmhouse', img: '/images/styles/farmhouse.jpg' },
  { id: 'mediterranean', label: 'Mediterranean', img: '/images/styles/mediterranean.jpg' },
  { id: 'industrial', label: 'Industrial', img: '/images/styles/industrial.jpg' },
  { id: 'scandinavian', label: 'Scandinavian', img: '/images/styles/scandinavian.jpg' },
  { id: 'coastal', label: 'Coastal', img: '/images/styles/coastal.jpg' },
  { id: 'minimalist', label: 'Minimalist', img: '/images/styles/minimalist.jpg' },
  { id: 'luxury', label: 'Luxury', img: '/images/styles/luxury.jpg' },
  { id: 'rustic', label: 'Rustic', img: '/images/styles/rustic.jpg' },
  { id: 'contemporary', label: 'Contemporary', img: '/images/styles/contemporary.jpg' },
];

const PROGRESS_MSGS = [
  'Analyzing your photo...',
  'Identifying room features...',
  'Generating design concepts...',
  'Calculating material costs...',
  'Finalizing your design...',
];

/* ─── Shared Styles ─── */
const glass: React.CSSProperties = {
  background: `${CARD}CC`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`, borderRadius: 16,
};
const btnGold: React.CSSProperties = {
  padding: '14px 36px', background: `linear-gradient(135deg, ${GOLD}, #B8860B)`,
  color: '#000', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 16,
  cursor: 'pointer', transition: 'all .2s', letterSpacing: 0.5,
};
const btnOutline: React.CSSProperties = {
  padding: '12px 28px', background: 'transparent', color: GOLD,
  border: `2px solid ${GOLD}`, borderRadius: 12, fontWeight: 700, fontSize: 14,
  cursor: 'pointer', transition: 'all .2s',
};

export default function DesignStudioPage() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [room, setRoom] = useState('');
  const [style, setStyle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhoto(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleGenerate = async () => {
    if (!room || !style) return;
    setLoading(true); setProgressIdx(0); setResult(null);
    const interval = setInterval(() => {
      setProgressIdx(prev => prev < PROGRESS_MSGS.length - 1 ? prev + 1 : prev);
    }, 2200);
    try {
      const formData = new FormData();
      if (photoFile) formData.append('photo', photoFile);
      formData.append('room_type', room);
      formData.append('design_style', style);
      formData.append('instructions', instructions);
      const res = await fetch('/api/design/generate', { method: 'POST', body: formData });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({
        description: 'Your dream space awaits. Based on your selections, here is a conceptual design that blends form and function.',
        estimated_cost: { low: 15000, high: 45000 },
        materials: [
          { name: 'Engineered Hardwood Flooring', qty: '200 sq ft', cost: '$2,400' },
          { name: 'Quartz Countertops', qty: '30 sq ft', cost: '$3,600' },
          { name: 'Custom Cabinetry', qty: '12 units', cost: '$8,500' },
          { name: 'LED Recessed Lighting', qty: '8 fixtures', cost: '$960' },
          { name: 'Smart Thermostat', qty: '1 unit', cost: '$250' },
        ],
      });
    } finally {
      clearInterval(interval); setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT }}>
      {/* ── Hero Section ── */}
      <section style={{
        textAlign: 'center', padding: '80px 20px 40px',
        background: `linear-gradient(180deg, ${DARK} 0%, ${BG} 100%)`,
      }}>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: 800, marginBottom: 12 }}>
          Design Your <span style={{ color: GOLD }}>Dream Space</span>
        </h1>
        <p style={{ fontSize: 18, color: DIM, maxWidth: 600, margin: '0 auto 40px' }}>
          Upload a photo, choose your style, and let AI transform your vision into reality.
        </p>

        {/* ── Upload Area ── */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            ...glass, maxWidth: 640, margin: '0 auto', padding: photo ? 0 : 60,
            cursor: 'pointer', transition: 'border-color .2s',
            borderColor: dragOver ? GOLD : BORDER, overflow: 'hidden',
          }}
        >
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {photo ? (
            <div style={{ position: 'relative' }}>
              <img src={photo} alt="Preview" style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }} />
              <button
                onClick={(e) => { e.stopPropagation(); setPhoto(null); setPhotoFile(null); }}
                style={{
                  position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,.7)',
                  color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >Remove</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
              <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                Drag & drop a photo or tap to upload
              </p>
              <p style={{ fontSize: 13, color: DIM }}>
                Take a photo of your room or upload an existing image
              </p>
            </>
          )}
        </div>
      </section>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 80px' }}>
        {/* ── Room Type ── */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
            Select Room Type
          </h2>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12,
          }}>
            {ROOMS.map(r => (
              <button key={r.id} onClick={() => setRoom(r.id)} style={{
                ...glass, padding: '20px 10px', textAlign: 'center', cursor: 'pointer',
                borderColor: room === r.id ? GOLD : BORDER,
                background: room === r.id ? `${GOLD}18` : `${CARD}CC`,
                transition: 'all .2s',
              }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>{r.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: room === r.id ? GOLD : TEXT }}>
                  {r.label}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Design Style ── */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
            Choose Your Style
          </h2>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14,
          }}>
            {STYLES.map(s => (
              <button key={s.id} onClick={() => setStyle(s.id)} style={{
                ...glass, padding: 0, overflow: 'hidden', cursor: 'pointer',
                borderColor: style === s.id ? GOLD : BORDER,
                transition: 'all .2s', textAlign: 'left',
              }}>
                <div style={{
                  height: 110, background: `linear-gradient(135deg, ${CARD}, ${DARK})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 40, color: DIM,
                }}>
                  {s.label.charAt(0)}
                </div>
                <div style={{
                  padding: '10px 14px', fontSize: 13, fontWeight: 700,
                  color: style === s.id ? GOLD : TEXT,
                  background: style === s.id ? `${GOLD}12` : 'transparent',
                }}>
                  {s.label}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Custom Instructions ── */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
            Custom Instructions <span style={{ fontWeight: 400, color: DIM, fontSize: 14 }}>(optional)</span>
          </h2>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Describe your vision... e.g., 'Open concept with an island, warm lighting, and smart appliances'"
            rows={4}
            style={{
              width: '100%', background: `${CARD}CC`, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: 16, color: TEXT, fontSize: 14, resize: 'vertical',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
        </section>

        {/* ── Generate Button ── */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <button
            onClick={handleGenerate}
            disabled={loading || !room || !style}
            style={{
              ...btnGold,
              opacity: loading || !room || !style ? 0.5 : 1,
              transform: loading ? 'scale(0.98)' : 'scale(1)',
            }}
          >
            {loading ? 'Generating...' : 'Generate Design'}
          </button>
          {(!room || !style) && !loading && (
            <p style={{ color: DIM, fontSize: 13, marginTop: 10 }}>
              Please select a room type and design style to continue
            </p>
          )}
        </div>

        {/* ── Loading Progress ── */}
        {loading && (
          <div style={{ ...glass, padding: 40, textAlign: 'center', marginBottom: 48 }}>
            <div style={{
              width: 48, height: 48, border: `3px solid ${BORDER}`, borderTopColor: GOLD,
              borderRadius: '50%', margin: '0 auto 20px',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: GOLD }}>
              {PROGRESS_MSGS[progressIdx]}
            </p>
            <div style={{
              width: '100%', maxWidth: 300, height: 4, background: BORDER,
              borderRadius: 2, margin: '16px auto 0', overflow: 'hidden',
            }}>
              <div style={{
                width: `${((progressIdx + 1) / PROGRESS_MSGS.length) * 100}%`,
                height: '100%', background: GOLD, borderRadius: 2,
                transition: 'width .5s ease',
              }} />
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── Results ── */}
        {result && !loading && (
          <section>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20, color: GOLD }}>
              Your Design Concept
            </h2>

            {/* Description */}
            <div style={{ ...glass, padding: 24, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>AI Design Description</h3>
              <p style={{ color: DIM, lineHeight: 1.7 }}>{result.description}</p>
            </div>

            {/* Cost Range */}
            <div style={{
              ...glass, padding: 24, marginBottom: 20,
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
            }}>
              <div>
                <div style={{ fontSize: 13, color: DIM, marginBottom: 4 }}>Estimated Cost Range</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: GREEN }}>
                  ${(result.estimated_cost?.low || 15000).toLocaleString()} &ndash; ${(result.estimated_cost?.high || 45000).toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: DIM, marginBottom: 4 }}>Style</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {STYLES.find(s => s.id === style)?.label || style} {ROOMS.find(r => r.id === room)?.label || room}
                </div>
              </div>
            </div>

            {/* Materials */}
            <div style={{ ...glass, padding: 24, marginBottom: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Materials List</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {(result.materials || []).map((m: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', background: `${BG}80`, borderRadius: 10,
                    border: `1px solid ${BORDER}`,
                  }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: DIM }}>{m.qty}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: GOLD }}>{m.cost}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div style={{
              display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap',
            }}>
              <a href="/design/discover" style={{ textDecoration: 'none' }}>
                <button style={btnGold}>Get a Free Quote</button>
              </a>
              <a href="/signup" style={{ textDecoration: 'none' }}>
                <button style={btnOutline}>Sign Up to Save Your Design</button>
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
