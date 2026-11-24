"""VidyaMitra AI - FastAPI application entry point.

Run (from the backend folder):  uvicorn app.main:app --reload --port 8000
API docs:                        http://localhost:8000/docs
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS, UPLOAD_DIR
from .migrate import migrate
from .routers import admin, ask, auth_routes, dashboard, documents, payments, quizzes
from .services.llm import llm_enabled
from .services.mailer import smtp_enabled

migrate()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="VidyaMitra AI API", version="1.0.0",
              description="AI study assistant: document Q&A with citations, summaries and auto-generated quizzes.")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

for r in (auth_routes, dashboard, documents, ask, quizzes, payments, admin):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "answer_engine": "llm" if llm_enabled() else "offline",
            "email": "smtp" if smtp_enabled() else "demo"}


# Serve the built frontend (frontend/dist) from the same server for a single-URL deployment.
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        target = (DIST / path).resolve()
        if path and target.is_file() and target.is_relative_to(DIST.resolve()):
            return FileResponse(target)
        return FileResponse(DIST / "index.html")
