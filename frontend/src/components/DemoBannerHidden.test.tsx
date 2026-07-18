import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DemoBanner } from './DemoBanner';

// Mock useSession to return demo inactive
vi.mock('../context/SessionContext', () => ({
  useSession: () => ({
    isDemoActive: false,
    exitDemo: vi.fn(),
  }),
}));

describe('DemoBanner (hidden when demo inactive)', () => {
  it('does not render when demo is not active', () => {
    render(
      <MemoryRouter>
        <DemoBanner />
      </MemoryRouter>
    );
    expect(
      screen.queryByText('You are viewing demo data')
    ).not.toBeInTheDocument();
  });
});
