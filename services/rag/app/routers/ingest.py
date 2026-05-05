"""POST /ingest — multipart : file + form fields (soccod, document_id, original_name)."""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models import IngestResponse
from app.services.ingestion import ingest_document

router = APIRouter()


@router.post("/ingest", response_model=IngestResponse)
async def ingest(
    file: UploadFile = File(...),
    soccod: str = Form(...),
    document_id: int = Form(...),
    original_name: str = Form(...),
) -> IngestResponse:
    if not soccod or len(soccod) > 6:
        raise HTTPException(status_code=400, detail="invalid soccod")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty file")

    chunks_count, pages = ingest_document(
        soccod=soccod,
        document_id=document_id,
        original_name=original_name or file.filename or "document",
        content_type=file.content_type or "",
        file_bytes=raw,
    )
    return IngestResponse(chunks_count=chunks_count, pages=pages)
