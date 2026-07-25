import { vi } from "vitest";

export const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

// Pure and side-effect-free — reuse the real implementation instead of mocking it.
export const { toErrorMessage } = await vi.importActual<typeof import("../logger")>("../logger");
