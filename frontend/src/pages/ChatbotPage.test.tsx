import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatbotPage } from './ChatbotPage';

// Mock useSession to control session state
let sessionOverride: { id: string; isDemoActive: boolean } | null = null;

vi.mock('../context/SessionContext', async () => {
  const actual = await vi.importActual('../context/SessionContext');
  return {
    ...actual,
    useSession: () => ({
      session: sessionOverride,
      setSession: vi.fn(),
      isDemoActive: sessionOverride?.isDemoActive ?? false,
      exitDemo: vi.fn(),
    }),
  };
});

function renderChatbotPage() {
  return render(
    <MemoryRouter initialEntries={['/chat']}>
      <Routes>
        <Route path="/chat" element={<ChatbotPage />} />
        <Route path="/upload" element={<div>Upload Page</div>} />
        <Route path="/" element={<div>Landing Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ChatbotPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionOverride = null;
    globalThis.fetch = vi.fn();
  });

  describe('No financial data state', () => {
    it('shows no-data message when no session exists', async () => {
      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByText(/No Financial Data Available/i)).toBeInTheDocument();
      });
    });

    it('prompts user to upload documents or load demo data', async () => {
      renderChatbotPage();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Upload Documents/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /Load Demo Data/i })
        ).toBeInTheDocument();
      });
    });

    it('navigates to /upload when Upload Documents button is clicked', async () => {
      const user = userEvent.setup();
      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upload Documents/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Upload Documents/i }));

      await waitFor(() => {
        expect(screen.getByText('Upload Page')).toBeInTheDocument();
      });
    });

    it('navigates to landing page when Load Demo Data button is clicked', async () => {
      const user = userEvent.setup();
      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Load Demo Data/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Load Demo Data/i }));

      await waitFor(() => {
        expect(screen.getByText('Landing Page')).toBeInTheDocument();
      });
    });

    it('displays the disclaimer even in no-data state', async () => {
      renderChatbotPage();

      await waitFor(() => {
        expect(
          screen.getByRole('note', { name: /Financial disclaimer/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Loading chat history', () => {
    it('shows loading indicator while fetching history', () => {
      sessionOverride = { id: 'test-session', isDemoActive: false };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      renderChatbotPage();

      expect(screen.getByText(/Loading chat history/i)).toBeInTheDocument();
    });

    it('displays prior chat history on successful load', async () => {
      sessionOverride = { id: 'test-session', isDemoActive: false };
      const mockHistory = [
        {
          id: 'msg-1',
          question: 'What are my top expenses?',
          answer: 'Your top expense is Rent at ₹25,000.',
          timestamp: '2024-01-15T10:00:00Z',
        },
        {
          id: 'msg-2',
          question: 'How can I save more?',
          answer: 'Consider reducing food expenses by ₹3,000.',
          timestamp: '2024-01-15T10:05:00Z',
        },
      ];

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistory,
      });

      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByText('What are my top expenses?')).toBeInTheDocument();
        expect(screen.getByText('Your top expense is Rent at ₹25,000.')).toBeInTheDocument();
        expect(screen.getByText('How can I save more?')).toBeInTheDocument();
        expect(screen.getByText('Consider reducing food expenses by ₹3,000.')).toBeInTheDocument();
      });
    });

    it('shows error with retry when history load fails but financial data exists', async () => {
      sessionOverride = { id: 'test-session', isDemoActive: false };
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: false, status: 500 }) // history fails
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // summary succeeds

      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load chat history/i)).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });
  });

  describe('Disclaimer display', () => {
    it('shows non-dismissible disclaimer at the top of the chat', async () => {
      sessionOverride = { id: 'test-session', isDemoActive: false };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      renderChatbotPage();

      await waitFor(() => {
        const disclaimer = screen.getByRole('note', { name: /Financial disclaimer/i });
        expect(disclaimer).toBeInTheDocument();
        // Verify no dismiss/close button inside disclaimer
        expect(within(disclaimer).queryByRole('button')).not.toBeInTheDocument();
      });
    });

    it('includes disclaimer text in each bot response', async () => {
      sessionOverride = { id: 'test-session', isDemoActive: false };
      const mockHistory = [
        {
          id: 'msg-1',
          question: 'Test question',
          answer: 'Test answer',
          timestamp: '2024-01-15T10:00:00Z',
        },
      ];

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistory,
      });

      renderChatbotPage();

      await waitFor(() => {
        expect(
          screen.getByText(
            'This is informational guidance only. Consult a certified financial advisor for professional advice.'
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('Text input validation', () => {
    beforeEach(async () => {
      sessionOverride = { id: 'test-session', isDemoActive: false };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
    });

    it('has a text input with 500 character maximum', async () => {
      renderChatbotPage();

      await waitFor(() => {
        const input = screen.getByRole('textbox', { name: /Chat message input/i });
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('maxLength', '500');
      });
    });

    it('shows character count indicator', async () => {
      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByText('500/500')).toBeInTheDocument();
      });
    });

    it('updates character count as user types', async () => {
      const user = userEvent.setup();
      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /Chat message input/i })).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox', { name: /Chat message input/i });
      await user.type(input, 'Hello');

      expect(screen.getByText('495/500')).toBeInTheDocument();
    });

    it('disables send button when input is empty (prevents empty submission)', async () => {
      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Send message/i })).toBeInTheDocument();
      });

      const sendBtn = screen.getByRole('button', { name: /Send message/i });
      expect(sendBtn).toBeDisabled();
    });

    it('keeps send button disabled for whitespace-only input', async () => {
      const user = userEvent.setup();
      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /Chat message input/i })).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox', { name: /Chat message input/i });
      await user.type(input, '   ');

      const sendBtn = screen.getByRole('button', { name: /Send message/i });
      expect(sendBtn).toBeDisabled();
    });

    it('does not call fetch for empty input submission', async () => {
      const user = userEvent.setup();
      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Send message/i })).toBeInTheDocument();
      });

      // Reset fetch mock after initial history load
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockClear();

      await user.click(screen.getByRole('button', { name: /Send message/i }));

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('disables send button when input is empty', async () => {
      renderChatbotPage();

      await waitFor(() => {
        const sendBtn = screen.getByRole('button', { name: /Send message/i });
        expect(sendBtn).toBeDisabled();
      });
    });
  });

  describe('Sending messages', () => {
    beforeEach(async () => {
      sessionOverride = { id: 'test-session', isDemoActive: false };
    });

    it('shows typing indicator while waiting for response', async () => {
      const user = userEvent.setup();
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // history
        .mockImplementationOnce(() => new Promise(() => {})); // chat response hangs

      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /Chat message input/i })).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox', { name: /Chat message input/i });
      await user.type(input, 'How can I save more?');
      await user.click(screen.getByRole('button', { name: /Send message/i }));

      expect(screen.getByLabelText('Thinking')).toBeInTheDocument();
    });

    it('clears input after sending a message', async () => {
      const user = userEvent.setup();
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // history
        .mockImplementationOnce(() => new Promise(() => {})); // chat response hangs

      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /Chat message input/i })).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox', { name: /Chat message input/i });
      await user.type(input, 'How can I save more?');
      await user.click(screen.getByRole('button', { name: /Send message/i }));

      expect(input).toHaveValue('');
    });

    it('displays the response after successful send', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        id: 'msg-new',
        question: 'How can I save more?',
        answer: 'Cut food expenses by ₹3,000 to save more each month.',
        timestamp: '2024-01-15T11:00:00Z',
      };

      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // history
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse }); // chat response

      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /Chat message input/i })).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox', { name: /Chat message input/i });
      await user.type(input, 'How can I save more?');
      await user.click(screen.getByRole('button', { name: /Send message/i }));

      await waitFor(() => {
        expect(screen.getByText('How can I save more?')).toBeInTheDocument();
        expect(
          screen.getByText('Cut food expenses by ₹3,000 to save more each month.')
        ).toBeInTheDocument();
      });
    });

    it('shows error message on send failure', async () => {
      const user = userEvent.setup();
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // history
        .mockResolvedValueOnce({ ok: false, status: 500 }); // chat fails

      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /Chat message input/i })).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox', { name: /Chat message input/i });
      await user.type(input, 'Test question');
      await user.click(screen.getByRole('button', { name: /Send message/i }));

      await waitFor(() => {
        expect(screen.getByText(/Failed to send message/i)).toBeInTheDocument();
      });
    });

    it('sends message on Enter key (without Shift)', async () => {
      const user = userEvent.setup();
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // history
        .mockImplementationOnce(() => new Promise(() => {})); // chat hangs

      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /Chat message input/i })).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox', { name: /Chat message input/i });
      await user.type(input, 'Test question');
      await user.keyboard('{Enter}');

      // Should show typing indicator (message was sent)
      expect(screen.getByLabelText('Thinking')).toBeInTheDocument();
    });

    it('disables input while loading', async () => {
      const user = userEvent.setup();
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: async () => [] }) // history
        .mockImplementationOnce(() => new Promise(() => {})); // chat hangs

      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /Chat message input/i })).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox', { name: /Chat message input/i });
      await user.type(input, 'Test question');
      await user.click(screen.getByRole('button', { name: /Send message/i }));

      expect(input).toBeDisabled();
    });
  });

  describe('Chat messages area', () => {
    it('has an accessible log role for messages', async () => {
      sessionOverride = { id: 'test-session', isDemoActive: false };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByRole('log', { name: /Chat messages/i })).toBeInTheDocument();
      });
    });

    it('shows placeholder text when no messages exist', async () => {
      sessionOverride = { id: 'test-session', isDemoActive: false };
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      renderChatbotPage();

      await waitFor(() => {
        expect(screen.getByText(/Ask me anything about your finances/i)).toBeInTheDocument();
      });
    });
  });
});
