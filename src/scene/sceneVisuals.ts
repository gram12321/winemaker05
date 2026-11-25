/** Current, already-derived game facts that a scene may depict. */
export interface SceneVisuals {
  calendar: {
    year: number;
    season: number;
    week: number;
    weeksPerSeason: number;
    seasonsPerYear: number;
  };
  vineyards: readonly {
    ripeness: number;
    harvestableKg: number;
    harvestedKg: number;
  }[];
  activeHarvestCount: number;
  vessels: readonly {
    material: 'steel' | 'oak' | 'concrete';
    fillRatio: number;
  }[];
  bottlesInCellar: number;
}
