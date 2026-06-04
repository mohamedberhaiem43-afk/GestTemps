FROM python:3.11-slim

# Eviter le bytecompile et le buffering, garder les logs lisibles dans Docker.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/models \
    # Laisse plus de temps par fichier avant abandon (réseau lent / rate-limit HF).
    HF_HUB_DOWNLOAD_TIMEOUT=60

# Outils systeme pour PyPDF (libgomp1 pour torch CPU + git pour pip VCS si besoin).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installer Torch CPU prebuilt (plus rapide que la pull par defaut, gros wheel cuda inutile).
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.5.1

# Dependances Python (LangChain + FastAPI). Le pyproject est copie en premier pour
# beneficier du cache Docker quand seul le code applicatif change.
COPY pyproject.toml ./
RUN pip install --no-cache-dir \
    "fastapi==0.115.6" \
    "uvicorn[standard]==0.32.1" \
    "pydantic==2.10.4" \
    "pydantic-settings==2.7.0" \
    "python-multipart==0.0.20" \
    "langchain==0.3.13" \
    "langchain-community==0.3.13" \
    "langchain-text-splitters==0.3.4" \
    "langchain-qdrant==0.2.0" \
    "langchain-huggingface==0.1.2" \
    "qdrant-client==1.12.1" \
    "sentence-transformers==3.3.1" \
    "pypdf==5.1.0" \
    "docx2txt==0.8"

# IMPORTANT : le modèle e5-large (~2,2 Go) n'est PLUS téléchargé au build — ça saturait
# le disque du runner CI ("No space left on device"). Il est désormais récupéré au
# DÉMARRAGE du conteneur, une seule fois, dans le volume persistant /models (cf. CMD +
# docker-compose `rag_models:/models`), avec retry/backoff. L'image reste donc légère et
# le build ne dépend plus de la place disque / du Hub HF.
COPY download_model.py ./
COPY app ./app

EXPOSE 8080

# Hardening : ne pas tourner en root. UID fixe (10001) pour reproducibilité.
# On crée /models et on lui donne l'ownership 10001 AVANT le passage en non-root : quand
# le volume nommé `rag_models` se monte sur /models, il hérite de cette ownership →
# l'app (UID 10001) peut y écrire le modèle téléchargé au 1er démarrage.
RUN groupadd --system --gid 10001 appgrp \
 && useradd  --system --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin appusr \
 && mkdir -p /models \
 && chown -R 10001:10001 /models
USER 10001:10001

# Au 1er démarrage : pré-télécharge le modèle dans /models (volume) avec retry/backoff,
# puis lance l'API. Démarrages suivants : modèle déjà en cache (volume) → quasi instantané.
# `|| true` : si le pré-chargement échoue (réseau), on démarre quand même — l'app fera un
# lazy-load au 1er /retrieve. Un seul worker : e5-large ~2 Go en RAM, à ne pas dupliquer.
CMD ["sh", "-c", "python download_model.py || true; exec uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 1"]
