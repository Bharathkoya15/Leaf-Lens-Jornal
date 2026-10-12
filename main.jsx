import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Dexie from 'dexie'
import { Camera, Leaf, Trophy, History, Home, X, Check, Trash2, Sprout, WifiOff, Download, Search } from 'lucide-react'
import './style.css'

const db = new Dexie('LeafLensDB')
db.version(1).stores({
  plants: '++id, common_name, scientific_name, scanned_at',
  badges: 'id, unlocked'
})
const initialBadges = [
  { id: 'first', title: 'First Leaf', description: 'Save your first plant to the journal.', icon: '🌱', unlocked: false },
  { id: 'five', title: 'Curious Botanist', description: 'Save five plants to your journal.', icon: '🔎', unlocked: false },
  { id: 'oak', title: 'Oak Observer', description: 'Add a plant with “oak” in its name.', icon: '🌳', unlocked: false },
  { id: 'ten', title: 'Green Thumb', description: 'Save ten plants to your journal.', icon: '🏆', unlocked: false }
]
const fmt = value => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

function App() {
  const [page, setPage] = useState('home')
  const [plants, setPlants] = useState([])
  const [badges, setBadges] = useState(initialBadges)
  const [cameraError, setCameraError] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [captured, setCaptured] = useState(null)
  const [commonName, setCommonName] = useState('')
  const [scientificName, setScientificName] = useState('')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)

  async function refresh() {
    const saved = await db.plants.orderBy('scanned_at').reverse().toArray()
    setPlants(saved)
    const old = await db.badges.toArray()
    const map = new Map(old.map(b => [b.id, b]))
    const total = saved.length
    const oak = saved.some(p => (p.common_name || '').toLowerCase().includes('oak'))
    const next = initialBadges.map(b => ({ ...b, unlocked: b.id === 'first' ? total >= 1 : b.id === 'five' ? total >= 5 : b.id === 'oak' ? oak : total >= 10 }))
    await db.transaction('rw', db.badges, async () => {
      for (const b of next) {
        if (b.unlocked && !map.get(b.id)?.unlocked) setToast(`🏆 Badge unlocked: ${b.title}`)
        await db.badges.put(b)
      }
    })
    setBadges(next)
  }
  useEffect(() => { refresh() }, [])
  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(''), 3200); return () => clearTimeout(id) } }, [toast])
  useEffect(() => () => stopCamera(), [])

  async function startCamera() {
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access requires HTTPS or localhost. Open this app through a secure website, or choose a photo instead.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream
      setStreaming(true)
      setPage('camera')
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream }, 80)
    } catch (e) {
      setCameraError(e.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser settings, or choose a photo.' : 'Could not start the camera. Try choosing a photo from your device.')
      setPage('camera')
    }
  }
  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setStreaming(false)
  }
  async function capturePhoto() {
    const video = videoRef.current
    if (!video?.videoWidth) { setCameraError('Camera is still starting. Try again in a moment.'); return }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => { if (blob) { setCaptured(blob); stopCamera() } }, 'image/jpeg', 0.85)
  }
  function chooseFile(e) {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) { setCaptured(file); setCameraError(''); stopCamera(); setPage('camera') }
    e.target.value = ''
  }
  async function savePlant(e) {
    e.preventDefault()
    if (!captured || !commonName.trim()) return
    await db.plants.add({
      common_name: commonName.trim(),
      scientific_name: scientificName.trim() || 'Not recorded',
      scanned_at: new Date().toISOString(),
      image_blob: captured,
      confidence_score: null,
      identification_note: 'Name entered by you; automatic plant identification is not connected.'
    })
    setCaptured(null); setCommonName(''); setScientificName('')
    await refresh(); setPage('journal'); setToast('Plant saved to your offline journal 🌿')
  }
  async function deletePlant(id) {
    await db.plants.delete(id)
    await refresh()
  }
  const filtered = plants.filter(p => `${p.common_name} ${p.scientific_name}`.toLowerCase().includes(search.toLowerCase()))

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><Leaf size={22} /></div>
      <div><div className="brand">LeafLens</div><div className="tagline">Your personal forest journal</div></div>
      <div className="offline-pill"><WifiOff size={13}/> Offline-ready</div>
    </header>

    <main>
      {page === 'home' && <section className="page">
        <div className="hero">
          <div className="hero-copy"><span className="eyebrow">GROW YOUR CURIOSITY</span><h1>Every leaf has<br/>a story.</h1><p>Build your own little field guide, one plant at a time.</p>
            <button className="primary" onClick={startCamera}><Camera size={19}/> Scan a plant <span>→</span></button>
            <button className="secondary" onClick={() => fileRef.current?.click()}><Download size={17}/> Choose a photo</button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={chooseFile}/>
            {cameraError && <p className="error">{cameraError}</p>}
          </div>
          <div className="hero-art" aria-hidden="true"><div className="sun"></div><div className="plant-illustration"><span className="stem"></span><span className="leaf-shape l1"></span><span className="leaf-shape l2"></span><span className="leaf-shape l3"></span><span className="leaf-shape l4"></span><span className="pot"></span></div></div>
        </div>
        <div className="section-heading"><div><span className="eyebrow">YOUR PROGRESS</span><h2>Little by little</h2></div><span className="tiny-leaf">✳</span></div>
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-icon sage"><Leaf size={20}/></div><div className="stat-number">{plants.length}</div><div className="stat-label">Plants in journal</div></div>
          <div className="stat-card"><div className="stat-icon gold"><Trophy size={20}/></div><div className="stat-number">{badges.filter(b => b.unlocked).length}<span className="muted"> / {badges.length}</span></div><div className="stat-label">Badges earned</div></div>
        </div>
        <div className="section-heading"><div><span className="eyebrow">COLLECT MOMENTS</span><h2>Your achievements</h2></div><button className="text-button" onClick={() => setPage('badges')}>See all →</button></div>
        <div className="badge-row">{badges.slice(0,3).map(b => <div className={`badge-card ${b.unlocked?'earned':''}`} key={b.id}><div className="badge-icon">{b.icon}</div><div><strong>{b.title}</strong><p>{b.unlocked?'Unlocked!':b.description}</p></div>{b.unlocked && <Check size={17} className="check"/>}</div>)}</div>
        <div className="tip"><div className="tip-icon">☀️</div><div><strong>A little field note</strong><p>Good light and a clear view of the leaves make it easier to record a plant accurately.</p></div></div>
      </section>}

      {page === 'camera' && <section className="page">
        <button className="back-button" onClick={() => { stopCamera(); setCaptured(null); setPage('home') }}>← Back</button>
        <div className="section-heading"><div><span className="eyebrow">FIELD CAMERA</span><h1>Meet a new leaf</h1></div></div>
        {!captured ? <div className="camera-panel">
          {streaming ? <div className="video-wrap"><video ref={videoRef} autoPlay playsInline muted/><div className="viewfinder"></div></div> : <div className="camera-placeholder"><Camera size={44}/><p>Start your camera or choose a photo.</p><button className="primary" onClick={startCamera}>Enable camera</button><button className="secondary" onClick={() => fileRef.current?.click()}>Choose photo</button><input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={chooseFile}/></div>}
          {streaming && <div className="capture-controls"><p>Center the plant in the frame</p><button className="shutter" onClick={capturePhoto} aria-label="Capture photo"><span/></button><button className="secondary" onClick={() => fileRef.current?.click()}>Choose photo instead</button><input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={chooseFile}/></div>}
          {cameraError && <p className="error">{cameraError}</p>}
        </div> : <div className="form-card">
          <img className="preview-image" src={URL.createObjectURL(captured)} alt="Captured plant"/>
          <div className="note-box"><strong>Identification note</strong><p>This version stores your photo and the name you enter. Automatic AI identification and cloud syncing are not connected yet.</p></div>
          <form onSubmit={savePlant}>
            <label>Plant common name *<input value={commonName} onChange={e=>setCommonName(e.target.value)} required placeholder="e.g. Holy basil"/></label>
            <label>Scientific name (optional)<input value={scientificName} onChange={e=>setScientificName(e.target.value)} placeholder="e.g. Ocimum tenuiflorum"/></label>
            <button className="primary full" type="submit"><Check size={18}/> Save to journal</button>
            <button className="secondary full" type="button" onClick={() => setCaptured(null)}>Retake / choose another</button>
          </form>
        </div>}
      </section>}

      {page === 'journal' && <section className="page">
        <div className="section-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h1>Plant journal</h1><p className="subhead">{plants.length} memories growing here</p></div><button className="round-action" onClick={startCamera}><Camera size={19}/></button></div>
        <div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your plants"/></div>
        {filtered.length === 0 ? <div className="empty-state"><div className="empty-emoji">🌿</div><h3>{plants.length ? 'No matches found' : 'Your story starts here'}</h3><p>{plants.length ? 'Try another plant name.' : 'Capture or choose a plant photo and save it to your journal.'}</p><button className="primary" onClick={startCamera}><Camera size={18}/> Add your first plant</button></div> :
          <div className="plant-grid">{filtered.map(p => <article className="plant-card" key={p.id}>{p.image_blob ? <img src={URL.createObjectURL(p.image_blob)} alt={p.common_name}/> : <div className="plant-photo-placeholder">🌿</div>}<div className="plant-info"><span className="date">{fmt(p.scanned_at)}</span><h3>{p.common_name}</h3><p className="latin">{p.scientific_name}</p><button className="delete-button" onClick={()=>deletePlant(p.id)}><Trash2 size={14}/> Remove</button></div></article>)}</div>}
      </section>}

      {page === 'badges' && <section className="page">
        <button className="back-button" onClick={() => setPage('home')}>← Back to home</button>
        <div className="section-heading"><div><span className="eyebrow">MILESTONES</span><h1>Growing achievements</h1><p className="subhead">Every little discovery counts.</p></div></div>
        <div className="badges-list">{badges.map(b=><div className={`badge-detail ${b.unlocked?'earned':''}`} key={b.id}><div className="badge-icon large">{b.icon}</div><div className="badge-description"><h3>{b.title}</h3><p>{b.description}</p></div><span className={`status ${b.unlocked?'done':''}`}>{b.unlocked?'Earned':'Locked'}</span></div>)}</div>
      </section>}
    </main>

    <nav className="bottom-nav">
      <button className={page==='home'?'active':''} onClick={()=>setPage('home')}><Home size={20}/><span>Home</span></button>
      <button className={page==='camera'?'active':''} onClick={startCamera}><Camera size={20}/><span>Scan</span></button>
      <button className={page==='journal'?'active':''} onClick={()=>setPage('journal')}><History size={20}/><span>Journal</span></button>
      <button className={page==='badges'?'active':''} onClick={()=>setPage('badges')}><Trophy size={20}/><span>Badges</span></button>
    </nav>
    {toast && <div className="toast"><Check size={17}/>{toast}<button onClick={()=>setToast('')}><X size={16}/></button></div>}
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
