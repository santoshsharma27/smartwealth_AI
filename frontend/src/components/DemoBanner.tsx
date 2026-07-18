import { useSession } from '../context/SessionContext';
import { useNavigate } from 'react-router-dom';

/**
 * Persistent banner displayed on all pages when demo data is active.
 * Visible without scrolling. Shows "You are viewing demo data" with an Exit Demo button.
 * Validates: Requirement 10.4
 */
export function DemoBanner() {
  const { isDemoActive, exitDemo } = useSession();
  const navigate = useNavigate();

  if (!isDemoActive) {
    return null;
  }

  const handleExitDemo = () => {
    exitDemo();
    navigate('/');
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-warning-100 border-b border-warning-500 px-4 py-2 flex items-center justify-between text-sm"
    >
      <span className="font-medium text-warning-700">
        You are viewing demo data
      </span>
      <button
        onClick={handleExitDemo}
        className="px-3 py-1 rounded-md bg-warning-600 text-white font-medium text-xs hover:bg-warning-700 focus:outline-none focus:ring-2 focus:ring-warning-500 focus:ring-offset-1 transition-colors"
        aria-label="Exit demo mode and return to landing page"
      >
        Exit Demo
      </button>
    </div>
  );
}
