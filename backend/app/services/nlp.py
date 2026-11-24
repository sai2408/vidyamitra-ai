"""Offline NLP engine: sentence splitting, chunking, TF-IDF retrieval, extractive answers,
summaries and key-term extraction. Uses scikit-learn only, so it runs without internet or API keys."""
import re

import numpy as np
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

NOT_FOUND_THRESHOLD = 0.08
TOKEN = r"(?u)\b[A-Za-z0-9][A-Za-z0-9+#\-]*\b"
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])")
_DEFINITION = re.compile(r"\b(is|are) (a|an|the)\b|\b(means|refers to|called|known as|defined as)\b", re.IGNORECASE)
_FILLER = re.compile(r"\b(explain|define|describe|elaborate|briefly|tell me about|what do you mean by|meant by|"
                     r"difference between|differentiate|give an example of)\b", re.IGNORECASE)
_PRONOUN_START = re.compile(r"^(This|It|They|These|That|Those)\b")
# Generic words that make poor "key terms" for summaries, suggestions and quizzes.
GENERIC = set(ENGLISH_STOP_WORDS) | {
    "called", "known", "used", "uses", "using", "use", "based", "means", "example", "examples", "summary",
    "introduction", "overview", "removes", "remove", "makes", "make", "given", "gives", "set", "time", "times",
    "data", "process", "processes", "table", "tables", "type", "types", "way", "number", "value", "values",
    "important", "main", "different", "simple", "small", "large", "long", "short", "new", "good", "high", "low",
    "order", "level", "layer", "layers", "row", "rows", "users", "user", "system", "systems", "requires",
    "problem", "solution", "version", "trade-off", "common", "especially", "certain", "specific", "useful",
    "occurs", "occur", "exists", "exist", "depends", "depend", "leads", "allows", "helps", "gets", "takes",
    "chosen", "known", "therefore", "usually", "busy", "wait", "waits", "attributes", "attribute",
    "services", "service", "addresses", "address", "works", "work", "link", "results", "result",
}
# Verbs and connectives never belong in a key phrase, in any position.
VERBISH = {
    "occurs", "occur", "exists", "exist", "depends", "depend", "leads", "allows", "helps", "gets", "takes",
    "provides", "provide", "operate", "operates", "handles", "removes", "uses", "used", "called", "known",
    "gives", "makes", "means", "requires", "decide", "decides", "solves", "risks", "suffers", "become", "becomes",
}


def _is_heading(line: str, next_line: str) -> bool:
    words = line.split()
    return (0 < len(words) <= 8 and not re.search(r"[.!?:;,]$", line)
            and (not next_line or next_line[:1].isupper() or next_line[:1].isdigit()))


def clean_text(text: str) -> str:
    """Join wrapped lines into paragraphs and drop heading lines, so headings never merge into sentences."""
    text = text.replace("­", "").replace("\r", "")
    text = re.sub(r"-\n(?=[a-z])", "", text)
    lines = [ln.strip() for ln in text.split("\n")]
    out = []
    for i, line in enumerate(lines):
        if not line:
            out.append(" ")
            continue
        nxt = next((ln for ln in lines[i + 1:] if ln), "")
        prev = out[-1].strip() if out else ""
        starts_block = not prev or prev.endswith((".", "!", "?"))
        if starts_block and _is_heading(line, nxt):
            out.append(" ")  # heading -> separator
            continue
        out.append(re.sub(r"^[•●▪◦\-\*]\s*", "", line))
    text = " ".join(out)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_sentences(text: str) -> list[str]:
    sentences = []
    for s in _SENT_SPLIT.split(clean_text(text)):
        s = s.strip()
        if len(s.split()) >= 4:
            if not s.endswith((".", "!", "?")):
                s += "."
            sentences.append(s)
    return sentences


def chunk_pages(pages: list[str], window: int = 3, stride: int = 2) -> list[tuple[int, str]]:
    """Split each page into overlapping chunks of `window` sentences."""
    chunks = []
    for page_no, page_text in enumerate(pages, start=1):
        sents = split_sentences(page_text)
        for start in range(0, max(1, len(sents) - window + stride), stride):
            part = sents[start:start + window]
            if part:
                chunks.append((page_no, " ".join(part)))
    return chunks


def _search_analyzer(text: str) -> list[str]:
    """Tokens for question matching: stop words removed, plurals folded (sprints -> sprint), plus bigrams."""
    toks = [_stem(t) for t in re.findall(TOKEN, text.lower()) if t not in ENGLISH_STOP_WORDS]
    return toks + [f"{a} {b}" for a, b in zip(toks, toks[1:])]


def _search_vectorizer() -> TfidfVectorizer:
    return TfidfVectorizer(analyzer=_search_analyzer, sublinear_tf=True)


def _vectorizer(ngrams=(1, 2)) -> TfidfVectorizer:
    return TfidfVectorizer(stop_words="english", ngram_range=ngrams, sublinear_tf=True, token_pattern=TOKEN)


def _stem(word: str) -> str:
    for suf, rep in (("ies", "y"), ("sses", "ss"), ("es", ""), ("s", "")):
        if word.endswith(suf) and len(word) - len(suf) >= 3:
            return word[: -len(suf)] + rep
    return word


def question_keywords(question: str) -> list[str]:
    words = re.findall(r"[A-Za-z0-9][A-Za-z0-9+#\-]*", question.lower())
    skip = ENGLISH_STOP_WORDS | {"explain", "define", "difference", "describe", "meant", "mean", "does", "tell"}
    return sorted({w for w in words if w not in skip and len(w) > 1 and not w.isdigit()})


def _coverage(keywords: list[str], text: str) -> float:
    if not keywords:
        return 0.0
    low = text.lower()
    hits = sum(1 for k in keywords if _stem(k)[:5] in low)
    return hits / len(keywords)


def confidence_label(score: int) -> str:
    return "High" if score >= 70 else "Medium" if score >= 45 else "Low"


def answer_question(question: str, chunks: list[dict], max_sentences: int = 3) -> dict:
    """chunks: [{id, text, page, document_id, document_title}] -> answer with citations."""
    keywords = question_keywords(question)
    if not chunks:
        return {"found": False, "answer": "You have no documents yet. Upload your notes to start asking questions.",
                "confidence": 0, "confidence_label": "Low", "sources": [], "keywords": keywords}

    corpus = [c["text"] for c in chunks]
    query = _FILLER.sub(" ", question)
    vec = _search_vectorizer().fit(corpus + [query])
    q_vec = vec.transform([query])
    sims = cosine_similarity(q_vec, vec.transform(corpus)).ravel()
    order = np.argsort(-sims)
    best = float(sims[order[0]])

    if best < NOT_FOUND_THRESHOLD or q_vec.nnz == 0 or _coverage(keywords, corpus[order[0]]) == 0:
        return {"found": False,
                "answer": "I couldn't find this in your uploaded notes. Try rephrasing, or upload a document that covers this topic.",
                "confidence": 0, "confidence_label": "Low", "sources": [], "keywords": keywords}

    top = [int(i) for i in order[:5] if sims[i] >= max(0.05, best * 0.4)]
    candidates, seen = [], set()
    for rank, idx in enumerate(top):
        for s_pos, sent in enumerate(split_sentences(corpus[idx])):
            key = re.sub(r"\W+", "", sent.lower())
            if key in seen:
                continue
            seen.add(key)
            candidates.append({"text": sent, "rank": rank, "pos": s_pos, "chunk": idx})

    sent_sims = cosine_similarity(q_vec, vec.transform([c["text"] for c in candidates])).ravel()
    for c, s in zip(candidates, sent_sims):
        score = 0.8 * float(s) + 0.2 * float(sims[c["chunk"]])
        low = c["text"].lower()
        words = low.split()
        stems = [_stem(k)[:5] for k in keywords]
        if _DEFINITION.search(c["text"]):
            if any(st in " ".join(words[:5]) for st in stems):
                score += 0.22  # sentence opens with the asked term and defines it
            elif any(st in " ".join(words[:9]) for st in stems):
                score += 0.10
        if any(re.search(r"\b" + re.escape(st) + r"[\w-]*\s+((is|are) (a|an|the)|means|refers)\b", low) for st in stems):
            score += 0.12  # "<term> is ..." pattern
        if any(re.search(r"\bcalled (a |an |the )?" + re.escape(st), low) for st in stems):
            score += 0.30  # "... is called a time quantum"
        if any(re.match(r"^(a |an |the )?" + re.escape(st), low) for st in stems):
            score += 0.10  # sentence is about the asked term
        if any(re.search(r"\b(is|are) in (a |an |the )?" + re.escape(st) + r"[\w-]*\s+when\b", low) for st in stems):
            score += 0.12  # "a table is in BCNF when ..."
        if _PRONOUN_START.match(c["text"]) or re.search(r"\b(therefore|thus|hence)\b", low):
            score -= 0.20  # leans on a previous sentence
        c["score"], c["sim"] = score, float(s)
    ranked = sorted([c for c in candidates if c["sim"] > 0], key=lambda c: -c["score"])
    if not ranked:
        ranked = sorted(candidates, key=lambda c: -c["score"])
    lead = ranked[0]
    rest = [c for c in ranked[1:] if c["score"] >= lead["score"] * 0.5 and c["sim"] >= 0.1][: max_sentences - 1]
    rest.sort(key=lambda c: (c["rank"], c["pos"]))
    picked = [lead] + rest
    # Make sure every asked term is covered (e.g. both sides of "difference between TCP and UDP").
    compare = re.search(r"\b(difference|differ|compare|comparison|vs|versus|and)\b", question, re.IGNORECASE)
    head = lambda c: " ".join(c["text"].lower().split()[:6])  # noqa: E731
    for k in keywords:
        st = _stem(k)[:5]
        where = head if compare else (lambda c: c["text"].lower())
        if len(picked) >= max_sentences + 1 or any(st in where(c) for c in picked):
            continue
        extra = (next((c for c in ranked if c not in picked and st in head(c)), None)
                 or next((c for c in ranked if c not in picked and st in c["text"].lower()), None))
        if extra:
            picked.append(extra)
    answer = " ".join(c["text"] for c in picked)

    used_chunks = []
    for c in picked:
        if c["chunk"] not in used_chunks:
            used_chunks.append(c["chunk"])
    sources = [{"document_id": chunks[i]["document_id"], "document_title": chunks[i]["document_title"],
                "page": chunks[i]["page"], "snippet": chunks[i]["text"][:320],
                "relevance": int(min(99, round(float(sims[i]) * 200)))} for i in used_chunks]

    strength = min(1.0, lead["sim"] / 0.45)
    confidence = int(round(100 * (0.55 * _coverage(keywords, answer) + 0.45 * strength)))
    confidence = max(20, min(97, confidence))
    return {"found": True, "answer": answer, "confidence": confidence,
            "confidence_label": confidence_label(confidence), "sources": sources, "keywords": keywords,
            "context": [chunks[i]["text"] for i in used_chunks]}


def summarize(pages: list[str], n: int = 5) -> str:
    """Centroid summary: sentences closest to the document's overall topic, in reading order."""
    sents = [s for p in pages for s in split_sentences(p)]
    if len(sents) <= n:
        return " ".join(sents)
    vec = _vectorizer((1, 2))
    try:
        m = vec.fit_transform(sents)
    except ValueError:
        return " ".join(sents[:n])
    centroid = np.asarray(m.mean(axis=0))
    scores = cosine_similarity(m, centroid).ravel()
    lengths = np.array([len(s.split()) for s in sents])
    scores[lengths < 8] *= 0.5
    scores[lengths > 40] *= 0.7
    scores[0] *= 1.25
    chosen = []
    for i in np.argsort(-scores):
        if all(cosine_similarity(m[i], m[j])[0, 0] < 0.5 for j in chosen):
            chosen.append(int(i))
        if len(chosen) == n:
            break
    return " ".join(sents[i] for i in sorted(chosen))


def key_terms(pages: list[str], k: int = 12) -> list[str]:
    sents = [s for p in pages for s in split_sentences(p)]
    if not sents:
        return []
    vec = _vectorizer((1, 2))
    try:
        m = vec.fit_transform(sents)
    except ValueError:
        return []
    scores = np.asarray(m.sum(axis=0)).ravel()
    terms = vec.get_feature_names_out()
    full = " ".join(sents)
    weighted = []
    for i, t in enumerate(terms):
        words = t.split()
        if len(t) < 3 or any(w in VERBISH or w.isdigit() or len(w) < 2 for w in words):
            continue
        if (len(words) == 1 and words[0] in GENERIC) or (len(words) == 2 and all(w in GENERIC for w in words)):
            continue
        if len(words) == 2 and not re.search(r"\b" + re.escape(words[0]) + r"\s+" + re.escape(words[1]) + r"\b",
                                             full, re.IGNORECASE):
            continue  # skip pairs that only look adjacent after stop-word removal
        if len(words) == 2 and len(re.findall(r"\b" + re.escape(t) + r"\b", full, re.IGNORECASE)) < 2:
            continue  # a real key phrase repeats in the notes
        w = scores[i]
        if len(words) == 2:
            w *= 1.6
        if re.search(r"\b" + re.escape(t.upper()) + r"\b", full) and len(t) <= 6:
            w *= 1.4  # acronym such as FCFS, BCNF, TCP
        weighted.append((w, t))
    weighted.sort(reverse=True)

    chosen: list[str] = []
    stems: set[str] = set()
    for _, t in weighted:
        st = " ".join(_stem(w) for w in t.split())
        if st in stems:
            continue
        if len(t.split()) == 1 and any(st in c_st.split() for c_st in stems):
            continue  # already covered by a chosen phrase
        chosen.append(t)
        stems.add(st)
        if len(chosen) >= k:
            break
    return chosen


def suggestion_terms(pages_text: str, terms: list[str], limit: int = 3) -> list[str]:
    """Key terms that the notes actually define (e.g. 'X is ...'), best for suggested questions."""
    out = []
    terms = sorted(terms, key=lambda t: (len(t.split()) == 1 and not (t.upper() in pages_text and len(t) <= 6)))
    for t in terms:
        if re.search(r"\b" + re.escape(t) + r"\b[^.]{0,40}\b(is|are|means|refers)\b", pages_text, re.IGNORECASE):
            out.append(original_case(t, pages_text))
        if len(out) >= limit:
            break
    return out


def original_case(term: str, text: str) -> str:
    m = re.search(r"\b" + re.escape(term) + r"\b", text, flags=re.IGNORECASE)
    return m.group(0) if m else term
