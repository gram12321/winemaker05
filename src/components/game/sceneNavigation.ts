import type { Destination, ManagementSection, SceneObjectId } from '../../experience';

export type GameFocusTarget =
  | 'estate-vineyards'
  | 'estate-work'
  | 'estate-establish'
  | 'winery-lots'
  | 'cellar-lots'
  | 'cellar-bottles'
  | 'cellar-details'
  | 'company-overview'
  | 'company-history'
  | 'management-equipment';

export interface SceneNavigationTarget {
  label: string;
  description: string;
  destination: Destination;
  focusTarget: GameFocusTarget;
  managementSection?: ManagementSection;
}

/** Each depicted area opens an implemented page, form, list, or detail region. */
export const sceneNavigation: Record<SceneObjectId, SceneNavigationTarget> = {
  'estate-parcel': {
    label: 'Vineyards',
    description: 'Inspect each vineyard, its current crop, and harvest actions.',
    destination: 'estate',
    focusTarget: 'estate-vineyards',
  },
  'estate-building': {
    label: 'Production',
    description: 'Press harvested grapes and manage fermentation settings.',
    destination: 'winery',
    focusTarget: 'winery-lots',
  },
  'estate-grounds': {
    label: 'Establish a vineyard',
    description: 'Open the vineyard establishment form.',
    destination: 'estate',
    focusTarget: 'estate-establish',
  },
  'winery-vessel': {
    label: 'Press and fermentation',
    description: 'Open the current production lots and their available actions.',
    destination: 'winery',
    focusTarget: 'winery-lots',
  },
  'winery-work': {
    label: 'Harvest work',
    description: 'Review crop work in progress and adjust harvest activity.',
    destination: 'estate',
    focusTarget: 'estate-work',
  },
  'winery-barrel': {
    label: 'Vessel equipment',
    description: 'Inspect vessel materials, capacity, use, and maintenance actions.',
    destination: 'management',
    managementSection: 'equipment',
    focusTarget: 'management-equipment',
  },
  'cellar-barrels': {
    label: 'Lots in storage',
    description: 'Select a current lot to inspect its quantity and development.',
    destination: 'cellar',
    focusTarget: 'cellar-lots',
  },
  'cellar-shelves': {
    label: 'Bottled wines',
    description: 'Open bottled holdings and select a wine for its current details.',
    destination: 'cellar',
    focusTarget: 'cellar-bottles',
  },
  'cellar-wine': {
    label: 'Wine details',
    description: 'Focus the selected lot’s assessment, history, and management actions.',
    destination: 'cellar',
    focusTarget: 'cellar-details',
  },
  'company-portfolio': {
    label: 'Vineyard portfolio',
    description: 'Open the company’s actual vineyards and crop information.',
    destination: 'estate',
    focusTarget: 'estate-vineyards',
  },
  'company-landmark': {
    label: 'Company overview',
    description: 'Review current company totals and cash position.',
    destination: 'company',
    focusTarget: 'company-overview',
  },
  'company-milestones': {
    label: 'Sales and history',
    description: 'Review recorded sales and archived wine lots.',
    destination: 'company',
    focusTarget: 'company-history',
  },
};
