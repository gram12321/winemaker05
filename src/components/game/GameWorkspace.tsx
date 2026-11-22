import type { Destination, ManagementSection } from '../../experience';
import { Cellar } from './Cellar';
import { Company } from './Company';
import { Estate } from './Estate';
import { GameManagement } from './Management';
import { Winery } from './Winery';
import type { GameProps } from './common';
import './game.css';

export function GameWorkspace({ destination, managementSection, onManagementSectionChange, ...props }: { destination: Destination; managementSection: ManagementSection; onManagementSectionChange: (section: ManagementSection) => void } & GameProps) {
  if (destination === 'estate') return <Estate {...props} />;
  if (destination === 'winery') return <Winery {...props} />;
  if (destination === 'cellar') return <Cellar {...props} />;
  if (destination === 'company') return <Company {...props} />;
  return <GameManagement section={managementSection} onSectionChange={onManagementSectionChange} {...props} />;
}
