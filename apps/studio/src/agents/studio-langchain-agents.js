import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { CallbackHandler } from "langfuse-langchain";
import { z } from "zod";

const decisionSchema = z.enum(["GO", "CONDITIONAL_GO", "NO_GO"]);

const schemas = {
  economic_judge: z.object({
    decision: decisionSchema,
    score: z.number().min(0).max(100),
    strengths: z.array(z.string()).default([]),
    risks: z.array(z.string()).default([]),
    assumptions: z.array(z.string()).default([]),
  }),
  market_competitor: z.object({
    decision: decisionSchema,
    marketScore: z.number().min(0).max(100),
    competitors: z.array(z.string()).default([]),
    opportunityGaps: z.array(z.string()).default([]),
    recommendedWedge: z.string(),
  }),
  product_service: z.object({
    decision: decisionSchema,
    mvpName: z.string(),
    mustHaveFeatures: z.array(z.string()).default([]),
    timelineWeeks: z.number().min(1).max(12),
    successMetrics: z.array(z.string()).default([]),
  }),
  engineering_manager: z.object({
    decision: decisionSchema,
    canBuildInWeeks: z.number().min(1).max(12),
    stack: z.array(z.string()).default([]),
    deploymentPlan: z.array(z.string()).default([]),
  }),
  poc_builder: z.object({
    title: z.string(),
    summary: z.string(),
    html: z.string(),
  }),
};

const promptByAgent = {
  economic_judge: ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are Economic Judge Agent. Return strict JSON only. Evaluate financial viability and execution risk.",
    ],
    [
      "human",
      [
        "Idea: {idea}",
        "Founder: {founderName}",
        "Target user: {targetUser}",
        "Appeal mode: {appealMode}",
        "Appeal argument: {appeal}",
        "Appeal token limit: {appealTokenLimit}",
      ].join("\n"),
    ],
  ]),
  market_competitor: ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are Market & Competitor Agent. Return strict JSON only with market score, key competitors, gaps, and wedge.",
    ],
    [
      "human",
      ["Idea: {idea}", "Founder: {founderName}", "Target user: {targetUser}"].join("\n"),
    ],
  ]),
  product_service: ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are Product Service Agent. Return strict JSON only. Define practical MVP scope and measurable outcomes.",
    ],
    [
      "human",
      ["Idea: {idea}", "Founder: {founderName}", "Target user: {targetUser}"].join("\n"),
    ],
  ]),
  engineering_manager: ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are Engineering Manager Agent. Return strict JSON only. Confirm build feasibility, stack and deployment plan.",
    ],
    [
      "human",
      [
        "Idea: {idea}",
        "Founder: {founderName}",
        "Target user: {targetUser}",
        "Product context: {agentResultsText}",
      ].join("\n"),
    ],
  ]),
  poc_builder: ChatPromptTemplate.fromMessages([
    [
      "system",
      [
        "You are a rapid prototype builder.",
        "Return strict JSON with title, summary, and html.",
        "html must be a complete single-file HTML document with inline CSS/JS.",
      ].join(" "),
    ],
    [
      "human",
      [
        "Idea: {idea}",
        "Founder: {founderName}",
        "Target user: {targetUser}",
        "Validated context: {agentResultsText}",
        "Build a runnable POC homepage with one key interaction.",
      ].join("\n"),
    ],
  ]),
};

function boolText(value) {
  return value ? "true" : "false";
}

export class StudioLangChainAgents {
  constructor(env) {
    this.model = env.LANGCHAIN_MODEL || "";
    this.apiKey = env.LANGCHAIN_API_KEY || env.OPENAI_API_KEY || "";
    this.baseUrl = env.LANGCHAIN_BASE_URL || "";
    this.temperature = Number(env.LANGCHAIN_TEMPERATURE || 0.2);

    this.langfuseHost = env.LANGFUSE_HOST || "https://cloud.langfuse.com";
    this.langfusePublicKey = env.LANGFUSE_PUBLIC_KEY || "";
    this.langfuseSecretKey = env.LANGFUSE_SECRET_KEY || "";

    this.enabled = Boolean(this.model && this.apiKey);
  }

  handlerFor(agentName, context) {
    if (!this.langfusePublicKey || !this.langfuseSecretKey) return null;
    return new CallbackHandler({
      publicKey: this.langfusePublicKey,
      secretKey: this.langfuseSecretKey,
      baseUrl: this.langfuseHost,
      sessionId: context?.founderName || "anonymous",
      userId: context?.founderName || "anonymous",
      tags: ["langchain", "studio", agentName],
      metadata: { targetUser: context?.targetUser || "" },
    });
  }

  modelWithSchema(schema) {
    const model = new ChatOpenAI({
      model: this.model,
      temperature: this.temperature,
      apiKey: this.apiKey,
      ...(this.baseUrl ? { configuration: { baseURL: this.baseUrl } } : {}),
    });
    return model.withStructuredOutput(schema);
  }

  async run(agentName, { idea, context, appealTokenLimit, agentResults }) {
    if (!this.enabled) return null;
    const prompt = promptByAgent[agentName];
    const schema = schemas[agentName];
    if (!prompt || !schema) return null;

    const chain = prompt.pipe(this.modelWithSchema(schema));
    const handler = this.handlerFor(agentName, context);
    const input = {
      idea,
      founderName: context?.founderName || "",
      targetUser: context?.targetUser || "",
      appealMode: boolText(Boolean(context?.appealMode)),
      appeal: context?.appeal || "",
      appealTokenLimit: String(appealTokenLimit || ""),
      agentResultsText: JSON.stringify(agentResults || []),
    };

    try {
      const output = await chain.invoke(
        input,
        handler ? { callbacks: [handler], runName: `${agentName}_langchain` } : undefined
      );
      return output;
    } finally {
      if (handler) await handler.flushAsync();
    }
  }
}
