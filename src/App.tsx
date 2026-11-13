import { useRef, useState } from "react";
import { Icon } from "./Icon";
import { managementSections, navigation, scenes, type Destination, type ManagementSection, type SceneObjectId } from "./experience";
import { Management } from "./components/Management";
import { SceneWorkspace } from "./components/SceneWorkspace";
import { WineDialog } from "./components/WineDialog";

export default function App() {
  const [destination, setDestination] = useState<Destination>("estate");
  const [managementSection, setManagementSection] = useState<ManagementSection>("finance");
  const [selected, setSelected] = useState<SceneObjectId | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [wineOpen, setWineOpen] = useState(false);
  const activityToggleRef = useRef<HTMLButtonElement>(null);
  const currentScene = destination === "management" ? null : scenes[destination];
  const currentManagement = managementSections.find((item) => item.id === managementSection);

  function navigate(next: Destination) {
    setDestination(next);
    setSelected(null);
  }

  function closeActivity() {
    setActivityOpen(false);
    activityToggleRef.current?.focus();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Winemaker">
          <span className="brand-mark"><Icon name="vine" /></span>
          <span className="brand-name">Winemaker<small>THE WINEMAKER'S JOURNAL</small></span>
        </div>
        <div className="topbar-motto"><span>A LIFE IN WINE</span><strong>From the vine to the bottle</strong></div>
        <div className="topbar-controls">
          <div className="calendar-placeholder" aria-label="Calendar">
            <Icon name="calendar" /><span><small>CALENDAR</small><strong>—</strong></span>
          </div>
          <button className="advance-button" type="button" disabled title="Time advancement is not available yet">Advance time <Icon name="arrow" /></button>
          <button
            ref={activityToggleRef}
            className={"activity-toggle" + (activityOpen ? " is-active" : "")}
            type="button"
            aria-label="Activity manager"
            aria-expanded={activityOpen}
            aria-controls={activityOpen ? "activity-manager" : undefined}
            title="Activity manager"
            onClick={() => setActivityOpen((value) => !value)}
          >
            <Icon name="activity" /><span>Activity manager</span>
          </button>
        </div>
      </header>

      <div className="shell-body">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <span className="sidebar-label">YOUR WINERY</span>
            <nav className="primary-nav" aria-label="Primary navigation">
              {navigation.map((item) => (
                <button type="button" key={item.id} className={destination === item.id ? "is-active" : ""} aria-label={item.label} aria-current={destination === item.id ? "page" : undefined} title={item.label} onClick={() => navigate(item.id)}>
                  <Icon name={item.icon} /><span>{item.label}</span><span className="nav-active-mark" aria-hidden="true" />
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="sidebar-illustration" aria-hidden="true"><span /><span /><span /></div>
              <span className="sidebar-bottom-title">Made with care.</span>
              <span>From the vineyard<br />to the cellar.</span>
            </div>
          </div>
        </aside>

        <main className="workspace">
          <div className="workspace-heading">
            <div>
              <div className="breadcrumb"><span>WINEMAKER</span><span>/</span><span>{currentScene?.label ?? "Management"}</span>{destination === "management" && <><span>/</span><span>{currentManagement?.label}</span></>}</div>
              <h1>{currentScene?.title ?? "Management"}</h1>
              <p>{currentScene?.description ?? "The everyday details behind a thriving winery."}</p>
            </div>
            <div className="heading-ornament" aria-hidden="true"><span />✦<span /></div>
          </div>

          {destination === "management" ? (
            <Management section={managementSection} onSectionChange={setManagementSection} />
          ) : (
            <SceneWorkspace scene={destination} selected={selected} onSelect={setSelected} onCloseDetail={() => setSelected(null)} onOpenWine={() => setWineOpen(true)} />
          )}
        </main>
      </div>

      {activityOpen && (
        <aside id="activity-manager" className="activity-panel" aria-label="Activity manager">
          <div className="activity-panel-heading"><span className="activity-panel-icon"><Icon name="activity" /></span><div><span className="eyebrow">YOUR WINERY</span><h2>Activity manager</h2></div><button className="icon-button" type="button" onClick={closeActivity} aria-label="Close activity manager"><Icon name="close" /></button></div>
          <div className="activity-empty"><span className="activity-empty-icon"><Icon name="activity" /></span><h3>Work, all in one place.</h3><p>Activities across your estate and winery will appear here.</p></div>
        </aside>
      )}
      <WineDialog open={wineOpen} onClose={() => setWineOpen(false)} />
    </div>
  );
}
