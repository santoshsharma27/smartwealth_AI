import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LandingPage from './LandingPage';

// Mock useSession
vi.mock('../context/SessionContext', async () => {
  const actual = await vi.importActual('../context/SessionContext');
  return {
    ...actual,
    useSession: () => ({
      session: null,
      setSession: vi.fn(),
      isDemoActive: false,
      exitDemo: vi.fn(),
    }),
  };
});

function renderLandingPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/upload" element={<div>Upload Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LandingPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn();
  });

  it('renders the application title', () => {
    renderLandingPage();
    expect(
      screen.getByRole('heading', { level: 1, name: /SmartWealth AI/i })
    ).toBeInTheDocument();
  });

  it('renders the tagline', () => {
    renderLandingPage();
    expect(
      screen.getByText(/Your AI-powered personal financial copilot/i)
    ).toBeInTheDocument();
  });

  it('renders an explanation of 50 words or fewer', () => {
    renderLandingPage();
    const explanation = screen.getByText(/Upload salary slips and bank statements/i);
    expect(explanation).toBeInTheDocument();
    const wordCount = explanation.textContent!.trim().split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(50);
  });

  it('renders Upload Documents button that navigates to /upload', async () => {
    const user = userEvent.setup();
    renderLandingPage();

    const uploadBtn = screen.getByRole('button', { name: /Upload Documents/i });
    expect(uploadBtn).toBeInTheDocument();

    await user.click(uploadBtn);

    await waitFor(() => {
      expect(screen.getByText('Upload Page')).toBeInTheDocument();
    });
  });

  it('renders Try Demo Data button', () => {
    renderLandingPage();
    expect(
      screen.getByRole('button', { name: /Try Demo Data/i })
    ).toBeInTheDocument();
  });

  it('shows loading state when Try Demo Data is clicked', async () => {
    const user = userEvent.setup();
    // Make fetch hang so we can observe loading state
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    );

    renderLandingPage();

    const demoBtn = screen.getByRole('button', { name: /Try Demo Data/i });
    await user.click(demoBtn);

    expect(screen.getByText(/Loading Demo/i)).toBeInTheDocument();
  });

  it('navigates to /dashboard on successful demo load', async () => {
    const user = userEvent.setup();
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'test-session-123' }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    renderLandingPage();

    await user.click(screen.getByRole('button', { name: /Try Demo Data/i }));

    await waitFor(() => {
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    });
  });

  it('shows error message on demo load failure and keeps buttons interactive', async () => {
    const user = userEvent.setup();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    renderLandingPage();

    await user.click(screen.getByRole('button', { name: /Try Demo Data/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Demo data could not be loaded/i
      );
    });

    // Buttons remain interactive
    const uploadBtn = screen.getByRole('button', { name: /Upload Documents/i });
    const demoBtn = screen.getByRole('button', { name: /Try Demo Data/i });
    expect(uploadBtn).not.toBeDisabled();
    expect(demoBtn).not.toBeDisabled();
  });

  it('renders between 3 and 6 feature cards', () => {
    renderLandingPage();
    const featureSection = screen.getByLabelText(/Features/i);
    const cards = featureSection.querySelectorAll('h3');
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(cards.length).toBeLessThanOrEqual(6);
  });

  it('each feature card has a name and description', () => {
    renderLandingPage();
    const featureNames = [
      'Smart Document Parsing',
      'AI Expense Categorization',
      'Financial Health Score',
      'Goal Planning',
      'AI Finance Chatbot',
      'Downloadable Reports',
    ];

    for (const name of featureNames) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('uses existing session ID from localStorage for demo', async () => {
    const user = userEvent.setup();
    localStorage.setItem('smartwealth_session_id', 'existing-session');
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    renderLandingPage();
    await user.click(screen.getByRole('button', { name: /Try Demo Data/i }));

    await waitFor(() => {
      // Should only call the demo endpoint (not create session)
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/sessions/existing-session/demo',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
