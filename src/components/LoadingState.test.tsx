import { describe, it, expect } from 'vitest';
import { render } from '@/test-utils';
import { LoadingState } from './LoadingState';

describe('LoadingState', () => {
  it('renders a spinner', () => {
    const { container } = render(<LoadingState />);
    expect(container.querySelector('.chakra-spinner')).toBeInTheDocument();
  });

  it('accepts a custom minH and color without crashing', () => {
    const { container } = render(<LoadingState minH="500px" color="#6478a0" />);
    expect(container.querySelector('.chakra-spinner')).toBeInTheDocument();
  });
});
