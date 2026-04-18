from dataclasses import dataclass

from src.rag.models import ProductExposure, SummaryReport
from src.rag.summary.ports import AtRiskRecordsSource, ExposureLookup, StructuredAnalyst


@dataclass(frozen=True)
class SummaryService:
    records: AtRiskRecordsSource
    analyst: StructuredAnalyst
    exposures: ExposureLookup

    def run(self) -> SummaryReport:
        report = self.analyst(self.records.fetch())
        enriched = [
            risk.model_copy(update={"product_exposures": [
                ProductExposure(product=p, arr_000s=a)
                for p, a in self.exposures.for_application(risk.application)
            ]})
            for risk in report.critical_risks
        ]
        return report.model_copy(update={"critical_risks": enriched})
