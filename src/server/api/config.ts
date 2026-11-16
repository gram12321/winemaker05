import { createCompanyState, type NewCompanyInput } from '../../game/core';

/** Read all calendar settings from the trusted server environment; there are no gameplay defaults. */
export function readCompanyConfigFromEnvironment(environment: Readonly<Record<string, string | undefined>>): NewCompanyInput {
  function readInteger(name: string): number {
    const value = environment[name];
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
