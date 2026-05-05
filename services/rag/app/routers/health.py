"""GET /health — sanity check rapide pour le backend .NET."""

from __future__ import annotations

from fastapi import APIRouter

from app.deps import get_embeddings, get_qdrant_client
from app.models import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    qdrant_ok = False
    try:
        get_qdrant_client().get_collections()
        qdrant_ok = True
    except Exception:
        qdrant_ok = False

    model_ok = False
    try:
        # _model_name est defini par HuggingFaceEmbeddings — pas besoin d'inferer pour valider.
        _ = get_embeddings()
        model_ok = True
    except Exception:
        model_ok = False

    return HealthResponse(ok=qdrant_ok and model_ok, qdrant=qdrant_ok, model_loaded=model_ok)


@router.delete("/documents/{soccod}/{document_id}")
def delete_document(soccod: str, document_id: int):
    from app.services.ingestion import delete_document as do_delete

    do_delete(soccod, document_id)
    return {"deleted": True}
