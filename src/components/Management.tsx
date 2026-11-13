import { Icon } from "../Icon";
import { managementSections, type ManagementSection } from "../experience";

interface ManagementProps {
  section: ManagementSection;
  onSectionChange: (section: ManagementSection) => void;
}

export function Management({ section, onSectionChange }: ManagementProps) {
  const current = managementSections.find((item) => item.id === section) ?? managementSections[0];

  return (
    <div className="management-layout">
      <nav className="management-nav" aria-label="Management sections">
        {managementSections.map((item) => (
          <button type="button" key={item.id} className={item.id === section ? "is-active" : ""} aria-pressed={item.id === section} onClick={() => onSectionChange(item.id)}>
            <Icon name={item.icon} /><span>{item.label}</span>
          </button>
        ))}
      </nav>
      <section className="management-page" aria-labelledby="management-section-title">
        <div className="management-heading">
          <div><span className="eyebrow">MANAGEMENT / {current.label.toUpperCase()}</span><h2 id="management-section-title">{current.label}</h2><p>{current.description}</p></div>
          <span className="management-heading-icon"><Icon name={current.icon} /></span>
        </div>
        <div className="management-grid">
          {current.panels.map((panel, index) => (
            <article className={"management-card" + (index === 0 ? " management-card-wide" : "")} key={panel.title}>
              <div className="management-card-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h3>{panel.title}</h3></div><Icon name={current.icon} /></div>
              <div className="empty-visual" aria-hidden="true"><span /><span /><span /></div>
              <p>{panel.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
