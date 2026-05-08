FROM python:3.11-slim

# Eviter le bytecompile et le buffering, garder les logs lisibles dans Docker.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/models \
    TRANSFORMERS_CACHE=/models

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

COPY app ./app

# Pre-download du modele e5-large pour eviter le cold start au premier /retrieve.
# 2.2 Go DL une fois au build, mis en cache sur la couche image.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-large')"

EXPOSE 8080

# Hardening : ne pas tourner en root. /models est le cache HF (build-time) — readable par tous.
# /app est readable par tous (COPY le rend root:root mais 644). uvicorn n'a pas besoin d'écrire
# ailleurs que dans /tmp. UID fixe (10001) plutôt que useradd dynamique pour reproducibilité.
RUN groupadd --system --gid 10001 appgrp \
 && useradd  --system --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin appusr
USER 10001:10001

# Un seul worker : le modele e5-large prend ~2 Go en RAM, multiplier les workers le duplique.
# Pour scaler horizontalement, lancer plusieurs containers via Docker Compose `replicas`.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
