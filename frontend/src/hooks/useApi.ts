/**
 * SmartWealth AI - useApi Hook
 *
 * Custom hook providing loading/error state management for API calls.
 * Usable from any component without prop drilling.
 */

import { useState, useCallback, useRef } from 'react';
import { ApiError } from '../services/api';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | Error | null;
}

export interface UseApiReturn<T> extends ApiState<T> {
  execute: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
}

/**
 * Hook that wraps an async API function with loading, error, and data state.
 *
 * @example
 * ```tsx
 * const { data, loading, error, execute } = useApi(
 *   (sessionId: string) => financialApi.getSummary(sessionId)
 * );
 *
 * useEffect(() => { execute(session.id); }, [session.id, execute]);
 * ```
 */
export function useApi<T, Args extends unknown[] = unknown[]>(
  apiFn: (...args: Args) => Promise<T>,
): UseApiReturn<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  // Track the current request to handle race conditions
  const requestId = useRef(0);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      const currentRequestId = ++requestId.current;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await apiFn(...(args as Args));

        // Only update state if this is still the latest request
        if (currentRequestId === requestId.current) {
          setState({ data: result, loading: false, error: null });
        }
        return result;
      } catch (err) {
        const error =
          err instanceof ApiError || err instanceof Error
            ? err
            : new Error(String(err));

        if (currentRequestId === requestId.current) {
          setState({ data: null, loading: false, error });
        }
        return null;
      }
    },
    [apiFn],
  );

  const reset = useCallback(() => {
    requestId.current++;
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}

/**
 * Hook for mutations (POST/PUT/DELETE) that don't persist data in state.
 * Returns execute function with loading/error tracking.
 *
 * @example
 * ```tsx
 * const { execute: deleteGoal, loading } = useMutation(
 *   (goalId: string) => goalApi.delete(session.id, goalId)
 * );
 * ```
 */
export function useMutation<T, Args extends unknown[] = unknown[]>(
  apiFn: (...args: Args) => Promise<T>,
): {
  execute: (...args: unknown[]) => Promise<T | null>;
  loading: boolean;
  error: ApiError | Error | null;
  reset: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiFn(...(args as Args));
        setLoading(false);
        return result;
      } catch (err) {
        const apiError =
          err instanceof ApiError || err instanceof Error
            ? err
            : new Error(String(err));
        setError(apiError);
        setLoading(false);
        return null;
      }
    },
    [apiFn],
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return { execute, loading, error, reset };
}
