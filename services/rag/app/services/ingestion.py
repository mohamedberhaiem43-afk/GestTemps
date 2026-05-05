"""Pipeline d'ingestion : load -> split -> embed -> upsert Qdrant.

Le caller .NET passe le fichier en multipart, on le sauve temporairement, on charge
via le bon DocumentLoader LangChain selon le content_type, on splitte avec
RecursiveCharacterTextSplitter, on embedde, puis on upserte dans la collection
tenant_{soccod}. La collection est creee paresseusement si elle n'existe pas.
"""

from __future__ import annotations

import os
import tempfile
import uuid
from pathlib import Path

from langchain_community.document_loaders import (
    Docx2txtLoader,
    PyPDFLoader,
    TextLoader,
)
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from qdrant_client.http import models as qmodels

from app.config import settings
from app.deps import collection_name, embed_passages, get_qdrant_client


def _select_loader(path: str, content_type: str):
    ct = (content_type or "").lower()
    if "pdf" in ct or path.lower().endswith(".pdf"):
        return PyPDFLoader(path)
    if "wordprocessingml" in ct or path.lower().endswith(".docx"):
        return Docx2txtLoader(path)
    return TextLoader(path, encoding="utf-8")


def _ensure_collection(client, name: str) -> None:
    existing = {c.name for c in client.get_collections().collections}
    if name in existing:
        return
    client.create_collection(
        collection_name=name,
        vectors_config=qmodels.VectorParams(
            size=settings.embed_dim,
            distance=qmodels.Distance.COSINE,
        ),
    )
    # Index payload pour filtrer rapidement par soccod et document_id.
    client.create_payload_index(name, "soccod", field_schema=qmodels.PayloadSchemaType.KEYWORD)
    client.create_payload_index(name, "document_id", field_schema=qmodels.PayloadSchemaType.INTEGER)


def ingest_document(
    *,
    soccod: str,
    document_id: int,
    original_name: str,
    content_type: str,
    file_bytes: bytes,
) -> tuple[int, int]:
    """Ingere un document. Retourne (chunks_count, pages)."""

    # Sauve le fichier dans un repertoire temp ; les loaders LangChain veulent un path.
    suffix = Path(original_name).suffix or ""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        loader = _select_loader(tmp_path, content_type)
        docs: list[Document] = loader.load()
        pages = len(docs) if docs else 0

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        chunks = splitter.split_documents(docs)
        if not chunks:
            return 0, pages

        texts = [c.page_content for c in chunks]
        vectors = embed_passages(texts)

        client = get_qdrant_client()
        coll = collection_name(soccod)
        _ensure_collection(client, coll)

        # Avant upsert : on supprime tout chunk existant pour ce document_id (re-index).
        client.delete(
            collection_name=coll,
            points_selector=qmodels.FilterSelector(
                filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(key="soccod", match=qmodels.MatchValue(value=soccod)),
                        qmodels.FieldCondition(key="document_id", match=qmodels.MatchValue(value=document_id)),
                    ]
                )
            ),
        )

        points = []
        for idx, (chunk, vec) in enumerate(zip(chunks, vectors)):
            page = chunk.metadata.get("page")
            points.append(
                qmodels.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vec,
                    payload={
                        "soccod": soccod,
                        "document_id": document_id,
                        "document_name": original_name,
                        "chunk_idx": idx,
                        "page": int(page) + 1 if isinstance(page, int) else None,
                        "text": chunk.page_content,
                    },
                )
            )
        client.upsert(collection_name=coll, points=points)

        return len(points), pages
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def delete_document(soccod: str, document_id: int) -> None:
    client = get_qdrant_client()
    coll = collection_name(soccod)
    # Si la collection n'existe pas (tenant n'a jamais ingere), on ignore silencieusement.
    if coll not in {c.name for c in client.get_collections().collections}:
        return
    client.delete(
        collection_name=coll,
        points_selector=qmodels.FilterSelector(
            filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(key="soccod", match=qmodels.MatchValue(value=soccod)),
                    qmodels.FieldCondition(key="document_id", match=qmodels.MatchValue(value=document_id)),
                ]
            )
        ),
    )
