/**
 * SmartWealth AI - API Client Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiError,
  sessionApi,
  documentApi,
  financialApi,
  goalApi,
  chatApi,
  reportApi,
  getStoredSessionId,
  setStoredSessionId,
  clearStoredSessionId,
} from './api';

// ─── Test Helpers ───────────────────────────────────────────────────────────────

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown>; blob?: () => Promise<Blob>; text?: () => Promise<string> }) {
  const mockResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    ...response,
  } as Response;

  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);
}

function mockFetchError(status: number, statusText: string, body: unknown = null) {
  const mockResponse = {
    ok: false,
    status,
    statusText,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(String(body)),
  } as Response;

  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Session ID Management', () => {
    it('stores and retrieves session ID from localStorage', () => {
      expect(getStoredSessionId()).toBeNull();
      setStoredSessionId('test-session-123');
      expect(getStoredSessionId()).toBe('test-session-123');
    });

    it('clears stored session ID', () => {
      setStoredSessionId('test-session-123');
      clearStoredSessionId();
      expect(getStoredSessionId()).toBeNull();
    });
  });

  describe('X-Session-Id Header Injection', () => {
    it('injects X-Session-Id header when session exists', async () => {
      setStoredSessionId('my-session-id');
      const fetchSpy = mockFetch({
        json: () => Promise.resolve({ id: 'my-session-id', isDemoActive: false, createdAt: '', lastAccessedAt: '' }),
      });

      await sessionApi.getStatus('my-session-id');

      const [, options] = fetchSpy.mock.calls[0];
      expect((options?.headers as Record<string, string>)['X-Session-Id']).toBe('my-session-id');
    });

    it('does not inject X-Session-Id header when no session', async () => {
      const fetchSpy = mockFetch({
        json: () => Promise.resolve({ id: 'new-id', isDemoActive: false }),
      });

      await sessionApi.create();

      const [, options] = fetchSpy.mock.calls[0];
      expect((options?.headers as Record<string, string>)['X-Session-Id']).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('throws ApiError with status and body on non-ok response', async () => {
      mockFetchError(400, 'Bad Request', { message: 'Invalid input' });

      await expect(sessionApi.create()).rejects.toThrow(ApiError);
      await expect(
        mockFetchError(400, 'Bad Request', { message: 'Invalid input' }) && sessionApi.create(),
      ).rejects.toMatchObject({
        status: 400,
        statusText: 'Bad Request',
        body: { message: 'Invalid input' },
      });
    });

    it('throws ApiError with text body when JSON parsing fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        json: () => Promise.reject(new Error('not json')),
        text: () => Promise.resolve('raw error text'),
      } as unknown as Response;

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

      await expect(financialApi.getSummary('session-1')).rejects.toMatchObject({
        status: 500,
        body: 'raw error text',
      });
    });
  });

  describe('Session API', () => {
    it('creates a session and stores session ID', async () => {
      mockFetch({
        json: () => Promise.resolve({ id: 'new-session-id', isDemoActive: false }),
      });

      const session = await sessionApi.create();

      expect(session.id).toBe('new-session-id');
      expect(getStoredSessionId()).toBe('new-session-id');
    });

    it('gets session status', async () => {
      const fetchSpy = mockFetch({
        json: () =>
          Promise.resolve({
            id: 'sess-1',
            isDemoActive: true,
            createdAt: '2024-01-01T00:00:00Z',
            lastAccessedAt: '2024-01-02T00:00:00Z',
          }),
      });

      const status = await sessionApi.getStatus('sess-1');

      expect(status.id).toBe('sess-1');
      expect(status.isDemoActive).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/sess-1'),
        expect.any(Object),
      );
    });

    it('loads demo data', async () => {
      const fetchSpy = mockFetch({ status: 204, json: () => Promise.resolve(undefined) });

      await sessionApi.loadDemo('sess-1');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/sess-1/demo'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('clears demo data', async () => {
      const fetchSpy = mockFetch({ status: 204, json: () => Promise.resolve(undefined) });

      await sessionApi.clearDemo('sess-1');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/sess-1/demo'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('Document API', () => {
    it('uploads documents as multipart/form-data', async () => {
      const fetchSpy = mockFetch({
        json: () =>
          Promise.resolve({
            documents: [
              { id: 'doc-1', fileName: 'salary.pdf', documentType: 'salary_slip', status: 'processing', uploadedAt: '' },
            ],
          }),
      });

      const file = new File(['content'], 'salary.pdf', { type: 'application/pdf' });
      const result = await documentApi.upload('sess-1', [file], ['salary_slip']);

      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].fileName).toBe('salary.pdf');

      // Verify FormData body was sent (no Content-Type header set manually)
      const [, options] = fetchSpy.mock.calls[0];
      expect(options?.body).toBeInstanceOf(FormData);
      expect((options?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    });

    it('lists documents', async () => {
      mockFetch({
        json: () =>
          Promise.resolve([
            { id: 'doc-1', fileName: 'salary.pdf', documentType: 'salary_slip', status: 'processed', uploadedAt: '' },
          ]),
      });

      const docs = await documentApi.list('sess-1');
      expect(docs).toHaveLength(1);
    });

    it('gets document processing status', async () => {
      mockFetch({
        json: () => Promise.resolve({ id: 'doc-1', status: 'processed', processedAt: '2024-01-01T00:00:00Z' }),
      });

      const status = await documentApi.getStatus('sess-1', 'doc-1');
      expect(status.status).toBe('processed');
    });
  });

  describe('Financial API', () => {
    it('gets financial summary', async () => {
      const summaryData = {
        monthlyIncome: 120000,
        totalExpenses: 78000,
        monthlySavings: 42000,
        savingsPercentage: 35,
        expensesByCategory: { Rent: 25000, Food: 18500 },
      };
      mockFetch({ json: () => Promise.resolve(summaryData) });

      const summary = await financialApi.getSummary('sess-1');
      expect(summary.monthlyIncome).toBe(120000);
      expect(summary.monthlySavings).toBe(42000);
    });

    it('gets paginated transactions', async () => {
      const fetchSpy = mockFetch({
        json: () =>
          Promise.resolve({
            transactions: [{ id: 'tx-1', description: 'Swiggy', amount: 450, type: 'debit', category: 'Food' }],
            total: 50,
            page: 2,
            pageSize: 20,
          }),
      });

      const result = await financialApi.getTransactions('sess-1', 2, 20);

      expect(result.transactions).toHaveLength(1);
      expect(result.total).toBe(50);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('page=2&pageSize=20'),
        expect.any(Object),
      );
    });

    it('gets health score', async () => {
      const scoreData = {
        totalScore: 72,
        statusLabel: 'Very Good',
        components: {
          savingsRatio: { score: 25, maxScore: 30, value: 0.35 },
          expenseControl: { score: 18, maxScore: 25, value: 0.42 },
          emiBurden: { score: 12, maxScore: 15, value: 0.1 },
          investmentAllocation: { score: 10, maxScore: 15, value: 0.13 },
          emergencyFundReadiness: { score: 7, maxScore: 15, value: 2.8 },
        },
      };
      mockFetch({ json: () => Promise.resolve(scoreData) });

      const score = await financialApi.getScore('sess-1');
      expect(score.totalScore).toBe(72);
      expect(score.statusLabel).toBe('Very Good');
    });

    it('gets recommendations', async () => {
      mockFetch({
        json: () =>
          Promise.resolve([
            { id: 'rec-1', category: 'Savings', text: 'Increase savings', dataPointReference: '35%' },
          ]),
      });

      const recs = await financialApi.getRecommendations('sess-1');
      expect(recs).toHaveLength(1);
      expect(recs[0].category).toBe('Savings');
    });

    it('gets recurring expenses', async () => {
      mockFetch({
        json: () =>
          Promise.resolve([
            { id: 're-1', description: 'Netflix', recurringAmount: 649, consecutiveMonths: 3 },
          ]),
      });

      const recurring = await financialApi.getRecurring('sess-1');
      expect(recurring).toHaveLength(1);
      expect(recurring[0].description).toBe('Netflix');
    });

    it('gets spending anomalies', async () => {
      mockFetch({
        json: () =>
          Promise.resolve([
            { id: 'sa-1', description: 'Expensive dinner', transactionAmount: 8500, category: 'Food', categoryAverage: 2000 },
          ]),
      });

      const anomalies = await financialApi.getAnomalies('sess-1');
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].transactionAmount).toBe(8500);
    });
  });

  describe('Goal API', () => {
    it('creates a goal with correct payload', async () => {
      const goalReq = {
        goalName: 'Buy a Car',
        goalType: 'buy_car',
        targetAmount: 800000,
        durationMonths: 24,
        existingSavings: 100000,
        expectedReturnPercent: 8.0,
      };
      const fetchSpy = mockFetch({
        json: () =>
          Promise.resolve({
            id: 'goal-1',
            ...goalReq,
            requiredMonthlySavings: 26923,
            feasibilityStatus: 'Challenging',
          }),
      });

      const goal = await goalApi.create('sess-1', goalReq);

      expect(goal.id).toBe('goal-1');
      expect(goal.requiredMonthlySavings).toBe(26923);
      const [, options] = fetchSpy.mock.calls[0];
      expect(JSON.parse(options?.body as string)).toEqual(goalReq);
    });

    it('lists goals', async () => {
      mockFetch({
        json: () => Promise.resolve([{ id: 'goal-1', goalName: 'Buy a Car' }]),
      });

      const goals = await goalApi.list('sess-1');
      expect(goals).toHaveLength(1);
    });

    it('deletes a goal', async () => {
      const fetchSpy = mockFetch({ status: 204, json: () => Promise.resolve(undefined) });

      await goalApi.delete('sess-1', 'goal-1');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/sess-1/goals/goal-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('Chat API', () => {
    it('sends a chat message', async () => {
      const fetchSpy = mockFetch({
        json: () =>
          Promise.resolve({
            id: 'msg-1',
            question: 'How can I save more?',
            answer: 'Based on your data...',
            timestamp: '2024-01-15T11:00:00Z',
            disclaimer: 'This is informational guidance only.',
          }),
      });

      const response = await chatApi.send('sess-1', 'How can I save more?');

      expect(response.answer).toContain('Based on your data');
      const [, options] = fetchSpy.mock.calls[0];
      expect(JSON.parse(options?.body as string)).toEqual({ message: 'How can I save more?' });
    });

    it('gets chat history', async () => {
      mockFetch({
        json: () =>
          Promise.resolve([
            { id: 'msg-1', question: 'Q1', answer: 'A1', timestamp: '2024-01-15T10:00:00Z' },
            { id: 'msg-2', question: 'Q2', answer: 'A2', timestamp: '2024-01-15T11:00:00Z' },
          ]),
      });

      const history = await chatApi.getHistory('sess-1');
      expect(history).toHaveLength(2);
    });
  });

  describe('Report API', () => {
    it('generates report and returns PDF blob', async () => {
      const pdfBlob = new Blob(['pdf-content'], { type: 'application/pdf' });
      mockFetch({
        headers: new Headers({ 'Content-Type': 'application/pdf' }),
        blob: () => Promise.resolve(pdfBlob),
      });

      const result = await reportApi.generate('sess-1');
      expect(result).toBeInstanceOf(Blob);
    });

    it('gets report status', async () => {
      mockFetch({
        json: () => Promise.resolve({ status: 'completed', downloadUrl: '/report.pdf' }),
      });

      const status = await reportApi.getStatus('sess-1');
      expect(status.status).toBe('completed');
    });
  });

  describe('Content-Type Handling', () => {
    it('sets Content-Type to application/json for JSON bodies', async () => {
      const fetchSpy = mockFetch({
        json: () => Promise.resolve({ id: 'msg-1', question: '', answer: '', timestamp: '', disclaimer: '' }),
      });

      await chatApi.send('sess-1', 'Hello');

      const [, options] = fetchSpy.mock.calls[0];
      expect((options?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('does not set Content-Type for FormData bodies', async () => {
      const fetchSpy = mockFetch({
        json: () => Promise.resolve({ documents: [] }),
      });

      const file = new File(['x'], 'test.pdf', { type: 'application/pdf' });
      await documentApi.upload('sess-1', [file], ['salary_slip']);

      const [, options] = fetchSpy.mock.calls[0];
      expect((options?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    });
  });
});
