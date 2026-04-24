"""Ingest: uv run python scripts/ingest.py [--reset]"""
import argparse, os, sys
from pathlib import Path
import chromadb
from dotenv import load_dotenv
from openai import OpenAI

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.ingest import Ingestor

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()
    load_dotenv()
    collection = chromadb.PersistentClient(path=".chroma").get_or_create_collection("portfolio")
    openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    embed = lambda t: [e.embedding for e in openai_client.embeddings.create(model="text-embedding-3-small", input=t).data]
    result = Ingestor(collection, embed).run(reset=args.reset)
    print(f"Indexed {result.chunk_count} documents into 'portfolio'.")
