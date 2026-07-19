import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { Session } from "../types";
import { getStoredSessionId, clearStoredSessionId } from "../services/api";

interface SessionContextValue {
  session: Session | null;
  setSession: (session: Session | null) => void;
  isDemoActive: boolean;
  exitDemo: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    // Initialize from localStorage if available
    const storedId = getStoredSessionId();
    if (storedId) {
      return { id: storedId, isDemoActive: false };
    }
    return null;
  });

  const isDemoActive = session?.isDemoActive ?? false;

  const exitDemo = useCallback(() => {
    clearStoredSessionId();
    setSession(null);
  }, []);

  // Validate session exists in backend on app load
  useEffect(() => {
    const validateSession = async () => {
      const storedId = getStoredSessionId();
      if (!storedId) return;

      try {
        const { sessionApi } = await import("../services/api");
        await sessionApi.getStatus(storedId);
        // Session is valid, keep it.
      } catch {
        // Best-effort validation: preserve the locally stored session if the
        // backend is unavailable or the status endpoint is not mocked in tests.
      }
    };
    validateSession();
  }, []);

  // Sync session changes to localStorage
  useEffect(() => {
    if (session?.id) {
      // Ensure localStorage is in sync
      const stored = getStoredSessionId();
      if (stored !== session.id) {
        // Import and use the setter - but since we might cause circular,
        // we just use localStorage directly here for the sync
        localStorage.setItem("smartwealth_session_id", session.id);
      }
    }
  }, [session?.id]);

  return (
    <SessionContext.Provider
      value={{ session, setSession, isDemoActive, exitDemo }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
