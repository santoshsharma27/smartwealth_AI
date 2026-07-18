import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { EmptyState } from './EmptyState';
import { SessionProvider } from '../context/SessionContext';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <SessionProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </SessionProvider>
  );
};

describe('EmptyState', () => {
  it('renders default title and description', () => {
    renderWithProviders(<EmptyState />);
    expect(screen.getByText('No financial data available')).toBeInTheDocument();
    expect(
      screen.getByText(/Upload your salary slips and bank statements/)
    ).toBeInTheDocument();
  });

  it('renders custom title and description', () => {
    renderWithProviders(
      <EmptyState title="No goals yet" description="Create your first financial goal." />
    );
    expect(screen.getByText('No goals yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first financial goal.')).toBeInTheDocument();
  });

  it('displays Upload Documents button', () => {
    renderWithProviders(<EmptyState />);
    const uploadBtn = screen.getByRole('button', { name: /upload/i });
    expect(uploadBtn).toBeInTheDocument();
  });

  it('displays Try Demo Data button', () => {
    renderWithProviders(<EmptyState />);
    const demoBtn = screen.getByRole('button', { name: /demo/i });
    expect(demoBtn).toBeInTheDocument();
  });

  it('Upload button has accessible aria-label', () => {
    renderWithProviders(<EmptyState />);
    const uploadBtn = screen.getByRole('button', {
      name: /upload your financial documents/i,
    });
    expect(uploadBtn).toBeInTheDocument();
  });

  it('Demo button has accessible aria-label', () => {
    renderWithProviders(<EmptyState />);
    const demoBtn = screen.getByRole('button', {
      name: /try demo data to explore features/i,
    });
    expect(demoBtn).toBeInTheDocument();
  });

  it('has role="status" for non-urgent state notification', () => {
    renderWithProviders(<EmptyState />);
    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
  });

  it('calls custom onLoadDemo handler when provided', () => {
    const mockLoadDemo = vi.fn();
    renderWithProviders(<EmptyState onLoadDemo={mockLoadDemo} />);
    const demoBtn = screen.getByRole('button', { name: /demo/i });
    fireEvent.click(demoBtn);
    expect(mockLoadDemo).toHaveBeenCalledTimes(1);
  });

  it('hides Upload button when showUpload is false', () => {
    renderWithProviders(<EmptyState showUpload={false} />);
    expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument();
  });

  it('hides Demo button when showDemo is false', () => {
    renderWithProviders(<EmptyState showDemo={false} />);
    expect(screen.queryByRole('button', { name: /demo/i })).not.toBeInTheDocument();
  });

  it('buttons have visible focus indicator classes', () => {
    renderWithProviders(<EmptyState />);
    const uploadBtn = screen.getByRole('button', { name: /upload/i });
    const demoBtn = screen.getByRole('button', { name: /demo/i });
    expect(uploadBtn.className).toContain('focus-visible:outline-2');
    expect(demoBtn.className).toContain('focus-visible:outline-2');
  });

  it('tab order follows visual reading sequence (Upload first, Demo second)', () => {
    renderWithProviders(<EmptyState />);
    const buttons = screen.getAllByRole('button');
    // Upload button should come before Demo button in DOM order
    const uploadIdx = buttons.findIndex((b) => b.textContent?.includes('Upload'));
    const demoIdx = buttons.findIndex((b) => b.textContent?.includes('Demo'));
    expect(uploadIdx).toBeLessThan(demoIdx);
  });

  it('icon SVG is hidden from assistive technology', () => {
    renderWithProviders(<EmptyState />);
    const svgs = document.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
