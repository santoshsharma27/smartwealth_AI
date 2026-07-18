from fastapi import FastAPI

from routers.categorize import router as categorize_router
from routers.chat import router as chat_router
from routers.parse import router as parse_router
from routers.patterns import router as patterns_router
from routers.recommend import router as recommend_router
from routers.report import router as report_router
from routers.score import router as score_router

app = FastAPI(
    title="SmartWealth AI Service",
    description="AI microservice for document parsing, expense categorization, "
    "financial health scoring, recommendations, chatbot, and report generation.",
    version="1.0.0",
)

app.include_router(parse_router)
app.include_router(categorize_router)
app.include_router(score_router)
app.include_router(recommend_router)
app.include_router(patterns_router)
app.include_router(chat_router)
app.include_router(report_router)


@app.get("/ai/health")
async def health_check():
    """Health check endpoint for service monitoring."""
    return {"status": "healthy", "service": "smartwealth-ai-service"}
