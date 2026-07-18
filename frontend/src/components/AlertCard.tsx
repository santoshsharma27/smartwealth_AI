/**
 * AlertCard component for displaying recurring expenses and unusual spending alerts.
 * Validates: Requirements 13.3
 */
import { formatINR } from './SummaryCard';

export interface RecurringExpenseAlertProps {
  type: 'recurring';
  description: string;
  recurringAmount: number;
  consecutiveMonths: number;
}

export interface SpendingAnomalyAlertProps {
  type: 'anomaly';
  description: string;
  transactionAmount: number;
  category: string;
  categoryAverage: number;
}

export type AlertCardProps = RecurringExpenseAlertProps | SpendingAnomalyAlertProps;

export function AlertCard(props: AlertCardProps) {
  if (props.type === 'recurring') {
    return (
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-900 truncate">
            {props.description}
          </p>
          <p className="text-sm text-blue-700 mt-0.5">
            {formatINR(props.recurringAmount)} &middot; {props.consecutiveMonths} consecutive months
          </p>
        </div>
      </div>
    );
  }

  // Anomaly type
  return (
    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex-shrink-0 mt-0.5">
        <svg
          className="w-5 h-5 text-amber-600"
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
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900 truncate">
          {props.description}
        </p>
        <p className="text-sm text-amber-700 mt-0.5">
          {formatINR(props.transactionAmount)} in {props.category} (avg: {formatINR(props.categoryAverage)})
        </p>
      </div>
    </div>
  );
}
