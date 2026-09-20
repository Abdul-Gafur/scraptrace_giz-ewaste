# SRS analysis models

These maintainable Mermaid models mirror Figures 1–14 in the [approved SRS v1.1](<../product/ScrapTrace_Software_Requirements_Specification (2).docx>). They describe required behaviour and logical structure, not implemented components. The SRS remains authoritative; [SRS parity notes](../product/srs-traceability.md#srs-interpretation-notes) govern known source inconsistencies.

## Figure 1 Application system context

```mermaid
flowchart TB
    collector[Collector or household user] --> web[ScrapTrace mobile web application]
    recycler[Scrapyard or recycler] --> web
    programme[Programme reviewer or manager] --> web
    web --> api[ScrapTrace application API]
    api --> vision[Computer vision service]
    api --> safety[Safety content and LLM service]
    api --> data[(Application database and evidence storage)]
    api --> location[Location and map service]
```

## Figure 2 End-to-end application journey

```mermaid
flowchart TD
    A[Capture e-waste image] --> B[Identify category and confidence]
    B --> C[Confirm or correct category]
    C --> D[Explain approved safety guidance in selected language]
    D --> E[Show indicative price and nearby locations]
    E --> F[Create recovery record and QR code]
    F --> G[Confirm handoff, weight, price and evidence]
    G --> H[Review and display completed journey]
```

## Figure 3 Logical components and external providers

```mermaid
flowchart TB
    web[Mobile web user interface] --> api[Application API and access control]
    api --> workflow[Recovery record and workflow service]
    workflow --> vision[Computer vision service]
    workflow --> safety[Safety retrieval and LLM service]
    workflow --> reference[Location and price reference service]
    workflow --> db[(Relational database)]
    workflow --> objects[(Image and evidence storage)]
    safety --> llm[External LLM provider]
    reference --> maps[External map provider]
```

## Figure 4 Core data relationships

```mermaid
flowchart TB
    user[User and role] --> record[Recovery record]
    location[Receiving location] --> record
    record --> item[Item or batch]
    record --> prediction[Category prediction]
    record --> guide[Safety guide response]
    record --> handoff[Handoff and measured weight]
    record --> processing[Processing evidence]
    record --> review[Review decision]
    record --> audit[Audit event]
```

## Figure 5 Grounded LLM safety-guidance flow

```mermaid
flowchart TD
    category[Confirmed e-waste category] --> retrieve[Retrieve approved current safety card]
    retrieve --> available{Approved content available?}
    available -- No --> referral[Display approved fallback and referral]
    available -- Yes --> request[Send approved facts and language task to LLM]
    request --> validate{Schema and prohibited-content validation passes?}
    validate -- No --> fallback[Display approved static card and fallback label]
    validate -- Yes --> display[Display AI-assisted explanation with source, version and review date]
    display --> cache[Cache approved or validated guide for offline access]
```

## Figure 6 Offline-save and synchronization decisions

```mermaid
flowchart TD
    capture[Capture and validate record] --> local[Save local draft]
    local --> network{Network available?}
    network -- No --> pending[Mark Pending synchronization]
    pending --> network
    network -- Yes --> submit[Submit with client ID, version and idempotency key]
    submit --> validate[Server validates request]
    validate --> issue{Conflict or duplicate?}
    issue -- Conflict --> action[Preserve local copy and mark Action required]
    issue -- Repeated key --> existing[Return existing logical result]
    issue -- No --> create[Create server record and return canonical ID]
    existing --> synced[Mark Synchronized]
    create --> synced
```

## Figure 7 Recovery-record lifecycle overview

```mermaid
flowchart TD
    draft[Draft] --> offline[Saved offline]
    offline --> pending[Pending synchronization]
    pending --> submitted[Submitted]
    draft --> submitted
    submitted --> awaiting[Awaiting handoff]
    awaiting --> received[Received]
    received --> processing[Processing recorded]
    processing --> checks{Automated checks pass?}
    checks -- Yes --> completed[Completed]
    checks -- No --> review[Under review]
    review -- Reviewer approves --> approved[Approved and completed]
    review -- Reviewer rejects --> rejected[Rejected]
```

`Approved and completed` is the state eligible for verified-weight totals. See the [state interpretation](../product/srs-traceability.md#srs-interpretation-notes).

## Figure 8 Handoff and review interaction sequence

```mermaid
sequenceDiagram
    actor Collector
    participant Web as ScrapTrace web app
    participant API as Application API
    actor Recycler
    actor Reviewer as Programme reviewer
    Collector->>Web: Present QR code and item or batch
    Recycler->>Web: Scan QR code
    Web->>API: Request recovery record
    API-->>Web: Return permitted record and expected category
    Recycler->>Web: Confirm category, condition, weight and price
    Recycler->>Web: Upload handoff and scale evidence
    Web->>API: Submit handoff confirmation
    API-->>Web: Return next state or review-required status
    opt Record is flagged
        Reviewer->>API: Review evidence and record reasoned decision
    end
    API-->>Web: Publish final permitted status
```

## Figure 9 Context data-flow diagram

```mermaid
flowchart LR
    collector[Collector or household user] -- Collection details --> system((P0 ScrapTrace))
    system -- Guidance, estimate, locations and status --> collector
    receiving[Receiving location] -- Handoff, weight, price and evidence --> system
    system -- Expected record and status --> receiving
    reviewer[Programme reviewer] -- Review decision --> system
    system -- Review queue and programme reports --> reviewer
    providers[Map and LLM providers] -- Limited provider results --> system
    system -- Minimized provider requests --> providers
```

## Figure 10 Level 1 data-flow diagram

```mermaid
flowchart TB
    collector[Collector] -->|Image and confirmed details| p1((1 Capture and identify))
    p1 -->|Validated draft| d1[(D1 Local drafts)]
    d1 -->|Pending draft| p2((2 Guide, estimate, locate and sync))
    d2[(D2 Approved reference data)] -->|Cards, rates and locations| p2
    p2 -->|Guidance, estimate, places and QR| collector
    p2 -->|Submitted record| d3[(D3 Recovery records)]
    recycler[Recycler] -->|Weight, price and evidence| p3((3 Confirm handoff and processing))
    d3 -->|Expected record| p3
    p3 -->|State decision and audit event| d3
    p3 -->|Protected evidence| d4[(D4 Private evidence)]
    d3 -->|Record and rule results| p4((4 Check, review and report))
    p4 -->|State decision and audit event| d3
    reviewer[Programme reviewer] -->|Review outcome| p4
    p4 -->|Review queue and reports| reviewer
```

## Figure 11 UML use-case model

```mermaid
flowchart LR
    collector[Collector or household user]
    recycler[Recycler]
    reviewer[Programme reviewer or manager]
    subgraph ScrapTrace
      identify([Capture, identify and correct item])
      guidance([Read approved safety guidance])
      locate([View estimate and nearby locations])
      create([Create recovery record and QR])
      receive([Confirm handoff, weight and evidence])
      history([View receiving history])
      decide([Review flags and decide outcome])
      totals([View programme totals])
    end
    collector --> identify
    collector --> guidance
    collector --> locate
    collector --> create
    recycler --> receive
    recycler --> history
    reviewer --> decide
    reviewer --> totals
```

Content administrators and data reviewers are additional access roles defined by FR-ACC-001; their governed content/model-review use cases sit outside the core traceability use-case figure.

## Figure 12 UML domain class model

```mermaid
classDiagram
    class User {
      +UUID userId
      +Role role
      +String preferredLanguage
    }
    class RecoveryRecord {
      +UUID recordId
      +RecordState state
      +String confirmedCategory
      +submit()
      +transitionState()
    }
    class ItemOrBatch {
      +UUID itemId
      +String category
      +String condition
      +Decimal approximateWeight
    }
    class CategoryPrediction {
      +UUID predictionId
      +String modelVersion
      +Map scores
      +String suggestedCategory
    }
    class Handoff {
      +UUID handoffId
      +Decimal measuredWeight
      +Decimal finalPrice
      +confirmReceipt()
    }
    class ProcessingEvidence {
      +UUID evidenceId
      +String evidenceType
      +String digest
      +validate()
    }
    class ReviewDecision {
      +UUID decisionId
      +Decision outcome
      +String reason
      +decide()
    }
    class AuditEvent {
      +UUID eventId
      +String action
      +DateTime occurredAt
    }
    class ReceivingLocation {
      +UUID locationId
      +String type
      +VerificationState verificationState
    }
    User "1" --> "0..*" RecoveryRecord : owns
    ReceivingLocation "0..1" --> "0..*" RecoveryRecord : selected destination
    RecoveryRecord "1" *-- "1" ItemOrBatch
    RecoveryRecord "1" *-- "0..1" CategoryPrediction
    RecoveryRecord "1" *-- "0..1" Handoff
    Handoff "1" *-- "0..*" ProcessingEvidence
    RecoveryRecord "1" o-- "0..*" ReviewDecision
    RecoveryRecord "1" *-- "1..*" AuditEvent
```

## Figure 13 Recovery-record state-transition model

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Submitted: submit online
    Submitted --> AwaitingHandoff
    AwaitingHandoff --> Received
    Received --> ProcessingRecorded
    ProcessingRecorded --> Completed: evidence complete
    ProcessingRecorded --> UnderReview: flag created
    Completed --> UnderReview: flag created
    Completed --> ApprovedAndCompleted: server checks pass
    UnderReview --> ApprovedAndCompleted: reviewer approves
    UnderReview --> Rejected: reviewer rejects
    ApprovedAndCompleted --> [*]
    Rejected --> [*]
```

The server rejects transitions not shown or not authorised for the actor. Synchronization states remain orthogonal. Information-request handling is a review action and must not erase the prior state or evidence. See [ADR-003](../decisions/ADR-003-recovery-record-lifecycle.md) for the recorded resolution of the source-diagram ambiguity.

## Figure 14 Core traceability entity-relationship model

```mermaid
erDiagram
    USER ||--o{ RECOVERY_RECORD : owns
    RECEIVING_LOCATION o|--o{ RECOVERY_RECORD : selected_for
    RECOVERY_RECORD ||--|| ITEM_BATCH : describes
    RECOVERY_RECORD ||--o| CATEGORY_PREDICTION : preserves
    RECOVERY_RECORD ||--o| HANDOFF : receives
    HANDOFF ||--o{ PROCESSING_EVIDENCE : supports
    RECOVERY_RECORD ||--o{ REVIEW_DECISION : reviewed_by
    RECOVERY_RECORD ||--|{ AUDIT_EVENT : records

    USER {
      uuid user_id PK
      string role
      string preferred_language
    }
    RECEIVING_LOCATION {
      uuid location_id PK
      string name
      string verification_state
    }
    RECOVERY_RECORD {
      uuid record_id PK
      uuid owner_id FK
      uuid location_id FK
      string state
      datetime created_at
    }
    ITEM_BATCH {
      uuid item_id PK
      uuid record_id FK
      string category
      string condition
      decimal approximate_weight
    }
    CATEGORY_PREDICTION {
      uuid prediction_id PK
      uuid record_id FK
      string model_version
      decimal confidence
      string suggested_category
    }
    HANDOFF {
      uuid handoff_id PK
      uuid record_id FK
      decimal measured_weight
      decimal final_price
    }
    PROCESSING_EVIDENCE {
      uuid evidence_id PK
      uuid handoff_id FK
      string evidence_type
      string object_key
      string digest
    }
    REVIEW_DECISION {
      uuid decision_id PK
      uuid record_id FK
      uuid reviewer_id FK
      string outcome
      string reason
    }
    AUDIT_EVENT {
      uuid event_id PK
      uuid record_id FK
      uuid actor_id FK
      string action
      datetime occurred_at
    }
```

Safety-card versions, LLM responses, price references/estimates and language bundles are additional governed entities described in the [data-model overview](../data/data-model-overview.md); the SRS Figure 14 intentionally focuses on the core traceability path.
