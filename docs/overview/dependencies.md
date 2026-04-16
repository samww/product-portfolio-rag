# Application & Product Dependencies

Two sections:
1. **Application dependencies** — which applications depend on which, grouped by division, styled by risk rating
2. **Per-product dependency diagrams** — one diagram per product showing its direct application dependencies and those applications' own dependencies (two levels deep)

**Risk key (diagram 1):** 🔴 Critical &nbsp;|&nbsp; 🟠 High &nbsp;|&nbsp; 🟡 Medium &nbsp;|&nbsp; 🟢 Low &nbsp;|&nbsp; dashed border = no named owner

---

## Diagram 1: Application-to-Application Dependencies

Arrow direction: `A → B` means *A depends on B*.

```mermaid
graph TD
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef high     fill:#ff9933,stroke:#cc6600,color:#fff
    classDef medium   fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low      fill:#57cc99,stroke:#2e8b57,color:#000
    classDef noowner  stroke:#ff0000,stroke-width:3px,stroke-dasharray:6 4

    subgraph Analytics
        PanelIQ
        SurveyEngine
        InsightHub
        DataMapper
        QuotaManager
        SegmentBuilder
    end

    subgraph DataCollection["Data Collection"]
        FieldOps
        CallCentreSuite["CallCentre Suite ⚠ EOL 2026"]
        WebCollect
        DiaryTracker
        SampleRouter
    end

    subgraph ClientServices["Client Services"]
        ClientPortal
        ReportFactory["ReportFactory ✓ modernised 2024"]
        DeliveryTracker
        BriefManager
        ContractVault
    end

    subgraph PlatformEng["Platform Engineering"]
        CoreDataWarehouse
        APIGateway
        AuthService["AuthService ⚠ vendor EOL Q2 2026"]
        ObservabilityStack
        DevPortal
    end

    subgraph Finance
        BillingEngine
        CostTracker
        ForecastTool
        ProcurementHub
    end

    subgraph HR
        WorkforceModel
        LearningPortal
        OrgDesigner
        OnboardingFlow
        OffboardingFlow
    end

    %% Analytics
    PanelIQ       --> CoreDataWarehouse
    PanelIQ       --> AuthService
    SurveyEngine  --> PanelIQ
    SurveyEngine  --> CoreDataWarehouse
    SurveyEngine  --> AuthService
    InsightHub    --> CoreDataWarehouse
    InsightHub    --> AuthService
    InsightHub    --> APIGateway
    DataMapper    --> CoreDataWarehouse
    QuotaManager  --> SurveyEngine
    QuotaManager  --> CoreDataWarehouse
    SegmentBuilder --> PanelIQ
    SegmentBuilder --> CoreDataWarehouse

    %% Data Collection
    FieldOps       --> QuotaManager
    FieldOps       --> SampleRouter
    FieldOps       --> CoreDataWarehouse
    CallCentreSuite --> SampleRouter
    WebCollect     --> SurveyEngine
    WebCollect     --> AuthService
    DiaryTracker   --> CoreDataWarehouse
    DiaryTracker   --> SampleRouter
    SampleRouter   --> PanelIQ
    SampleRouter   --> CoreDataWarehouse

    %% Client Services
    ClientPortal   --> ReportFactory
    ClientPortal   --> AuthService
    ClientPortal   --> APIGateway
    ReportFactory  --> CoreDataWarehouse
    ReportFactory  --> DataMapper
    DeliveryTracker --> CoreDataWarehouse
    BriefManager   --> AuthService
    ContractVault  --> AuthService

    %% Platform Engineering
    CoreDataWarehouse --> AuthService

    %% Finance
    BillingEngine  --> CoreDataWarehouse
    BillingEngine  --> AuthService
    CostTracker    --> CoreDataWarehouse
    ProcurementHub --> AuthService

    %% HR
    WorkforceModel  --> AuthService
    WorkforceModel  --> CoreDataWarehouse
    LearningPortal  --> AuthService
    OrgDesigner     --> AuthService
    OrgDesigner     --> WorkforceModel
    OnboardingFlow  --> AuthService
    OffboardingFlow --> AuthService

    %% Risk styles
    class AuthService critical
    class CallCentreSuite,ForecastTool high
    class PanelIQ,SurveyEngine,DataMapper,FieldOps,DiaryTracker,ContractVault,CoreDataWarehouse,BillingEngine,CostTracker,WorkforceModel,OffboardingFlow medium
    class InsightHub,QuotaManager,SegmentBuilder,WebCollect,SampleRouter,ClientPortal,ReportFactory,DeliveryTracker,BriefManager,APIGateway,ObservabilityStack,DevPortal,ProcurementHub,LearningPortal,OrgDesigner,OnboardingFlow low

    %% No-owner dashed border
    class ContractVault,ForecastTool,OffboardingFlow noowner
```

---

## Diagrams 2–15: Per-Product Application Dependencies

Each diagram shows the product → its direct application dependencies → those applications' own dependencies (two levels deep). Risk colouring matches diagram 1.

Arrow direction: `A → B` means *A depends on B*.

---

### DataLicensing — $6.2m ARR · Platform Engineering

```mermaid
graph LR
    classDef product  fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef medium   fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low      fill:#57cc99,stroke:#2e8b57,color:#000

    DataLicensing["DataLicensing<br/>$6.2m ARR"]
    CoreDataWarehouse
    APIGateway
    ClientPortal
    AuthService["AuthService ⚠ Critical"]
    ReportFactory

    DataLicensing    --> CoreDataWarehouse
    DataLicensing    --> APIGateway
    DataLicensing    --> ClientPortal
    CoreDataWarehouse --> AuthService
    ClientPortal     --> ReportFactory
    ClientPortal     --> AuthService
    ClientPortal     --> APIGateway

    class DataLicensing product
    class AuthService critical
    class CoreDataWarehouse medium
    class APIGateway,ClientPortal,ReportFactory low
```

---

### MediaMeasurement — $5.1m ARR · Analytics

```mermaid
graph LR
    classDef product fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef medium  fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low     fill:#57cc99,stroke:#2e8b57,color:#000

    MediaMeasurement["MediaMeasurement<br/>$5.1m ARR"]
    DiaryTracker
    DataMapper
    InsightHub
    CoreDataWarehouse
    SampleRouter
    AuthService["AuthService ⚠ Critical"]
    APIGateway

    MediaMeasurement  --> DiaryTracker
    MediaMeasurement  --> DataMapper
    MediaMeasurement  --> InsightHub
    MediaMeasurement  --> CoreDataWarehouse
    DiaryTracker      --> CoreDataWarehouse
    DiaryTracker      --> SampleRouter
    DataMapper        --> CoreDataWarehouse
    InsightHub        --> CoreDataWarehouse
    InsightHub        --> AuthService
    InsightHub        --> APIGateway
    CoreDataWarehouse --> AuthService

    class MediaMeasurement product
    class AuthService critical
    class CoreDataWarehouse,DataMapper,DiaryTracker,SampleRouter medium
    class InsightHub,APIGateway low
```

---

### RetailInsights — $4.6m ARR · Analytics

```mermaid
graph LR
    classDef product fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef medium  fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low     fill:#57cc99,stroke:#2e8b57,color:#000

    RetailInsights["RetailInsights<br/>$4.6m ARR"]
    SurveyEngine
    SegmentBuilder
    InsightHub
    CoreDataWarehouse
    PanelIQ
    AuthService["AuthService ⚠ Critical"]
    APIGateway

    RetailInsights    --> SurveyEngine
    RetailInsights    --> SegmentBuilder
    RetailInsights    --> InsightHub
    RetailInsights    --> CoreDataWarehouse
    SurveyEngine      --> PanelIQ
    SurveyEngine      --> CoreDataWarehouse
    SurveyEngine      --> AuthService
    SegmentBuilder    --> PanelIQ
    SegmentBuilder    --> CoreDataWarehouse
    InsightHub        --> CoreDataWarehouse
    InsightHub        --> AuthService
    InsightHub        --> APIGateway
    CoreDataWarehouse --> AuthService

    class RetailInsights product
    class AuthService critical
    class CoreDataWarehouse medium
    class SurveyEngine,PanelIQ,InsightHub,SegmentBuilder,APIGateway low
```

---

### BrandTracking Platform — $4.2m ARR · Analytics

```mermaid
graph LR
    classDef product fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef medium  fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low     fill:#57cc99,stroke:#2e8b57,color:#000

    BrandTracking["BrandTracking Platform<br/>$4.2m ARR"]
    SurveyEngine
    PanelIQ
    InsightHub
    CoreDataWarehouse
    AuthService["AuthService ⚠ Critical"]
    APIGateway

    BrandTracking     --> SurveyEngine
    BrandTracking     --> PanelIQ
    BrandTracking     --> InsightHub
    BrandTracking     --> CoreDataWarehouse
    SurveyEngine      --> PanelIQ
    SurveyEngine      --> CoreDataWarehouse
    SurveyEngine      --> AuthService
    PanelIQ           --> CoreDataWarehouse
    PanelIQ           --> AuthService
    InsightHub        --> CoreDataWarehouse
    InsightHub        --> AuthService
    InsightHub        --> APIGateway
    CoreDataWarehouse --> AuthService

    class BrandTracking product
    class AuthService critical
    class CoreDataWarehouse medium
    class SurveyEngine,PanelIQ,InsightHub,APIGateway low
```

---

### CustomerSatisfaction Suite — $3.8m ARR · Analytics

```mermaid
graph LR
    classDef product fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef medium  fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low     fill:#57cc99,stroke:#2e8b57,color:#000

    CustomerSatisfaction["CustomerSatisfaction Suite<br/>$3.8m ARR"]
    SurveyEngine
    WebCollect
    ReportFactory
    CoreDataWarehouse
    PanelIQ
    DataMapper
    AuthService["AuthService ⚠ Critical"]

    CustomerSatisfaction --> SurveyEngine
    CustomerSatisfaction --> WebCollect
    CustomerSatisfaction --> ReportFactory
    CustomerSatisfaction --> CoreDataWarehouse
    SurveyEngine         --> PanelIQ
    SurveyEngine         --> CoreDataWarehouse
    SurveyEngine         --> AuthService
    WebCollect           --> SurveyEngine
    WebCollect           --> AuthService
    ReportFactory        --> CoreDataWarehouse
    ReportFactory        --> DataMapper
    CoreDataWarehouse    --> AuthService

    class CustomerSatisfaction product
    class AuthService critical
    class CoreDataWarehouse,DataMapper medium
    class SurveyEngine,WebCollect,PanelIQ,ReportFactory low
```

---

### ConsumerPanel — $3.4m ARR · Data Collection

```mermaid
graph LR
    classDef product fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef medium  fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low     fill:#57cc99,stroke:#2e8b57,color:#000

    ConsumerPanel["ConsumerPanel<br/>$3.4m ARR"]
    PanelIQ
    WebCollect
    DataMapper
    SampleRouter
    CoreDataWarehouse
    AuthService["AuthService ⚠ Critical"]
    SurveyEngine

    ConsumerPanel     --> PanelIQ
    ConsumerPanel     --> WebCollect
    ConsumerPanel     --> DataMapper
    ConsumerPanel     --> SampleRouter
    PanelIQ           --> CoreDataWarehouse
    PanelIQ           --> AuthService
    WebCollect        --> SurveyEngine
    WebCollect        --> AuthService
    DataMapper        --> CoreDataWarehouse
    SampleRouter      --> PanelIQ
    SampleRouter      --> CoreDataWarehouse

    class ConsumerPanel product
    class AuthService critical
    class CoreDataWarehouse,DataMapper,SampleRouter medium
    class PanelIQ,WebCollect,SurveyEngine low
```

---

### TechnologyAdoption — $3.3m ARR · Analytics ⚠ Critical risk

```mermaid
graph LR
    classDef product fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef medium  fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low     fill:#57cc99,stroke:#2e8b57,color:#000

    TechnologyAdoption["TechnologyAdoption<br/>$3.3m ARR ⚠"]
    SurveyEngine
    WebCollect
    DataMapper
    AuthService["AuthService ⚠ Critical"]
    PanelIQ
    CoreDataWarehouse

    TechnologyAdoption --> SurveyEngine
    TechnologyAdoption --> WebCollect
    TechnologyAdoption --> DataMapper
    TechnologyAdoption --> AuthService
    SurveyEngine       --> PanelIQ
    SurveyEngine       --> CoreDataWarehouse
    SurveyEngine       --> AuthService
    WebCollect         --> SurveyEngine
    WebCollect         --> AuthService
    DataMapper         --> CoreDataWarehouse

    class TechnologyAdoption product
    class AuthService critical
    class CoreDataWarehouse,DataMapper medium
    class SurveyEngine,WebCollect,PanelIQ low
```

---

### AudienceAnalytics — $2.9m ARR · Analytics

```mermaid
graph LR
    classDef product fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef medium  fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low     fill:#57cc99,stroke:#2e8b57,color:#000

    AudienceAnalytics["AudienceAnalytics<br/>$2.9m ARR"]
    SegmentBuilder
    PanelIQ
    InsightHub
    CoreDataWarehouse
    AuthService["AuthService ⚠ Critical"]
    APIGateway

    AudienceAnalytics --> SegmentBuilder
    AudienceAnalytics --> PanelIQ
    AudienceAnalytics --> InsightHub
    AudienceAnalytics --> CoreDataWarehouse
    SegmentBuilder    --> PanelIQ
    SegmentBuilder    --> CoreDataWarehouse
    PanelIQ           --> CoreDataWarehouse
    PanelIQ           --> AuthService
    InsightHub        --> CoreDataWarehouse
    InsightHub        --> AuthService
    InsightHub        --> APIGateway
    CoreDataWarehouse --> AuthService

    class AudienceAnalytics product
    class AuthService critical
    class CoreDataWarehouse medium
    class SegmentBuilder,PanelIQ,InsightHub,APIGateway low
```

---

### HealthcareResearch — $2.7m ARR · Analytics

```mermaid
graph LR
    classDef product fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef medium  fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low     fill:#57cc99,stroke:#2e8b57,color:#000

    HealthcareResearch["HealthcareResearch<br/>$2.7m ARR"]
    SurveyEngine
    PanelIQ
    ClientPortal
    CoreDataWarehouse
    AuthService["AuthService ⚠ Critical"]
    ReportFactory
    APIGateway

    HealthcareResearch --> SurveyEngine
    HealthcareResearch --> PanelIQ
    HealthcareResearch --> ClientPortal
    HealthcareResearch --> CoreDataWarehouse
    SurveyEngine       --> PanelIQ
    SurveyEngine       --> CoreDataWarehouse
    SurveyEngine       --> AuthService
    PanelIQ            --> CoreDataWarehouse
    PanelIQ            --> AuthService
    ClientPortal       --> ReportFactory
    ClientPortal       --> AuthService
    ClientPortal       --> APIGateway
    CoreDataWarehouse  --> AuthService

    class HealthcareResearch product
    class AuthService critical
    class CoreDataWarehouse medium
    class SurveyEngine,PanelIQ,ClientPortal,ReportFactory,APIGateway low
```

---

### CompetitiveIntelligence — $2.2m ARR · Analytics

```mermaid
graph LR
    classDef product fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef medium  fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low     fill:#57cc99,stroke:#2e8b57,color:#000

    CompetitiveIntelligence["CompetitiveIntelligence<br/>$2.2m ARR"]
    DataMapper
    InsightHub
    CoreDataWarehouse
    AuthService["AuthService ⚠ Critical"]
    APIGateway

    CompetitiveIntelligence --> DataMapper
    CompetitiveIntelligence --> InsightHub
    CompetitiveIntelligence --> CoreDataWarehouse
    DataMapper              --> CoreDataWarehouse
    InsightHub              --> CoreDataWarehouse
    InsightHub              --> AuthService
    InsightHub              --> APIGateway
    CoreDataWarehouse       --> AuthService

    class CompetitiveIntelligence product
    class AuthService critical
    class CoreDataWarehouse,DataMapper medium
    class InsightHub,APIGateway low
```

---

### LongitudinalStudies — $1.8m ARR · Data Collection

```mermaid
graph LR
    classDef product fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef medium  fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low     fill:#57cc99,stroke:#2e8b57,color:#000

    LongitudinalStudies["LongitudinalStudies<br/>$1.8m ARR"]
    DiaryTracker
    DataMapper
    CoreDataWarehouse
    SampleRouter
    AuthService["AuthService ⚠ Critical"]

    LongitudinalStudies --> DiaryTracker
    LongitudinalStudies --> DataMapper
    LongitudinalStudies --> CoreDataWarehouse
    DiaryTracker        --> CoreDataWarehouse
    DiaryTracker        --> SampleRouter
    DataMapper          --> CoreDataWarehouse
    CoreDataWarehouse   --> AuthService

    class LongitudinalStudies product
    class AuthService critical
    class CoreDataWarehouse,DataMapper,DiaryTracker,SampleRouter medium
```

---

### FieldworkServices — $1.6m ARR · Data Collection ⚠ EOL dependency

```mermaid
graph LR
    classDef product fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef high    fill:#ff9933,stroke:#cc6600,color:#fff
    classDef medium  fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low     fill:#57cc99,stroke:#2e8b57,color:#000

    FieldworkServices["FieldworkServices<br/>$1.6m ARR ⚠"]
    FieldOps
    QuotaManager
    SampleRouter
    CallCentreSuite["CallCentre Suite ⚠ EOL 2026"]
    CoreDataWarehouse
    SurveyEngine
    PanelIQ

    FieldworkServices --> FieldOps
    FieldworkServices --> QuotaManager
    FieldworkServices --> SampleRouter
    FieldworkServices --> CallCentreSuite
    FieldOps          --> QuotaManager
    FieldOps          --> SampleRouter
    FieldOps          --> CoreDataWarehouse
    QuotaManager      --> SurveyEngine
    QuotaManager      --> CoreDataWarehouse
    SampleRouter      --> PanelIQ
    SampleRouter      --> CoreDataWarehouse
    CallCentreSuite   --> SampleRouter

    class FieldworkServices product
    class CallCentreSuite high
    class CoreDataWarehouse,SampleRouter medium
    class FieldOps,QuotaManager,SurveyEngine,PanelIQ low
```

---

### PublicAffairsResearch — $1.1m ARR · Client Services

```mermaid
graph LR
    classDef product fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef medium  fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low     fill:#57cc99,stroke:#2e8b57,color:#000

    PublicAffairsResearch["PublicAffairsResearch<br/>$1.1m ARR"]
    SurveyEngine
    WebCollect
    ReportFactory
    PanelIQ
    CoreDataWarehouse
    DataMapper
    AuthService["AuthService ⚠ Critical"]

    PublicAffairsResearch --> SurveyEngine
    PublicAffairsResearch --> WebCollect
    PublicAffairsResearch --> ReportFactory
    SurveyEngine          --> PanelIQ
    SurveyEngine          --> CoreDataWarehouse
    SurveyEngine          --> AuthService
    WebCollect            --> SurveyEngine
    WebCollect            --> AuthService
    ReportFactory         --> CoreDataWarehouse
    ReportFactory         --> DataMapper

    class PublicAffairsResearch product
    class AuthService critical
    class CoreDataWarehouse,DataMapper medium
    class SurveyEngine,WebCollect,PanelIQ,ReportFactory low
```

---

### CorporateReporting — $0.9m ARR · Client Services

```mermaid
graph LR
    classDef product fill:#4d79ff,stroke:#0033cc,color:#fff
    classDef critical fill:#ff4d4d,stroke:#cc0000,color:#fff
    classDef medium  fill:#ffdd57,stroke:#b8860b,color:#000
    classDef low     fill:#57cc99,stroke:#2e8b57,color:#000

    CorporateReporting["CorporateReporting<br/>$0.9m ARR"]
    ReportFactory
    DeliveryTracker
    ClientPortal
    CoreDataWarehouse
    DataMapper
    AuthService["AuthService ⚠ Critical"]
    APIGateway

    CorporateReporting --> ReportFactory
    CorporateReporting --> DeliveryTracker
    CorporateReporting --> ClientPortal
    ReportFactory      --> CoreDataWarehouse
    ReportFactory      --> DataMapper
    DeliveryTracker    --> CoreDataWarehouse
    ClientPortal       --> ReportFactory
    ClientPortal       --> AuthService
    ClientPortal       --> APIGateway
    CoreDataWarehouse  --> AuthService

    class CorporateReporting product
    class AuthService critical
    class CoreDataWarehouse,DataMapper medium
    class ReportFactory,DeliveryTracker,ClientPortal,APIGateway low
```

---

## Key risk chains

| Chain | ARR exposed | Why it matters |
|---|---|---|
| **AuthService** (Critical, vendor EOL Q2 2026) → directly used by 8 apps | — | Platform-wide blast radius if not replaced |
| **CoreDataWarehouse** → AuthService runtime dep | — | CDW write operations blocked if AuthService fails |
| **DataLicensing** → CoreDataWarehouse → AuthService (indirect) | **$6.2m** | Highest-revenue product exposed via two-hop dependency |
| **TechnologyAdoption** → AuthService (direct) | **$3.3m** | Direct Critical-risk exposure |
| **FieldworkServices** → CallCentre Suite (EOL 2026) | **$1.6m** | EOL dependency with no replacement plan |
| Total ARR with direct High/Critical exposure | **~$11.1m** | Including indirect DataLicensing chain |
