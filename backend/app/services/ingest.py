"""Turns an uploaded PDF or TXT file into a Document with searchable chunks, a summary and key terms."""
import json
from pathlib import Path

from pypdf import PdfReader
from sqlalchemy.orm import Session

from ..models import Chunk, Document, User
from .nlp import chunk_pages, key_terms, split_sentences, summarize


class IngestError(ValueError):
    pass


def extract_pages(path: Path) -> list[str]:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        try:
            reader = PdfReader(str(path))
            pages = [(p.extract_text() or "") for p in reader.pages]
        except Exception:
            raise IngestError("This PDF could not be read. It may be damaged or password-protected.")
    elif suffix == ".txt":
        raw = path.read_text(encoding="utf-8", errors="ignore")
        # Treat a form-feed or ~400 words as a "page" so citations stay useful.
        parts = raw.split("\f") if "\f" in raw else None
        if not parts:
            words = raw.split()
            parts = [" ".join(words[i:i + 400]) for i in range(0, len(words), 400)] or [""]
        pages = parts
    else:
        raise IngestError("Only PDF and TXT files are supported.")
    if sum(len(p.split()) for p in pages) < 30:
        if suffix == ".pdf":
            raise IngestError("No readable text found. Scanned (image-only) PDFs are not supported; "
                              "please upload a text-based PDF or TXT file.")
        raise IngestError("This file has too little text to analyse. Please upload notes with at least a few paragraphs.")
    return pages


def ingest_file(db: Session, user: User, path: Path, title: str) -> Document:
    pages = extract_pages(path)
    chunks = chunk_pages(pages)
    if not chunks:
        raise IngestError("The document has too little text to analyse.")
    doc = Document(user_id=user.id, title=title[:255], filename=path.name, file_type=path.suffix.lstrip(".").lower(),
                   pages=len(pages), word_count=sum(len(p.split()) for p in pages),
                   summary=summarize(pages), key_terms=json.dumps(key_terms(pages, k=12)))
    db.add(doc)
    db.flush()
    for pos, (page_no, text) in enumerate(chunks):
        db.add(Chunk(document_id=doc.id, page=page_no, position=pos, text=text))
    db.commit()
    db.refresh(doc)
    return doc


def document_pages(doc: Document) -> list[str]:
    """Rebuild per-page text from stored chunks (used for quizzes)."""
    by_page: dict[int, list[str]] = {}
    for ch in sorted(doc.chunks, key=lambda c: c.position):
        by_page.setdefault(ch.page, []).append(ch.text)
    if not by_page:
        return []
    pages = [""] * max(by_page)  # index = page number - 1, so quiz citations keep real page numbers
    for page_no, texts in by_page.items():
        seen, sents = set(), []
        for text in texts:
            for s in split_sentences(text):
                if s not in seen:
                    seen.add(s)
                    sents.append(s)
        pages[page_no - 1] = " ".join(sents)
    return pages
