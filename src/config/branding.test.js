import { describe, it, expect } from 'vitest';
import { BUSINESS_NAME, buildPageTitle, SHEET_NAME } from './branding';

describe('branding', () => {
  it('exports BUSINESS_NAME as "Amit General Store"', () => {
    expect(BUSINESS_NAME).toBe('Amit General Store');
  });

  it('buildPageTitle creates correct title format', () => {
    expect(buildPageTitle('Dashboard')).toBe('Amit General Store \u00b7 Dashboard');
  });

  it('SHEET_NAME includes business name', () => {
    expect(SHEET_NAME).toContain('Amit General Store');
  });
});
