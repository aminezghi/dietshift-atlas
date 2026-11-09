# Coding Guidelines (Inspired by Andrej Karpathy's Principles)

> Based on the engineering framework from [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills).

These principles govern all coding, refactoring, and AI-assisted development across **DietShift Atlas**:

---

### 1. Don't Assume; Don't Hide Confusion
- Never make silent assumptions about data schemas, column names, API contracts, or user requirements.
- If an input or edge case is ambiguous, inspect the concrete data first or raise the question explicitly.
- Provide clear error messages that explain *what* failed, *where* it failed, and *why*, rather than silently swallowing exceptions.

### 2. Minimum Code That Solves the Problem
- Write the leanest, most direct implementation that fully addresses the task.
- Avoid premature abstractions, speculative interfaces, redundant wrappers, or unnecessary third-party dependencies.
- Keep data pipelines readable: load -> transform -> validate -> store.

### 3. Touch Only What You Must
- Keep changes strictly laser-scoped to the files and functions related to the task.
- Do not make opportunistic, out-of-scope edits or reformat entire files that pollute git diffs.
- Preserve all existing comments, docstrings, and verified domain logic.

### 4. Define Success Criteria and Loop Until Verified
- Always establish a concrete, verifiable definition of done before declaring victory.
- For frontend and web tasks: run `npm run build` (`tsc -b && vite build`) and verify zero type errors or broken asset references.
- For data and scraping tasks: verify record counts, schema nullability, and Parquet read/write roundtrips.
- Check live outputs and network status codes (`200 OK`) to guarantee runtime health.
