"""Boundary tests for summary adapters — ChromaAtRiskSource and DictExposureLookup."""

import chromadb

from src.rag.summary.adapters import ChromaAtRiskSource, DictExposureLookup


def test_dict_exposure_lookup_returns_exposures_for_known_app():
    lookup = DictExposureLookup({"AuthService": [("Billing", 400), ("Payments", 200)]})
    result = lookup.for_application("AuthService")
    assert list(result) == [("Billing", 400), ("Payments", 200)]


def test_dict_exposure_lookup_returns_empty_for_unknown_app():
    lookup = DictExposureLookup({})
    assert lookup.for_application("NonExistentApp") == []


def test_chroma_at_risk_source_delegates_to_retrieve_at_risk_docs():
    client = chromadb.Client()
    collection = client.create_collection("test")
    collection.add(
        ids=["app-1"],
        documents=["AuthService at risk"],
        metadatas=[{"doc_type": "application", "risk_rating": "Critical", "owner": "team-a"}],
    )
    source = ChromaAtRiskSource(collection)
    docs = source.fetch()
    assert len(docs) == 1
    assert docs[0].document == "AuthService at risk"
    assert docs[0].metadata["risk_rating"] == "Critical"
