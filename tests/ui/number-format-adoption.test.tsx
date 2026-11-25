// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Company } from '../../src/components/game/Company';
import { decimal, integer, money, percent, percentage, quantity } from '../../src/components/game/common';
import { companyView } from '../../src/game/queries/CompanyView';
import { companyStateAt } from '../helpers/CompanyState';

vi.mock('../../src/scene/SceneCanvas', () => ({ SceneCanvas: () => null }));

afterEach(cleanup);

describe('connected UI number formatting', () => {
  it('uses deterministic number, score, percentage, currency, and quantity displays', () => {
    expect(decimal(1_234_567.891, 2)).toBe('1 234 567,89');
    expect(integer(12_345)).toBe('12 345');
    expect(percent(0.75)).toBe('75/100');
    expect(percentage(0.123456, 2)).toBe('12,35 %');
    expect(money(123_456_789)).toBe('1 234 567,89 €');
    expect(quantity(1_234_567, 'g')).toBe('1 234,567 kg');
    expect(quantity(1_234_567, 'ml')).toBe('1 234,567 L');
    expect(quantity(12_345, 'bottle')).toBe('12 345 bottles');
  });

  it('renders grouped company and scene counts with euro totals while leaving calendar labels intact', () => {
    const company = companyStateAt();
    const baseView = companyView(company);
    const view = {
      ...baseView,
      summary: {
        ...baseView.summary,
        vineyardCount: 1_234,
        liveLotCount: 2_345,
        bottlesInCellar: 3_456,
        activeCommitments: 4_567,
        saleCount: 5_678,
        totalRevenueCents: 123_456_789,
      },
    };

    const { container } = render(<Company company={company} view={view} disabled={false} onCommand={() => {}} />);

    expect(screen.getByText('1 234')).toBeTruthy();
    expect(screen.getByText('2 345')).toBeTruthy();
    expect(screen.getByText('3 456')).toBeTruthy();
    expect(screen.getByText('4 567')).toBeTruthy();
    expect(screen.getByText('1 234 567,89 €')).toBeTruthy();
    expect(screen.getByText('120 000,00 €')).toBeTruthy();
    expect(container.querySelector('.game-scene-status')?.textContent).toContain('1 234 vineyards · 2 345 current lots · 5 678 recorded sales');
    expect(container.querySelector('.game-scene-date')?.textContent).toContain('Year 1 · Season 1 · Week 1');
  });
});
