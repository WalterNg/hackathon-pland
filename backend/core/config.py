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
    supabase_anon_key: str = Field(default="", alias="NEXT_PUBLIC_SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field(default="", alias="SUPABASE_SERVICE_ROLE_KEY")

    # Ethereum Sepolia anchor configuration
    eth_sepolia_rpc_url: str = Field(default="", alias="ETH_SEPOLIA_RPC_URL")
    eth_sepolia_private_key: str = Field(default="", alias="ETH_SEPOLIA_PRIVATE_KEY")
    eth_sepolia_anchor_wallet_address: str = Field(default="", alias="ETH_SEPOLIA_ANCHOR_WALLET_ADDRESS")
    eth_sepolia_explorer_base_url: str = Field(default="https://sepolia.etherscan.io/tx/", alias="ETH_SEPOLIA_EXPLORER_BASE_URL")

    model_config = SettingsConfigDict(
        env_file=(
            os.path.join(ROOT_DIR, ".env.local"),
            os.path.join(ROOT_DIR, ".env"),
        ),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
