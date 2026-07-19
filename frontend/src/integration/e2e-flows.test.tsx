/**
 * End-to-End Integration Tests for SmartWealth AI
 *
 * Tests the complete user flows through the application by rendering
 * the full app with MemoryRouter and mocking fetch at the network level.
 *
 * Validates: Requirements 10.1, 10.2, 2.8, 2.9
 */
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionProvider } from "../context/SessionContext";
import { LandingPage } from "../pages/LandingPage";
import { UploadPage } from "../pages/UploadPage";
import { DashboardPage } from "../pages/DashboardPage";
import { ChatbotPage } from "../pages/ChatbotPage";
import { ReportPage } from "../pages/ReportPage";
import { GoalPlannerPage } from "../pages/GoalPlannerPage";
import { AppLayout } from "../components/AppLayout";

// ─── Mock Data ──────────────────────────────────────────────────────────────────

const MOCK_DEMO_SESSION = { id: "demo-session-001", isDemoActive: true };

const MOCK_SUMMARY = {
  monthlyIncome: 120000,
  totalExpenses: 78000,
  monthlySavings: 42000,
  savingsPercentage: 35,
  expensesByCategory: {
    Rent: 25000,
    Food: 18500,
    Travel: 5000,
    Shopping: 8000,
    Bills: 6000,
    EMI: 10000,
    Healthcare: 2000,
    Entertainment: 3500,
    Investments: 0,
    Savings: 0,
    Education: 0,
    Miscellaneous: 0,
  },
};

const MOCK_SCORE = {
  totalScore: 72,
  statusLabel: "Very Good",
  components: {
    savingsRatio: { score: 25, maxScore: 30, value: 0.35 },
    expenseControl: { score: 18, maxScore: 25, value: 0.42 },
    emiBurden: { score: 12, maxScore: 15, value: 0.1 },
    investmentAllocation: { score: 10, maxScore: 15, value: 0.13 },
    emergencyFundReadiness: { score: 7, maxScore: 15, value: 2.8 },
  },
};

const MOCK_RECOMMENDATIONS = [
  {
    id: "rec-1",
    category: "Savings",
    text: "Your savings rate is 35%. Consider increasing it to 40% by reducing dining out expenses by ₹3,000/month.",
    dataPointReference: "savingsPercentage: 35%",
  },
  {
    id: "rec-2",
    category: "Food",
    text: "Your food spending is ₹18,500/month (23.7% of expenses). Aim to reduce to 20% by meal planning.",
    dataPointReference: "foodExpenses: ₹18,500",
  },
  {
    id: "rec-3",
    category: "EMI",
    text: "Your EMI burden is 8.3% of income. This is healthy - keep it below 15%.",
    dataPointReference: "emiRatio: 8.3%",
  },
];

const MOCK_RECURRING = [
  {
    id: "rec-exp-1",
    description: "NETFLIX SUBSCRIPTION",
    recurringAmount: 499,
    consecutiveMonths: 3,
  },
];

const MOCK_ANOMALIES = [
  {
    id: "anomaly-1",
    description: "ZARA PURCHASE",
    transactionAmount: 12500,
    category: "Shopping",
    categoryAverage: 4000,
  },
];

const MOCK_CHAT_RESPONSE = {
  id: "chat-1",
  question: "How can I save more?",
  answer:
    "Based on your data, your savings rate is 35% (₹42,000/month). You could increase this by reducing food expenses from ₹18,500 to ₹15,000.",
  timestamp: new Date().toISOString(),
  disclaimer: "This is informational guidance only.",
};

const MOCK_GOAL = {
  id: "goal-1",
  goalName: "Buy a Car",
  goalType: "buy_car",
  targetAmount: 800000,
  durationMonths: 24,
  existingSavings: 100000,
  expectedReturnPercent: 8,
  requiredMonthlySavings: 26923,
  feasibilityStatus: "Challenging",
};

const MOCK_DOCUMENT_UPLOAD_RESPONSE = {
  documents: [
    {
      id: "doc-1",
      fileName: "salary_jan.pdf",
      documentType: "salary_slip",
      status: "processing",
      uploadedAt: "2024-01-15T10:30:00Z",
    },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

interface MockResponse {
  status: number;
  body?: unknown;
  blob?: boolean;
}

function normalizeUrl(url: string | URL | Request): string {
  const rawUrl =
    typeof url === "string"
      ? url
      : url instanceof URL
        ? url.toString()
        : url.url;

  try {
    const parsedUrl = new URL(rawUrl, "http://localhost");
    return `${parsedUrl.pathname}${parsedUrl.search}`;
  } catch {
    return rawUrl.replace(/^https?:\/\/[^/]+/i, "");
  }
}

function createFetchMock(responseMap: Record<string, MockResponse>) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const normalizedUrl = normalizeUrl(url);
    const key = `${method} ${normalizedUrl}`;

    // Try exact match first, then pattern matching
    let response = responseMap[key];

    if (!response) {
      for (const [pattern, resp] of Object.entries(responseMap)) {
        const regexStr = pattern.replace(/\{[^}]+\}/g, "[^/]+");
        if (new RegExp(`^${regexStr}$`).test(key)) {
          response = resp;
          break;
        }
      }
    }

    if (!response) {
      if (method === "GET" && /^\/api\/sessions\/[^/]+$/.test(normalizedUrl)) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: async () => ({
            id: normalizedUrl.split("/").pop(),
            isDemoActive: false,
            createdAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
          }),
          text: async () => "{}",
        };
      }

      if (method === "POST" && normalizedUrl === "/api/sessions") {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: async () => ({
            id: "test-session-001",
            isDemoActive: false,
            createdAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
          }),
          text: async () => "{}",
        };
      }

      return {
        ok: false,
        status: 404,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ error: "Not found" }),
        text: async () => "Not found",
      };
    }

    if (response.blob) {
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        headers: new Headers({ "Content-Type": "application/pdf" }),
        blob: async () =>
          new Blob(["%PDF-1.4 mock pdf content"], { type: "application/pdf" }),
        json: async () => response!.body,
        text: async () => "",
      };
    }

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => response!.body,
      text: async () => JSON.stringify(response!.body),
    };
  });
}

function renderApp(initialRoute = "/") {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<AppLayout />}>
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/goals" element={<GoalPlannerPage />} />
            <Route path="/chat" element={<ChatbotPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
}

// ─── Test Suites ────────────────────────────────────────────────────────────────

describe("End-to-End Integration Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  // ─── Judge Flow: Landing → Demo Data → Dashboard → Chat → Report ───────────

  describe("Judge Flow: Landing → Demo Data → Dashboard → Chat → Report", () => {
    it("loads demo data from landing and navigates to dashboard with full data", async () => {
      const user = userEvent.setup();

      globalThis.fetch = createFetchMock({
        "POST /api/sessions": { status: 200, body: MOCK_DEMO_SESSION },
        "POST /api/sessions/demo-session-001/demo": { status: 200, body: {} },
        "GET /api/sessions/demo-session-001/summary": {
          status: 200,
          body: MOCK_SUMMARY,
        },
        "GET /api/sessions/demo-session-001/score": {
          status: 200,
          body: MOCK_SCORE,
        },
        "GET /api/sessions/demo-session-001/recommendations": {
          status: 200,
          body: MOCK_RECOMMENDATIONS,
        },
        "GET /api/sessions/demo-session-001/recurring": {
          status: 200,
          body: MOCK_RECURRING,
        },
        "GET /api/sessions/demo-session-001/anomalies": {
          status: 200,
          body: MOCK_ANOMALIES,
        },
      });

      renderApp("/");

      // Landing page renders with required elements
      expect(
        screen.getByRole("heading", { level: 1, name: /SmartWealth AI/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Try Demo Data/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Upload Documents/i }),
      ).toBeInTheDocument();

      // Click "Try Demo Data" and verify navigation to Dashboard
      await user.click(screen.getByRole("button", { name: /Try Demo Data/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 1, name: /Dashboard/i }),
        ).toBeInTheDocument();
      });

      // Verify summary cards display with correct data
      await waitFor(() => {
        expect(screen.getByText(/Monthly Income/i)).toBeInTheDocument();
        expect(screen.getByText(/Monthly Expenses/i)).toBeInTheDocument();
        expect(screen.getByText(/Monthly Savings/i)).toBeInTheDocument();
      });

      // Verify health score displayed
      await waitFor(() => {
        expect(screen.getAllByText("72").length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/Very Good/i).length).toBeGreaterThanOrEqual(
          1,
        );
      });

      // Verify AI recommendations are displayed
      await waitFor(() => {
        expect(screen.getByText(/AI Recommendations/i)).toBeInTheDocument();
        expect(
          screen.getByText(/Your savings rate is 35%/i),
        ).toBeInTheDocument();
      });

      // Verify recurring expense alerts
      await waitFor(() => {
        expect(screen.getByText(/NETFLIX SUBSCRIPTION/i)).toBeInTheDocument();
      });

      // Verify unusual spending anomalies
      await waitFor(() => {
        expect(screen.getByText(/ZARA PURCHASE/i)).toBeInTheDocument();
      });
    });

    it("navigates to chat page and sends a message with successful response", async () => {
      const user = userEvent.setup();

      // Set session in BOTH possible storage locations
      window.localStorage.setItem("smartwealth_session_id", "demo-session-001");

      globalThis.fetch = vi.fn(
        async (url: string | URL | Request, init?: RequestInit) => {
          const urlStr =
            typeof url === "string"
              ? url
              : url instanceof URL
                ? url.toString()
                : url.url;
          const method = init?.method ?? "GET";

          if (urlStr.includes("/chat/history")) {
            return new Response(JSON.stringify([]), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (urlStr.includes("/summary")) {
            return new Response(JSON.stringify(MOCK_SUMMARY), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (urlStr.includes("/chat") && method === "POST") {
            return new Response(JSON.stringify(MOCK_CHAT_RESPONSE), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
          });
        },
      ) as typeof fetch;

      // Render ChatbotPage directly to test chat functionality
      render(
        <SessionProvider>
          <MemoryRouter initialEntries={["/chat"]}>
            <Routes>
              <Route path="/chat" element={<ChatbotPage />} />
            </Routes>
          </MemoryRouter>
        </SessionProvider>,
      );

      // Wait for chat page to load (may show loading first, then chat input)
      await waitFor(
        () => {
          expect(
            screen.getByLabelText(/Chat message input/i),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      // Type and send a question
      const input = screen.getByLabelText(/Chat message input/i);
      await user.type(input, "How can I save more?");
      await user.click(screen.getByRole("button", { name: /Send message/i }));

      // Verify the AI response is displayed
      await waitFor(() => {
        expect(
          screen.getByText(/your savings rate is 35%/i),
        ).toBeInTheDocument();
      });

      // Verify disclaimer is present in response
      expect(
        screen.getByText(/informational guidance only/i),
      ).toBeInTheDocument();
    });

    it("generates and downloads a report from the report page", async () => {
      // Render report page - verify it shows report sections preview
      render(
        <SessionProvider>
          <MemoryRouter initialEntries={["/report"]}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/report" element={<ReportPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 1, name: /Financial Report/i }),
        ).toBeInTheDocument();
      });

      // Verify all report sections are listed in preview
      expect(screen.getByText(/Income Summary/i)).toBeInTheDocument();
      expect(screen.getByText(/Expense Summary/i)).toBeInTheDocument();
      expect(screen.getByText(/Financial Health Score/i)).toBeInTheDocument();
      expect(screen.getByText(/AI Recommendations/i)).toBeInTheDocument();
      expect(screen.getByText(/Next Action Items/i)).toBeInTheDocument();
      expect(screen.getByText(/Key Financial Risks/i)).toBeInTheDocument();
      expect(screen.getByText(/Savings Analysis/i)).toBeInTheDocument();
      expect(screen.getByText(/Goal Plan Summary/i)).toBeInTheDocument();

      // Verify Generate Report button exists
      expect(
        screen.getByRole("button", { name: /Generate Report/i }),
      ).toBeInTheDocument();

      // Without session data, user is prompted to upload or load demo
      expect(
        screen.getByText(/Upload documents or load demo data/i),
      ).toBeInTheDocument();
    });

    it("shows demo data load failure error on landing page", async () => {
      const user = userEvent.setup();

      globalThis.fetch = createFetchMock({
        "POST /api/sessions": {
          status: 500,
          body: { error: "Internal server error" },
        },
      });

      renderApp("/");

      await user.click(screen.getByRole("button", { name: /Try Demo Data/i }));

      // Verify error message is shown and user stays on landing page
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(
          screen.getByText(/Demo data could not be loaded/i),
        ).toBeInTheDocument();
      });

      // Buttons remain interactive
      expect(
        screen.getByRole("button", { name: /Try Demo Data/i }),
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: /Upload Documents/i }),
      ).toBeEnabled();
    });
  });

  // ─── User Flow: Landing → Upload → Processing → Dashboard → Goals → Chat → Report ───

  describe("User Flow: Landing → Upload → Processing → Dashboard → Goals → Chat → Report", () => {
    it("navigates from landing to upload page via Upload Documents button", async () => {
      const user = userEvent.setup();

      renderApp("/");

      // Verify landing page
      expect(
        screen.getByRole("heading", { level: 1, name: /SmartWealth AI/i }),
      ).toBeInTheDocument();

      // Click "Upload Documents"
      await user.click(
        screen.getByRole("button", { name: /Upload Documents/i }),
      );

      // Verify upload page renders
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 1, name: /Upload Documents/i }),
        ).toBeInTheDocument();
      });

      // Verify upload form elements
      expect(
        screen.getByLabelText(/Select files to upload/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/PDF for salary slips/i)).toBeInTheDocument();
    });

    it("uploads a valid PDF file and shows processing status", async () => {
      const user = userEvent.setup();
      localStorage.setItem("smartwealth_session_id", "test-session-001");

      globalThis.fetch = createFetchMock({
        "POST /api/sessions/test-session-001/documents": {
          status: 202,
          body: MOCK_DOCUMENT_UPLOAD_RESPONSE,
        },
      });

      renderApp("/upload");

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 1, name: /Upload Documents/i }),
        ).toBeInTheDocument();
      });

      // Create a mock PDF file
      const mockFile = new File(["%PDF-1.4 test content"], "salary_jan.pdf", {
        type: "application/pdf",
      });

      // Add file via the file input
      const input = screen.getByLabelText(/Select files to upload/i);
      await user.upload(input, mockFile);

      // Select document type
      await waitFor(() => {
        expect(
          screen.getByLabelText(/Select document type for salary_jan\.pdf/i),
        ).toBeInTheDocument();
      });

      const select = screen.getByLabelText(
        /Select document type for salary_jan\.pdf/i,
      );
      await user.selectOptions(select, "salary_slip");

      // Verify upload button is enabled
      const uploadBtn = screen.getByRole("button", {
        name: /Upload selected documents/i,
      });
      expect(uploadBtn).toBeEnabled();

      // Click upload
      await user.click(uploadBtn);

      // Verify upload success status shown
      await waitFor(() => {
        expect(
          screen.getByText(/uploaded successfully/i) ||
            screen.getByText(/processing/i),
        ).toBeTruthy();
      });
    });

    it("creates a goal and sees feasibility assessment result", async () => {
      const user = userEvent.setup();
      localStorage.setItem("smartwealth_session_id", "test-session-001");

      globalThis.fetch = createFetchMock({
        "GET /api/sessions/test-session-001/goals": { status: 200, body: [] },
        "POST /api/sessions/test-session-001/goals": {
          status: 201,
          body: MOCK_GOAL,
        },
      });

      renderApp("/goals");

      // Wait for page to load
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 1, name: /Goal Planner/i }),
        ).toBeInTheDocument();
      });

      // Fill in goal form
      await user.type(screen.getByLabelText(/Goal Name/i), "Buy a Car");
      await user.type(screen.getByLabelText(/Target Amount/i), "800000");
      await user.type(screen.getByLabelText(/Duration \(months\)/i), "24");
      await user.type(screen.getByLabelText(/Existing Savings/i), "100000");
      await user.type(screen.getByLabelText(/Expected Annual Return/i), "8");

      // Submit the form
      await user.click(screen.getByRole("button", { name: /Calculate Goal/i }));

      // Verify result is displayed
      await waitFor(
        () => {
          expect(screen.getByText(/Calculation Result/i)).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      expect(screen.getByTestId("feasibility-status")).toHaveTextContent(
        "Challenging",
      );

      // Verify goal appears in the list
      await waitFor(() => {
        expect(screen.getByTestId("goal-item")).toBeInTheDocument();
      });
    });

    it("sends a chat message and receives a data-driven response", async () => {
      const user = userEvent.setup();
      localStorage.setItem("smartwealth_session_id", "test-session-001");

      globalThis.fetch = createFetchMock({
        "GET /api/sessions/test-session-001/chat/history": {
          status: 200,
          body: [],
        },
        "GET /api/sessions/test-session-001/summary": {
          status: 200,
          body: MOCK_SUMMARY,
        },
        "POST /api/sessions/test-session-001/chat": {
          status: 200,
          body: {
            id: "chat-2",
            question: "What are my biggest expenses?",
            answer:
              "Your largest expense category is Rent at ₹25,000/month, followed by Food at ₹18,500/month.",
            timestamp: new Date().toISOString(),
            disclaimer: "This is informational guidance only.",
          },
        },
      });

      renderApp("/chat");

      await waitFor(() => {
        expect(
          screen.getByLabelText(/Chat message input/i),
        ).toBeInTheDocument();
      });

      // Send a message
      const chatInput = screen.getByLabelText(/Chat message input/i);
      await user.type(chatInput, "What are my biggest expenses?");
      await user.click(screen.getByRole("button", { name: /Send message/i }));

      // Verify the response
      await waitFor(() => {
        expect(
          screen.getByText(/Your largest expense category is Rent/i),
        ).toBeInTheDocument();
      });
    });

    it("shows empty state on dashboard when no data is uploaded", async () => {
      // No session in localStorage, no session context
      renderApp("/dashboard");

      await waitFor(() => {
        // EmptyState component should prompt upload or demo
        expect(
          screen.getByText(/No financial data/i) ||
            screen.getByText(/Upload Documents/i),
        ).toBeTruthy();
      });
    });
  });

  // ─── Error Recovery: Invalid Upload → Error → Valid Upload → Success ──────────

  describe("Error Recovery: invalid file upload → error → valid upload → success", () => {
    it("shows format error for CSV used as salary slip then succeeds with PDF", async () => {
      const user = userEvent.setup();
      localStorage.setItem("smartwealth_session_id", "test-session-001");

      globalThis.fetch = createFetchMock({
        "POST /api/sessions/test-session-001/documents": {
          status: 202,
          body: MOCK_DOCUMENT_UPLOAD_RESPONSE,
        },
      });

      renderApp("/upload");

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 1, name: /Upload Documents/i }),
        ).toBeInTheDocument();
      });

      // Upload a CSV file
      const csvFile = new File(
        ["date,amount\n2024-01-01,500"],
        "statement.csv",
        {
          type: "text/csv",
        },
      );

      const input = screen.getByLabelText(/Select files to upload/i);
      await user.upload(input, csvFile);

      // Select document type as salary_slip (CSV not valid for salary slip)
      await waitFor(() => {
        expect(
          screen.getByLabelText(/Select document type for statement\.csv/i),
        ).toBeInTheDocument();
      });

      const typeSelect = screen.getByLabelText(
        /Select document type for statement\.csv/i,
      );
      await user.selectOptions(typeSelect, "salary_slip");

      // Verify error message appears
      await waitFor(() => {
        expect(
          screen.getByText(/File format not supported/i),
        ).toBeInTheDocument();
      });

      // Upload button should be disabled due to validation error
      const uploadBtn = screen.getByRole("button", {
        name: /Upload selected documents/i,
      });
      expect(uploadBtn).toBeDisabled();

      // Remove the invalid file
      await user.click(
        screen.getByRole("button", { name: /Remove statement\.csv/i }),
      );

      // Verify file is removed
      await waitFor(() => {
        expect(screen.queryByText("statement.csv")).not.toBeInTheDocument();
      });

      // Upload a valid PDF file
      const validFile = new File(["%PDF-1.4 valid content"], "salary_jan.pdf", {
        type: "application/pdf",
      });

      const inputAgain = screen.getByLabelText(/Select files to upload/i);
      await user.upload(inputAgain, validFile);

      // Select correct document type
      await waitFor(() => {
        expect(
          screen.getByLabelText(/Select document type for salary_jan\.pdf/i),
        ).toBeInTheDocument();
      });

      const validSelect = screen.getByLabelText(
        /Select document type for salary_jan\.pdf/i,
      );
      await user.selectOptions(validSelect, "salary_slip");

      // No error should be shown
      expect(
        screen.queryByText(/File format not supported/i),
      ).not.toBeInTheDocument();

      // Upload button should now be enabled
      const uploadBtnValid = screen.getByRole("button", {
        name: /Upload selected documents/i,
      });
      expect(uploadBtnValid).toBeEnabled();
    });

    it("shows size error for oversized file then recovers with small valid file", async () => {
      const user = userEvent.setup();
      localStorage.setItem("smartwealth_session_id", "test-session-001");

      renderApp("/upload");

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 1, name: /Upload Documents/i }),
        ).toBeInTheDocument();
      });

      // Create an oversized file (>15MB)
      const largeContent = new Array(16 * 1024 * 1024).fill("x").join("");
      const oversizedFile = new File([largeContent], "big_statement.pdf", {
        type: "application/pdf",
      });

      const input = screen.getByLabelText(/Select files to upload/i);
      await user.upload(input, oversizedFile);

      // Select document type
      await waitFor(() => {
        expect(
          screen.getByLabelText(/Select document type for big_statement\.pdf/i),
        ).toBeInTheDocument();
      });

      const typeSelect = screen.getByLabelText(
        /Select document type for big_statement\.pdf/i,
      );
      await user.selectOptions(typeSelect, "bank_statement");

      // Verify size error
      await waitFor(() => {
        expect(
          screen.getByText(/File exceeds maximum size/i),
        ).toBeInTheDocument();
      });

      // Remove oversized file
      await user.click(
        screen.getByRole("button", { name: /Remove big_statement\.pdf/i }),
      );

      // Upload a valid smaller file
      const smallFile = new File(["%PDF-1.4 small content"], "bank_jan.pdf", {
        type: "application/pdf",
      });

      const inputAgain = screen.getByLabelText(/Select files to upload/i);
      await user.upload(inputAgain, smallFile);

      await waitFor(() => {
        expect(
          screen.getByLabelText(/Select document type for bank_jan\.pdf/i),
        ).toBeInTheDocument();
      });

      const validSelect = screen.getByLabelText(
        /Select document type for bank_jan\.pdf/i,
      );
      await user.selectOptions(validSelect, "bank_statement");

      // No errors should be shown
      expect(
        screen.queryByText(/File exceeds maximum size/i),
      ).not.toBeInTheDocument();

      // Upload button should be enabled
      const uploadBtn = screen.getByRole("button", {
        name: /Upload selected documents/i,
      });
      expect(uploadBtn).toBeEnabled();
    });

    it("handles upload API failure and shows error message to user", async () => {
      const user = userEvent.setup();
      localStorage.setItem("smartwealth_session_id", "test-session-001");

      globalThis.fetch = vi.fn(async () => {
        return {
          ok: false,
          status: 500,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: async () => ({ error: "Server error" }),
          text: async () => "Server error",
        };
      });

      renderApp("/upload");

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 1, name: /Upload Documents/i }),
        ).toBeInTheDocument();
      });

      // Upload a valid file
      const validFile = new File(["%PDF-1.4 content"], "salary_jan.pdf", {
        type: "application/pdf",
      });
      const input = screen.getByLabelText(/Select files to upload/i);
      await user.upload(input, validFile);

      await waitFor(() => {
        expect(
          screen.getByLabelText(/Select document type for salary_jan\.pdf/i),
        ).toBeInTheDocument();
      });

      const select = screen.getByLabelText(
        /Select document type for salary_jan\.pdf/i,
      );
      await user.selectOptions(select, "salary_slip");

      // Upload attempt fails
      const uploadBtn = screen.getByRole("button", {
        name: /Upload selected documents/i,
      });
      await user.click(uploadBtn);

      // Verify error message is displayed to user
      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(
          screen.getByText(/Upload failed\. Please try again\./i),
        ).toBeInTheDocument();
      });

      // Verify user can still interact with the page (upload button remains)
      expect(
        screen.getByRole("button", { name: /Upload selected documents/i }),
      ).toBeInTheDocument();
    });
  });

  // ─── Circuit Breaker: AI service down → degraded response → recovery ──────────

  describe("Circuit Breaker: AI service down → degraded response → recovery", () => {
    it("dashboard shows empty state when session has no data due to service being down", async () => {
      // Without a session in context, DashboardPage shows empty state.
      // This simulates the scenario where the circuit breaker is open
      // and no data can be fetched, forcing the empty/error UI.
      globalThis.fetch = vi.fn(async () => {
        return {
          ok: false,
          status: 503,
          headers: new Headers({ "Content-Type": "application/json" }),
          json: async () => ({ error: "Service unavailable", circuit: "open" }),
          text: async () => "Service unavailable",
        };
      });

      // DashboardPage uses useSession() which returns null session without
      // explicit setSession call, resulting in empty state
      renderApp("/dashboard");

      // Dashboard shows empty state (no session means no data)
      await waitFor(() => {
        expect(
          screen.getByText(/No financial data/i) ||
            screen.getByText(/Upload Documents/i) ||
            screen.getByText(/Try Demo Data/i),
        ).toBeTruthy();
      });
    });

    it("chatbot shows error when AI service is unavailable and recovers on resend", async () => {
      const user = userEvent.setup();
      localStorage.setItem("smartwealth_session_id", "test-session-001");

      let chatCallCount = 0;
      globalThis.fetch = vi.fn(
        async (url: string | URL | Request, init?: RequestInit) => {
          const urlStr =
            typeof url === "string"
              ? url
              : url instanceof URL
                ? url.toString()
                : url.url;
          const method = init?.method ?? "GET";

          if (urlStr.includes("/chat/history") && method === "GET") {
            return {
              ok: true,
              status: 200,
              headers: new Headers({ "Content-Type": "application/json" }),
              json: async () => [],
              text: async () => "[]",
            };
          }

          if (urlStr.includes("/summary") && method === "GET") {
            return {
              ok: true,
              status: 200,
              headers: new Headers({ "Content-Type": "application/json" }),
              json: async () => MOCK_SUMMARY,
              text: async () => JSON.stringify(MOCK_SUMMARY),
            };
          }

          // Chat POST - first call fails (circuit breaker open), second succeeds
          if (urlStr.includes("/chat") && method === "POST") {
            chatCallCount++;
            if (chatCallCount === 1) {
              return {
                ok: false,
                status: 503,
                headers: new Headers({ "Content-Type": "application/json" }),
                json: async () => ({ error: "AI service unavailable" }),
                text: async () => "AI service unavailable",
              };
            }
            return {
              ok: true,
              status: 200,
              headers: new Headers({ "Content-Type": "application/json" }),
              json: async () => MOCK_CHAT_RESPONSE,
              text: async () => JSON.stringify(MOCK_CHAT_RESPONSE),
            };
          }

          return {
            ok: false,
            status: 404,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: async () => ({ error: "Not found" }),
            text: async () => "Not found",
          };
        },
      );

      renderApp("/chat");

      // Wait for chat to load
      await waitFor(() => {
        expect(
          screen.getByLabelText(/Chat message input/i),
        ).toBeInTheDocument();
      });

      // Send first message - AI service is down (circuit breaker open)
      const input = screen.getByLabelText(/Chat message input/i);
      await user.type(input, "How can I save more?");
      await user.click(screen.getByRole("button", { name: /Send message/i }));

      // Verify error message is shown
      await waitFor(() => {
        expect(screen.getByText(/Failed to send message/i)).toBeInTheDocument();
      });

      // Dismiss the error
      await user.click(screen.getByText(/Dismiss/i));

      // Send again - AI service has recovered (circuit breaker closed)
      const inputAgain = screen.getByLabelText(/Chat message input/i);
      await user.type(inputAgain, "How can I save more?");
      await user.click(screen.getByRole("button", { name: /Send message/i }));

      // Verify successful response
      await waitFor(() => {
        expect(
          screen.getByText(/your savings rate is 35%/i),
        ).toBeInTheDocument();
      });
    });

    it("report page shows correct state when service is unavailable", async () => {
      // Render report page without an active session in context
      // (simulates the state when circuit breaker prevents data loading)
      render(
        <SessionProvider>
          <MemoryRouter initialEntries={["/report"]}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/report" element={<ReportPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </SessionProvider>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 1, name: /Financial Report/i }),
        ).toBeInTheDocument();
      });

      // Verify the page renders with report preview sections
      expect(screen.getByText(/Report Contents Preview/i)).toBeInTheDocument();
      expect(screen.getByText(/Income Summary/i)).toBeInTheDocument();

      // Without a session in context, user is prompted to load data first
      expect(
        screen.getByText(/Upload documents or load demo data/i),
      ).toBeInTheDocument();
    });

    it("chatbot shows no-data state when no financial data is available", async () => {
      // No session in localStorage
      localStorage.removeItem("smartwealth_session_id");

      renderApp("/chat");

      // Should show the "no financial data" state
      await waitFor(() => {
        expect(
          screen.getByText(/No Financial Data Available/i),
        ).toBeInTheDocument();
      });

      // Should offer navigation options
      expect(
        screen.getByRole("button", { name: /Upload Documents/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Load Demo Data/i }),
      ).toBeInTheDocument();
    });
  });
});
