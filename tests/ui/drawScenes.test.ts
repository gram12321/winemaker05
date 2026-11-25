import { Polygon, type Container } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { drawScene } from '../../src/scene/drawScenes';
import type { SceneId, SceneObjectId } from '../../src/experience';
import type { SceneVisuals } from '../../src/scene/sceneVisuals';

const emptyVisuals: SceneVisuals = {
  calendar: { year: 1, season: 1, week: 1, weeksPerSeason: 12, seasonsPerYear: 4 },
  vineyards: [],
  activeHarvestCount: 0,
  vessels: [],
  bottlesInCellar: 0,
};

describe('state-backed scene illustrations', () => {
  it('adds crop, occupied vessel, and bottle-count graphics from company state', () => {
    const estate = drawScene('estate', () => {}, emptyVisuals);
    const unplantedGraphics = estate.root.children.length;
    estate.setVisuals({
      ...emptyVisuals,
      calendar: { ...emptyVisuals.calendar, season: 3, week: 8 },
      vineyards: [{ ripeness: 0.8, harvestableKg: 120, harvestedKg: 20 }],
      activeHarvestCount: 1,
    });
    expect(estate.root.children.length).toBeGreaterThan(unplantedGraphics);
    estate.root.destroy({ children: true });

    const winery = drawScene('winery', () => {}, emptyVisuals);
    const emptyVesselGraphics = winery.root.children.length;
    winery.setVisuals({
      ...emptyVisuals,
      vessels: [{ material: 'steel', fillRatio: 0.7 }],
    });
    expect(winery.root.children.length).toBeGreaterThan(emptyVesselGraphics);
    winery.root.destroy({ children: true });

    const cellar = drawScene('cellar', () => {}, emptyVisuals);
    const emptyBottleCounterGraphics = cellar.root.children.length;
    cellar.setVisuals({ ...emptyVisuals, bottlesInCellar: 24 });
    const ordinaryBottleCountGraphics = cellar.root.children.length;
    cellar.setVisuals({ ...emptyVisuals, bottlesInCellar: 1_000 });
    expect(ordinaryBottleCountGraphics).toBeGreaterThan(emptyBottleCounterGraphics);
    expect(cellar.root.children.length).toBeGreaterThan(ordinaryBottleCountGraphics);
    cellar.root.destroy({ children: true });
  });

  it('keeps every scene hotspot inside its polygon and dispatches its scene object', () => {
    const cases: { scene: SceneId; markers: readonly [SceneObjectId, number, number][] }[] = [
      { scene: 'estate', markers: [['estate-parcel', 255, 325], ['estate-building', 637, 225], ['estate-grounds', 842, 396]] },
      { scene: 'winery', markers: [['winery-vessel', 354, 408], ['winery-work', 705, 305], ['winery-barrel', 902, 430]] },
      { scene: 'cellar', markers: [['cellar-barrels', 500, 326], ['cellar-shelves', 178, 220], ['cellar-wine', 850, 370]] },
      { scene: 'company', markers: [['company-portfolio', 176, 302], ['company-landmark', 515, 245], ['company-milestones', 824, 354]] },
    ];

    for (const { scene, markers } of cases) {
      const onSelect = vi.fn();
      const drawing = drawScene(scene, onSelect, emptyVisuals);
      const targets = drawing.root.children.filter(child => child.eventMode === 'static') as Container[];
      expect(targets).toHaveLength(markers.length);
      for (const [id, x, y] of markers) {
        const target = targets.find(item => item.hitArea instanceof Polygon && item.hitArea.contains(x, y));
        expect(target?.hitArea).toBeInstanceOf(Polygon);
        expect((target?.hitArea as Polygon).contains(5, 5)).toBe(false);
        target?.emit('pointertap', undefined as never);
        expect(onSelect).toHaveBeenLastCalledWith(id);
      }
      drawing.root.destroy({ children: true });
    }
  });
});
