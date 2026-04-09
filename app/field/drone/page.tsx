'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface DronePhoto {
  id: string;
  url: string;
  filename: string;
  size: number;
  uploaded_at: string;
  project_id: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  heading?: number;
  status: 'uploading' | 'processing' | 'stitched' | 'error';
  panorama_url?: string;
  thumbnail_url?: string;
  ai_tags?: string[];
  progress_pct?: number;
  notes?: string;
}

interface StitchJob {
  id: string;
  status: 'queued' | 'processing' | 'complete' | 'error';
  progress: number;
  photo_count: number;
  panorama_url?: string;
  started_at: string;
  completed_at?: string;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function enqueue(action: string, payload: unknown) {
  try {
    const q = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    q.push({ action, payload, ts: Date.now() });
    localStorage.setItem('offline_queue', JSON.stringify(q));
  } catch { /* silent */ }
}

export default function DronePage() {
  const router       = useRouter();
  const params       = useSearchParams();
  const [projectId, setProjectId]       = useState<string | null>(null);
  const [photos,    setPhotos]          = useState<DronePhoto[]>([]);
  const [jobs,      setJobs]            = useState<StitchJob[]>([]);
  const [uploading, setUploading]       = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string,number>>({});
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [stitching, setStitching]       = useState(false);
  const [online,    setOnline]          = useState(true);
  const [view,      setView]            = useState<'grid' | 'map' | 'panorama'>('grid');
  const [activeJob, setActiveJob]       = useState<StitchJob | null>(null);
  const [activePhoto, setActivePhoto]   = useState<DronePhoto | null>(null);
  const [dragOver,  setDragOver]        = useState(false);
  const [error,     setError]           = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const pid = params.get('projectId') || localStorage.getItem('saguaro_active_project');
    setProjectId(pid);
    setOnline(navigator.onLine);
    window.addEventListener('online',  () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
    if (pid) { fetchPhotos(pid); fetchJobs(pid); }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [params]);

  const fetchPhotos = async (pid: string) => {
    try {
      const res = await fetch(`/api/drone?projectId=${pid}`);
      if (res.ok) { const d = await res.json(); setPhotos(d.photos || []); }
    } catch { /* offline */ }
  };

  const fetchJobs = async (pid: string) => {
    try {
      const res = await fetch(`/api/drone/jobs?projectId=${pid}`);
      if (res.ok) { const d = await res.json(); setJobs(d.jobs || []); }
    } catch { /* offline */ }
  };

  const startPolling = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/drone/jobs/${jobId}`);
        if (res.ok) {
          const d = await res.json();
          const job: StitchJob = d.job;
          setActiveJob(job);
          setJobs(prev => prev.map(j => j.id === job.id ? job : j));
          if (job.status === 'complete' || job.status === 'error') {
            if (pollRef.current) clearInterval(pollRef.current);
            if (job.status === 'complete' && projectId) fetchPhotos(projectId);
          }
        }
      } catch { /* network error, keep polling */ }
    }, 2500);
  };

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!projectId) { setError('No active project.'); return; }
    const fileArr = Array.from(files).filter(f => f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.jpg') || f.name.toLowerCase().endsWith('.jpeg') || f.name.toLowerCase().endsWith('.png') || f.name.toLowerCase().endsWith('.tif') || f.name.toLowerCase().endsWith('.tiff'));
    if (!fileArr.length) { setError('Please select image files (JPG, PNG, TIFF).'); return; }

    setUploading(true);
    setError('');
    const newPhotos: DronePhoto[] = [];

    for (const file of fileArr) {
      const tempId = crypto.randomUUID();
      const tempPhoto: DronePhoto = {
        id: tempId, url: URL.createObjectURL(file), filename: file.name,
        size: file.size, uploaded_at: new Date().toISOString(),
        project_id: projectId, status: 'uploading', progress_pct: 0,
      };
      setPhotos(prev => [tempPhoto, ...prev]);
      setUploadProgress(prev => ({ ...prev, [tempId]: 0 }));

      if (!online) {
        await enqueue('drone/upload', { filename: file.name, projectId, size: file.size });
        const offlinePhoto = { ...tempPhoto, status: 'error' as const, id: tempId };
        setPhotos(prev => prev.map(p => p.id === tempId ? offlinePhoto : p));
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);

        // Extract EXIF GPS if available (simplified approach)
        const reader = new FileReader();
        const exifPromise = new Promise<{lat?:number,lng?:number,alt?:number,heading?:number}>((resolve) => {
          reader.onload = () => resolve({});
          reader.readAsArrayBuffer(file.slice(0, 65536));
        });
        const exif = await exifPromise;
        if (exif.lat) { formData.append('latitude', String(exif.lat)); formData.append('longitude', String(exif.lng)); }
        if (exif.alt) formData.append('altitude', String(exif.alt));
        if (exif.heading) formData.append('heading', String(exif.heading));

        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => ({ ...prev, [tempId]: Math.min((prev[tempId] || 0) + 10, 90) }));
        }, 200);

        const res = await fetch('/api/drone', { method: 'POST', body: formData });
        clearInterval(progressInterval);
        setUploadProgress(prev => ({ ...prev, [tempId]: 100 }));

        if (res.ok) {
          const d = await res.json();
          const uploaded: DronePhoto = { ...d.photo, status: 'processing' };
          setPhotos(prev => prev.map(p => p.id === tempId ? uploaded : p));
          newPhotos.push(uploaded);
        } else {
          throw new Error('Upload failed');
        }
      } catch (err) {
        setPhotos(prev => prev.map(p => p.id === tempId ? { ...p, status: 'error' } : p));
        setError(`Failed to upload ${file.name}: ${(err as Error).message}`);
      }

      setUploadProgress(prev => { const n = {...prev}; delete n[tempId]; return n; });
    }

    setUploading(false);
    // Auto-AI processing suggestion
    if (newPhotos.length >= 3) {
      setError('');
      // Auto-select newly uploaded photos for stitching suggestion
      setSelectedPhotos(new Set(newPhotos.map(p => p.id)));
    }
  }, [projectId, online]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const startStitching = async () => {
    if (!projectId || selectedPhotos.size < 2) {
      setError('Select at least 2 photos to stitch.');
      return;
    }
    setStitching(true);
    setError('');
    try {
      const res = await fetch('/api/drone/stitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, photoIds: Array.from(selectedPhotos) }),
      });
      if (res.ok) {
        const d = await res.json();
        const job: StitchJob = d.job;
        setActiveJob(job);
        setJobs(prev => [job, ...prev]);
        startPolling(job.id);
        setSelectedPhotos(new Set());
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Stitch request failed');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStitching(false);
    }
  };

  const togglePhotoSelect = (id: string) => {
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const deletePhoto = async (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
    if (online) await fetch(`/api/drone/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const statusColor: Record<string, string> = {
    uploading: '#3B82F6', processing: '#D4A017', stitched: '#22C55E', error: '#EF4444',
    queued: '#8BAAC8', complete: '#22C55E',
  };
  const statusIcon: Record<string, string> = {
    uploading: '⬆', processing: '⚙', stitched: '✓', error: '✕',
    queued: '⏳', complete: '✓',
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0F1419', color:'#F0F4FF', fontFamily:'system-ui,sans-serif', padding:'16px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#8BAAC8', cursor:'pointer', fontSize:'20px' }}>←</button>
        <div style={{ flex:1 }}>
          <h1 style={{ margin:0, fontSize:'20px', fontWeight:700 }}>🚁 Drone Photo AI</h1>
          <p style={{ margin:0, fontSize:'12px', color:'#8BAAC8' }}>
            {photos.length} photos · {jobs.length} stitch jobs ·{' '}
            <span style={{ color: online ? '#22C55E' : '#EF4444' }}>{online ? 'Online' : 'Offline'}</span>
          </p>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {(['grid','map','panorama'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding:'6px 12px', borderRadius:20, border:'1px solid', borderColor: view === v ? '#D4A017' : '#1E3A5F', background: view === v ? '#D4A017' : 'transparent', color: view === v ? '#0F1419' : '#8BAAC8', cursor:'pointer', fontSize:12, fontWeight: view === v ? 700 : 400, textTransform:'capitalize' }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background:'#7F1D1D', border:'1px solid #EF4444', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#FCA5A5' }}>
          ⚠ {error}
          <button onClick={() => setError('')} style={{ float:'right', background:'none', border:'none', color:'#FCA5A5', cursor:'pointer' }}>✕</button>
        </div>
      )}

      {/* Active Stitch Job */}
      {activeJob && (activeJob.status === 'queued' || activeJob.status === 'processing') && (
        <div style={{ background:'#1A1F2E', border:'2px solid #D4A017', borderRadius:12, padding:'16px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'#D4A017', animation:'pulse 1s infinite' }} />
            <span style={{ fontWeight:600 }}>AI Stitching in Progress</span>
            <span style={{ marginLeft:'auto', fontSize:12, color:'#8BAAC8' }}>{activeJob.photo_count} photos</span>
          </div>
          <div style={{ background:'#0F1419', borderRadius:4, height:8, overflow:'hidden' }}>
            <div style={{ height:'100%', background:'linear-gradient(90deg,#D4A017,#F59E0B)', width:`${activeJob.progress}%`, transition:'width 0.5s' }} />
          </div>
          <p style={{ margin:'6px 0 0', fontSize:12, color:'#8BAAC8', textAlign:'right' }}>{activeJob.progress}% complete</p>
        </div>
      )}

      {/* Completed panorama preview */}
      {activeJob?.status === 'complete' && activeJob.panorama_url && (
        <div style={{ background:'#1A1F2E', border:'2px solid #22C55E', borderRadius:12, padding:'16px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <span style={{ color:'#22C55E', fontWeight:700 }}>✓ Panorama Ready</span>
            <a href={activeJob.panorama_url} target="_blank" rel="noopener noreferrer"
              style={{ marginLeft:'auto', color:'#3B82F6', fontSize:12, textDecoration:'underline' }}>
              Open Full Size ↗
            </a>
          </div>
          <img src={activeJob.panorama_url} alt="Site panorama"
            style={{ width:'100%', maxHeight:200, objectFit:'cover', borderRadius:8, cursor:'pointer' }}
            onClick={() => setView('panorama')} />
        </div>
      )}

      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{ background: dragOver ? '#1E3A5F' : '#1A1F2E', border:`2px dashed ${dragOver ? '#D4A017' : '#1E3A5F'}`, borderRadius:12, padding:'24px', marginBottom:16, textAlign:'center', transition:'all 0.2s', cursor:'pointer' }}
        onClick={() => fileInputRef.current?.click()}>
        <input ref={fileInputRef} type="file" multiple accept="image/*,.tif,.tiff" style={{ display:'none' }}
          onChange={e => e.target.files && uploadFiles(e.target.files)} />
        {uploading ? (
          <div>
            <div style={{ fontSize:32 }}>⬆</div>
            <p style={{ color:'#D4A017', fontWeight:600 }}>Uploading {Object.keys(uploadProgress).length} photo(s)...</p>
            {Object.entries(uploadProgress).map(([id, pct]) => (
              <div key={id} style={{ background:'#0F1419', borderRadius:4, height:4, margin:'4px 0', overflow:'hidden' }}>
                <div style={{ height:'100%', background:'#3B82F6', width:`${pct}%`, transition:'width 0.3s' }} />
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ fontSize:40 }}>🚁</div>
            <p style={{ margin:'8px 0 4px', fontWeight:600, color: dragOver ? '#D4A017' : '#F0F4FF' }}>
              Drop drone photos here or click to browse
            </p>
            <p style={{ margin:0, fontSize:12, color:'#8BAAC8' }}>
              Supports JPG, PNG, TIFF · Select multiple for AI panorama stitching
            </p>
          </div>
        )}
      </div>

      {/* Stitch Controls */}
      {selectedPhotos.size > 0 && (
        <div style={{ background:'#1A1F2E', border:'1px solid #D4A017', borderRadius:12, padding:'14px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <span style={{ fontSize:14 }}>
            <strong style={{ color:'#D4A017' }}>{selectedPhotos.size}</strong> photos selected for stitching
          </span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setSelectedPhotos(new Set())}
              style={{ padding:'8px 16px', background:'transparent', border:'1px solid #1E3A5F', borderRadius:8, color:'#8BAAC8', cursor:'pointer', fontSize:13 }}>
              Clear
            </button>
            <button onClick={startStitching} disabled={stitching || selectedPhotos.size < 2}
              style={{ padding:'8px 20px', background:'#D4A017', border:'none', borderRadius:8, color:'#0F1419', fontWeight:700, cursor: selectedPhotos.size >= 2 ? 'pointer' : 'not-allowed', fontSize:13 }}>
              {stitching ? '⏳ Starting...' : '🤖 AI Stitch Panorama'}
            </button>
          </div>
        </div>
      )}

      {/* Photo Grid */}
      {view === 'grid' && (
        <div style={{ background:'#1A1F2E', border:'1px solid #1E3A5F', borderRadius:12, padding:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600 }}>Site Photos ({photos.length})</h3>
            {photos.length > 0 && (
              <button onClick={() => setSelectedPhotos(new Set(photos.map(p => p.id)))}
                style={{ fontSize:12, background:'none', border:'1px solid #1E3A5F', borderRadius:6, color:'#8BAAC8', padding:'4px 10px', cursor:'pointer' }}>
                Select All
              </button>
            )}
          </div>

          {photos.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#8BAAC8' }}>
              <div style={{ fontSize:48 }}>🚁</div>
              <p style={{ margin:'8px 0 4px', fontSize:14 }}>No photos uploaded yet</p>
              <p style={{ margin:0, fontSize:12 }}>Drop drone footage above to get started</p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:10 }}>
              {photos.map(photo => (
                <div key={photo.id}
                  onClick={() => togglePhotoSelect(photo.id)}
                  style={{ position:'relative', borderRadius:8, overflow:'hidden', cursor:'pointer', border:`2px solid ${selectedPhotos.has(photo.id) ? '#D4A017' : 'transparent'}`, background:'#0F1419' }}>
                  {/* Status badge */}
                  <div style={{ position:'absolute', top:6, left:6, zIndex:2, background: statusColor[photo.status] || '#8BAAC8', borderRadius:10, padding:'2px 6px', fontSize:10, fontWeight:700, color:'#fff', display:'flex', alignItems:'center', gap:3 }}>
                    {statusIcon[photo.status]} {photo.status}
                  </div>
                  {/* Select indicator */}
                  {selectedPhotos.has(photo.id) && (
                    <div style={{ position:'absolute', top:6, right:6, zIndex:2, background:'#D4A017', borderRadius:'50%', width:20, height:20, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#0F1419' }}>✓</div>
                  )}
                  {/* Photo */}
                  <img src={photo.thumbnail_url || photo.url} alt={photo.filename}
                    style={{ width:'100%', height:120, objectFit:'cover', display:'block' }} />
                  {/* Info */}
                  <div style={{ padding:'6px 8px' }}>
                    <p style={{ margin:0, fontSize:11, color:'#8BAAC8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{photo.filename}</p>
                    <p style={{ margin:'2px 0 0', fontSize:10, color:'#4B5563' }}>{formatBytes(photo.size)}</p>
                    {photo.ai_tags && photo.ai_tags.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:2, marginTop:4 }}>
                        {photo.ai_tags.slice(0,2).map(tag => (
                          <span key={tag} style={{ fontSize:9, background:'#1A1F2E', border:'1px solid #1E3A5F', borderRadius:4, padding:'1px 4px', color:'#8BAAC8' }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Delete */}
                  <button onClick={e => { e.stopPropagation(); deletePhoto(photo.id); }}
                    style={{ position:'absolute', bottom:6, right:6, background:'rgba(239,68,68,0.8)', border:'none', borderRadius:4, color:'#fff', cursor:'pointer', fontSize:11, padding:'2px 6px', zIndex:2 }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map View */}
      {view === 'map' && (
        <div style={{ background:'#1A1F2E', border:'1px solid #1E3A5F', borderRadius:12, padding:'16px' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:600 }}>Photo Map</h3>
          <div style={{ background:'#0F1419', borderRadius:8, height:350, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #1E3A5F' }}>
            {photos.filter(p => p.latitude).length > 0 ? (
              <div style={{ textAlign:'center', color:'#8BAAC8' }}>
                <div style={{ fontSize:40 }}>🗺</div>
                <p style={{ margin:'8px 0 4px' }}>{photos.filter(p => p.latitude).length} geotagged photos</p>
                <p style={{ margin:0, fontSize:12 }}>GPS overlay requires Mapbox integration</p>
              </div>
            ) : (
              <div style={{ textAlign:'center', color:'#8BAAC8' }}>
                <div style={{ fontSize:40 }}>📍</div>
                <p style={{ margin:'8px 0 4px' }}>No GPS data found</p>
                <p style={{ margin:0, fontSize:12 }}>Upload photos with embedded GPS EXIF data</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panorama View */}
      {view === 'panorama' && (
        <div style={{ background:'#1A1F2E', border:'1px solid #1E3A5F', borderRadius:12, padding:'16px' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:600 }}>Panoramic Views</h3>
          {jobs.filter(j => j.status === 'complete' && j.panorama_url).length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#8BAAC8' }}>
              <div style={{ fontSize:48 }}>🌐</div>
              <p style={{ margin:'8px 0 4px', fontSize:14 }}>No panoramas yet</p>
              <p style={{ margin:0, fontSize:12 }}>Upload 3+ photos and click AI Stitch Panorama</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {jobs.filter(j => j.status === 'complete' && j.panorama_url).map(job => (
                <div key={job.id} style={{ background:'#0F1419', borderRadius:8, overflow:'hidden' }}>
                  <img src={job.panorama_url} alt="Site panorama" style={{ width:'100%', maxHeight:250, objectFit:'cover', display:'block' }} />
                  <div style={{ padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'#8BAAC8' }}>{job.photo_count} photos · {new Date(job.completed_at!).toLocaleDateString()}</span>
                    <a href={job.panorama_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize:12, color:'#3B82F6' }}>Open Full ↗</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stitch Jobs History */}
      {jobs.length > 0 && (
        <div style={{ background:'#1A1F2E', border:'1px solid #1E3A5F', borderRadius:12, padding:'16px', marginTop:16 }}>
          <h3 style={{ margin:'0 0 12px', fontSize:14, fontWeight:600 }}>Stitch History</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {jobs.map(job => (
              <div key={job.id} style={{ display:'flex', alignItems:'center', gap:12, background:'#0F1419', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background: statusColor[job.status], flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:13, fontWeight:500 }}>{job.photo_count} photos → AI stitch</span>
                    <span style={{ fontSize:11, color:'#8BAAC8' }}>{new Date(job.started_at).toLocaleString()}</span>
                  </div>
                  {(job.status === 'queued' || job.status === 'processing') && (
                    <div style={{ background:'#1A1F2E', borderRadius:2, height:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', background:'#D4A017', width:`${job.progress}%`, transition:'width 0.5s' }} />
                    </div>
                  )}
                  {job.status === 'error' && job.error && <p style={{ margin:0, fontSize:11, color:'#EF4444' }}>{job.error}</p>}
                </div>
                <span style={{ fontSize:12, color: statusColor[job.status], fontWeight:600, textTransform:'capitalize' }}>{job.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
