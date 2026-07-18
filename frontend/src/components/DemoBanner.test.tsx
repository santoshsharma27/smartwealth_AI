import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DemoBanner } from './DemoBanner';

// Mock the useSession hook
const mockExitDemo = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/SessionContext', () => ({
  useSession: () => ({
    isDemoActive: true,
    exitDemo: mockExitDemo,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('DemoBanner', () => {
  it('renders demo banner text when demo is active', () => {
    render(
      <MemoryRouter>
        <DemoBanner />
      </MemoryRouter>
    );
    expect(
      screen.getByText('You are viewing demo data')
    ).toBeInTheDocument();
  });

  it('renders Exit Demo button', () => {
    render(
      <MemoryRouter>
        <DemoBanner />
      </MemoryRouter>
    );
    expect(
      screen.getByRole('button', { name: /exit demo/i })
    ).toBeInTheDocument();
  });

  it('calls exitDemo and navigates to landing when Exit Demo is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DemoBanner />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /exit demo/i }));
    expect(mockExitDemo).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('has an accessible role=status for screen readers', () => {
    render(
      <MemoryRouter>
        <DemoBanner />
      </MemoryRouter>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
