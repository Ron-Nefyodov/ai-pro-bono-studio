import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLangfuseClient } from "./langfuse.js";
import { ModelWrapper } from "./model-wrapper.js";
import { runIdeaToPocPipeline } from "./agent-pipeline.js";
import { StudioLangChainAgents } from "./agents/studio-langchain-agents.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

const app = express();
const port = Number(process.env.PORT || 8787);
const appealTokenLimit = Number(process.env.APPEAL_TOKEN_LIMIT || 220);

const langfuse = createLangfuseClient(process.env);
const modelWrapper = new ModelWrapper(process.env);
const langchainStudio = new StudioLangChainAgents(process.env);
const paidOverrides = [];

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ai-pro-bono-studio",
    modelWrapperConfigured: Boolean(process.env.MODEL_WRAPPER_URL),
    langfuseEnabled: langfuse.enabled,
    appealTokenLimit,
    langChainAgentsEnabled: langchainStudio.enabled,
  });
});

app.post("/api/idea-to-poc", async (req, res) => {
  const idea = String(req.body?.idea || "").trim();
  const founderName = String(req.body?.founderName || "").trim();
  const targetUser = String(req.body?.targetUser || "").trim();

  if (!idea) {
    return res.status(400).json({ error: "idea is required" });
  }

  const trace = await langfuse.trace({
    name: "idea_to_poc_pipeline",
    input: { idea, founderName, targetUser },
    metadata: { route: "/api/idea-to-poc" },
  });

  try {
    const result = await runIdeaToPocPipeline({
      idea,
      context: { founderName, targetUser },
      modelWrapper,
      trace,
      langchainStudio,
      appealTokenLimit,
    });

    await trace.update({ output: result });
    return res.json({
      ...result,
      appealTokenLimit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    await trace.update({ output: { error: message } });
    return res.status(500).json({ error: message });
  }
});

app.post("/api/appeal", async (req, res) => {
  const idea = String(req.body?.idea || "").trim();
  const founderName = String(req.body?.founderName || "").trim();
  const targetUser = String(req.body?.targetUser || "").trim();
  const appeal = String(req.body?.appeal || "").trim();

  if (!idea || !appeal) {
    return res.status(400).json({ error: "idea and appeal are required" });
  }

  const appealTokensUsed = estimateTokens(appeal);
  if (appealTokensUsed > appealTokenLimit) {
    return res.status(400).json({
      error: `Appeal is over token limit (${appealTokensUsed}/${appealTokenLimit})`,
      appealTokensUsed,
      appealTokenLimit,
    });
  }

  const trace = await langfuse.trace({
    name: "idea_appeal_pipeline",
    input: { idea, founderName, targetUser, appeal },
    metadata: { route: "/api/appeal" },
  });

  try {
    const result = await runIdeaToPocPipeline({
      idea,
      context: {
        founderName,
        targetUser,
        appeal,
        appealMode: true,
      },
      modelWrapper,
      trace,
      langchainStudio,
      appealTokenLimit,
    });

    await trace.update({ output: result, metadata: { appealMode: true } });
    return res.json({
      ...result,
      appealAccepted: result.decision !== "REJECTED",
      appealTokensUsed,
      appealTokenLimit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    await trace.update({ output: { error: message } });
    return res.status(500).json({ error: message });
  }
});

app.post("/api/paid-override", async (req, res) => {
  const idea = String(req.body?.idea || "").trim();
  const founderName = String(req.body?.founderName || "").trim();
  const targetUser = String(req.body?.targetUser || "").trim();
  const email = String(req.body?.email || "").trim();
  const notes = String(req.body?.notes || "").trim();

  if (!idea || !email) {
    return res.status(400).json({ error: "idea and email are required" });
  }

  const record = {
    id: `po_${Date.now()}`,
    createdAt: new Date().toISOString(),
    founderName,
    targetUser,
    idea,
    email,
    notes,
    status: "PENDING_CONTACT",
  };

  paidOverrides.unshift(record);

  const trace = await langfuse.trace({
    name: "paid_override_request",
    input: record,
    metadata: { route: "/api/paid-override" },
  });
  await trace.update({ output: { accepted: true, recordId: record.id } });

  return res.json({
    accepted: true,
    message: "Paid override request received. Team follow-up is pending.",
    record,
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`AI Pro Bono Studio running at http://localhost:${port}`);
});
