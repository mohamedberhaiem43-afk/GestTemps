"""FastAPI entry point — auth header + route assembly + global error handling."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import embed, health, ingest, retrieve

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ABRPOINT RAG sidecar",
    version="0.1.0",
    description="Ingestion / retrieval / embeddings pour ABRPOINT GestTemps. "
                "Acces reserve au backend .NET via header X-Sidecar-Key.",
)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # /health reste accessible sans auth pour faciliter le ping Docker.
    if request.url.path == "/health":
        return await call_next(request)

    # En dev (sidecar_key vide), on tolere — production : configurer la cle.
    if settings.sidecar_key:
        provided = request.headers.get("X-Sidecar-Key")
        if provided != settings.sidecar_key:
            return JSONResponse(status_code=401, content={"detail": "invalid sidecar key"})

    return await call_next(request)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


app.include_router(health.router, tags=["health"])
app.include_router(ingest.router, tags=["ingest"])
app.include_router(retrieve.router, tags=["retrieve"])
app.include_router(embed.router, tags=["embed"])
