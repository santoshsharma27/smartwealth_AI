import { useState, useCallback } from "react";
import { useSession } from "../context/SessionContext";
import { reportApi, ApiError } from "../services/api";

/** Possible states for report generation */
type ReportStatus = "idle" | "generating" | "success" | "error";

/** Sections that will be included in the report */
const REPORT_SECTIONS = [
  {
    title: "Income Summary",
    description: "Monthly gross and net salary breakdown",
  },
  {
    title: "Expense Summary",
    description: "Total expenses with category-wise breakdown",
  },
  {
    title: "Savings Analysis",
    description: "Monthly savings amount and savings rate trends",
  },
  {
    title: "Financial Health Score",
    description: "Overall score (0–100) with component breakdown",
  },
  {
    title: "Key Financial Risks",
    description: "Components scoring below 50% of maximum points",
  },
  {
    title: "AI Recommendations",
    description: "Personalized, actionable financial suggestions",
  },
  {
    title: "Goal Plan Summary",
    description: "Your financial goals with feasibility status",
  },
  {
    title: "Next Action Items",
    description: "Top 5 prioritized steps to improve your finances",
  },
] as const;

const TIMEOUT_MS = 15_000;

/**
 * ReportPage component — allows users to preview report contents
 * and generate/download a PDF financial report.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */
export function ReportPage() {
  const { session } = useSession();
  const [status, setStatus] = useState<ReportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const hasSession = Boolean(session?.id);

  const generateReport = useCallback(async () => {
    if (!session?.id) return;

    setStatus("generating");
    setErrorMessage("");

    try {
      // Race the report generation against a timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const err = new Error(
            "Report generation timed out. Please try again.",
          );
          err.name = "TimeoutError";
          reject(err);
        }, TIMEOUT_MS);
      });

      const blob = await Promise.race([
        reportApi.generate(session.id),
        timeoutPromise,
      ]);

      // Download the PDF blob
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "smartwealth-report.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatus("success");
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.name === "AbortError" || err.name === "TimeoutError")
      ) {
        setErrorMessage("Report generation timed out. Please try again.");
      } else if (err instanceof ApiError) {
        if (err.status === 504) {
          setErrorMessage("Report generation timed out. Please try again.");
        } else {
          setErrorMessage(
            `Report generation failed (${err.status}). Please retry.`,
          );
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Report generation failed. Please retry.");
      }
      setStatus("error");
    }
  }, [session?.id]);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-neutral-800 mb-6">
        Financial Report
      </h1>

      {/* Report Preview Section */}
      <section
        aria-label="Report Preview"
        className="border border-neutral-200 rounded-lg p-6 mb-6 bg-white shadow-sm"
      >
        <h2 className="text-lg font-semibold text-neutral-700 mb-4">
          Report Contents Preview
        </h2>
        <p className="text-sm text-neutral-500 mb-4">
          Your downloadable report will include the following sections:
        </p>
        <ul className="space-y-3">
          {REPORT_SECTIONS.map((section) => (
            <li key={section.title} className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />
              <div>
                <span className="font-medium text-neutral-800">
                  {section.title}
                </span>
                <p className="text-sm text-neutral-500">
                  {section.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Status Messages */}
      {status === "generating" && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 p-4 mb-4 bg-indigo-50 rounded-lg"
        >
          <svg
            className="animate-spin h-5 w-5 text-indigo-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span className="text-indigo-700 font-medium">
            Generating your report...
          </span>
        </div>
      )}

      {status === "success" && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 mb-4 bg-green-50 border border-green-200 rounded-lg text-green-700"
        >
          Report downloaded successfully.
        </div>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
        >
          {errorMessage}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {(status === "idle" || status === "success" || status === "error") && (
          <button
            onClick={generateReport}
            disabled={!hasSession || status === "generating"}
            className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Generate Report
          </button>
        )}

        {status === "error" && (
          <button
            onClick={generateReport}
            className="px-6 py-2.5 border border-indigo-600 text-indigo-600 font-medium rounded-lg hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            Retry
          </button>
        )}
      </div>

      {!hasSession && (
        <p className="mt-3 text-sm text-neutral-500">
          Upload documents or load demo data to generate a report.
        </p>
      )}
    </div>
  );
}
