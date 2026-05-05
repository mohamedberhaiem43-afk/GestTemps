"""Schemas Pydantic — wire format avec le backend .NET (snake_case)."""

from pydantic import BaseModel, Field


class IngestResponse(BaseModel):
    chunks_count: int
    pages: int


class RetrieveRequest(BaseModel):
    soccod: str
    query: str
    top_k: int = Field(default=5, ge=1, le=50)


class RetrieveItem(BaseModel):
    text: str
    document_id: int
    document_name: str | None = None
    page: int | None = None
    score: float


class RetrieveResponse(BaseModel):
    results: list[RetrieveItem]


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]


class HealthResponse(BaseModel):
    ok: bool
    qdrant: bool
    model_loaded: bool
