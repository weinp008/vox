from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "EXAVITQu4vr4xnSDxMaL"  # Default "Sarah" voice
    projects_dir: str = "/tmp/sonar-projects"

    model_config = {"env_file": ".env"}


settings = Settings()
