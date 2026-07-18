import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { sessionApi, getStoredSessionId } from '../services/api';

interface FeatureCard {
  emoji: string;
  name: string;
  description: string;
}

const features: FeatureCard[] = [
  {
    emoji: '📄',
    name: 'Smart Document Parsing',
    description:
      'Automatically extract financial data from salary slips and bank statements.',
  },
  {
    emoji: '🏷️',
    name: 'AI Expense Categorization',
    description:
      'Transactions categorized into 12 spending categories using AI and rules.',
  },
  {
    emoji: '📊',
    name: 'Financial Health Score',
    description:
      'Get a 0–100 wellness score based on savings, expenses, and investments.',
  },
  {
    emoji: '🎯',
    name: 'Goal Planning',
    description:
      'Set financial goals and see monthly savings needed with feasibility analysis.',
  },
  {
    emoji: '🤖',
    name: 'AI Finance Chatbot',
    description:
      'Ask questions about your finances and get personalized, data-driven answers.',
  },
  {
    emoji: '📥',
    name: 'Downloadable Reports',
    description:
      'Generate comprehensive PDF reports with scores, risks, and action items.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { setSession } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTryDemo() {
    setIsLoading(true);
    setError(null);

    try {
      // Create a session if one doesn't exist
      let sessionId = getStoredSessionId();

      if (!sessionId) {
        const session = await sessionApi.create();
        sessionId = session.id;
      }

      // Load demo data
      await sessionApi.loadDemo(sessionId);

      // Update session context with demo active state
      setSession({ id: sessionId, isDemoActive: true });

      navigate('/dashboard');
    } catch {
      setError(
        'Demo data could not be loaded. Please try again or upload your own documents.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-primary-700 mb-3">
          SmartWealth AI
        </h1>
        <p className="text-xl md:text-2xl text-neutral-600 mb-4">
          Your AI-powered personal financial copilot
        </p>
        <p className="text-neutral-500 max-w-xl mb-8">
          Upload salary slips and bank statements to get instant insights,
          expense categorization, a Financial Health Score, personalized
          recommendations, and goal planning — all powered by AI.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <button
            onClick={() => navigate('/upload')}
            className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-2 focus:outline-offset-2 focus:outline-primary-500 transition-colors"
          >
            Upload Documents
          </button>
          <button
            onClick={handleTryDemo}
            disabled={isLoading}
            aria-busy={isLoading}
            className="px-6 py-3 bg-success-600 text-white font-medium rounded-lg hover:bg-success-700 focus:outline-2 focus:outline-offset-2 focus:outline-success-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading Demo…' : 'Try Demo Data'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <p role="alert" className="text-danger-600 text-sm max-w-md">
            {error}
          </p>
        )}
      </section>

      {/* Feature Cards */}
      <section
        aria-label="Features"
        className="bg-white border-t border-neutral-200 px-4 py-16"
      >
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-neutral-800 text-center mb-10">
            What SmartWealth AI Can Do
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.name}
                className="p-6 rounded-xl border border-neutral-200 hover:border-primary-300 hover:shadow-sm transition-all"
              >
                <span className="text-3xl mb-3 block" aria-hidden="true">
                  {feature.emoji}
                </span>
                <h3 className="text-lg font-medium text-neutral-800 mb-2">
                  {feature.name}
                </h3>
                <p className="text-neutral-500 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default LandingPage;
