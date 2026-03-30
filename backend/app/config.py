from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # Default "Rachel" voice
    projects_dir: str = "/tmp/sonar-projects"

    model_config = {"env_file": ".env"}


settings = Settings()
