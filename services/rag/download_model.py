"""Pré-téléchargement résilient du modèle d'embeddings au build Docker.

Pourquoi : `SentenceTransformer('intfloat/multilingual-e5-large')` déclenche le
téléchargement de ~2,2 Go répartis sur plusieurs fichiers. Le Hugging Face Hub
applique un rate-limit (HTTP 429) qui fait échouer le build, surtout sans token
(les requêtes anonymes ont un quota bas) et quand plusieurs builds tournent.

Ce script ré-essaie avec un backoff exponentiel borné, ce qui absorbe les 429
transitoires. On utilise `snapshot_download` (qui reprend les fichiers déjà
récupérés à chaque tentative — pas de re-téléchargement complet) puis on charge
le modèle pour valider le cache.

Le modèle et le cache sont pilotés par variables d'env (cf. Dockerfile) :
  MODEL_ID            (def. intfloat/multilingual-e5-large)
  HF_HOME / HF_HUB_*  cache HuggingFace
Un token éventuel (HUGGING_FACE_HUB_TOKEN / HF_TOKEN) est utilisé s'il est
présent — fortement recommandé pour relever le quota anti-429.
"""

import os
import sys
import time

MODEL_ID = os.environ.get("MODEL_ID", "intfloat/multilingual-e5-large")
MAX_ATTEMPTS = int(os.environ.get("MODEL_DL_MAX_ATTEMPTS", "8"))
BASE_DELAY = float(os.environ.get("MODEL_DL_BASE_DELAY", "15"))  # secondes
MAX_DELAY = float(os.environ.get("MODEL_DL_MAX_DELAY", "300"))   # plafond du backoff

# Token optionnel : relève fortement le quota HF (anonyme = quota bas → 429).
TOKEN = (
    os.environ.get("HUGGING_FACE_HUB_TOKEN")
    or os.environ.get("HF_TOKEN")
    or None
)


def _is_rate_limited(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "429" in msg or "too many requests" in msg or "rate limit" in msg


def main() -> int:
    from huggingface_hub import snapshot_download
    from sentence_transformers import SentenceTransformer

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            # snapshot_download reprend les fichiers déjà en cache → les retries
            # ne re-téléchargent que ce qui manque.
            snapshot_download(
                repo_id=MODEL_ID,
                token=TOKEN,
                # Inutile de tirer les variantes non utilisées (onnx, openvino, tf…).
                ignore_patterns=["*.onnx", "*.ot", "*.h5", "*.tflite", "openvino/*"],
            )
            # Charge le modèle pour valider l'intégrité du cache (chemin du runtime).
            SentenceTransformer(MODEL_ID)
            print(f"[download_model] OK — '{MODEL_ID}' en cache.", flush=True)
            return 0
        except Exception as exc:  # noqa: BLE001 - on veut retenter quoi qu'il arrive
            if attempt == MAX_ATTEMPTS:
                print(
                    f"[download_model] ÉCHEC après {MAX_ATTEMPTS} tentatives : {exc}",
                    file=sys.stderr,
                    flush=True,
                )
                return 1
            delay = min(MAX_DELAY, BASE_DELAY * (2 ** (attempt - 1)))
            reason = "HTTP 429 (rate-limit)" if _is_rate_limited(exc) else type(exc).__name__
            print(
                f"[download_model] tentative {attempt}/{MAX_ATTEMPTS} échouée "
                f"({reason}: {exc}). Nouvel essai dans {delay:.0f}s…",
                flush=True,
            )
            time.sleep(delay)
    return 1


if __name__ == "__main__":
    sys.exit(main())
