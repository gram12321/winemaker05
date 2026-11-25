import { useEffect } from 'react';
import type { Destination, ManagementSection } from '../../experience';
import { Cellar } from './Cellar';
import { Company } from './Company';
import { Estate } from './Estate';
import { GameManagement } from './Management';
import { Winery } from './Winery';
import type { GameProps } from './common';
import type { GameFocusTarget } from './sceneNavigation';
import './game.css';

interface GameWorkspaceProps extends GameProps {
  destination: Destination;
  managementSection: ManagementSection;
  onManagementSectionChange: (section: ManagementSection) => void;
  focusTarget: GameFocusTarget | null;
  onFocusComplete: () => void;
}

export function GameWorkspace({ destination, managementSection, onManagementSectionChange, focusTarget, onFocusComplete, ...props }: GameWorkspaceProps) {
  useEffect(() => {
    if (!focusTarget) return;
    const element = document.querySelector<HTMLElement>(`[data-game-focus="${focusTarget}"]`);
    if (!element) return;
    element.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    element.focus({ preventScroll: true });
    onFocusComplete();
  }, [destination, focusTarget, onFocusComplete]);

  if (destination === 'estate') return <Estate {...props} />;
  if (destination === 'winery') return <Winery {...props} />;
  if (destination === 'cellar') return <Cellar {...props} />;
  if (destination === 'company') return <Company {...props} />;
  return <GameManagement section={managementSection} onSectionChange={onManagementSectionChange} {...props} />;
}
