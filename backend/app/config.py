from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    tts_voice: str = "nova"  # OpenAI voice: alloy, echo, fable, onyx, nova, shimmer
    projects_dir: str = "/tmp/vox-projects"
    use_claude_code: bool = True  # Use Claude Code CLI instead of direct API

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
