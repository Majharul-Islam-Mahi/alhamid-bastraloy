// src/test/setup.ts
// Vitest setup — testing-library এবং jsdom extensions
import "@testing-library/jest-dom/vitest";

// jsdom-এ প্রয়োজনীয় globals
if (typeof window !== "undefined") {
  // ResizeObserver stub
  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // matchMedia stub
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }

  // scrollTo stub
  if (!window.scrollTo) {
    (window as unknown as { scrollTo: () => void }).scrollTo = () => {};
  }
}