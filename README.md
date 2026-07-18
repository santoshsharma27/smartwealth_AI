# SmartWealth AI

An AI-powered personal financial copilot that helps salaried individuals understand and improve their financial health.

## Overview

SmartWealth AI enables users to upload salary slips and bank statements, automatically extracts and categorizes financial data, calculates a Financial Health Score (0–100), generates personalized AI recommendations, supports goal-based planning, and provides an AI chatbot for answering finance questions using the user's own data.

## Architecture

| Service | Technology | Description |
|---------|-----------|-------------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS | Single-page application with responsive data visualization using Recharts |
| **Backend** | Java Quarkus | RESTful API handling session management, document upload/storage, and orchestration |
| **AI Service** | Python FastAPI | ML/AI microservice for PDF/CSV parsing, expense categorization, health score calculation, recommendations, and chatbot |
| **Database** | PostgreSQL 16 | Persistent storage for sessions, documents, transactions, scores, goals, and chat history |

## Project Structure

```
SmartWealth_AI/
├── frontend/              # React + Vite + TypeScript SPA
├── backend/               # Java Quarkus REST API
│   └── Dockerfile         # Multi-stage Maven build
├── ai-service/            # Python FastAPI AI/ML service
│   └── Dockerfile         # Python runtime image
├── database/
│   ├── migrations/        # SQL schema migrations (auto-run on startup)
│   └── seed/              # Demo data seed scripts (auto-run on startup)
├── docker-compose.yml     # Full stack orchestration
├── .env.example           # Environment variable template
└── README.md
```

## Getting Started

### Prerequisites

- Docker & Docker Compose (required for full stack)
- Node.js 18+ (for frontend development)
- Java 17+ (for backend development without Docker)
- Python 3.11+ (for AI service development without Docker)

### Full Stack with Docker Compose

The quickest way to run the entire application (database, backend, and AI service) is with Docker Compose.

1. **Copy the environment file:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to set your `OPENAI_API_KEY` if you want LLM-enhanced categorization (optional — the app works without it using rule-based categorization).

2. **Start all services:**
   ```bash
   docker-compose up --build
   ```
   This will:
   - Start PostgreSQL 15 with persistent storage
   - Auto-run database migrations and seed demo data on first startup
   - Build and start the Quarkus backend (Java) on port 8080
   - Build and start the FastAPI AI service (Python) on port 8000

3. **Start the frontend dev server** (in a separate terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The frontend dev server runs on `http://localhost:5173` and proxies API calls to the backend at `http://localhost:8080`.

4. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8080
   - Backend Swagger UI: http://localhost:8080/q/swagger-ui
   - AI Service: http://localhost:8000
   - AI Service Health: http://localhost:8000/ai/health

5. **Stop all services:**
   ```bash
   docker-compose down
   ```
   To also remove the database volume (reset all data):
   ```bash
   docker-compose down -v
   ```

### Individual Service Development

For faster iteration on individual services, you can run them separately:

#### Database only (Docker)
```bash
docker-compose up postgres -d
```

#### Backend (dev mode with hot reload)
```bash
cd backend
./mvnw quarkus:dev
```

#### AI Service (dev mode with hot reload)
```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### Frontend (dev mode with hot reload)
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `POSTGRES_DB` | PostgreSQL | `smartwealth` | Database name |
| `POSTGRES_USER` | PostgreSQL | `smartwealth` | Database user |
| `POSTGRES_PASSWORD` | PostgreSQL | `smartwealth_dev` | Database password |
| `QUARKUS_DATASOURCE_JDBC_URL` | Backend | `jdbc:postgresql://postgres:5432/smartwealth` | JDBC connection URL |
| `QUARKUS_DATASOURCE_USERNAME` | Backend | `smartwealth` | DB username for backend |
| `QUARKUS_DATASOURCE_PASSWORD` | Backend | `smartwealth_dev` | DB password for backend |
| `AI_SERVICE_BASE_URL` | Backend | `http://ai-service:8000` | AI service URL for backend |
| `DATABASE_URL` | AI Service | `postgresql://smartwealth:smartwealth_dev@postgres:5432/smartwealth` | DB connection for AI service (read-only) |
| `AI_SERVICE_PORT` | AI Service | `8000` | Port for AI service |
| `OPENAI_API_KEY` | AI Service | _(empty)_ | OpenAI API key (optional) |

## Features

- **Document Upload** — Upload salary slips (PDF) and bank statements (PDF/CSV)
- **Automatic Extraction** — AI-powered parsing and data extraction
- **Expense Categorization** — Rule-based + LLM classification into 12 categories
- **Financial Health Score** — Composite score (0–100) based on savings, expenses, EMI, investments, and emergency fund
- **AI Recommendations** — Personalized, actionable financial guidance
- **Goal Planner** — Plan financial goals with SIP calculations and feasibility assessment
- **AI Chatbot** — Ask questions about your finances in natural language
- **Downloadable Reports** — Comprehensive PDF financial wellness reports
- **Demo Data** — Instant experience without uploading personal documents

## License

This project is developed for hackathon demonstration purposes.
