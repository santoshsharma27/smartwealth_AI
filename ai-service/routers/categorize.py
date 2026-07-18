"""Expense categorization router for POST /ai/categorize endpoint."""

from fastapi import APIRouter

from models.categorize import (
    CategorizedTransaction,
    CategorizeRequest,
    CategorizeResponse,
    CategorizeStats,
)
from services.categorizer import categorize_transactions

router = APIRouter()


@router.post("/ai/categorize", response_model=CategorizeResponse)
async def categorize(request: CategorizeRequest) -> CategorizeResponse:
    """Categorize a batch of transactions using rule-based and LLM methods.

    Processes all input transactions and returns exactly N categorized results
    for N inputs. Each result includes category, confidence score, and method used.

    Falls back to rule-based only if LLM is unavailable, with a notice in stats.
    """
    # Convert Pydantic models to dicts for the service layer
    txn_dicts = [
        {
            "id": txn.id,
            "description": txn.description,
            "amount": txn.amount,
            "type": txn.type,
        }
        for txn in request.transactions
    ]

    # Process all transactions
    results, llm_available = categorize_transactions(txn_dicts)

    # Build response models
    categorized = [
        CategorizedTransaction(
            id=r["id"],
            category=r["category"],
            confidence=r["confidence"],
            method=r["method"],
        )
        for r in results
    ]

    # Calculate stats
    rule_based_count = sum(1 for r in results if r["method"] == "rule_based")
    llm_based_count = sum(1 for r in results if r["method"] == "llm_based")

    stats = CategorizeStats(
        totalProcessed=len(results),
        ruleBased=rule_based_count,
        llmBased=llm_based_count,
        llmAvailable=llm_available,
    )

    return CategorizeResponse(
        categorizedTransactions=categorized,
        stats=stats,
    )
