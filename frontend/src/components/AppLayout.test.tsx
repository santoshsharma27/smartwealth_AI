import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SessionProvider } from '../context/SessionContext';
import { AppLayout } from './AppLayout';

function renderWithRouter(initialRoute = '/dashboard') {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
            <Route path="/upload" element={<div>Upload Content</div>} />
            <Route path="/goals" element={<div>Goals Content</div>} />
            <Route path="/chat" element={<div>Chat Content</div>} />
            <Route path="/report" element={<div>Report Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionProvider>
  );
}

describe('AppLayout', () => {
  it('renders all navigation links', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /upload/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /goals/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /chat/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /report/i })).toBeInTheDocument();
  });

  it('renders child route content via Outlet', () => {
    renderWithRouter('/dashboard');
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('navigates to a different route when a nav link is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter('/dashboard');

    const uploadLinks = screen.getAllByRole('link', { name: /upload/i });
    await user.click(uploadLinks[0]);

    expect(screen.getByText('Upload Content')).toBeInTheDocument();
  });

  it('has accessible navigation landmarks', () => {
    renderWithRouter();
    const navElements = screen.getAllByRole('navigation', { name: /main navigation/i });
    expect(navElements.length).toBeGreaterThan(0);
  });

  it('renders the SmartWealth AI brand link/title', () => {
    renderWithRouter();
    expect(screen.getAllByText('SmartWealth AI').length).toBeGreaterThan(0);
  });
});
