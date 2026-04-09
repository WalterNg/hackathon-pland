import os
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the project root directory
ROOT_DIR = Path(__file__).parent.parent.parent.absolute()

class Settings(BaseSettings):
    project_name: str = "hackathon-pland"
    gemini_api_key: str = ""

    # Supabase Configuration
    supabase_url: str = Field(default="", alias="NEXT_PUBLIC_SUPABASE_URL")
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")

    model_config = SettingsConfigDict(
        env_file=(
            os.path.join(ROOT_DIR, ".env.local"),
            os.path.join(ROOT_DIR, ".env"),
        ),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
