"""LLM client for LM Studio / OpenAI-compatible APIs.

Supports any server that implements the OpenAI Chat Completions API:
- LM Studio (default: http://localhost:1234/v1)
- Ollama (http://localhost:11434/v1)
- OpenAI (https://api.openai.com/v1)
- Any other OpenAI-compatible endpoint
"""

import logging
from typing import Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)

_client: Optional[httpx.Client] = None


def _get_client() -> httpx.Client:
    """Get or create the HTTP client for LLM requests."""
    global _client
    if _client is None:
        _client = httpx.Client(
            base_url=settings.LLM_BASE_URL,
            timeout=settings.LLM_TIMEOUT,
            headers={
                "Authorization": f"Bearer {settings.LLM_API_KEY}",
                "Content-Type": "application/json",
            },
        )
    return _client


def is_available() -> bool:
    """Check if the LLM service is enabled and reachable."""
    if not settings.LLM_ENABLED:
        return False
    try:
        client = _get_client()
        response = client.get("/models")
        return response.status_code == 200
    except Exception as e:
        logger.debug("LLM service not reachable: %s", str(e))
        return False


def chat_completion(
    messages: list[dict[str, str]],
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    model: Optional[str] = None,
) -> Optional[str]:
    """Send a chat completion request to the LLM.

    Args:
        messages: List of message dicts with 'role' and 'content'.
        temperature: Sampling temperature (default from settings).
        max_tokens: Max response tokens (default from settings).
        model: Model name (default from settings, empty = server default).

    Returns:
        The assistant's response text, or None if the request failed.
    """
    if not settings.LLM_ENABLED:
        return None

    payload = {
        "messages": messages,
        "temperature": temperature or settings.LLM_TEMPERATURE,
        "max_tokens": max_tokens or settings.LLM_MAX_TOKENS,
        "stream": False,
    }

    # Only include model if explicitly set
    model_name = model or settings.LLM_MODEL
    if model_name:
        payload["model"] = model_name

    try:
        client = _get_client()
        response = client.post("/chat/completions", json=payload)

        if response.status_code != 200:
            logger.warning(
                "LLM request failed with status %d: %s",
                response.status_code,
                response.text[:200],
            )
            return None

        data = response.json()
        choices = data.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "").strip()
        return None

    except httpx.TimeoutException:
        logger.warning("LLM request timed out after %ds", settings.LLM_TIMEOUT)
        return None
    except Exception as e:
        logger.warning("LLM request failed: %s", str(e))
        return None
