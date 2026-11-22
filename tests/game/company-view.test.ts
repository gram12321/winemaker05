import { describe, expect, it } from 'vitest';
import { companyView, vineyardEstablishmentPreview } from '../../src/game/queries/CompanyView';
import { createVineyard } from '../../src/game/vineyard/Rules';
import { createWineOrigin } from '../../src/game/vineyard/Origin';
import { createHarvestLot } from '../../src/game/wine/Anchors';
import { blendLots, pressLot } from '../../src/game/wine/Operations';
import { companyStateAt } from '../helpers/CompanyState';

describe('company view origin projections', () => {
  it('previews the same establishment cost, terroir and prestige as the vineyard rules', () => {
    const preview = vineyardEstablishmentPreview('heritage', 'sauvignon-blanc', 1.25);
    const established = createVineyard({
      id: 'preview-vineyard', name: 'Preview vineyard', siteId: 'heritage', grapeId: 'sauvignon-blanc', areaHa: 1.25, year: 0,
    });
    expect(preview.ok).toBe(true);
    expect(established.ok).toBe(true);
    if (!preview.ok || !established.ok) return;

    const origin = createWineOrigin(established.value.vineyard);
    expect(preview.value).toEqual({
      costCents: established.value.costCents,
      terroirPotential: origin.terroirPotential,
      originPrestige: origin.originPrestige,
    });
    expect(vineyardEstablishmentPreview('heritage', 'sauvignon-blanc', 0).ok).toBe(false);
  });

  it('exposes every blend source and fraction without building unused buyer quotes', () => {
    function pressedLot(id: string, name: string, siteId: 'hillside' | 'riverbend', grapeId: 'pinot-noir' | 'chardonnay') {
      const established = createVineyard({ id: `${id}-vineyard`, name, siteId, grapeId, areaHa: 1, year: 2028 });
      if (!established.ok) throw new Error(established.reason);
      const vineyard = { ...established.value.vineyard, condition: 0.8, ripeness: 0.8 };
      const grapes = createHarvestLot({
        id, wineId: id, name, vineyard, origin: createWineOrigin(vineyard), week: 0,
      });
      const pressed = pressLot(grapes, 0.5, true, false, 0);
      if (!pressed.ok) throw new Error(pressed.reason);
      return pressed.value.lot;
    }

    const north = pressedLot('north-lot', 'North Block', 'hillside', 'pinot-noir');
    const south = pressedLot('south-lot', 'South Block', 'riverbend', 'chardonnay');
    const blend = blendLots([
      { lot: north, quantity: 650 },
      { lot: south, quantity: 350 },
    ], 'blend-lot', 'Valley Blend', 0);
    if (!blend.ok) throw new Error(blend.reason);

    const state = companyStateAt();
    const view = companyView({
      ...state,
      winery: { lots: [blend.value], archivedLots: [] },
      inventory: {
        ...state.inventory,
        holdings: [{ lotId: blend.value.id, quantity: 1_000, unit: 'ml', location: 'cellar', vesselId: 'starter-tank' }],
      },
    });
    const row = view.lots[0];
    expect(row?.originSources.map(source => source.origin.vineyardName).sort()).toEqual(['North Block', 'South Block']);
    expect(row?.originSources.map(source => source.fraction).sort()).toEqual([0.35, 0.65]);
    expect(row?.originSources).toEqual(blend.value.sources.map(({ origin, fraction }) => ({ origin, fraction })));
    expect(row && 'dominantOrigin' in row).toBe(false);
    expect(row && 'quotes' in row).toBe(false);
  });
});
