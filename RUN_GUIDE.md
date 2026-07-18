# SmartWealth AI — Run Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Java | 17+ (tested with 25) | Quarkus backend |
| Python | 3.11+ | FastAPI AI service |
| Node.js | 18+ | React frontend |
| Podman or Docker | Any | PostgreSQL database |
| LM Studio | Any (optional) | Local LLM for AI features |

---

## Quick Start (4 terminals)

### Terminal 1: PostgreSQL Database

```powershell
# Start PostgreSQL with Podman
podman run --name smartwealth-db -e POSTGRES_DB=smartwealth -e POSTGRES_USER=smartwealth -e POSTGRES_PASSWORD=smartwealth_dev -p 5432:5432 --rm docker.io/library/postgres:15-alpine
```

### Terminal 2: Run Database Migrations

```powershell
# Wait for PostgreSQL to be ready, then run migrations
Get-Content database\migrations\V001__initial_schema.sql | podman exec -i smartwealth-db psql -U smartwealth -d smartwealth
```

### Terminal 3: Start Backend (Quarkus)

```powershell
cd backend
$env:MAVEN_OPTS="-Dnet.bytebuddy.experimental=true"
.\mvnw.cmd quarkus:dev
```

Backend runs on: **http://localhost:8080**  
Swagger UI: **http://localhost:8080/q/swagger-ui**

### Terminal 4: Start AI Service (FastAPI)

```powershell
cd ai-service
..\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

AI service runs on: **http://localhost:8001**  
Health check: **http://localhost:8001/ai/health**

### Terminal 5: Start Frontend (React/Vite)

```powershell
cd frontend
npm run dev
```

Frontend runs on: **http://localhost:5173**

---

## LM Studio Setup (Optional — for AI-powered features)

1. Download and install [LM Studio](https://lmstudio.ai)
2. Download a model (e.g., `meta-llama-3.1-8b-instruct`)
3. Load the model and start the local server (port 1234)
4. The AI service auto-connects to `http://127.0.0.1:1234/v1`

To use a different LLM provider, edit `ai-service/.env`:

```env
# OpenAI
LLM_PROVIDER=openai
LLM_API_KEY=sk-your-key

# Groq (fast, free tier)
LLM_PROVIDER=groq
LLM_API_KEY=gsk_your-key

# Ollama (local)
LLM_PROVIDER=ollama
```

---

## Service URLs

| Service | URL | Port |
|---------|-----|------|
| Frontend | http://localhost:5173 | 5173 |
| Backend API | http://localhost:8080 | 8080 |
| AI Service | http://localhost:8001 | 8001 |
| PostgreSQL | localhost | 5432 |
| LM Studio | http://127.0.0.1:1234 | 1234 |

---

## Database Management

```powershell
# Connect to database
podman exec -it smartwealth-db psql -U smartwealth -d smartwealth

# Clear all data (fresh start)
echo "TRUNCATE TABLE spending_anomalies, recurring_expenses, chat_messages, goals, recommendations, health_scores, financial_summaries, transactions, salary_data, documents, sessions CASCADE;" | podman exec -i smartwealth-db psql -U smartwealth -d smartwealth

# Check what's stored
echo "SELECT monthly_income, total_expenses FROM financial_summaries;" | podman exec -i smartwealth-db psql -U smartwealth -d smartwealth
```

---

## Testing

```powershell
# Backend tests (JUnit 5 + jqwik)
cd backend
.\mvnw.cmd test

# AI service tests (pytest + hypothesis)
cd ai-service
..\.venv\Scripts\python.exe -m pytest

# Frontend tests (Vitest + React Testing Library)
cd frontend
npx vitest run
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Backend won't start (ByteBuddy error) | Add `$env:MAVEN_OPTS="-Dnet.bytebuddy.experimental=true"` |
| Dashboard shows ₹0 after upload | Wait 10 seconds then refresh (F5) — processing is async |
| 404 on API calls | Clear browser localStorage (`smartwealth_session_id`) |
| Chat returns error | Ensure AI service is running on port 8001 |
| LLM not responding | Check LM Studio server is running on port 1234 |
| Duplicate key errors | Clear DB with TRUNCATE command above |

---

## Architecture

```
Frontend (React/Vite)  →  Backend (Quarkus)  →  AI Service (FastAPI)  →  LM Studio
       :5173                    :8080                  :8001                 :1234
                                    ↓
                              PostgreSQL :5432
```

- Frontend proxies `/api/*` requests to backend via Vite proxy config
- Backend orchestrates: upload → parse → categorize → score → recommend
- AI service handles: PDF parsing, categorization, health score, chat, reports
- LM Studio provides LLM capabilities (optional — rule-based fallback works without it)
