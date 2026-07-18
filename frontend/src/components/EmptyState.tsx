import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

interface EmptyStateProps {
  /** Title text displayed prominently */
  title?: string;
  /** Descriptive text below the title */
  description?: string;
  /** Handler for loading demo data */
  onLoadDemo?: () => void;
  /** Whether to show the upload button */
  showUpload?: boolean;
  /** Whether to show the demo data button */
  showDemo?: boolean;
}

/**
 * Reusable empty state component for pages with no data.
 * Shows an icon, title, description, and two CTAs:
 * - "Upload Documents" navigates to /upload
 * - "Try Demo Data" triggers loading demo data
 *
 * Accessibility:
 * - Logical tab order (upload first, demo second)
 * - Visible focus indicators via focus-visible
 * - Descriptive aria-labels on buttons
 * - role="status" for non-urgent empty state notification
 *
 * Validates: Requirements 12.1, 12.3, 12.5
 */
export function EmptyState({
  title = 'No financial data available',
  description = 'Upload your salary slips and bank statements to get personalized financial insights, or try our demo data to explore the features.',
  onLoadDemo,
  showUpload = true,
  showDemo = true,
}: EmptyStateProps) {
  const navigate = useNavigate();
  const { setSession } = useSession();

  const handleUpload = () => {
    navigate('/upload');
  };

  const handleLoadDemo = async () => {
    if (onLoadDemo) {
      onLoadDemo();
    } else {
      // Default demo loading behavior using proper API
      try {
        const { sessionApi } = await import('../services/api');
        const session = await sessionApi.create();
        await sessionApi.loadDemo(session.id);
        setSession({ id: session.id, isDemoActive: true });
        navigate('/dashboard');
      } catch {
        // If API unavailable, navigate to landing page to use the demo button there
        navigate('/');
      }
    }
  };

  return (
    <div
      role="status"
      aria-label={title}
      className="py-16 px-4 text-center"
    >
      {/* Illustration icon */}
      <div className="w-20 h-20 mb-6 rounded-full bg-primary-50 flex items-center justify-center mx-auto">
        <svg
          className="w-10 h-10 text-primary-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>

      <h2 className="text-2xl font-semibold text-neutral-800 mb-2">
        {title}
      </h2>

      <p className="text-neutral-600 mb-8">
        {description}
      </p>

      <div className="flex justify-center gap-3 flex-wrap">
        {showUpload && (
          <button
            onClick={handleUpload}
            className="px-6 py-3 rounded-lg bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 transition-colors"
            aria-label="Upload your financial documents"
          >
            Upload Documents
          </button>
        )}
        {showDemo && (
          <button
            onClick={handleLoadDemo}
            className="px-6 py-3 rounded-lg border border-primary-600 text-primary-700 font-medium text-sm hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 transition-colors"
            aria-label="Try demo data to explore features"
          >
            Try Demo Data
          </button>
        )}
      </div>
    </div>
  );
}
