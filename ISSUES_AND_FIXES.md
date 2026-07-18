# SmartWealth AI — Issues Faced & Resolutions

## 1. Frontend Layout Broken (Text Wrapping Word-by-Word)

**Symptom:** All text on every page wrapped after each word, making the UI unusable.

**Root Cause:** Custom `--spacing-*` tokens in the Tailwind CSS v4 `@theme` block (`--spacing-md: 1rem`, `--spacing-xl: 2rem`, `--spacing-3xl: 4rem`) were overriding Tailwind's built-in sizing utilities. `max-w-3xl` resolved to `--spacing-3xl` = 4rem (64px!) instead of the default 48rem.

**Fix:** Removed `--spacing-*` and `--text-*` custom tokens from `frontend/src/index.css` `@theme` block. Used plain CSS with media queries for the sidebar layout.

**Files Changed:**
- `frontend/src/index.css` — Removed conflicting spacing/text tokens
- `frontend/src/components/AppLayout.tsx` — Rewrote layout using CSS classes instead of Tailwind utilities

---

## 2. App.tsx Missing Routes

**Symptom:** Goals page showed "Coming Soon" placeholder, Report page was missing entirely.

**Root Cause:** `App.tsx` was never updated to import and route to `GoalPlannerPage` and `ReportPage`.

**Fix:** Added proper imports and routes for all pages.

**Files Changed:**
- `frontend/src/App.tsx`

---

## 3. Frontend Not Reaching Backend (No Proxy)

**Symptom:** API calls returned 404 because they went to the Vite dev server instead of the backend.

**Root Cause:** `API_BASE_URL` defaulted to `/api` (relative), so requests went to `http://localhost:5173/api/...` which Vite doesn't proxy.

**Fix:** Added Vite proxy configuration to forward `/api` requests to `http://localhost:8080`.

**Files Changed:**
- `frontend/vite.config.ts` — Added `server.proxy` config

---

## 4. Stale Session ID in localStorage

**Symptom:** 400/404 errors on session endpoints after database was cleared.

**Root Cause:** Browser had old session IDs in localStorage that no longer existed in the database. Also, `EmptyState` component was creating a fake `"demo-session"` ID.

**Fix:** Updated `UploadPage` to verify session exists before using it. Fixed `EmptyState` to use proper API calls instead of creating fake sessions.

**Files Changed:**
- `frontend/src/pages/UploadPage.tsx`
- `frontend/src/components/EmptyState.tsx`

---

## 5. CategoryChart Crash on null expensesByCategory

**Symptom:** `TypeError: Cannot convert undefined or null to object` at `Object.entries()` in CategoryChart.

**Root Cause:** `expensesByCategory` was `null` when the financial summary had no expense data.

**Fix:** Added null check at the start of `computeChartData`.

**Files Changed:**
- `frontend/src/components/CategoryChart.tsx`

---

## 6. Document Upload multipart Form Data Mismatch

**Symptom:** Upload returned 400 because `documentTypes` was sent as a single JSON string.

**Root Cause:** Frontend sent `formData.append('documentTypes', JSON.stringify(["salary_slip"]))` but the backend expected multiple separate form fields.

**Fix:** Changed to append each document type as a separate form field.

**Files Changed:**
- `frontend/src/services/api.ts`

---

## 7. Java 25 Not Supported by Byte Buddy

**Symptom:** Quarkus dev mode failed to start with `Java 25 (69) is not supported by the current version of Byte Buddy`.

**Root Cause:** The installed JDK is Java 25 (Temurin), but the Quarkus version's Byte Buddy only supports up to Java 23.

**Fix:** Set `MAVEN_OPTS="-Dnet.bytebuddy.experimental=true"` when starting Quarkus dev mode.

**Command:**
```powershell
$env:MAVEN_OPTS="-Dnet.bytebuddy.experimental=true"; .\mvnw.cmd quarkus:dev
```

---

## 8. Document Processing Pipeline — Transaction Management

**Symptom:** 500 Internal Server Error with `duplicate key value violates unique constraint "documents_pkey"`.

**Root Cause:** `DocumentUploadService.storeDocuments()` has its own `@Transactional` and persists documents. The orchestrator then received detached entity references and tried to re-persist them, causing duplicate key conflicts.

**Fix:** 
- Created `processDocumentsByIds(UUID sessionId, List<UUID> documentIds)` that accepts only IDs
- The method has `@Transactional(REQUIRES_NEW)` and loads fresh managed entities from DB
- Removed `@Transactional` from inner helper methods to avoid nested transaction issues

**Files Changed:**
- `backend/.../resource/DocumentResource.java`
- `backend/.../service/DocumentProcessingOrchestrator.java`

---

## 9. SalaryData monthYear Field Too Short

**Symptom:** `ConstraintViolationException: size must be between 0 and 7, propertyPath=monthYear`

**Root Cause:** The `SalaryData.monthYear` field had `@Size(max=7)` expecting format "01/2024" (7 chars), but the payslip extracted "JUN-2025" (8 chars).

**Fix:** Changed `@Size(max=7)` to `@Size(max=20)` and updated the database column to `VARCHAR(20)`.

**Files Changed:**
- `backend/.../entity/SalaryData.java`
- Database: `ALTER TABLE salary_data ALTER COLUMN month_year TYPE VARCHAR(20)`

---

## 10. Parse Success Flag Blocking Valid Data

**Symptom:** Dashboard showed ₹0 even though the AI service extracted salary data correctly.

**Root Cause:** The orchestrator checked `if (!response.success)` and abandoned all data — but `success` was `false` whenever ANY field had an extraction error (e.g., missing employer name), even if gross/net salary was extracted.

**Fix:** Changed the check to verify whether usable data exists (gross_salary > 0 or transactions present) instead of relying on the boolean `success` flag.

**Files Changed:**
- `backend/.../service/DocumentProcessingOrchestrator.java`

---

## 11. Chat Endpoint 422 Unprocessable Content

**Symptom:** Chat messages failed with 422 from the AI service.

**Root Cause:** The backend's `ChatRequest.FinancialContext` had `transactions` and `goals` fields initialized as `null`. When serialized to JSON, this sent `"transactions": null` which the Pydantic model rejected (it expects a list).

**Fix:** Initialized list fields with empty ArrayLists: `transactions = new ArrayList<>()`, `goals = new ArrayList<>()`.

**Files Changed:**
- `backend/.../client/dto/ChatRequest.java`

---

## 12. Max File Size Increase (10MB → 15MB)

**Symptom:** User requested larger file upload support.

**Files Changed:**
- `backend/src/main/resources/application.properties` — `quarkus.http.limits.max-body-size=15728640`
- `backend/.../service/DocumentUploadService.java` — `MAX_FILE_SIZE = 15_728_640`
- `backend/.../entity/Document.java` — `@Max(15728640)`
- `frontend/src/pages/UploadPage.tsx` — Client-side validation + UI text
- `database/migrations/V001__initial_schema.sql` — CHECK constraint
- Database: `ALTER TABLE documents DROP CONSTRAINT ... ADD CONSTRAINT ... <= 15728640`

---

## 13. LLM Provider Configuration

**Enhancement:** Added configurable LLM provider support (LM Studio, OpenAI, Groq, Ollama, etc.)

**Files Created/Changed:**
- `ai-service/config.py` — Added `LLM_PROVIDER` with provider presets
- `ai-service/services/llm_client.py` — New OpenAI-compatible HTTP client
- `ai-service/services/categorizer.py` — LLM fallback for categorization
- `ai-service/services/chatbot.py` — LLM-enhanced chat responses
- `ai-service/services/parser.py` — LLM fallback for salary slip parsing
- `ai-service/.env` — LM Studio configuration
- `.env.example` — Provider documentation
