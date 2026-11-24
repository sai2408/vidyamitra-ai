"""Optional generative answers through any OpenAI-compatible chat API (OpenAI, Groq, a local Ollama, ...).
Only used when LLM_API_KEY is set; otherwise the offline engine answers."""
import json
import urllib.request

from ..config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL


def llm_enabled() -> bool:
    return bool(LLM_API_KEY)


def generate_answer(question: str, context: list[str]) -> str | None:
    if not llm_enabled() or not context:
        return None
    numbered = "\n\n".join(f"[{i + 1}] {c}" for i, c in enumerate(context))
    body = {
        "model": LLM_MODEL,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": "You are VidyaMitra, a study assistant. Answer ONLY from the given "
             "notes. Be clear and concise (2-4 sentences) and cite passages like [1]. If the notes do not "
             "contain the answer, say you could not find it in the notes."},
            {"role": "user", "content": f"Notes:\n{numbered}\n\nQuestion: {question}"},
        ],
    }
    req = urllib.request.Request(f"{LLM_BASE_URL}/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          "Authorization": f"Bearer {LLM_API_KEY}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return None  # fall back to the offline answer
