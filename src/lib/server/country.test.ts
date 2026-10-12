import { describe, it, expect } from 'vitest';
import { countryFromRequest } from './country';

function requestWith(headers: Record<string, string> = {}) {
  return new Request('http://localhost/', { headers });
}

describe('countryFromRequest', () => {
  it('returns the code for a valid country', () => {
    expect(countryFromRequest(requestWith({ 'cf-ipcountry': 'NO' }))).toBe('NO');
  });

  it('upper-cases a lowercase code', () => {
    expect(countryFromRequest(requestWith({ 'cf-ipcountry': 'no' }))).toBe('NO');
  });

  it('trims whitespace around the code', () => {
    expect(countryFromRequest(requestWith({ 'cf-ipcountry': ' ch ' }))).toBe('CH');
  });

  it('returns null for XX (unknown)', () => {
    expect(countryFromRequest(requestWith({ 'cf-ipcountry': 'XX' }))).toBeNull();
  });

  it('returns null for T1 (Tor)', () => {
    expect(countryFromRequest(requestWith({ 'cf-ipcountry': 'T1' }))).toBeNull();
  });

  it('returns null for an empty header', () => {
    expect(countryFromRequest(requestWith({ 'cf-ipcountry': '' }))).toBeNull();
  });

  it('returns null when the header is missing', () => {
    expect(countryFromRequest(requestWith())).toBeNull();
  });

  it('returns null for a three-letter value', () => {
    expect(countryFromRequest(requestWith({ 'cf-ipcountry': 'NOR' }))).toBeNull();
  });

  it('returns null for a single character or digit', () => {
    expect(countryFromRequest(requestWith({ 'cf-ipcountry': '1' }))).toBeNull();
    expect(countryFromRequest(requestWith({ 'cf-ipcountry': 'N' }))).toBeNull();
  });

  it('returns null for non-letter junk of the right length', () => {
    expect(countryFromRequest(requestWith({ 'cf-ipcountry': '12' }))).toBeNull();
    expect(countryFromRequest(requestWith({ 'cf-ipcountry': 'N-' }))).toBeNull();
  });
});
