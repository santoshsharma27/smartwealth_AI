import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardPage } from './DashboardPage';
import { SessionProvider } from '../context/SessionContext';
import type {
  FinancialSummary,
  HealthScore,
  Recommendation,
  RecurringExpense,
  SpendingAnomaly,
} from '../types';

declare const global: { fetch: typeof fetch };

// Mock useSession to control session state
const mockSession = { id: 'test-session-123', isDemoActive: false };
let sessionOverride: { id: string; isDemoActive: boolean } | null = mockSession;

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

// Mock data
const mockSummary: FinancialSummary = {
  monthlyIncome: 120000,
  totalExpenses: 78000,
  monthlySavings: 42000,
  savingsPercentage: 35,
  expensesByCategory: {
    Rent: 25000,
    Food: 18500,
    Travel: 5000,
    Shopping: 8000,
    Bills: 6000,
    EMI: 10000,
    Healthcare: 2000,
    Entertainment: 3500,
    Investments: 0,
    Savings: 0,
    Education: 0,
    Miscellaneous: 0,
  },
};

const mockScore: HealthScore = {
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

const mockRecommendations: Recommendation[] = [
  {
    id: 'rec-1',
    category: 'Savings',
    text: 'Consider increasing your monthly savings by ₹8,000 to reach a 40% savings rate.',
    dataPointReference: 'Current savings rate: 35%',
  },
  {
    id: 'rec-2',
    category: 'Food',
    text: 'Your food spending is ₹18,500 which is 23.7% of expenses. Try reducing dining out.',
    dataPointReference: 'Food spending: ₹18,500',
  },
];

const mockRecurring: RecurringExpense[] = [
  {
    id: 'rec-exp-1',
    description: 'Netflix Subscription',
    recurringAmount: 649,
    consecutiveMonths: 4,
  },
];

const mockAnomalies: SpendingAnomaly[] = [
  {
    id: 'anom-1',
    description: 'Electronics Store Purchase',
    transactionAmount: 45000,
    category: 'Shopping',
    categoryAverage: 8000,
  },
];

function renderDashboard() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <DashboardPage />
      </SessionProvider>
    </MemoryRouter>
  );
}

function mockFetchSuccess() {
  global.fetch = vi.fn((url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('/summary')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSummary),
      });
    }
    if (urlStr.includes('/score')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockScore),
      });
    }
    if (urlStr.includes('/recommendations')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockRecommendations),
      });
    }
    if (urlStr.includes('/recurring')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockRecurring),
      });
    }
    if (urlStr.includes('/anomalies')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAnomalies),
      });
    }
    return Promise.resolve({ ok: false, status: 404 });
  }) as unknown as typeof fetch;
}

describe('DashboardPage', () => {
  beforeEach(() => {
    sessionOverride = mockSession;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    // Never-resolving fetch to keep loading state
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    renderDashboard();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders empty state when no session', async () => {
    sessionOverride = null;
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('No financial data available')).toBeInTheDocument();
    });
  });

  it('renders empty state when API returns 404 for summary and score', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 404 })
    ) as unknown as typeof fetch;

    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('No financial data available')).toBeInTheDocument();
    });
  });

  it('renders error state with retry button when API fails', async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Network error'))
    ) as unknown as typeof fetch;

    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Unable to load dashboard')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('retries loading on retry button click', async () => {
    const user = userEvent.setup();
    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      if (callCount <= 5) {
        return Promise.reject(new Error('Network error'));
      }
      // After retry, return success
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSummary),
      });
    }) as unknown as typeof fetch;

    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    // Now mock success and retry
    mockFetchSuccess();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('renders summary cards with correct values when data loads', async () => {
    mockFetchSuccess();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Monthly Income')).toBeInTheDocument();
    });

    expect(screen.getByText('Monthly Expenses')).toBeInTheDocument();
    expect(screen.getByText('Monthly Savings')).toBeInTheDocument();
    expect(screen.getByText('Savings Rate')).toBeInTheDocument();
  });

  it('renders Financial Health Score with status label', async () => {
    mockFetchSuccess();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Financial Health Score')).toBeInTheDocument();
    });

    // Score is rendered in multiple places (gauge + accessibility table), use getAllByText
    expect(screen.getAllByText('72').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Very Good')).toBeInTheDocument();
  });

  it('renders expense breakdown chart section', async () => {
    mockFetchSuccess();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Expense Breakdown')).toBeInTheDocument();
    });
  });

  it('renders AI recommendations', async () => {
    mockFetchSuccess();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('AI Recommendations')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Consider increasing your monthly savings/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your food spending is/)
    ).toBeInTheDocument();
  });

  it('renders recurring expenses alerts', async () => {
    mockFetchSuccess();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Recurring Expenses')).toBeInTheDocument();
    });
    expect(screen.getByText('Netflix Subscription')).toBeInTheDocument();
    expect(screen.getByText(/4 consecutive months/)).toBeInTheDocument();
  });

  it('renders unusual spending alerts', async () => {
    mockFetchSuccess();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Unusual Spending')).toBeInTheDocument();
    });
    expect(screen.getByText('Electronics Store Purchase')).toBeInTheDocument();
  });

  it('renders disclaimer bar', async () => {
    mockFetchSuccess();
    renderDashboard();

    // DisclaimerBar should always be visible
    await waitFor(() => {
      expect(screen.getByText(/educational and informational only/i)).toBeInTheDocument();
    });
  });

  it('displays ₹ formatted currency values in summary cards', async () => {
    mockFetchSuccess();
    renderDashboard();

    await waitFor(() => {
      // Indian formatting: ₹1,20,000
      expect(screen.getByLabelText(/Monthly Income: ₹1,20,000/)).toBeInTheDocument();
    });
  });

  it('displays savings percentage correctly', async () => {
    mockFetchSuccess();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByLabelText(/Savings Rate: 35%/)).toBeInTheDocument();
    });
  });
});
