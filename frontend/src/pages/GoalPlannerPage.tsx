import { useState, useEffect, useCallback } from 'react';
import type { Goal, GoalType } from '../types';
import { goalApi, ApiError } from '../services/api';
import { useSession } from '../context/SessionContext';

/** Predefined goal types with display labels */
const GOAL_TYPE_OPTIONS: { value: GoalType; label: string }[] = [
  { value: 'buy_car', label: 'Buy a Car' },
  { value: 'buy_house', label: 'Buy a House' },
  { value: 'vacation', label: 'Save for Vacation' },
  { value: 'emergency_fund', label: 'Build Emergency Fund' },
  { value: 'education', label: 'Education Planning' },
  { value: 'retirement', label: 'Retirement Planning' },
  { value: 'custom', label: 'Custom' },
];

/** Feasibility status color map */
function getFeasibilityColor(status: Goal['feasibilityStatus']): string {
  switch (status) {
    case 'Achievable':
      return 'text-green-700 bg-green-100';
    case 'Challenging':
      return 'text-amber-700 bg-amber-100';
    case 'Not Feasible':
      return 'text-red-700 bg-red-100';
    case 'Unable to assess':
      return 'text-gray-700 bg-gray-100';
    case 'Already Met':
      return 'text-blue-700 bg-blue-100';
    default:
      return 'text-gray-700 bg-gray-100';
  }
}

/** Format number as Indian Rupees */
function formatCurrency(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

interface GoalFormData {
  goalName: string;
  goalType: GoalType;
  targetAmount: string;
  durationMonths: string;
  existingSavings: string;
  expectedReturnPercent: string;
}

interface FormErrors {
  goalName?: string;
  goalType?: string;
  targetAmount?: string;
  durationMonths?: string;
  existingSavings?: string;
  expectedReturnPercent?: string;
}

const INITIAL_FORM: GoalFormData = {
  goalName: '',
  goalType: 'buy_car',
  targetAmount: '',
  durationMonths: '',
  existingSavings: '',
  expectedReturnPercent: '',
};

/**
 * Goal Planner Page — allows users to create financial goals,
 * view feasibility assessments, and manage existing goals.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.6, 8.7, 8.8
 */
export function GoalPlannerPage() {
  const { session } = useSession();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<GoalFormData>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [lastResult, setLastResult] = useState<Goal | null>(null);

  const fetchGoals = useCallback(async () => {
    const sessionId = session?.id;
    if (!sessionId) {
      setGoals([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await goalApi.list(sessionId);
      setGoals(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setGoals([]);
      } else {
        setError('Failed to fetch goals');
      }
    } finally {
      setLoading(false);
    }
  }, [session?.id]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  /** Client-side validation matching Requirement 8.6 ranges */
  function validateForm(data: GoalFormData): FormErrors {
    const errors: FormErrors = {};

    // Goal name: required, 1-100 chars
    if (!data.goalName.trim()) {
      errors.goalName = 'Goal name is required';
    } else if (data.goalName.length > 100) {
      errors.goalName = 'Goal name must be 100 characters or fewer';
    }

    // Target amount: required, 1 to 999999999
    const target = Number(data.targetAmount);
    if (!data.targetAmount) {
      errors.targetAmount = 'Target amount is required';
    } else if (isNaN(target) || target < 1 || target > 999999999) {
      errors.targetAmount = 'Target amount must be between ₹1 and ₹999,999,999';
    }

    // Duration: required, 1-360
    const duration = Number(data.durationMonths);
    if (!data.durationMonths) {
      errors.durationMonths = 'Duration is required';
    } else if (isNaN(duration) || duration < 1 || duration > 360 || !Number.isInteger(duration)) {
      errors.durationMonths = 'Duration must be between 1 and 360 months';
    }

    // Existing savings: required, 0 to target amount
    const savings = Number(data.existingSavings);
    if (data.existingSavings === '') {
      errors.existingSavings = 'Existing savings is required';
    } else if (isNaN(savings) || savings < 0) {
      errors.existingSavings = 'Existing savings must be ₹0 or more';
    } else if (!isNaN(target) && savings > target) {
      errors.existingSavings = 'Existing savings cannot exceed target amount';
    }

    // Expected return: required, 0-30
    const returnPct = Number(data.expectedReturnPercent);
    if (data.expectedReturnPercent === '') {
      errors.expectedReturnPercent = 'Expected return % is required';
    } else if (isNaN(returnPct) || returnPct < 0 || returnPct > 30) {
      errors.expectedReturnPercent = 'Expected return must be between 0% and 30%';
    }

    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validateForm(formData);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const sessionId = session?.id;
    if (!sessionId) {
      setFormErrors({ goalName: 'No active session. Please load demo data or upload documents first.' });
      return;
    }

    setSubmitting(true);
    setLastResult(null);

    try {
      const newGoal = await goalApi.create(sessionId, {
        goalName: formData.goalName.trim(),
        goalType: formData.goalType,
        targetAmount: Number(formData.targetAmount),
        durationMonths: Number(formData.durationMonths),
        existingSavings: Number(formData.existingSavings),
        expectedReturnPercent: Number(formData.expectedReturnPercent),
      });

      setLastResult(newGoal);
      setGoals((prev) => [...prev, newGoal]);
      setFormData(INITIAL_FORM);
      setFormErrors({});
    } catch (err) {
      if (err instanceof ApiError) {
        const message = typeof err.body === 'object' && err.body && 'message' in err.body
          ? String((err.body as { message: string }).message)
          : `Failed to create goal (${err.status})`;
        setFormErrors({ goalName: message });
      } else {
        setFormErrors({
          goalName: err instanceof Error ? err.message : 'Failed to create goal',
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(goalId: string) {
    const sessionId = session?.id;
    if (!sessionId) return;

    try {
      await goalApi.delete(sessionId, goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      if (lastResult?.id === goalId) {
        setLastResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal');
    }
  }

  function handleFieldChange(field: keyof GoalFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear the error for the field being edited
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-neutral-800 mb-6">Goal Planner</h1>

      {/* Goal Creation Form */}
      <section aria-label="Create a financial goal" className="bg-white rounded-xl border border-neutral-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-neutral-700 mb-4">Create a New Goal</h2>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Goal Name */}
          <div>
            <label htmlFor="goalName" className="block text-sm font-medium text-neutral-700 mb-1">
              Goal Name
            </label>
            <input
              id="goalName"
              type="text"
              maxLength={100}
              value={formData.goalName}
              onChange={(e) => handleFieldChange('goalName', e.target.value)}
              placeholder="e.g., New Car Fund"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                formErrors.goalName ? 'border-red-400' : 'border-neutral-300'
              }`}
              aria-invalid={!!formErrors.goalName}
              aria-describedby={formErrors.goalName ? 'goalName-error' : undefined}
            />
            {formErrors.goalName && (
              <p id="goalName-error" className="mt-1 text-sm text-red-600" role="alert">
                {formErrors.goalName}
              </p>
            )}
          </div>

          {/* Goal Type */}
          <div>
            <label htmlFor="goalType" className="block text-sm font-medium text-neutral-700 mb-1">
              Goal Type
            </label>
            <select
              id="goalType"
              value={formData.goalType}
              onChange={(e) => handleFieldChange('goalType', e.target.value as GoalType)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {GOAL_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Target Amount */}
          <div>
            <label htmlFor="targetAmount" className="block text-sm font-medium text-neutral-700 mb-1">
              Target Amount (₹)
            </label>
            <input
              id="targetAmount"
              type="number"
              min={1}
              max={999999999}
              value={formData.targetAmount}
              onChange={(e) => handleFieldChange('targetAmount', e.target.value)}
              placeholder="e.g., 800000"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                formErrors.targetAmount ? 'border-red-400' : 'border-neutral-300'
              }`}
              aria-invalid={!!formErrors.targetAmount}
              aria-describedby={formErrors.targetAmount ? 'targetAmount-error' : undefined}
            />
            {formErrors.targetAmount && (
              <p id="targetAmount-error" className="mt-1 text-sm text-red-600" role="alert">
                {formErrors.targetAmount}
              </p>
            )}
          </div>

          {/* Duration Months */}
          <div>
            <label htmlFor="durationMonths" className="block text-sm font-medium text-neutral-700 mb-1">
              Duration (months)
            </label>
            <input
              id="durationMonths"
              type="number"
              min={1}
              max={360}
              value={formData.durationMonths}
              onChange={(e) => handleFieldChange('durationMonths', e.target.value)}
              placeholder="e.g., 24"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                formErrors.durationMonths ? 'border-red-400' : 'border-neutral-300'
              }`}
              aria-invalid={!!formErrors.durationMonths}
              aria-describedby={formErrors.durationMonths ? 'durationMonths-error' : undefined}
            />
            {formErrors.durationMonths && (
              <p id="durationMonths-error" className="mt-1 text-sm text-red-600" role="alert">
                {formErrors.durationMonths}
              </p>
            )}
          </div>

          {/* Existing Savings */}
          <div>
            <label htmlFor="existingSavings" className="block text-sm font-medium text-neutral-700 mb-1">
              Existing Savings (₹)
            </label>
            <input
              id="existingSavings"
              type="number"
              min={0}
              value={formData.existingSavings}
              onChange={(e) => handleFieldChange('existingSavings', e.target.value)}
              placeholder="e.g., 100000"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                formErrors.existingSavings ? 'border-red-400' : 'border-neutral-300'
              }`}
              aria-invalid={!!formErrors.existingSavings}
              aria-describedby={formErrors.existingSavings ? 'existingSavings-error' : undefined}
            />
            {formErrors.existingSavings && (
              <p id="existingSavings-error" className="mt-1 text-sm text-red-600" role="alert">
                {formErrors.existingSavings}
              </p>
            )}
          </div>

          {/* Expected Return % */}
          <div>
            <label htmlFor="expectedReturnPercent" className="block text-sm font-medium text-neutral-700 mb-1">
              Expected Annual Return (%)
            </label>
            <input
              id="expectedReturnPercent"
              type="number"
              min={0}
              max={30}
              step="0.1"
              value={formData.expectedReturnPercent}
              onChange={(e) => handleFieldChange('expectedReturnPercent', e.target.value)}
              placeholder="e.g., 8"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                formErrors.expectedReturnPercent ? 'border-red-400' : 'border-neutral-300'
              }`}
              aria-invalid={!!formErrors.expectedReturnPercent}
              aria-describedby={formErrors.expectedReturnPercent ? 'expectedReturnPercent-error' : undefined}
            />
            {formErrors.expectedReturnPercent && (
              <p id="expectedReturnPercent-error" className="mt-1 text-sm text-red-600" role="alert">
                {formErrors.expectedReturnPercent}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Calculating…' : 'Calculate Goal'}
          </button>
        </form>
      </section>

      {/* Latest Result */}
      {lastResult && (
        <section aria-label="Goal calculation result" className="bg-white rounded-xl border border-neutral-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-neutral-700 mb-3">Calculation Result</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <p className="text-sm text-neutral-500">Required Monthly Savings</p>
              <p className="text-xl font-bold text-neutral-800">
                {formatCurrency(lastResult.requiredMonthlySavings)}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Feasibility</p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getFeasibilityColor(lastResult.feasibilityStatus)}`}
                data-testid="feasibility-status"
              >
                {lastResult.feasibilityStatus}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Goals List */}
      <section aria-label="Your financial goals">
        <h2 className="text-lg font-semibold text-neutral-700 mb-4">Your Goals</h2>

        {loading && (
          <div className="text-center py-8" role="status" aria-label="Loading goals">
            <p className="text-neutral-500">Loading goals…</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center" role="alert">
            <p className="text-red-700 mb-2">{error}</p>
            <button
              onClick={fetchGoals}
              className="text-sm text-red-600 underline hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && goals.length === 0 && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-8 text-center" data-testid="empty-state">
            <p className="text-neutral-600 text-lg mb-1">No goals yet</p>
            <p className="text-neutral-500 text-sm">
              Create your first financial goal above to start planning for your future!
            </p>
          </div>
        )}

        {!loading && !error && goals.length > 0 && (
          <div className="space-y-3">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="bg-white rounded-lg border border-neutral-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                data-testid="goal-item"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-neutral-800 truncate">{goal.goalName}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-neutral-500">
                    <span>Target: {formatCurrency(goal.targetAmount)}</span>
                    <span>{goal.durationMonths} months</span>
                    <span>Monthly: {formatCurrency(goal.requiredMonthlySavings)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getFeasibilityColor(goal.feasibilityStatus)}`}
                  >
                    {goal.feasibilityStatus}
                  </span>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    aria-label={`Delete goal ${goal.goalName}`}
                    className="p-1.5 text-neutral-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
