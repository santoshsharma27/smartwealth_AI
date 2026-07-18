import os
from dotenv import load_dotenv

load_dotenv()

# Provider presets: maps provider name to default base URL
_PROVIDER_DEFAULTS: dict[str, dict[str, str]] = {
    "openai": {"base_url": "https://api.openai.com/v1", "model": "gpt-4o-mini"},
    "azure": {"base_url": "", "model": "gpt-4o-mini"},
    "anthropic": {"base_url": "https://api.anthropic.com/v1", "model": "claude-3-5-sonnet-20241022"},
    "google": {"base_url": "https://generativelanguage.googleapis.com/v1beta/openai", "model": "gemini-2.0-flash"},
    "gemini": {"base_url": "https://generativelanguage.googleapis.com/v1beta/openai", "model": "gemini-2.0-flash"},
    "groq": {"base_url": "https://api.groq.com/openai/v1", "model": "llama-3.1-70b-versatile"},
    "together": {"base_url": "https://api.together.xyz/v1", "model": "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"},
    "ollama": {"base_url": "http://localhost:11434/v1", "model": "llama3.1"},
    "lmstudio": {"base_url": "http://localhost:1234/v1", "model": ""},
    "custom": {"base_url": "http://localhost:8080/v1", "model": ""},
}


def _resolve_provider_config() -> tuple[str, str]:
    """Resolve base URL and model from provider preset + explicit overrides."""
    provider = os.getenv("LLM_PROVIDER", "lmstudio").lower().strip()
    defaults = _PROVIDER_DEFAULTS.get(provider, _PROVIDER_DEFAULTS["custom"])

    base_url = os.getenv("LLM_BASE_URL", defaults["base_url"])
    model = os.getenv("LLM_MODEL", defaults["model"])

    return base_url, model


class Settings:
    """Application settings loaded from environment variables.

    LLM Configuration supports any OpenAI-compatible API:
    - Set LLM_PROVIDER to a preset (openai, azure, anthropic, google, groq, together, ollama, lmstudio)
    - Or set LLM_BASE_URL and LLM_MODEL directly for any custom endpoint
    - Set LLM_API_KEY to your provider's API key

    Examples:
        OpenAI:     LLM_PROVIDER=openai, LLM_API_KEY=sk-...
        Groq:       LLM_PROVIDER=groq, LLM_API_KEY=gsk_...
        Ollama:     LLM_PROVIDER=ollama (no key needed)
        LM Studio:  LLM_PROVIDER=lmstudio (default, no key needed)
        Custom:     LLM_BASE_URL=http://your-server/v1, LLM_API_KEY=your-key
    """

    # --- LLM Configuration ---
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "lmstudio").lower().strip()

    _base_url, _model = _resolve_provider_config()
    LLM_BASE_URL: str = _base_url
    LLM_MODEL: str = _model

    LLM_API_KEY: str = os.getenv("LLM_API_KEY", os.getenv("OPENAI_API_KEY", "lm-studio"))
    LLM_ENABLED: bool = os.getenv("LLM_ENABLED", "true").lower() == "true"
    LLM_TIMEOUT: int = int(os.getenv("LLM_TIMEOUT", "30"))
    LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "512"))
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.3"))

    # Legacy key (still works - maps to LLM_API_KEY if set)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # --- Database ---
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://smartwealth:smartwealth_dev@localhost:5432/smartwealth",
    )

    # --- Server ---
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8001"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"


settings = Settings()
