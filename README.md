# MovieBTI - Semantic Retrieval & Movie Discovery 

> [!NOTE]
> ### 📢 Project Status Notice / 项目状态声明
>
> **English:**
> - **Open Source Reference**: This repository ([`ZZZ-RecSys/ZZZ-MovieRecSystem`](https://github.com/ZZZ-RecSys/ZZZ-MovieRecSystem)) is permanently preserved as an open-source reference and architectural milestone archive.
> - **Future Transition**: Subsequent active feature development and commercial product evolution have transitioned to a closed-source private repository.
> - **Live Demo**: The hosted Vercel deployment remains fully active and operational at **[zzz-movie-rec-system.vercel.app](https://zzz-movie-rec-system.vercel.app/)**.
>
> **中文：**
> - **开源保留参考**：本项目（[`ZZZ-RecSys/ZZZ-MovieRecSystem`](https://github.com/ZZZ-RecSys/ZZZ-MovieRecSystem)）将作为公开开源版本长期保留，供技术参考、教学与架构演进回顾。
> - **后续开发转向闭源**：后续的深度迭代、产品化演进及商业化开发已转向闭源私有仓库进行维护。
> - **Vercel 在线演示依然有效**：部署在 Vercel 上的在线体验 Demo **[zzz-movie-rec-system.vercel.app](https://zzz-movie-rec-system.vercel.app/)** 保持正常运行且持续有效。

This project delivers an interactive movie recommendation experience powered by a lightweight latent semantic model and a modern
Next.js front-end. A curated subset of Kaggle movie plots is embedded into a compact latent space (truncated SVD over TF-IDF
features) and enriched with genre plus release-year metadata. The React carousel renders the top matches for a seed movie title or
a free-form description, presenting similarity scores and concise insight strings.

## Project Evolution (3 Phases)

```mermaid
flowchart LR
    subgraph P1 ["Phase 1: Concept & Initial Research (Feb 2024)"]
        direction TB
        O1["Oracle Cloud & DB Stack"]
        O2["❌ Heavyweight, high coupling & deployment friction"]
        O1 --> O2
    end

    subgraph P2 ["Phase 2: Hackathon Dual-Repo Architecture (Feb 2024)"]
        direction TB
        subgraph P2B ["Backend: ZZZ-MovieRecSystem"]
            TF["TensorFlow.js (USE)<br/>encoder.js"] --> PG[("PostgreSQL + pgvector<br/>(Aiven Hosted)")]
        end
        subgraph P2F ["Frontend: ZZZ-MovieSearch-Client"]
            FE["Next.js Search Client<br/>pgvector L2 Distance Query"]
        end
        FE <-->|"SQL &lt;-&gt; Distance"| PG
    end

    subgraph P3 ["Phase 3: Unified Standalone App (Oct 2025)"]
        direction TB
        V1["Consolidated Next.js App<br/>(Single Vercel Deployment)"]
        V2["In-Process ML Pipeline<br/>TF-IDF → Truncated SVD → Cosine Sim"]
        V1 --- V2
        V3["✅ Zero External Database & Zero Dependency"]
    end

    P1 -->|Pivot to open vector stack| P2
    P2 -->|Consolidate & eliminate DB| P3
```

| Phase | Architecture & Repos | Details & Outcome | Team |
|---|---|---|---|
| **Phase 1: Research** (Feb 2024) | Oracle Cloud Ecosystem | Explored Oracle full-stack DB architecture; dropped due to tight coupling and deployment complexity | Yiwei Zhang (Lead), [Weiran Zhao](https://github.com/weiranzhao97) (Research) |
| **Phase 2: Dual-Repo MVP** (Feb 2024) | **Dual-Repo Pipeline**:<br/>• **Backend Ingestion**: [`ZZZ-MovieRecSystem`](https://github.com/ZZZ-RecSys/ZZZ-MovieRecSystem) (dataset ingestion, TF.js USE embedding, Postgres pgvector)<br/>• **Frontend Client**: [`ZZZ-MovieSearch-Client`](https://github.com/ZZZ-RecSys/ZZZ-MovieSearch-Client) (Next.js UI, real-time pgvector `<->` vector search) | Full vector search pipeline built for Global Hack Week: AI/ML; write-up on [DevPost](https://devpost.com/software/zzz-movie-recommender) | Yiwei Zhang (Engineering), [Weiran Zhao](https://github.com/weiranzhao97) (Docs & Research), [Shizhe Zhang](https://github.com/zhang-shizhe) (Ideation) |
| **Phase 3: Unified Standalone** (Oct 2025) | Unified Next.js on Vercel ([`ZZZ-MovieRecSystem`](https://github.com/ZZZ-RecSys/ZZZ-MovieRecSystem) current `main`) | Consolidated frontend and backend into a single zero-database app; runs TF-IDF + Truncated SVD in-process on Vercel | Yiwei Zhang (Solo refactor & delivery) |

## Getting started

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to try the carousel. The page loads a default seed automatically so you can
immediately browse results, or you can type your own prompt / movie title and fetch fresh recommendations.

## Preview

![Movie Carousel Recommender Preview](public/preview.png)


## Live demo

Explore the deployed experience at **[zzz-movie-rec-system.vercel.app](https://zzz-movie-rec-system.vercel.app/)**. The hosted instance matches this repository, so you can browse the carousel, submit your own prompts, and share the link without any local setup.

### Available scripts

* `npm run dev` — start the Next.js development server with hot reloading
* `npm run build` — produce an optimized production build
* `npm run start` — launch the built application in production mode
* `npm run lint` — run Next.js ESLint checks

## Architecture overview

* **Next.js API routes** (`pages/api`) expose `/api/recommendations`, `/api/movies`, and `/api/health`. They share a memoized
  recommender module that loads the dataset, builds TF-IDF vectors, performs truncated SVD, and fuses in genre / year metadata.

* **React front end** (`pages/index.tsx`) renders search controls, an inferred preference profile, and a responsive carousel UI that
  consumes the API. The carousel adapts to different breakpoints and surfaces the similarity scores plus narrative insights.

* **Shared logic** (`lib/recommender.ts`) houses the recommendation engine and exports helper functions for the API routes.

* **Styling** (`styles/globals.css`) applies a cinematic dark theme with responsive layout and accessible focus states.

The app intentionally keeps the ML stack lightweight, relying on matrix factorization and metadata augmentation so it can run
locally without heavyweight dependencies.

### Machine Learning Design & Future Enhancements

The recommendation subsystem follows a **hybrid semantic–metadata architecture**, balancing interpretability, performance, and local deployability:

* **TF-IDF + SVD (Latent Semantic Analysis):**
  Transforms movie plots into a compact latent space (50–300 dimensions). This yields robust similarity even with noisy text while ensuring sub-100 ms latency.

* **Genre / Year Fusion:**
  Genre and release year act as auxiliary constraints, weighted (α≈1.0, β≈0.3, γ≈0.2) to fine-tune results toward user taste and stylistic period.

* **In-Process Model Caching:**
  The recommender module stays warm in memory inside Next.js API routes (Vercel / Node.js server), preventing redundant rebuilds.

* **Retrieval Scaling:**
  For datasets exceeding tens of thousands of titles, approximate-nearest-neighbor (ANN) libraries such as FAISS, Annoy, or HNSW can accelerate cosine-similarity queries.

#### Planned Improvements

| Area                         | Planned Upgrade                                                                    | Expected Benefit                                     |
| ---------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Semantic Embeddings**      | Replace TF-IDF + SVD with `Sentence-Transformer` models (e.g., `all-MiniLM-L6-v2`) | Captures deeper contextual semantics and paraphrases |
| **Hybrid Personalization**   | Introduce implicit feedback weighting (clicks / watch history)                     | Blends content-based and collaborative filtering     |
| **Index Optimization**       | Persist pre-computed latent vectors using FAISS / HNSW index                       | Enables millisecond-scale retrieval at 100 k + items |
| **Explainability Dashboard** | Add 2D PCA / UMAP visualization of latent clusters                                 | Improves transparency and debugging                  |
| **Edge Deployment**          | Package model cache via WASM / WebWorker                                           | Allows full offline use in browsers or Electron      |

> The design keeps the ML layer transparent, auditable, and easy to upgrade — ideal for privacy-sensitive or offline-first deployments while leaving a clean path to more advanced embeddings later on.

