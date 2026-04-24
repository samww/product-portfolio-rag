"""Load application and product JSON files into typed dataclass objects."""

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Application:
    name: str
    division: str
    business_capability: str
    technology_stack: str
    owner: str
    risk_rating: str
    status: str
    annual_cost_workforce: int
    annual_cost_licenses: int
    annual_cost_cloud: int
    annual_cost_total: int
    dependencies: list[str]
    dependents: list[str]
    notes: str


@dataclass
class Product:
    name: str
    division: str
    description: str
    arr: int
    dependent_applications: list[str]


def load_applications(path: Path) -> list[Application]:
    records = json.loads(Path(path).read_text())
    return [Application(**r) for r in records]


def load_products(path: Path) -> list[Product]:
    records = json.loads(Path(path).read_text())
    return [Product(**r) for r in records]
