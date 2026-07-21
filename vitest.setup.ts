import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Chakra UI v3 (menus, tooltips, etc.) relies on these browser APIs that
// jsdom doesn't implement.
global.ResizeObserver = vi.fn(function () {
  return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
}) as unknown as typeof ResizeObserver;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom doesn't implement scrollIntoView, used by some Chakra components.
Element.prototype.scrollIntoView = vi.fn();
