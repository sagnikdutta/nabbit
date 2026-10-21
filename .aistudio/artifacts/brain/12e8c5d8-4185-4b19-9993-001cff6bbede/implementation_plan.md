# Intelligent Challenge Engine & Concept Hint Review System

Transform Nabbit's generator from a frontend-biased code generator into a domain-intelligent engineering assessment engine that accurately grounds on any YouTube tutorial (including AWS, DevOps, Cloud Infrastructure, and Backend Systems) and equips engineers with a two-stage concept hint and video review experience.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following core product decisions were confirmed during interactive clarification and govern this implementation:

- **Domain-Specific Challenge Formats**: For non-traditional coding topics like AWS, Cloud, and DevOps, Nabbit will generate native infrastructure and security configuration templates (e.g., AWS IAM Policies in JSON, Terraform HCL resource declarations, Dockerfiles, and Kubernetes Pod/Deployment manifests) rather than forcing mismatched JavaScript/TypeScript syntax.
- **Two-Stage Hint & Video Review UX**: A dedicated, non-intrusive hint drawer on the Challenge stage:
  - **Stage 1 (Concept Nudge & Video Cue)**: High-level architectural hint explaining what to think about, paired with an interactive button: `"Cue Video to Concept Moment (X:XX)"` that automatically seeks and highlights the synchronized video player to the exact tutorial timestamp.
  - **Stage 2 (Inspection Clue)**: Granular code/policy review pointer highlighting the specific line or property block under scrutiny.
- **Google Search Grounding for Video Discovery**: When an arbitrary YouTube URL is submitted, the backend utilizes `gemini-3.8-flash` combined with Google Search grounding (`tools: [{ googleSearch: {} }]`) to discover the actual video title, channel, tech stack, and tutorial breakdown from live web context, preventing generic hallucinated challenges.

---

### 1. Overview & Core Concept

- **The Problem**: When a user pasted an AWS or Cloud video URL (such as an AWS IAM, S3, or Lambda deep-dive), the generator previously defaulted to generic frontend TypeScript code. Furthermore, engineers stuck on a subtle bug had no structured way to consult the tutorial clip without leaving their review flow or spoiling the answer.
- **What It Does**:
  1. **Intelligent Domain Routing**: Detects the video's technical domain (e.g. AWS/Cloud, DevOps, Backend Systems, Frontend, Database) and selects the appropriate syntax dialect (JSON IAM, HCL Terraform, Dockerfile, Python, SQL, TypeScript).
  2. **Grounded Video Extraction**: Queries Google Search via Gemini 3.8 Flash to identify the genuine lesson taught in the video screencast.
  3. **Two-Stage Progressive Hinting**: Encourages active retrieval by providing an architectural reminder and synchronized video replay before disclosing granular clues.
- **Target Persona**: "Arin", a full-stack or cloud engineer reviewing unfamiliar AWS configurations, Terraform PRs, or microservice code, needing to train their code-review judgment on real infrastructure bugs.

---

### 2. User Experience & Visual Design

#### 1. Intelligent Domain Detection & Import
- In `YouTubeImportCard`:
  - When a user inputs a URL (e.g., an AWS tutorial or Docker deep-dive), the system analyzes the video using Gemini + Google Search Grounding.
  - The card displays detected domain tags: `AWS / Cloud Infrastructure · Terraform HCL` or `Security / IAM Policy`.
  - Realistic challenge previews display the correct file names (e.g., `policy.json`, `main.tf`, `Dockerfile`, `schema.sql`).

#### 2. Two-Stage Concept Hint & Video Cue (Challenge Stage)
- Below the code review editor and above the option cards sits an unboxed, subtle accordion control:
  - `💡 Need a concept refresher? (Stage 1 of 2)`
- **Stage 1 Revealed**:
  - Displays a concise conceptual prompt (e.g., *"Think about the difference between resource-based policies and identity policies in AWS IAM, and how wildcards evaluate in Action blocks"*).
  - Prominent interactive button: `▶ Cue Video to Tutorial Chapter (04:15)` with an instant rewind icon. Clicking it automatically updates the side-by-side video player to the concept chapter.
- **Stage 2 ("Still Stuck? View Inspection Clue")**:
  - Discloses an architectural clue (e.g., *"Inspect the Statement[0].Action array — check if s3:PutObject grants delete privileges"*).
  - Tracks whether hints were used for mastery calibration in the Spaced Recall model.

#### 3. High-Fidelity Code & Config Syntax Display
- Syntax highlighting updated to support:
  - **JSON / IAM Policies**: Semantic highlighting for `Version`, `Statement`, `Effect`, `Action`, `Resource`, and `Condition`.
  - **Terraform / HCL**: Blocks, attributes, provider identifiers, and CIDR blocks.
  - **Docker / YAML**: Directives (`FROM`, `RUN`, `USER`, `COPY`, `ENV`).
  - **TypeScript / Python / SQL**: Standard clean semantic token highlighting.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Real Config Formats vs Pseudocode**
  - *Chosen Approach*: Real, parseable AWS IAM JSON, Terraform HCL, and Dockerfile snippets with realistic production flaws (e.g., `Principal: "*"` without condition, `0.0.0.0/0` security ingress, container running as root, missing S3 encryption header).
  - *Why*: Engineers review actual config files in PRs, not abstract quiz questions.
- **Decision 2: Two-Stage Progressive Disclosure vs All-at-Once Hints**
  - *Chosen Approach*: Progressive two-tier disclosure (Concept + Video Timestamp first, code pointer second).
  - *Why*: Prevents "hint laziness" and encourages re-watching the exact 30-second clip from the tutorial, turning passive memory into active retention.
- **Decision 3: Gemini Search Grounding for YouTube Metadata**
  - *Chosen Approach*: Use Gemini 3.8 Flash with `googleSearch` tool integration to look up the YouTube ID and retrieve the tutorial context, instructor, and syllabus.
  - *Why*: YouTube blocks server-side scraping of video pages; Google Search grounding allows Gemini to read web results and transcripts indexed for that video ID safely.

---

### 4. Technical Architecture & Data Strategy

#### System Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Challenge Screen Frontend                       │
│                                                                        │
│   ┌───────────────────────────┐      ┌─────────────────────────────┐   │
│   │    Synchronized Player    │      │    Config / Code Review     │   │
│   │  [YouTube Timestamp Cue]  │◄─────┤   (IAM JSON / HCL / TS)     │   │
│   └───────────────────────────┘      └──────────────┬──────────────┘   │
│                 ▲                                   │                  │
│                 │ (Cue Timestamp onClick)           ▼                  │
│   ┌─────────────┴──────────────────────────────────────────────────┐   │
│   │               Two-Stage Progressive Hint Drawer                │   │
│   │   [Stage 1: Concept Nudge]  ──►  [Stage 2: Inspection Clue]   │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │ POST /api/videos/generate-from-url
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Express Engine (server.ts)                      │
│                                                                        │
│   1. extractYouTubeVideoId(url)                                        │
│   2. Gemini 3.8 Flash + Google Search Grounding:                       │
│      tools: [{ googleSearch: {} }]                                     │
│      - Query: "YouTube video <ID> tutorial topic concepts"             │
│      - Detect domain: 'aws' | 'devops' | 'backend' | 'frontend'        │
│   3. Domain-Specific Prompt Template:                                  │
│      - If AWS: Generate IAM Policy JSON or Terraform HCL               │
│      - If DevOps: Generate Dockerfile or Kubernetes YAML               │
│      - If Dev: Generate Python, SQL, or TypeScript logic               │
│   4. Output JSON Schema validation & LocalStore persistence            │
└────────────────────────────────────────────────────────────────────────┘
```

#### Core Data Entities Extension
- `Challenge`:
  - `hints: { conceptNudge: string; videoTimestampSeconds: number; inspectionClue: string }`
  - `language: 'json' | 'hcl' | 'dockerfile' | 'typescript' | 'python' | 'sql'`
- `Video`:
  - `domain: 'cloud-aws' | 'devops' | 'backend' | 'frontend' | 'security'`
