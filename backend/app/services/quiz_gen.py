"""Generates fill-in-the-blank multiple-choice questions from a document's own sentences."""
import random
import re

from .nlp import key_terms, original_case, split_sentences


def generate_quiz(pages: list[str], num_questions: int = 5, seed: int | None = None) -> list[dict]:
    rng = random.Random(seed)
    full_text = " ".join(pages)
    terms = key_terms(pages, k=40)
    if len(terms) < 4:
        return []
    display = {t: original_case(t, full_text) for t in terms}
    # Prefer phrases and acronyms as answers; single generic words make weaker questions.
    answer_order = sorted(terms, key=lambda t: 0 if len(t.split()) > 1 or (display[t].isupper() and len(t) <= 6) else 1)

    sentences = []
    for page_no, page in enumerate(pages, start=1):
        for s in split_sentences(page):
            if 8 <= len(s.split()) <= 38 and not re.match(r"(This|It|They|These|That|Those|For example)\b", s):
                sentences.append((page_no, s))

    questions, used_sentences, used_terms = [], set(), set()
    for term in answer_order:
        if len(questions) >= num_questions:
            break
        pattern = re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE)
        for page_no, sent in sentences:
            if sent in used_sentences or not pattern.search(sent):
                continue
            stem = pattern.sub("_______", sent, count=1)
            pool = [t for t in terms if t != term and t not in used_terms
                    and not pattern.search(t) and t not in term
                    and not re.search(r"\b" + re.escape(t) + r"\b", sent, re.IGNORECASE)]
            pool = [t for t in pool if len(t.split()) > 1 or display[t].isupper()
                    or len(re.findall(r"\b" + re.escape(t) + r"\b", full_text, re.IGNORECASE)) >= 3]
            same_shape = [t for t in pool if len(t.split()) == len(term.split())]
            distractors = (same_shape if len(same_shape) >= 3 else pool)[:12]
            if len(distractors) < 3:
                continue
            options = [display[term]] + [display[t] for t in rng.sample(distractors, 3)]
            rng.shuffle(options)
            questions.append({"id": len(questions) + 1, "question": stem, "options": options,
                              "answer": display[term], "page": page_no,
                              "explanation": f"From page {page_no} of your notes: \"{sent}\""})
            used_sentences.add(sent)
            used_terms.add(term)
            break
    return questions
