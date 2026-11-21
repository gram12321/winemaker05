import { useState } from 'react';
import readme from '../../README.md?raw';
import versionLog from '../../docs/versionlog.md?raw';

export default function Welcome({ children }: { children: React.ReactNode }) {
  const [document, setDocument] = useState<'readme' | 'version' | null>(null);
  return <main className="welcome-screen"><div className="welcome-frame"><header className="welcome-header"><h1>Welcome to Winemaker</h1><p>Manage your wine empire and compete with other vintners</p></header>
    <div className="welcome-layout"><section className="welcome-main">{children}</section><aside className="welcome-sidebar"><section><h2>♜ Top Companies</h2><p>Rankings coming soon</p></section><section><h2>♜ Fastest Growing</h2><p>Rankings coming soon</p></section><section><h2>Getting Started</h2><ul><li>Create a company to start your wine empire</li><li>Plant vineyards and craft premium wines</li><li>Build relationships with customers</li><li>Compete on the global leaderboards</li></ul><small>Gameplay features are in development.</small></section></aside></div>
    <nav className="welcome-links" aria-label="Resources"><span title="Coming soon">▤ Trello Board <small>(coming soon)</small></span><button onClick={() => setDocument('readme')}>▥ README</button><button onClick={() => setDocument('version')}>▧ Version Log</button></nav>
    {document && <div className="document-overlay"><div role="dialog" aria-modal="true" aria-label={document === 'readme' ? 'README' : 'Version Log'} className="document-dialog"><button onClick={() => setDocument(null)}>Close</button><pre>{document === 'readme' ? readme : versionLog}</pre></div></div>}
  </div></main>;
}
