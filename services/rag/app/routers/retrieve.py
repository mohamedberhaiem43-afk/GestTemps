"""POST /retrieve — recherche top-k filtree par soccod."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import RetrieveRequest, RetrieveResponse
from app.services.retrieval import retrieve as retrieve_chunks

router = APIRouter()


@router.post("/retrieve", response_model=RetrieveResponse)
def retrieve(req: RetrieveRequest) -> RetrieveResponse:
    if not req.soccod:
        raise HTTPException(status_code=400, detail="soccod required")
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="query empty")

    items = retrieve_chunks(soccod=req.soccod, query=req.query, top_k=req.top_k)
    return RetrieveResponse(results=items)
