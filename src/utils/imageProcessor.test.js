import { describe, it, expect, vi } from 'vitest';

// Mock browser-only dependencies that fail in jsdom
vi.mock('heic2any', () => ({ default: vi.fn() }));
vi.mock('browser-image-compression', () => ({ default: vi.fn() }));

import { validateImageFile } from './imageProcessor';

describe('validateImageFile', () => {
  function makeFile(name, type, sizeInBytes) {
    return { name, type, size: sizeInBytes };
  }

  it('rejects null/undefined file', () => {
    expect(validateImageFile(null)).toEqual({ valid: false, error: 'No file provided' });
    expect(validateImageFile(undefined)).toEqual({ valid: false, error: 'No file provided' });
  });

  it('accepts JPEG files', () => {
    expect(validateImageFile(makeFile('photo.jpg', 'image/jpeg', 1000))).toEqual({ valid: true });
  });

  it('accepts PNG files', () => {
    expect(validateImageFile(makeFile('photo.png', 'image/png', 1000))).toEqual({ valid: true });
  });

  it('accepts HEIC files by type', () => {
    expect(validateImageFile(makeFile('photo.heic', 'image/heic', 1000))).toEqual({ valid: true });
  });

  it('accepts HEIC files by extension when type is empty', () => {
    expect(validateImageFile(makeFile('photo.heic', '', 1000))).toEqual({ valid: true });
  });

  it('accepts HEIF files', () => {
    expect(validateImageFile(makeFile('photo.heif', 'image/heif', 1000))).toEqual({ valid: true });
  });

  it('rejects unsupported file types', () => {
    const result = validateImageFile(makeFile('doc.pdf', 'application/pdf', 1000));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Only JPG');
  });

  it('rejects files over 10 MB', () => {
    const result = validateImageFile(makeFile('big.jpg', 'image/jpeg', 11 * 1024 * 1024));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10 MB');
  });

  it('accepts files exactly at 10 MB', () => {
    expect(validateImageFile(makeFile('ok.jpg', 'image/jpeg', 10 * 1024 * 1024))).toEqual({
      valid: true,
    });
  });
});
