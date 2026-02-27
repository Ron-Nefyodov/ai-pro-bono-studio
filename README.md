# AI Pro Bono Studio

Base44-style pipeline: describe an idea, run agent gates for business logic, and receive a running POC when approved.

## What is implemented

- Multi-agent pipeline with business validation gates:
  - Economic Judge Agent
  - Market & Competitor Agent
  - Product Service Agent
  - Engineering Manager Agent
- POC Builder stage (single-file runnable HTML app).
- Blocked-idea flow:
  - Submit an argument (appeal) to re-run agent evaluation.
  - Appeals have a strict token budget (`APPEAL_TOKEN_LIMIT`) to force concise persuasion.
  - If still blocked, request a paid override build track.
- Optional Langfuse tracing for every run.
- Pluggable model wrapper endpoint (bring any model/provider).
- LangChain agents for all stages (optional) with Langfuse callback tracing.
- Built-in fallback mode if no wrapper is configured.

## Project structure

- `/Users/ronnefyodovpersonal/Desktop/clone_from_github/ai-pro-bono-studio/apps/studio`: full-stack web app (main product).
- `/Users/ronnefyodovpersonal/Desktop/clone_from_github/ai-pro-bono-studio/apps/intake-form`: earlier static intake prototype.
- `/Users/ronnefyodovpersonal/Desktop/clone_from_github/ai-pro-bono-studio/docs/agents`: agent templates and contracts.

## Run the main app

```bash
cd /Users/ronnefyodovpersonal/Desktop/clone_from_github/ai-pro-bono-studio/apps/studio
cp .env.example .env
npm install
npm run dev
```

Open: [http://localhost:8787](http://localhost:8787)

## Wrapper contract

Set in `.env`:

- `MODEL_WRAPPER_URL`
- `MODEL_WRAPPER_API_KEY` (optional)
- `MODEL_WRAPPER_TIMEOUT_MS`
- `LANGCHAIN_MODEL`
- `LANGCHAIN_API_KEY`
- `LANGCHAIN_BASE_URL` (OpenAI-compatible proxy/wrapper)
- `LANGCHAIN_TEMPERATURE`

Your wrapper receives:

```json
{
  "agent": "economic_judge | market_competitor | product_service | engineering_manager | poc_builder",
  "systemPrompt": "...",
  "userPrompt": "...",
  "schemaHint": { "...": "..." },
  "input": {
    "idea": "...",
    "context": { "founderName": "...", "targetUser": "..." }
  }
}
```

Accepted response formats:

- `{ "json": { ... } }`
- `{ "output": "{ ...json string... }" }`
- `{ "text": "{ ...json string... }" }`
- `{ ...direct object... }`

For `poc_builder`, return JSON with `title`, `summary`, and full `html` document string.

If LangChain settings are provided, all stages run through LangChain first.
If any stage is unavailable/fails, it falls back to wrapper/fallback logic.

## Langfuse setup (optional)

Set in `.env`:

- `LANGFUSE_HOST` (default `https://cloud.langfuse.com`)
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `APPEAL_TOKEN_LIMIT` (default `220`)

When configured, each pipeline run emits trace/span/generation events to Langfuse.

## API

- `GET /api/health`
- `POST /api/idea-to-poc`
- `POST /api/appeal`
- `POST /api/paid-override`

Example payload:

```json
{
  "founderName": "Ron",
  "targetUser": "Freelance legal teams",
  "idea": "AI copilot for contract redlines"
}
```

## Next improvements

- Persist runs and paid requests in a real database.
- Add Stripe Checkout for paid override.
- Add human approval checkpoint before final production deployment.
