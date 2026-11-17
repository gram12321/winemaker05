import { useRef } from "react";
import { Icon } from "../Icon";
import { scenes, type SceneId, type SceneObjectId } from "../experience";
import { SceneCanvas } from "../scene/SceneCanvas";

interface SceneWorkspaceProps {
  scene: SceneId;
  selected: SceneObjectId | null;
  onSelect: (id: SceneObjectId) => void;
  onCloseDetail: () => void;
  onOpenWine: () => void;
}

export function SceneWorkspace({ scene, selected, onSelect, onCloseDetail, onOpenWine }: SceneWorkspaceProps) {
  const definition = scenes[scene];
  const object = definition.objects.find((item) => item.id === selected);
  const placeButtons = useRef<Partial<Record<SceneObjectId, HTMLButtonElement | null>>>({});

  function closeDetail() {
    onCloseDetail();
    if (selected) placeButtons.current[selected]?.focus();
  }

  return (
    <div className="scene-layout">
      <div className="scene-primary">
        {scene === "company" && (
          <section className="company-modules" aria-label="Company overview">
            <article><span className="eyebrow">AT A GLANCE</span><h3>Company overview</h3><p>Your places and company story will come together here.</p></article>
            <article><span className="eyebrow">THE JOURNEY</span><h3>Achievements & milestones</h3><p>A place to look back on the journey of your company.</p></article>
          </section>
        )}
        <section className="scene-card" aria-label={definition.sceneCaption}>
          <div className="scene-card-heading">
            <div className="scene-card-title">
              <span className="scene-heading-icon"><Icon name={scene} /></span>
              <div><span className="eyebrow">{definition.eyebrow}</span><h2>{definition.sceneCaption}</h2></div>
            </div>
            <span className="scene-card-note">Select a place to explore</span>
          </div>
          <div className={"scene-art scene-art-" + scene}>
            <SceneCanvas scene={scene} selected={selected} onSelect={onSelect} />
            <div className="scene-label"><span className="scene-label-dot" /> {definition.label} view</div>
            <div className="scene-hint">Select a marker <span>or choose a place below</span></div>
          </div>
        </section>

        <section className="explore-section" aria-labelledby="explore-title">
          <div className="section-heading">
            <div><span className="eyebrow">TAKE A CLOSER LOOK</span><h2 id="explore-title">Explore {scene === "company" ? "the company" : "the " + scene}</h2></div>
            {scene === "cellar" && (
              <button className="text-button" type="button" onClick={onOpenWine}>Wine details <Icon name="arrow" /></button>
            )}
          </div>
          <div className="place-list">
            {definition.objects.map((item) => (
              <button
                type="button"
                key={item.id}
                ref={(element) => { placeButtons.current[item.id] = element; }}
                className={"place-button" + (item.id === selected ? " is-selected" : "")}
                aria-pressed={item.id === selected}
                onClick={() => onSelect(item.id)}
              >
                <span className="place-icon"><Icon name={item.icon} /></span>
                <span className="place-copy"><strong>{item.label}</strong><small>{item.id === selected ? "Selected" : "View details"}</small></span>
                <Icon className="place-arrow" name="arrow" />
              </button>
            ))}
          </div>
        </section>

      </div>

      <aside className="detail-panel" aria-label="Place details">
        <div className="detail-topline">
          <span className="eyebrow">A CLOSER LOOK</span>
          {object && <button className="icon-button detail-close" type="button" onClick={closeDetail} aria-label="Close place details"><Icon name="close" /></button>}
        </div>
        <div className={"detail-art detail-art-" + scene}>
          <span className="detail-art-ring"><Icon name={object?.icon ?? scene} /></span>
          <span className="detail-art-caption">{object ? object.category : definition.eyebrow}</span>
        </div>
        <div className="detail-content" aria-live="polite">
          {object ? (
            <>
              <span className="eyebrow">{object.category}</span>
              <h2>{object.label}</h2>
              <p className="detail-lead">{object.description}</p>
              <div className="detail-rule" />
              <p>{object.detail}</p>
              <h3>In this view</h3>
              <ul className="detail-fields">
                {object.fields.map((field) => <li key={field}><span>{field}</span><span aria-hidden="true">—</span></li>)}
              </ul>
              {object.id === "cellar-wine" && (
                <button className="primary-button detail-action" type="button" onClick={onOpenWine}>Open wine details <Icon name="arrow" /></button>
              )}
            </>
          ) : (
            <>
              <span className="eyebrow">YOUR VIEW</span>
              <h2>Every place has a story.</h2>
              <p className="detail-lead">Choose a place to see it a little closer.</p>
              <div className="detail-rule" />
              <p>Select a marker in the scene or use the list beside it to open the details.</p>
              <div className="detail-tip"><Icon name="spark" /><span>The same places are available from the scene and the list.</span></div>
            </>
          )}
        </div>
        <div className="detail-footer"><span>WINEMAKER</span><span className="detail-footer-mark">✦</span></div>
      </aside>
    </div>
  );
}
