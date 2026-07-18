import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DisclaimerBar } from '../components/DisclaimerBar';
import { useSession } from '../context/SessionContext';
import { chatApi, financialApi, ApiError } from '../services/api';
import type { ChatMessage } from '../types';

const MAX_CHARS = 500;
const DISCLAIMER_TEXT =
  'This is informational guidance only. Consult a certified financial advisor for professional advice.';

/**
 * AI Finance Chatbot page.
 * Conversational interface with message history, input validation,
 * typing indicator, and disclaimer.
 * Validates: Requirements 9.1, 9.2, 9.3, 9.6, 9.7, 9.8, 14.1
 */
export function ChatbotPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [hasFinancialData, setHasFinancialData] = useState<boolean | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { session } = useSession();
  const sessionId = session?.id ?? null;

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Load chat history and check for financial data on mount
  useEffect(() => {
    if (!sessionId) {
      setHasFinancialData(false);
      setIsFetchingHistory(false);
      return;
    }

    async function loadHistory() {
      try {
        const data = await chatApi.getHistory(sessionId!);
        setMessages(Array.isArray(data) ? data : []);
        setHasFinancialData(true);
      } catch (err) {
        // Check if it's a "no data" response or a real error
        try {
          await financialApi.getSummary(sessionId!);
          setHasFinancialData(true);
          // History fetch specifically failed
          setHistoryError('Failed to load chat history. Please try again.');
        } catch (summaryErr) {
          if (summaryErr instanceof ApiError && summaryErr.status === 404) {
            setHasFinancialData(false);
          } else {
            setHistoryError('Failed to load chat history. Please try again.');
            setHasFinancialData(true);
          }
        }
      } finally {
        setIsFetchingHistory(false);
      }
    }

    loadHistory();
  }, [sessionId]);

  const handleRetryHistory = async () => {
    if (!sessionId) return;
    setHistoryError(null);
    setIsFetchingHistory(true);
    try {
      const data = await chatApi.getHistory(sessionId);
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      setHistoryError('Failed to load chat history. Please try again.');
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setValidationMessage('Please enter a question.');
      return;
    }

    if (!sessionId) {
      setSendError('No active session. Please upload documents or load demo data.');
      return;
    }

    setValidationMessage(null);
    setSendError(null);
    setIsLoading(true);

    const userMessage = trimmed;
    setInput('');

    try {
      const data = await chatApi.send(sessionId, userMessage);
      // Map the ChatResponse to a ChatMessage for display
      const chatMessage: ChatMessage = {
        id: data.id,
        question: data.question,
        answer: data.answer,
        timestamp: data.timestamp,
      };
      setMessages((prev) => [...prev, chatMessage]);
    } catch {
      setSendError('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetrySend = () => {
    setSendError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARS) {
      setInput(value);
      setValidationMessage(null);
    }
  };

  const remainingChars = MAX_CHARS - input.length;
  const isInputEmpty = input.trim().length === 0;

  // Loading state while fetching history
  if (isFetchingHistory) {
    return (
      <div className="flex flex-col h-full">
        <DisclaimerBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-3" aria-label="Loading chat history"></div>
            <p className="text-neutral-500">Loading chat history...</p>
          </div>
        </div>
      </div>
    );
  }

  // No financial data state
  if (hasFinancialData === false) {
    return (
      <div className="flex flex-col h-full">
        <DisclaimerBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center" role="status">
            <div className="text-5xl mb-4">💬</div>
            <h2 className="text-xl font-semibold text-neutral-800 mb-2">No Financial Data Available</h2>
            <p className="text-neutral-600 mb-6">
              I don't have any financial data yet. Please upload documents or load demo data to start chatting about your finances.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => navigate('/upload')}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Upload Documents
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
              >
                Load Demo Data
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Disclaimer at top - non-dismissible, visible without scrolling */}
      <DisclaimerBar />

      {/* History error */}
      {historyError && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-2 flex items-center justify-between">
          <p className="text-sm text-red-700">{historyError}</p>
          <button
            onClick={handleRetryHistory}
            className="text-sm text-red-700 underline hover:text-red-900 ml-3"
          >
            Retry
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto mt-4 space-y-4 min-h-0 pb-2" aria-label="Chat messages" role="log">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-neutral-400 py-12">
            <p className="text-lg">Ask me anything about your finances</p>
            <p className="text-sm mt-1">e.g., "How can I reduce my food expenses?"</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-[75%] bg-primary-600 text-white rounded-2xl rounded-br-md px-4 py-2.5">
                <p className="text-sm">{msg.question}</p>
                <time className="block text-xs text-primary-200 mt-1">
                  {formatTimestamp(msg.timestamp)}
                </time>
              </div>
            </div>
            {/* Bot message */}
            <div className="flex justify-start">
              <div className="max-w-[75%] bg-neutral-100 text-neutral-800 rounded-2xl rounded-bl-md px-4 py-2.5">
                <p className="text-sm whitespace-pre-wrap">{msg.answer}</p>
                <p className="text-xs text-neutral-400 mt-2 italic">{DISCLAIMER_TEXT}</p>
                <time className="block text-xs text-neutral-400 mt-1">
                  {formatTimestamp(msg.timestamp)}
                </time>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-neutral-100 rounded-2xl rounded-bl-md px-4 py-3" aria-label="Thinking">
              <div className="flex space-x-1.5">
                <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Send error */}
      {sendError && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-2 flex items-center justify-between">
          <p className="text-sm text-red-700">{sendError}</p>
          <button
            onClick={handleRetrySend}
            className="text-sm text-red-700 underline hover:text-red-900 ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-neutral-200 pt-3 mt-auto">
        {validationMessage && (
          <p className="text-sm text-red-600 mb-2" role="alert">
            {validationMessage}
          </p>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your finances..."
              maxLength={MAX_CHARS}
              rows={1}
              className="w-full resize-none rounded-lg border border-neutral-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
              disabled={isLoading}
              aria-label="Chat message input"
            />
            <span
              className={`absolute bottom-1 right-2 text-xs ${
                remainingChars < 50 ? 'text-amber-600' : 'text-neutral-400'
              }`}
              aria-label={`${remainingChars} characters remaining`}
            >
              {remainingChars}/{MAX_CHARS}
            </span>
          </div>
          <button
            onClick={handleSend}
            disabled={isInputEmpty || isLoading}
            className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
