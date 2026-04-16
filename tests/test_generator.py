"""TDD tests for src/rag/generator.py

Run with: uv run pytest tests/test_generator.py -v
"""

from unittest.mock import MagicMock

from src.rag.generator import generate_answer, generate_answer_stream, generate_summary, GeneratedAnswer
from src.rag.models import SummaryReport
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

# ---------------------------------------------------------------------------
# Cycle 10: generate_answer_stream yields token delta strings
# ---------------------------------------------------------------------------

def _stub_streaming_openai(tokens: list[str]):
    """Return a mock OpenAI client whose streaming completion yields token chunks."""
    def make_chunk(content):
        chunk = MagicMock()
        chunk.choices[0].delta.content = content
        return chunk

    client = MagicMock()
    client.chat.completions.create.return_value = iter(make_chunk(t) for t in tokens)
    return client


def test_generate_answer_stream_yields_tokens():
    client = _stub_streaming_openai(["Hello", " world", "!"])
    docs = _make_docs("AuthService")
    tokens = list(generate_answer_stream("test query", docs, client))
    assert tokens == ["Hello", " world", "!"]


# ---------------------------------------------------------------------------
# Cycle 14: generate_summary returns a SummaryReport
# ---------------------------------------------------------------------------

_SUMMARY_REPORT = {
    "overall_health": "Critical",
    "executive_summary": "Two applications are at high risk.",
    "critical_risks": [
        {
            "application": "AuthService",
            "risk_rating": "Critical",
            "issue": "Vendor EOL",
            "revenue_at_risk_000s": 6200,
            "recommended_action": "Migrate immediately",
            "priority": "P1",
        }
    ],
    "governance_gaps": [
        {
            "application": "ContractVault",
            "issue": "No named owner",
            "recommended_action": "Assign an owner",
        }
    ],
    "total_apps_reviewed": 2,
    "total_arr_at_risk_000s": 6200,
}


def _stub_summary_openai(report: dict):
    """Mock OpenAI client that returns a structured summary via parsed attribute."""
    import json
    parsed = MagicMock()
    parsed.model_dump.return_value = report
    # response_format=... path uses .choices[0].message.parsed
    choice = MagicMock()
    choice.message.parsed = parsed
    completion = MagicMock()
    completion.choices = [choice]
    client = MagicMock()
    client.beta.chat.completions.parse.return_value = completion
    return client


def test_generate_summary_returns_summary_report():
    client = _stub_summary_openai(_SUMMARY_REPORT)
    docs = _make_docs("AuthService", "ContractVault")
    result = generate_summary(docs, client)
    assert isinstance(result, SummaryReport)


def test_generate_summary_uses_structured_output_parse():
    client = _stub_summary_openai(_SUMMARY_REPORT)
    docs = _make_docs("AuthService")
    generate_summary(docs, client)
    assert client.beta.chat.completions.parse.called
    call_kwargs = client.beta.chat.completions.parse.call_args.kwargs
    assert call_kwargs.get("response_format") is SummaryReport


def test_generate_summary_passes_all_docs_as_context():
    client = _stub_summary_openai(_SUMMARY_REPORT)
    docs = _make_docs("AuthService", "ForecastTool", "ContractVault")
    generate_summary(docs, client)
    call_kwargs = client.beta.chat.completions.parse.call_args.kwargs
    user_content = next(m["content"] for m in call_kwargs["messages"] if m["role"] == "user")
    assert "AuthService" in user_content
    assert "ForecastTool" in user_content
    assert "ContractVault" in user_content


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
