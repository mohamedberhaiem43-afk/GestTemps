"""POST /embed — calcul d'embeddings ad-hoc (passage prefix)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.deps import embed_passages
from app.models import EmbedRequest, EmbedResponse

router = APIRouter()


@router.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    if not req.texts:
        raise HTTPException(status_code=400, detail="texts is empty")
    vectors = embed_passages(req.texts)
    return EmbedResponse(embeddings=vectors)
