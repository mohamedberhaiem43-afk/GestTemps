"""Singletons coûteux : embeddings et client Qdrant. Lazy-load.

Le pattern @lru_cache garantit qu'on ne charge le modele e5-large qu'une seule fois,
et qu'un test peut monkeypatch ces fonctions pour injecter un fake.
"""

from functools import lru_cache

from langchain_huggingface import HuggingFaceEmbeddings
from qdrant_client import QdrantClient

from app.config import settings


@lru_cache(maxsize=1)
def get_embeddings() -> HuggingFaceEmbeddings:
    # Convention e5 : prefixer les passages avec "passage: " et les requetes avec "query: ".
    # LangChain appelle automatiquement embed_documents et embed_query, on injecte donc les
    # prefixes via les wrappers ci-dessous au lieu de ce parametre — ce dernier n'expose
    # qu'un prefix uniforme. On laisse encode_kwargs sans prefix.
    return HuggingFaceEmbeddings(
        model_name=settings.embed_model,
        model_kwargs={"device": settings.embed_device},
        encode_kwargs={"normalize_embeddings": True},
    )


def embed_passages(texts: list[str]) -> list[list[float]]:
    """Encode des textes destines a l'index (prefixe e5 'passage: ')."""
    embeds = get_embeddings()
    prefixed = [f"passage: {t}" for t in texts]
    return embeds.embed_documents(prefixed)


def embed_query(text: str) -> list[float]:
    """Encode une requete (prefixe e5 'query: ')."""
    embeds = get_embeddings()
    return embeds.embed_query(f"query: {text}")


@lru_cache(maxsize=1)
def get_qdrant_client() -> QdrantClient:
    return QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
        timeout=60,
    )


def collection_name(soccod: str) -> str:
    """Nom de collection Qdrant par tenant. Soccod est ASCII court (<=6), pas de risque d'injection.

    Pour eviter toute collision si plusieurs tenants partagent un soccod identique
    (cas multi-DB), le caller .NET pourra prefixer avec un tenantSlug en v2.
    """
    safe = "".join(c for c in soccod if c.isalnum() or c in "-_")
    return f"tenant_{safe}"
