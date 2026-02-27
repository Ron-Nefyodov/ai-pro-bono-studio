const AGENT_DEFS = [
  {
    name: "economic_judge",
    systemPrompt:
      "You are Economic Judge Agent. Return strict JSON only. Evaluate viability and unit economics quickly.",
    schemaHint: {
      decision: "GO | CONDITIONAL_GO | NO_GO",
      score: "number 0-100",
      strengths: "string[]",
      risks: "string[]",
      assumptions: "string[]",
    },
  },
  {
    name: "market_competitor",
    systemPrompt:
      "You are Market & Competitor Agent. Return strict JSON only. Map demand, alternatives, wedge positioning.",
    schemaHint: {
      decision: "GO | CONDITIONAL_GO | NO_GO",
      marketScore: "number 0-100",
      competitors: "string[]",
      opportunityGaps: "string[]",
      recommendedWedge: "string",
    },
  },
  {
    name: "product_service",
    systemPrompt:
      "You are Product Service Agent. Return strict JSON only. Define MVP scope and measurable success metrics.",
    schemaHint: {
      decision: "GO | CONDITIONAL_GO | NO_GO",
      mvpName: "string",
      mustHaveFeatures: "string[]",
      timelineWeeks: "number",
      successMetrics: "string[]",
    },
  },
  {
    name: "engineering_manager",
    systemPrompt:
      "You are Engineering Manager Agent. Return strict JSON only. Confirm feasibility and launch path on shared infra.",
    schemaHint: {
      decision: "GO | CONDITIONAL_GO | NO_GO",
      canBuildInWeeks: "number",
      stack: "string[]",
      deploymentPlan: "string[]",
    },
  },
];

function normalizeDecision(decision) {
  if (!decision || typeof decision !== "string") return "CONDITIONAL_GO";
  const value = decision.toUpperCase();
  if (value === "GO" || value === "CONDITIONAL_GO" || value === "NO_GO") return value;
  return "CONDITIONAL_GO";
}

function gateDecision(agentResults) {
  const hasNoGo = agentResults.some((item) => normalizeDecision(item.output?.decision) === "NO_GO");
  if (hasNoGo) return "REJECTED";

  const hasConditional = agentResults.some(
    (item) => normalizeDecision(item.output?.decision) === "CONDITIONAL_GO"
  );
  return hasConditional ? "CONDITIONAL_APPROVAL" : "APPROVED";
}

export async function runIdeaToPocPipeline({
  idea,
  context,
  modelWrapper,
  trace,
  langchainStudio,
  appealTokenLimit,
}) {
  const results = [];

  for (const agent of AGENT_DEFS) {
    const span = await trace.span({ name: agent.name, input: { idea, context } });
    const generation = await trace.generation({
      name: `${agent.name}_generation`,
      input: { idea, context },
      model: "wrapper-model",
    });

    try {
      let output;

      if (langchainStudio?.enabled) {
        output = await langchainStudio.run(agent.name, {
          idea,
          context,
          appealTokenLimit,
          agentResults: results,
        });
      }

      if (!output) {
        output = await modelWrapper.runAgent({
          agentName: agent.name,
          systemPrompt: agent.systemPrompt,
          userPrompt: `Idea: ${idea}\nContext: ${JSON.stringify(context)}`,
          schemaHint: agent.schemaHint,
          idea,
          context,
        });
      }

      await generation.end({ output });
      await span.end({ output, statusMessage: "ok" });
      results.push({ agent: agent.name, output });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown agent error";
      await generation.end({ output: { error: reason } });
      await span.end({ output: { error: reason }, level: "ERROR", statusMessage: reason });

      results.push({
        agent: agent.name,
        output: {
          decision: "NO_GO",
          error: reason,
        },
      });
      break;
    }
  }

  const decision = gateDecision(results);
  let poc = null;

  if (decision !== "REJECTED") {
    const pocSpan = await trace.span({ name: "poc_builder", input: { idea, context, results } });
    const pocGeneration = await trace.generation({
      name: "poc_builder_generation",
      input: { idea, context, results },
      model: "wrapper-model",
    });

    try {
      let pocOutput = null;

      if (langchainStudio?.enabled) {
        pocOutput = await langchainStudio.run("poc_builder", {
          idea,
          context,
          appealTokenLimit,
          agentResults: results,
        });
      }

      if (!pocOutput) {
        pocOutput = await modelWrapper.runAgent({
          agentName: "poc_builder",
          systemPrompt:
            "You are a rapid prototype builder. Return strict JSON with {title, summary, html}. html must be complete single-file HTML.",
          userPrompt:
            "Generate a runnable single-page POC for this startup idea using plain HTML/CSS/JS in one document.",
          schemaHint: {
            title: "string",
            summary: "string",
            html: "string containing full HTML document",
          },
          idea,
          context: { ...context, agentResults: results },
        });
      }

      poc = {
        title: String(pocOutput.title || "Generated POC"),
        summary: String(pocOutput.summary || "POC generated."),
        html: String(pocOutput.html || ""),
      };

      if (!poc.html.toLowerCase().includes("<html")) {
        throw new Error("Generated POC html was missing a full HTML document");
      }

      await pocGeneration.end({ output: poc });
      await pocSpan.end({ output: poc, statusMessage: "ok" });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown POC build error";
      await pocGeneration.end({ output: { error: reason } });
      await pocSpan.end({ output: { error: reason }, level: "ERROR", statusMessage: reason });

      return {
        decision: "REJECTED",
        reason: `POC generation failed: ${reason}`,
        agents: results,
        poc: null,
        nextActions: ["APPEAL", "PAID_OVERRIDE"],
      };
    }
  }

  const reason =
    decision === "APPROVED"
      ? "All agents passed."
      : decision === "CONDITIONAL_APPROVAL"
      ? "Agents requested conditions before scale; POC generated for validation."
      : "One or more agents returned NO_GO.";

  const nextActions = decision === "REJECTED" ? ["APPEAL", "PAID_OVERRIDE"] : [];

  return {
    decision,
    reason,
    agents: results,
    poc,
    nextActions,
  };
}
