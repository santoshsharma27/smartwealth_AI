/**
 * Financial Dashboard page displaying summary cards, charts, health score,
 * recommendations, recurring expenses, and unusual spending alerts.
 * Handles loading, error (with retry), and empty states.
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 13.3
 */
import { useState, useEffect, useCallback } from 'react';
import { DisclaimerBar } from '../components/DisclaimerBar';
import { SummaryCard } from '../components/SummaryCard';
import { CategoryChart } from '../components/CategoryChart';
import { ScoreGauge } from '../components/ScoreGauge';
import { AlertCard } from '../components/AlertCard';
import { EmptyState } from '../components/EmptyState';
import { useSession } from '../context/SessionContext';
import { financialApi, ApiError } from '../services/api';
import type {
  FinancialSummary,
  HealthScore,
  Recommendation,
  RecurringExpense,
  SpendingAnomaly,
} from '../types';

interface DashboardData {
  summary: FinancialSummary | null;
  score: HealthScore | null;
  recommendations: Recommendation[];
  recurringExpenses: RecurringExpense[];
  anomalies: SpendingAnomaly[];
}

type DashboardState = 'loading' | 'error' | 'empty' | 'loaded';

export function DashboardPage() {
  const { session } = useSession();
  const [state, setState] = useState<DashboardState>('loading');
  const [data, setData] = useState<DashboardData>({
    summary: null,
    score: null,
    recommendations: [],
    recurringExpenses: [],
    anomalies: [],
  });
  const [errorMessage, setErrorMessage] = useState('');

  const fetchDashboardData = useCallback(async () => {
    if (!session?.id) {
      setState('empty');
      return;
    }

    setState('loading');
    setErrorMessage('');

    try {
      const results = await Promise.allSettled([
        financialApi.getSummary(session.id),
        financialApi.getScore(session.id),
        financialApi.getRecommendations(session.id),
        financialApi.getRecurring(session.id),
        financialApi.getAnomalies(session.id),
      ]);

      const [summaryResult, scoreResult, recsResult, recurringResult, anomaliesResult] = results;

      // Check if both critical endpoints failed
      const summaryFailed = summaryResult.status === 'rejected';
      const scoreFailed = scoreResult.status === 'rejected';

      if (summaryFailed && scoreFailed) {
        // Check if it's a 404 (no data) scenario
        const summaryIs404 =
          summaryResult.status === 'rejected' &&
          summaryResult.reason instanceof ApiError &&
          summaryResult.reason.status === 404;
        const scoreIs404 =
          scoreResult.status === 'rejected' &&
          scoreResult.reason instanceof ApiError &&
          scoreResult.reason.status === 404;

        if (summaryIs404 && scoreIs404) {
          setState('empty');
          return;
        }
        throw new Error('Failed to retrieve financial data. Please try again.');
      }

      const summary: FinancialSummary | null =
        summaryResult.status === 'fulfilled' ? summaryResult.value : null;
      const score: HealthScore | null =
        scoreResult.status === 'fulfilled' ? scoreResult.value : null;
      const recommendations: Recommendation[] =
        recsResult.status === 'fulfilled' ? recsResult.value : [];
      const recurringExpenses: RecurringExpense[] =
        recurringResult.status === 'fulfilled' ? recurringResult.value : [];
      const anomalies: SpendingAnomaly[] =
        anomaliesResult.status === 'fulfilled' ? anomaliesResult.value : [];

      // If no summary data available, show empty state
      if (!summary && !score) {
        setState('empty');
        return;
      }

      setData({ summary, score, recommendations, recurringExpenses, anomalies });
      setState('loaded');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(message);
      setState('error');
    }
  }, [session?.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div>
      <DisclaimerBar />
      <h1 className="text-2xl font-bold text-neutral-800 mt-4 mb-6">Dashboard</h1>

      {state === 'loading' && <LoadingState />}
      {state === 'error' && (
        <ErrorState message={errorMessage} onRetry={fetchDashboardData} />
      )}
      {state === 'empty' && <EmptyState />}
      {state === 'loaded' && <DashboardContent data={data} />}
    </div>
  );
}

/** Loading skeleton */
function LoadingState() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard data" role="status">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm animate-pulse"
          >
            <div className="h-4 w-24 bg-neutral-200 rounded mb-3" />
            <div className="h-8 w-32 bg-neutral-200 rounded" />
          </div>
        ))}
      </div>
      {/* Chart and score skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm animate-pulse h-80" />
        <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm animate-pulse h-80" />
      </div>
      <span className="sr-only">Loading dashboard data, please wait...</span>
    </div>
  );
}

/** Error state with retry */
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="py-16 px-4 text-center"
    >
      <div className="w-16 h-16 mb-4 rounded-full bg-red-50 flex items-center justify-center mx-auto">
        <svg
          className="w-8 h-8 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-neutral-800 mb-2">
        Unable to load dashboard
      </h2>
      <p className="text-neutral-600 mb-6">
        {message || 'Financial data could not be retrieved. Please try again.'}
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-2 rounded-lg bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

/** Main dashboard content */
function DashboardContent({ data }: { data: DashboardData }) {
  const { summary, score, recommendations, recurringExpenses, anomalies } = data;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <section aria-label="Financial summary">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              label="Monthly Income"
              value={summary.monthlyIncome}
              variant="income"
            />
            <SummaryCard
              label="Monthly Expenses"
              value={summary.totalExpenses}
              variant="expense"
            />
            <SummaryCard
              label="Monthly Savings"
              value={summary.monthlySavings}
              variant="savings"
            />
            <SummaryCard
              label="Savings Rate"
              value={summary.savingsPercentage}
              isPercentage
            />
          </div>
        </section>
      )}

      {/* Chart and Score section */}
      <section
        aria-label="Expense breakdown and health score"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {summary && (
          <CategoryChart expensesByCategory={summary.expensesByCategory} />
        )}
        {score && (
          <ScoreGauge score={score.totalScore} statusLabel={score.statusLabel} />
        )}
      </section>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <section aria-label="AI recommendations">
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">
              AI Recommendations
            </h3>
            <ul className="space-y-3">
              {recommendations.map((rec) => (
                <li
                  key={rec.id}
                  className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg"
                >
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold"
                    aria-hidden="true"
                  >
                    💡
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800">
                      {rec.text}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {rec.category} &middot; Based on: {rec.dataPointReference}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Recurring Expenses & Unusual Spending Alerts */}
      {(recurringExpenses.length > 0 || anomalies.length > 0) && (
        <section aria-label="Recurring expenses and unusual spending alerts">
          <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">
              Alerts &amp; Patterns
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recurring Expenses */}
              {recurringExpenses.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-neutral-600 mb-3">
                    Recurring Expenses
                  </h4>
                  <div className="space-y-2">
                    {recurringExpenses.map((expense) => (
                      <AlertCard
                        key={expense.id}
                        type="recurring"
                        description={expense.description}
                        recurringAmount={expense.recurringAmount}
                        consecutiveMonths={expense.consecutiveMonths}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Unusual Spending */}
              {anomalies.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-neutral-600 mb-3">
                    Unusual Spending
                  </h4>
                  <div className="space-y-2">
                    {anomalies.map((anomaly) => (
                      <AlertCard
                        key={anomaly.id}
                        type="anomaly"
                        description={anomaly.description}
                        transactionAmount={anomaly.transactionAmount}
                        category={anomaly.category}
                        categoryAverage={anomaly.categoryAverage}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
