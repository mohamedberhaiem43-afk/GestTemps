"""Configuration 12-factor lue depuis les variables d'environnement."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Qdrant : URL HTTP (gRPC est plus rapide mais HTTP est plus simple a debug).
    qdrant_url: str = "http://qdrant:6333"
    qdrant_api_key: str | None = None

    # Modele d'embeddings — multilingual-e5-large (1024 dim, FR/EN solides).
    embed_model: str = "intfloat/multilingual-e5-large"
    embed_dim: int = 1024
    embed_device: str = "cpu"  # "cuda" si GPU disponible

    # Auth partagee avec le backend .NET.
    sidecar_key: str = ""

    # Limites operationnelles.
    chunk_size: int = 500       # caracteres approx (RecursiveCharacterTextSplitter)
    chunk_overlap: int = 50
    retrieve_score_threshold: float = 0.0  # 0 = pas de filtre, le caller decide

    # Logging.
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_prefix="", env_file=None, extra="ignore")


settings = Settings()
