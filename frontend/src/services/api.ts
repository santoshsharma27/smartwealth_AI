/**
 * SmartWealth AI - API Client Service Layer
 *
 * Centralized, typed API client for all backend endpoint calls.
 * Automatically injects X-Session-Id header and handles error parsing.
 */

/// <reference types="vite/client" />

import type {
  Session,
  FinancialSummary,
  HealthScore,
  Goal,
  ChatMessage,
  Transaction,
  Recommendation,
  RecurringExpense,
  SpendingAnomaly,
} from '../types';

// ─── Configuration ──────────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

// ─── Error Types ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

// ─── Request/Response Types ─────────────────────────────────────────────────────

export interface DocumentUploadResponse {
  documents: Array<{
    id: string;
    fileName: string;
    documentType: 'salary_slip' | 'bank_statement';
    status: string;
    uploadedAt: string;
  }>;
}

export interface DocumentInfo {
  id: string;
  fileName: string;
  documentType: 'salary_slip' | 'bank_statement';
  status: string;
  uploadedAt: string;
  processedAt?: string;
}

export interface DocumentStatus {
  id: string;
  status: 'uploaded' | 'processing' | 'processed' | 'failed';
  processedAt?: string;
}

export interface CreateGoalRequest {
  goalName: string;
  goalType: string;
  targetAmount: number;
  durationMonths: number;
  existingSavings: number;
  expectedReturnPercent: number;
}

export interface ChatResponse {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
  disclaimer: string;
}

export interface ReportStatus {
  status: 'pending' | 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
}

export interface PaginatedTransactions {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SessionStatus {
  id: string;
  isDemoActive: boolean;
  createdAt: string;
  lastAccessedAt: string;
}

// ─── Session ID Management ──────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = 'smartwealth_session_id';

export function getStoredSessionId(): string | null {
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

export function setStoredSessionId(sessionId: string): void {
  localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
}

export function clearStoredSessionId(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

// ─── Core Fetch Utility ─────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const sessionId = getStoredSessionId();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  }

  // Only set Content-Type for non-FormData bodies
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      try {
        body = typeof response.text === 'function' ? await response.text() : null;
      } catch {
        body = null;
      }
    }
    throw new ApiError(response.status, response.statusText ?? '', body);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // Handle blob responses (PDF download)
  const contentType = response.headers?.get?.('Content-Type') ?? null;
  if (contentType && contentType.includes('application/pdf')) {
    return (await response.blob()) as T;
  }

  return response.json();
}

// ─── Session Management ─────────────────────────────────────────────────────────

export const sessionApi = {
  /** Create a new session */
  async create(): Promise<Session> {
    const session = await request<Session>('/sessions', {
      method: 'POST',
    });
    setStoredSessionId(session.id);
    return session;
  },

  /** Get session status */
  async getStatus(sessionId: string): Promise<SessionStatus> {
    return request<SessionStatus>(`/sessions/${sessionId}`);
  },

  /** Load demo data for a session */
  async loadDemo(sessionId: string): Promise<void> {
    return request<void>(`/sessions/${sessionId}/demo`, {
      method: 'POST',
    });
  },

  /** Clear demo data */
  async clearDemo(sessionId: string): Promise<void> {
    return request<void>(`/sessions/${sessionId}/demo`, {
      method: 'DELETE',
    });
  },
};

// ─── Document Upload ────────────────────────────────────────────────────────────

export const documentApi = {
  /** Upload documents (multipart/form-data) */
  async upload(
    sessionId: string,
    files: File[],
    documentTypes: Array<'salary_slip' | 'bank_statement'>,
  ): Promise<DocumentUploadResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    documentTypes.forEach((type) => {
      formData.append('documentTypes', type);
    });

    return request<DocumentUploadResponse>(
      `/sessions/${sessionId}/documents`,
      {
        method: 'POST',
        body: formData,
      },
    );
  },

  /** List uploaded documents */
  async list(sessionId: string): Promise<DocumentInfo[]> {
    return request<DocumentInfo[]>(`/sessions/${sessionId}/documents`);
  },

  /** Get document processing status */
  async getStatus(sessionId: string, docId: string): Promise<DocumentStatus> {
    return request<DocumentStatus>(
      `/sessions/${sessionId}/documents/${docId}/status`,
    );
  },
};

// ─── Financial Data ─────────────────────────────────────────────────────────────

export const financialApi = {
  /** Get financial summary */
  async getSummary(sessionId: string): Promise<FinancialSummary> {
    return request<FinancialSummary>(`/sessions/${sessionId}/summary`);
  },

  /** Get categorized transactions (paginated) */
  async getTransactions(
    sessionId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedTransactions> {
    return request<PaginatedTransactions>(
      `/sessions/${sessionId}/transactions?page=${page}&pageSize=${pageSize}`,
    );
  },

  /** Get Financial Health Score */
  async getScore(sessionId: string): Promise<HealthScore> {
    return request<HealthScore>(`/sessions/${sessionId}/score`);
  },

  /** Get AI recommendations */
  async getRecommendations(sessionId: string): Promise<Recommendation[]> {
    return request<Recommendation[]>(
      `/sessions/${sessionId}/recommendations`,
    );
  },

  /** Get recurring expenses */
  async getRecurring(sessionId: string): Promise<RecurringExpense[]> {
    return request<RecurringExpense[]>(`/sessions/${sessionId}/recurring`);
  },

  /** Get unusual spending alerts */
  async getAnomalies(sessionId: string): Promise<SpendingAnomaly[]> {
    return request<SpendingAnomaly[]>(`/sessions/${sessionId}/anomalies`);
  },
};

// ─── Goal Planner ───────────────────────────────────────────────────────────────

export const goalApi = {
  /** Create a new goal */
  async create(sessionId: string, goal: CreateGoalRequest): Promise<Goal> {
    return request<Goal>(`/sessions/${sessionId}/goals`, {
      method: 'POST',
      body: JSON.stringify(goal),
    });
  },

  /** List all goals */
  async list(sessionId: string): Promise<Goal[]> {
    return request<Goal[]>(`/sessions/${sessionId}/goals`);
  },

  /** Get a single goal detail */
  async get(sessionId: string, goalId: string): Promise<Goal> {
    return request<Goal>(`/sessions/${sessionId}/goals/${goalId}`);
  },

  /** Delete a goal */
  async delete(sessionId: string, goalId: string): Promise<void> {
    return request<void>(`/sessions/${sessionId}/goals/${goalId}`, {
      method: 'DELETE',
    });
  },
};

// ─── Chatbot ────────────────────────────────────────────────────────────────────

export const chatApi = {
  /** Send a chat message */
  async send(sessionId: string, message: string): Promise<ChatResponse> {
    return request<ChatResponse>(`/sessions/${sessionId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  /** Get chat history */
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    return request<ChatMessage[]>(`/sessions/${sessionId}/chat/history`);
  },
};

// ─── Report ─────────────────────────────────────────────────────────────────────

export const reportApi = {
  /** Generate a financial report (returns PDF blob) */
  async generate(sessionId: string): Promise<Blob> {
    return request<Blob>(`/sessions/${sessionId}/report`, {
      method: 'POST',
    });
  },

  /** Get report generation status */
  async getStatus(sessionId: string): Promise<ReportStatus> {
    return request<ReportStatus>(`/sessions/${sessionId}/report/status`);
  },
};
