import { useEffect, useRef, useState } from 'react'
import { SceneCanvas } from '../scenes/SceneCanvas'
import { scenes, type SceneId, type SceneObject } from '../scenes/catalog'
import './App.css'

type Destination = SceneId | 'management'
type ManagementId = 'finance' | 'contracts' | 'equipment' | 'people'
type IconName = 'estate' | 'winery' | 'cellar' | 'company' | 'management' | 'calendar' | 'activity' | 'arrow' | 'close' | 'wine' | 'sparkle'

const navigation: { id: Destination; label: string; icon: IconName }[] = [
  { id: 'estate', label: 'Estate', icon: 'estate' },
  { id: 'winery', label: 'Winery', icon: 'winery' },
  { id: 'cellar', label: 'Cellar', icon: 'cellar' },
  { id: 'company', label: 'Company', icon: 'company' },
  { id: 'management', label: 'Management', icon: 'management' },
]

const managementViews: { id: ManagementId; name: string; description: string; sections: [string, string] }[] = [
  { id: 'finance', name: 'Finance', description: 'A clearer view of the business behind the wine.', sections: ['Financial overview', 'History and outlook'] },
  { id: 'contracts', name: 'Contracts / Market', description: 'A place for commercial relationships and opportunities.', sections: ['Contracts', 'Market overview'] },
  { id: 'equipment', name: 'Equipment', description: 'A place to explore the tools and vessels of the winery.', sections: ['Equipment overview', 'Equipment details'] },
  { id: 'people', name: 'People / Work', description: 'A place for the people and work across the estate.', sections: ['People', 'Work overview'] },
]

export default function App() {
  const [destination, setDestination] = useState<Destination>('estate')
  const [managementView, setManagementView] = useState<ManagementId>('finance')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activityOpen, setActivityOpen] = useState(false)
  const [wineOpen, setWineOpen] = useState(false)
  const activityToggleRef = useRef<HTMLButtonElement>(null)

  const navigate = (next: Destination) => {
    setDestination(next)
    setSelectedId(null)
  }

  const openManagement = (view: ManagementId) => {
    setManagementView(view)
    navigate('management')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><Icon name="wine" /></span>
          <div><span className="brand-name">Winemaker</span><span className="brand-subtitle">THE WINERY SIMULATION</span></div>
        </div>
        <div className="sidebar-label">YOUR WORLD</div>
        <nav className="primary-nav" aria-label="Destinations">
          {navigation.map((item) => (
            <button key={item.id} type="button" className={`nav-item${destination === item.id ? ' is-active' : ''}`} aria-current={destination === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>
              <Icon name={item.icon} /><span>{item.label}</span>{destination === item.id && <span className="nav-indicator" aria-hidden="true" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom"><span className="sidebar-ornament">✳</span><span>Made for the<br /><strong>long view.</strong></span></div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-context"><span>WINEMAKER</span><span className="topbar-separator">/</span><strong>{destination === 'management' ? 'Management' : scenes[destination].title}</strong></div>
          <div className="topbar-actions">
            <div className="calendar-placeholder" aria-label="Calendar placeholder"><Icon name="calendar" /><span><small>CALENDAR</small><strong>—</strong></span></div>
            <button type="button" className="advance-button" disabled aria-label="Advance time unavailable until simulation is connected">Advance time <Icon name="arrow" /></button>
            <span className="topbar-divider" />
            <button ref={activityToggleRef} type="button" className={`activity-toggle${activityOpen ? ' is-active' : ''}`} aria-expanded={activityOpen} aria-controls="activity-manager" onClick={() => setActivityOpen((open) => !open)}><Icon name="activity" /><span>Activity</span></button>
          </div>
        </header>

        <main className="main-content">
          {destination === 'management' ? (
            <ManagementView selected={managementView} onSelect={setManagementView} />
          ) : destination === 'company' ? (
            <CompanyView onNavigate={navigate} onOpenManagement={openManagement} />
          ) : (
            <SceneView sceneId={destination} selectedId={selectedId} onSelect={setSelectedId} onOpenWine={() => setWineOpen(true)} />
          )}
          {activityOpen && <ActivityManager onClose={() => { setActivityOpen(false); activityToggleRef.current?.focus() }} />}
        </main>
      </div>
      {wineOpen && <WineModal onClose={() => setWineOpen(false)} />}
    </div>
  )
}

function SceneView({ sceneId, selectedId, onSelect, onOpenWine }: { sceneId: Exclude<SceneId, 'company'>; selectedId: string | null; onSelect: (id: string | null) => void; onOpenWine: () => void }) {
  const scene = scenes[sceneId]
  const selected = scene.objects.find((item) => item.id === selectedId)
  const objectRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const closeDetails = () => {
    if (selectedId) objectRefs.current[selectedId]?.focus()
    onSelect(null)
  }
  return (
    <div className="workspace scene-workspace">
      <div className="workspace-heading">
        <div><p className="eyebrow">{scene.eyebrow}</p><h1>{scene.title}</h1><p className="workspace-intro">{scene.introduction}</p></div>
        <span className="prototype-label"><span /> EXPLORATION VIEW</span>
      </div>
      <div className="scene-layout">
        <section className="scene-main" aria-label={`${scene.title} scene and places`}>
          <div className={`scene-frame scene-frame--${sceneId}`}>
            <SceneCanvas scene={sceneId} selectedId={selectedId} onSelect={onSelect} />
            <div className="scene-tag"><span className="scene-tag-dot" /> {scene.title.toUpperCase()} VIEW</div>
            <div className="scene-hint">Select a feature to explore <span aria-hidden="true">↗</span></div>
          </div>
          <div className="explore-header"><div><p className="eyebrow">LOOK AROUND</p><h2>Explore this place</h2></div><span>Choose a feature to see its details</span></div>
          <div className="object-list" aria-label={`${scene.title} features`}>
            {scene.objects.map((item, index) => (
              <button ref={(element) => { objectRefs.current[item.id] = element }} type="button" key={item.id} className={`object-card${selectedId === item.id ? ' is-selected' : ''}`} aria-label={`${item.name}, ${item.kind}`} aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}>
                <span className="object-number">0{index + 1}</span><span className="object-label"><strong>{item.name}</strong><small>{selectedId === item.id ? 'Selected' : item.kind}</small></span><span className="object-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </section>
        <DetailPanel selected={selected} onClose={closeDetails} onOpenWine={onOpenWine} />
      </div>
    </div>
  )
}

function DetailPanel({ selected, onClose, onOpenWine }: { selected: SceneObject | undefined; onClose: () => void; onOpenWine: () => void }) {
  return (
    <aside className="detail-panel" aria-label="Feature details">
      <div className="panel-topline"><span className="eyebrow">DETAILS</span>{selected && <button className="icon-button" type="button" onClick={onClose} aria-label="Close feature details"><Icon name="close" /></button>}</div>
      {selected ? (
        <div className="detail-content" key={selected.id}>
          <div className="detail-symbol"><Icon name={selected.id === 'wine' ? 'wine' : 'sparkle'} /></div>
          <p className="detail-kind">{selected.kind}</p><h2>{selected.name}</h2><p>{selected.description}</p>
          <div className="detail-divider" />
          <p className="eyebrow">ABOUT THIS VIEW</p>
          <p className="detail-note">Details will appear here when this part of the winery is connected.</p>
          {selected.id === 'wine' && <button className="primary-button" type="button" onClick={onOpenWine}>Open wine detail <Icon name="arrow" /></button>}
        </div>
      ) : (
        <div className="empty-detail"><div className="empty-detail-icon"><Icon name="sparkle" /></div><h2>Take a closer look</h2><p>Select a feature in the scene or choose one from the list to explore it.</p></div>
      )}
      <div className="panel-footer"><span>WINEMAKER</span><span>✳</span></div>
    </aside>
  )
}

function CompanyView({ onNavigate, onOpenManagement }: { onNavigate: (destination: Destination) => void; onOpenManagement: (view: ManagementId) => void }) {
  return (
    <div className="workspace company-workspace">
      <div className="workspace-heading"><div><p className="eyebrow">THE BIGGER PICTURE</p><h1>Company</h1><p className="workspace-intro">A place to bring the whole enterprise together.</p></div><span className="prototype-label"><span /> OVERVIEW</span></div>
      <div className="company-grid">
        <section className="company-hero dashboard-card">
          <div className="company-hero-copy"><p className="eyebrow">YOUR COMPANY</p><h2>A story in the making.</h2><p>From the land to the cellar, see the places and people that make up your winery.</p><button className="text-button" type="button" onClick={() => onNavigate('estate')}>Explore the estate <span aria-hidden="true">↗</span></button></div>
          <div className="company-illustration"><SceneCanvas scene="company" selectedId={null} onSelect={() => {}} /></div>
        </section>
        <section className="dashboard-card portfolio-card"><div className="card-heading"><div><p className="eyebrow">PLACES</p><h2>Estate portfolio</h2></div><span className="card-icon"><Icon name="estate" /></span></div><p>Your places will come together here.</p><button className="text-button" type="button" onClick={() => onNavigate('estate')}>Visit the estate <span aria-hidden="true">→</span></button></section>
        <section className="dashboard-card overview-card"><div className="card-heading"><div><p className="eyebrow">AT A GLANCE</p><h2>Business overview</h2></div><span className="card-icon"><Icon name="management" /></span></div><p>Company information will appear here as the simulation develops.</p><div className="overview-links"><button type="button" onClick={() => onOpenManagement('finance')}>Finance <span aria-hidden="true">↗</span></button><button type="button" onClick={() => onOpenManagement('contracts')}>Contracts / Market <span aria-hidden="true">↗</span></button></div></section>
        <section className="dashboard-card milestones-card"><div className="card-heading"><div><p className="eyebrow">THE LONG VIEW</p><h2>Milestones</h2></div><span className="card-icon"><Icon name="sparkle" /></span></div><p>A space for the story of the company to unfold.</p><div className="milestone-art" aria-hidden="true"><span>✳</span><i /><span>✳</span><i /><span>✳</span></div></section>
      </div>
    </div>
  )
}

function ManagementView({ selected, onSelect }: { selected: ManagementId; onSelect: (view: ManagementId) => void }) {
  const view = managementViews.find((item) => item.id === selected) ?? managementViews[0]
  return (
    <div className="workspace management-workspace">
      <div className="workspace-heading"><div><p className="eyebrow">THE BUSINESS OF WINE</p><h1>Management</h1><p className="workspace-intro">The details behind the bigger picture.</p></div><span className="prototype-label"><span /> WORKSPACE</span></div>
      <nav className="management-tabs" aria-label="Management sections">{managementViews.map((item) => <button key={item.id} type="button" className={selected === item.id ? 'is-active' : ''} aria-current={selected === item.id ? 'page' : undefined} onClick={() => onSelect(item.id)}>{item.name}</button>)}</nav>
      <div className="management-heading"><div><p className="eyebrow">MANAGEMENT / {view.name.toUpperCase()}</p><h2>{view.name}</h2><p>{view.description}</p></div></div>
      <div className="management-grid">{view.sections.map((section, index) => <section key={section} className="dashboard-card management-card"><div className="card-heading"><div><p className="eyebrow">{index === 0 ? 'OVERVIEW' : 'DETAILS'}</p><h3>{section}</h3></div><span className="card-icon"><Icon name={index === 0 ? 'management' : 'sparkle'} /></span></div><div className="placeholder-content"><span className="placeholder-mark">✳</span><p>Information will appear here when this area is connected.</p></div></section>)}</div>
    </div>
  )
}

function ActivityManager({ onClose }: { onClose: () => void }) {
  return <aside className="activity-panel" id="activity-manager" aria-label="Activity Manager"><div className="activity-heading"><div><p className="eyebrow">YOUR WINERY</p><h2>Activity Manager</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close Activity Manager"><Icon name="close" /></button></div><div className="activity-empty"><div className="empty-detail-icon"><Icon name="activity" /></div><h3>A place for activity</h3><p>Winery activity will appear here when it is connected.</p></div><div className="panel-footer"><span>THE LONG VIEW</span><span>✳</span></div></aside>
}

function WineModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    return () => {
      if (dialog?.open) dialog.close()
      previousFocus?.focus()
    }
  }, [])
  return (
    <dialog className="wine-dialog" ref={dialogRef} aria-labelledby="wine-dialog-title" onCancel={(event) => { event.preventDefault(); onClose() }}>
      <div className="dialog-heading"><div><p className="eyebrow">CELLAR / WINE DETAIL</p><h2 id="wine-dialog-title">The story of a wine</h2><p>A closer look at the layers that make a wine its own.</p></div><button type="button" autoFocus className="icon-button" onClick={onClose} aria-label="Close wine detail"><Icon name="close" /></button></div>
      <div className="wine-dialog-body"><div className="wine-illustration"><Icon name="wine" /><span>WINEMAKER</span></div><div className="wine-sections"><section><p className="eyebrow">01 / ORIGIN</p><h3>Identity &amp; raw material potential</h3><p>Space for the wine's origin and inherited potential.</p></section><section><p className="eyebrow">02 / DEVELOPMENT</p><h3>Development &amp; sensory expression</h3><p>Space for the wine's changing state and current expression.</p></section><section><p className="eyebrow">03 / CONTEXT</p><h3>Evaluation &amp; commercial context</h3><p>Separate spaces for assessment and commercial information.</p></section></div></div>
      <div className="dialog-footer"><span>WINE DETAIL · PLACEHOLDER</span><button type="button" className="secondary-button" onClick={onClose}>Close detail</button></div>
    </dialog>
  )
}

function Icon({ name }: { name: IconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<IconName, React.ReactNode> = {
    estate: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6" /></>,
    winery: <><path d="M4 20V9l5 3V9l5 3V7l6-3v16H4Z" /><path d="M8 16h1m3 0h1m3 0h1" /></>,
    cellar: <><path d="M5 7c0-2 3-3 7-3s7 1 7 3v10c0 2-3 3-7 3s-7-1-7-3V7Z" /><path d="M5 8c0 2 3 3 7 3s7-1 7-3M5 16c0 2 3 3 7 3s7-1 7-3M9 5c-1 3-1 12 0 14m6-14c1 3 1 12 0 14" /></>,
    company: <><path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-6h6v6" /><path d="M4 10h16" /></>,
    management: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 5v15" /></>,
    calendar: <><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M8 4v4m8-4v4M4 10h16m-12 4h2m4 0h2m-8 3h2" /></>,
    activity: <><path d="M4 7h16M4 12h16M4 17h11" /><circle cx="7" cy="7" r="1.5" fill="currentColor" /><circle cx="15" cy="12" r="1.5" fill="currentColor" /></>,
    arrow: <><path d="M4 12h15m-5-5 5 5-5 5" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    wine: <><path d="M8 3h8l1 7a5 5 0 0 1-10 0l1-7ZM12 15v5m-4 1h8" /><path d="M8 8h8" /></>,
    sparkle: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm6 12 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]}</svg>
}
