"""Core expense categorization logic with rule-based and LLM fallback methods."""

import logging

from config import settings

logger = logging.getLogger(__name__)

# Keyword rules for 12 expense categories.
# Each category maps to a list of keywords for case-insensitive matching.
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Rent": ["rent", "house rent", "lease", "landlord"],
    "Food": [
        "swiggy",
        "zomato",
        "food",
        "restaurant",
        "grocery",
        "bigbasket",
        "dominos",
        "pizza",
        "cafe",
        "eat",
    ],
    "Travel": [
        "uber",
        "ola",
        "cab",
        "taxi",
        "fuel",
        "petrol",
        "metro",
        "airline",
        "flight",
        "train",
        "irctc",
    ],
    "Shopping": [
        "amazon",
        "flipkart",
        "myntra",
        "shopping",
        "store",
        "mart",
        "online purchase",
    ],
    "Bills": [
        "electricity",
        "water",
        "gas",
        "broadband",
        "internet",
        "phone",
        "mobile",
        "postpaid",
        "prepaid",
        "dth",
        "bill",
    ],
    "EMI": ["emi", "loan", "instalment", "housing loan", "car loan"],
    "Healthcare": [
        "pharmacy",
        "hospital",
        "doctor",
        "medical",
        "apollo",
        "health",
        "clinic",
    ],
    "Entertainment": [
        "netflix",
        "spotify",
        "movie",
        "cinema",
        "pvr",
        "gaming",
        "disney",
        "hotstar",
        "prime",
    ],
    "Investments": [
        "sip",
        "mutual fund",
        "stocks",
        "demat",
        "investment",
        "ppf",
        "nps",
        "fd",
        "fixed deposit",
    ],
    "Savings": ["savings", "transfer to savings"],
    "Education": [
        "school",
        "college",
        "tuition",
        "course",
        "udemy",
        "coursera",
        "education",
    ],
}


def categorize_rule_based(description: str) -> tuple[str, float]:
    """Categorize a transaction description using keyword matching.

    Returns:
        A tuple of (category, confidence).
        - Exact multi-word keyword match: confidence 0.90-0.95
        - Exact single-word keyword match: confidence 0.85-0.90
        - Partial/substring match: confidence 0.70-0.85
        - No match: ("Miscellaneous", 0.4)
    """
    desc_lower = description.lower().strip()

    best_category = "Miscellaneous"
    best_confidence = 0.0

    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            keyword_lower = keyword.lower()
            confidence = 0.0

            # Check for exact multi-word keyword as a phrase in the description
            if " " in keyword_lower:
                if keyword_lower in desc_lower:
                    confidence = 0.95
            # Check if the keyword matches the full description or a word boundary
            elif keyword_lower == desc_lower:
                confidence = 0.95
            elif f" {keyword_lower} " in f" {desc_lower} ":
                # Exact word match within description
                confidence = 0.90
            elif keyword_lower in desc_lower:
                # Substring/partial match
                confidence = 0.75

            if confidence > best_confidence:
                best_confidence = confidence
                best_category = category

    if best_confidence < 0.7:
        return ("Miscellaneous", best_confidence if best_confidence > 0 else 0.4)

    return (best_category, best_confidence)


def categorize_with_llm(description: str) -> tuple[str, float]:
    """Categorize a transaction using LLM (LM Studio / OpenAI-compatible API).

    Falls back gracefully if the LLM is unavailable.

    Returns:
        A tuple of (category, confidence).
        Returns (None, 0.0) if LLM is unavailable.
    """
    from services.llm_client import chat_completion, is_available

    if not is_available():
        logger.info("LLM unavailable: service not reachable or disabled.")
        return (None, 0.0)

    valid_categories = list(CATEGORY_KEYWORDS.keys()) + ["Miscellaneous"]
    categories_str = ", ".join(valid_categories)

    messages = [
        {
            "role": "system",
            "content": (
                "You are a financial transaction categorizer. "
                "Given a transaction description, respond with ONLY the category name. "
                f"Valid categories: {categories_str}. "
                "Respond with just the category name, nothing else."
            ),
        },
        {
            "role": "user",
            "content": f"Categorize this transaction: \"{description}\"",
        },
    ]

    try:
        result = chat_completion(messages, temperature=0.1, max_tokens=20)
        if result is None:
            return (None, 0.0)

        # Parse the LLM response - match against valid categories
        result_clean = result.strip().strip('"').strip("'")
        for category in valid_categories:
            if category.lower() == result_clean.lower():
                return (category, 0.75)

        # Partial match (LLM might include extra text)
        for category in valid_categories:
            if category.lower() in result_clean.lower():
                return (category, 0.65)

        logger.info("LLM returned unrecognized category: %s", result_clean)
        return ("Miscellaneous", 0.5)

    except Exception as e:
        logger.warning("LLM categorization failed: %s", str(e))
        return (None, 0.0)


def categorize_transaction(description: str) -> tuple[str, float, str]:
    """Categorize a single transaction using rule-based with LLM fallback.

    Logic:
        1. Try rule-based categorization
        2. If confidence >= 0.7, return with method="rule_based"
        3. If confidence < 0.7, try LLM
        4. If LLM confidence >= 0.5, return with method="llm_based"
        5. If both < 0.5, return ("Miscellaneous", confidence, method)

    Returns:
        A tuple of (category, confidence, method).
    """
    # Step 1: Rule-based categorization
    rule_category, rule_confidence = categorize_rule_based(description)

    # Step 2: If rule-based is confident enough, use it
    if rule_confidence >= 0.7:
        return (rule_category, rule_confidence, "rule_based")

    # Step 3: Try LLM fallback
    llm_category, llm_confidence = categorize_with_llm(description)

    # Step 4: If LLM succeeded with sufficient confidence
    if llm_category is not None and llm_confidence >= 0.5:
        return (llm_category, llm_confidence, "llm_based")

    # Step 5: Both methods below threshold - assign Miscellaneous
    # Use the best confidence available for reporting
    if llm_category is not None and llm_confidence > rule_confidence:
        return ("Miscellaneous", llm_confidence, "llm_based")

    return ("Miscellaneous", rule_confidence, "rule_based")


def categorize_transactions(
    transactions: list[dict],
) -> tuple[list[dict], bool]:
    """Batch categorize a list of transactions.

    Args:
        transactions: List of dicts with 'id', 'description', 'amount', 'type'.

    Returns:
        A tuple of (categorized_results, llm_available).
        Each result has: id, category, confidence, method.
    """
    results = []
    llm_available = bool(settings.OPENAI_API_KEY)

    for txn in transactions:
        category, confidence, method = categorize_transaction(txn["description"])
        results.append(
            {
                "id": txn["id"],
                "category": category,
                "confidence": round(confidence, 4),
                "method": method,
            }
        )

    return results, llm_available
