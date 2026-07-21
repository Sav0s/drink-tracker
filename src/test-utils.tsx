import type { ReactElement } from 'react';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { system } from '@/lib/theme';

/**
 * Wraps components in the app's ChakraProvider (with our custom `system`)
 * before rendering, since every Chakra component needs it in context.
 * Use this instead of `render` from '@testing-library/react' in component tests.
 */
export function render(ui: ReactElement, options?: RenderOptions) {
  return rtlRender(ui, { wrapper: ({ children }) => <ChakraProvider value={system}>{children}</ChakraProvider>, ...options });
}

export * from '@testing-library/react';
