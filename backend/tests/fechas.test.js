const { hoy, ahora, esFechaValida } = require('../src/utils/fechas');

describe('fechas.hoy', () => {
  it('devuelve el formato YYYY-MM-DD', () => {
    expect(hoy()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('usa la fecha LOCAL, no la UTC', () => {
    const nocheLocal = new Date(2026, 11, 31, 23, 30, 0);
    expect(hoy(nocheLocal)).toBe('2026-12-31');
  });

  it('completa con ceros mes y día', () => {
    expect(hoy(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('fechas.ahora', () => {
  it('devuelve el formato HH:MM:SS', () => {
    expect(ahora()).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('completa con ceros', () => {
    expect(ahora(new Date(2026, 0, 5, 7, 4, 9))).toBe('07:04:09');
  });
});

describe('fechas.esFechaValida', () => {
  it('acepta fechas reales', () => {
    expect(esFechaValida('2026-10-28')).toBe(true);
    expect(esFechaValida('2028-02-29')).toBe(true);
  });

  it('rechaza fechas que no existen', () => {
    expect(esFechaValida('2026-02-30')).toBe(false);
    expect(esFechaValida('2027-02-29')).toBe(false);
    expect(esFechaValida('2026-13-01')).toBe(false);
  });

  it('rechaza formatos incorrectos y valores que no son texto', () => {
    expect(esFechaValida('28/10/2026')).toBe(false);
    expect(esFechaValida('2026-1-5')).toBe(false);
    expect(esFechaValida('')).toBe(false);
    expect(esFechaValida(null)).toBe(false);
    expect(esFechaValida(20261028)).toBe(false);
  });
});
