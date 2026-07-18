import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReportPage } from './ReportPage';

// Mock useSession
const mockSession = { id: 'test-session-123', isDemoActive: false };
let sessionOverride: { id: string; isDemoActive: boolean } | null = mockSession;

vi.mock('../context/SessionContext', () => ({
  useSession: () => ({ session: sessionOverride }),
}));

describe('ReportPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionOverride = mockSession;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders report preview sections', () => {
    render(<ReportPage />);

    expect(screen.getByLabelText(/Report Preview/i)).toBeInTheDocument();
    expect(screen.getByText('Income Summary')).toBeInTheDocument();
    expect(screen.getByText('Expense Summary')).toBeInTheDocument();
    expect(screen.getByText('Savings Analysis')).toBeInTheDocument();
    expect(screen.getByText('Financial Health Score')).toBeInTheDocument();
    expect(screen.getByText('Key Financial Risks')).toBeInTheDocument();
    expect(screen.getByText('AI Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Goal Plan Summary')).toBeInTheDocument();
    expect(screen.getByText('Next Action Items')).toBeInTheDocument();
  });

  it('renders Generate Report button that is clickable', () => {
    render(<ReportPage />);

    const button = screen.getByRole('button', { name: /Generate Report/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('disables Generate Report button when no session is available', () => {
    sessionOverride = null;
    render(<ReportPage />);

    const button = screen.getByRole('button', { name: /Generate Report/i });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/Upload documents or load demo data/i)
    ).toBeInTheDocument();
  });

  it('shows loading state during generation', async () => {
    const user = userEvent.setup();
    // Make fetch hang indefinitely
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    );

    render(<ReportPage />);

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    expect(screen.getByText(/Generating your report/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('handles successful download', async () => {
    const user = userEvent.setup();
    const mockBlob = new Blob(['fake-pdf-content'], { type: 'application/pdf' });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: (name: string) => name === 'Content-Type' ? 'application/pdf' : null },
      blob: async () => mockBlob,
    });

    // Mock URL methods
    const mockUrl = 'blob:http://localhost/fake-url';
    const createObjectURLSpy = vi.fn(() => mockUrl);
    const revokeObjectURLSpy = vi.fn();
    globalThis.URL.createObjectURL = createObjectURLSpy;
    globalThis.URL.revokeObjectURL = revokeObjectURLSpy;

    render(<ReportPage />);

    // Mock anchor element interactions AFTER render so React can mount properly
    const clickSpy = vi.fn();
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLElement && node.tagName === 'A') {
        node.click = clickSpy;
      }
      return node;
    });
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText(/Report downloaded successfully/i)).toBeInTheDocument();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/sessions/test-session-123/report',
      expect.objectContaining({ method: 'POST' })
    );
    expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob);
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(mockUrl);

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('shows error message on failure (503)', async () => {
    const user = userEvent.setup();

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => { throw new Error('no body'); },
      text: async () => '',
    });

    render(<ReportPage />);

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Report generation failed.*Please retry/i
      );
    });
  });

  it('shows timeout error message on 504', async () => {
    const user = userEvent.setup();

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 504,
      statusText: 'Gateway Timeout',
      json: async () => { throw new Error('no body'); },
      text: async () => '',
    });

    render(<ReportPage />);

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Report generation timed out. Please try again/i
      );
    });
  });

  it('shows retry button after failure', async () => {
    const user = userEvent.setup();

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => { throw new Error('no body'); },
      text: async () => '',
    });

    render(<ReportPage />);

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });

    // Generate Report button is still present
    expect(screen.getByRole('button', { name: /Generate Report/i })).toBeInTheDocument();
  });

  it('retry button re-triggers generation', async () => {
    const user = userEvent.setup();

    // First call fails
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => { throw new Error('no body'); },
      text: async () => '',
    });

    render(<ReportPage />);

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });

    // Second call hangs (to observe generating state)
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    );

    await user.click(screen.getByRole('button', { name: /Retry/i }));

    expect(screen.getByText(/Generating your report/i)).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('handles abort/timeout when fetch takes too long', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Fetch that never resolves (simulating a slow response)
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    );

    render(<ReportPage />);

    await user.click(screen.getByRole('button', { name: /Generate Report/i }));

    // Advance past the 15 second timeout
    vi.advanceTimersByTime(15_000);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Report generation timed out. Please try again/i
      );
    });

    vi.useRealTimers();
  });
});
