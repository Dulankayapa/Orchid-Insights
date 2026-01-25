from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Central configuration for the unified backend.

    Environment variables:
      - API_PREFIX: base path for all routers (default: /api)
      - CORS_ORIGINS: comma-separated list of allowed origins (default: *)
      - FIREBASE_DB_URL: Realtime DB root URL (e.g., https://your-db.firebaseio.com)
      - GROWTH_MODEL_PATH: Optional override for the growth RF model (.joblib)
      - GROWTH_METADATA_PATH: Optional override for metadata (.joblib)
      - GROWTH_DATASET_PATH: Optional override for Excel dataset with expected ranges
      - DISEASE_WEIGHTS_PATH: Optional override for plant village weights (.pth)
    """

    api_prefix: str = Field("/api", env="API_PREFIX")
    cors_origins: List[str] = Field(default_factory=lambda: ["*"], env="CORS_ORIGINS")

    firebase_db_url: Optional[str] = Field(default=None, env="FIREBASE_DB_URL")

    growth_model_path: Optional[str] = Field(default=None, env="GROWTH_MODEL_PATH")
    growth_metadata_path: Optional[str] = Field(default=None, env="GROWTH_METADATA_PATH")
    growth_dataset_path: Optional[str] = Field(default=None, env="GROWTH_DATASET_PATH")

    disease_weights_path: Optional[str] = Field(default=None, env="DISEASE_WEIGHTS_PATH")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent
