"""Recherche top-k filtree par soccod (defense en profondeur)."""

from __future__ import annotations

from qdrant_client.http import models as qmodels

from app.deps import collection_name, embed_query, get_qdrant_client
from app.models import RetrieveItem


def retrieve(*, soccod: str, query: str, top_k: int) -> list[RetrieveItem]:
    client = get_qdrant_client()
    coll = collection_name(soccod)
    # Tenant qui n'a encore rien ingere : pas de collection, on renvoie vide plutot que de planter.
    if coll not in {c.name for c in client.get_collections().collections}:
        return []

    vec = embed_query(query)

    results = client.search(
        collection_name=coll,
        query_vector=vec,
        limit=top_k,
        with_payload=True,
        # Garde-fou : meme si la collection est theoriquement isolee par tenant,
        # on filtre AUSSI sur le payload soccod. Empeche tout leak en cas de mauvais
        # nommage de collection cote caller.
        query_filter=qmodels.Filter(
            must=[qmodels.FieldCondition(key="soccod", match=qmodels.MatchValue(value=soccod))]
        ),
    )

    out: list[RetrieveItem] = []
    for r in results:
        payload = r.payload or {}
        out.append(
            RetrieveItem(
                text=payload.get("text", ""),
                document_id=int(payload.get("document_id", 0)),
                document_name=payload.get("document_name"),
                page=payload.get("page"),
                score=float(r.score) if r.score is not None else 0.0,
            )
        )
    return out
