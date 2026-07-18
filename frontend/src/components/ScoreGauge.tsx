/**
 * Financial Health Score display (0-100) with status label and color coding.
 * Uses a circular gauge visualization with SVG arc.
 * Includes a visually hidden data table for screen reader accessibility.
 * Validates: Requirement 5.3, 12.4
 */

export interface ScoreGaugeProps {
  score: number;
  statusLabel: 'Needs Attention' | 'Fair' | 'Good' | 'Very Good' | 'Excellent';
  /** Optional component breakdown for accessible table */
  components?: {
    savingsRatio?: { score: number; maxScore: number };
    expenseControl?: { score: number; maxScore: number };
    emiBurden?: { score: number; maxScore: number };
    investmentAllocation?: { score: number; maxScore: number };
    emergencyFundReadiness?: { score: number; maxScore: number };
  };
}

function getScoreColor(score: number): string {
  if (score <= 30) return '#ef4444'; // red
  if (score <= 50) return '#f59e0b'; // yellow/amber
  if (score <= 70) return '#3b82f6'; // blue
  if (score <= 85) return '#22c55e'; // green
  return '#059669'; // emerald (excellent)
}

function getStatusColorClass(score: number): string {
  if (score <= 30) return 'text-red-600';
  if (score <= 50) return 'text-amber-600';
  if (score <= 70) return 'text-blue-600';
  if (score <= 85) return 'text-green-600';
  return 'text-emerald-600';
}

export function ScoreGauge({ score, statusLabel, components }: ScoreGaugeProps) {
  const color = getScoreColor(score);
  const statusColorClass = getStatusColorClass(score);

  // SVG arc parameters
  const radius = 60;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees
  const filledLength = (score / 100) * arcLength;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm flex flex-col items-center">
      <h3 className="text-lg font-semibold text-neutral-800 mb-4">Financial Health Score</h3>

      <div className="relative w-40 h-40" aria-hidden="true">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-[135deg]">
          {/* Background arc */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${filledLength} ${circumference}`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>

        {/* Score number centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold text-neutral-900">{score}</span>
        </div>
      </div>

      <p
        className={`mt-2 text-base font-semibold ${statusColorClass}`}
        aria-label={`Financial Health Score: ${score} out of 100, status: ${statusLabel}`}
      >
        {statusLabel}
      </p>

      {/* Visually hidden data table for screen readers (WCAG 12.4) */}
      <table className="sr-only" aria-label="Financial Health Score breakdown">
        <caption>Financial Health Score: {score} out of 100 - {statusLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col">Score</th>
            <th scope="col">Maximum</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total Score</td>
            <td>{score}</td>
            <td>100</td>
          </tr>
          {components?.savingsRatio && (
            <tr>
              <td>Savings Ratio</td>
              <td>{components.savingsRatio.score}</td>
              <td>{components.savingsRatio.maxScore}</td>
            </tr>
          )}
          {components?.expenseControl && (
            <tr>
              <td>Expense Control</td>
              <td>{components.expenseControl.score}</td>
              <td>{components.expenseControl.maxScore}</td>
            </tr>
          )}
          {components?.emiBurden && (
            <tr>
              <td>EMI Burden</td>
              <td>{components.emiBurden.score}</td>
              <td>{components.emiBurden.maxScore}</td>
            </tr>
          )}
          {components?.investmentAllocation && (
            <tr>
              <td>Investment Allocation</td>
              <td>{components.investmentAllocation.score}</td>
              <td>{components.investmentAllocation.maxScore}</td>
            </tr>
          )}
          {components?.emergencyFundReadiness && (
            <tr>
              <td>Emergency Fund Readiness</td>
              <td>{components.emergencyFundReadiness.score}</td>
              <td>{components.emergencyFundReadiness.maxScore}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
