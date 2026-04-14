"""TDD tests for src/rag/generator.py

Run with: uv run pytest tests/test_generator.py -v
"""

from unittest.mock import MagicMock

from src.rag.generator import generate_answer, GeneratedAnswer
from src.rag.retriever import RetrievedDoc


def _make_docs(*names):
    return [
        RetrievedDoc(
            document=f"Application: {name}\nRisk: Critical",
            metadata={"doc_type": "application", "division": "X",
                      "risk_rating": "Critical", "status": "Active", "owner": name},
            distance=0.1,
        )
        for name in names
    ]


def _stub_openai(answer_text: str):
    """Return a mock OpenAI client whose chat.completions.create returns answer_text."""
    choice = MagicMock()
    choice.message.content = answer_text
    completion = MagicMock()
    completion.choices = [choice]
    client = MagicMock()
    client.chat.completions.create.return_value = completion
    return client


# ---------------------------------------------------------------------------
# Cycle 4: generate_answer returns a GeneratedAnswer
# ---------------------------------------------------------------------------

def test_generate_answer_returns_generated_answer():
    client = _stub_openai("AuthService is critical.")
    docs = _make_docs("AuthService")
    result = generate_answer("Which apps are critical?", docs, client)
    assert isinstance(result, GeneratedAnswer)
    assert result.answer == "AuthService is critical."


# ---------------------------------------------------------------------------
# Cycle 5: generate_answer extracts source names from doc metadata
# ---------------------------------------------------------------------------

def test_generate_answer_sources_from_metadata():
    client = _stub_openai("Two critical apps found.")
    docs = _make_docs("AuthService", "PaymentGateway")
    result = generate_answer("critical apps", docs, client)
    assert "AuthService" in result.sources
    assert "PaymentGateway" in result.sources


# ---------------------------------------------------------------------------
# Cycle 6: generate_answer includes the system prompt in the OpenAI call
# ---------------------------------------------------------------------------

def test_generate_answer_uses_system_prompt():
    from src.rag.prompts import SYSTEM_PROMPT
    client = _stub_openai("Some answer.")
    docs = _make_docs("AuthService")
    generate_answer("any query", docs, client)
    call_args = client.chat.completions.create.call_args
    messages = call_args.kwargs.get("messages") or call_args.args[0] if call_args.args else call_args.kwargs["messages"]
    system_messages = [m for m in messages if m["role"] == "system"]
    assert system_messages, "No system message found in OpenAI call"
    assert SYSTEM_PROMPT in system_messages[0]["content"]
