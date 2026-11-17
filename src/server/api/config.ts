import { createCompanyState, type NewCompanyInput } from '../../game/core';

/** Read trusted calendar settings, using the selected defaults for new companies. */
export function readCompanyConfigFromEnvironment(environment: Readonly<Record<string, string | undefined>>): NewCompanyInput {
  const defaults: Readonly<Record<string, string>> = {
    WINEMAKER_WEEKS_PER_SEASON: '12',
    WINEMAKER_SEASONS_PER_YEAR: '4',
    WINEMAKER_START_YEAR: '1',
    WINEMAKER_START_SEASON: '1',
    WINEMAKER_START_WEEK: '1',
  };
  function readInteger(name: keyof typeof defaults): number {
    const value = environment[name]?.trim() || defaults[name];
    if (value === undefined || !/^-?\d+$/.test(value)) throw new Error('Invalid company startup configuration.');
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new Error('Invalid company startup configuration.');
    return parsed;
  }

  const input: NewCompanyInput = {
    rules: {
      weeksPerSeason: readInteger('WINEMAKER_WEEKS_PER_SEASON'),
      seasonsPerYear: readInteger('WINEMAKER_SEASONS_PER_YEAR'),
    },
    initialDate: {
      year: readInteger('WINEMAKER_START_YEAR'),
      season: readInteger('WINEMAKER_START_SEASON'),
      week: readInteger('WINEMAKER_START_WEEK'),
    },
  };
  if (createCompanyState(input).kind !== 'created') throw new Error('Invalid company startup configuration.');
  return input;
}
