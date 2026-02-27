function safeJsonParse(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function fallbackAgent(agentName, idea, context) {
  const text = `${idea} ${context?.targetUser || ""}`.toLowerCase();
  const hasB2BSignal = text.includes("saas") || text.includes("b2b") || text.includes("automation");

  if (agentName === "economic_judge") {
    const score = hasB2BSignal ? 77 : 63;
    return {
      decision: score >= 75 ? "GO" : "CONDITIONAL_GO",
      score,
      strengths: ["Clear user pain", "Fast MVP feasibility"],
      risks: ["Customer acquisition channel needs validation"],
      assumptions: ["Pilot users can be reached in 2 weeks"],
    };
  }

  if (agentName === "market_competitor") {
    return {
      decision: "GO",
      marketScore: hasB2BSignal ? 74 : 67,
      competitors: ["Incumbent legacy tools", "No-code DIY workflows"],
      opportunityGaps: ["Faster onboarding", "Lower setup complexity"],
      recommendedWedge: "One narrow high-frequency use case",
    };
  }

  if (agentName === "product_service") {
    return {
      decision: "GO",
      mvpName: `POC for ${idea.slice(0, 50)}`,
      mustHaveFeatures: ["Simple onboarding", "Primary workflow", "Basic analytics"],
      timelineWeeks: 3,
      successMetrics: ["Activation > 30%", "Week-1 retention > 20%"],
    };
  }

  if (agentName === "engineering_manager") {
    return {
      decision: "GO",
      canBuildInWeeks: 3,
      stack: ["Node.js", "Static frontend", "Shared cloud runtime"],
      deploymentPlan: ["Staging preview", "Production promote", "Rollback toggle"],
    };
  }

  if (agentName === "poc_builder") {
    const title = `${idea.split(" ").slice(0, 6).join(" ")} POC`;
    return {
      title,
      summary: "Single-page working proof-of-concept generated from idea and validated assumptions.",
      html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f6f4ed; color: #1f1f1f; }
      .shell { max-width: 900px; margin: 24px auto; padding: 20px; }
      .hero { background: #fff; border: 1px solid #ddd3be; border-radius: 14px; padding: 20px; }
      button { border: 0; background: #1f8a62; color: #fff; padding: 10px 14px; border-radius: 8px; cursor: pointer; }
      .waitlist { display: flex; gap: 8px; margin-top: 12px; }
      input { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #ddd3be; }
      #msg { margin-top: 10px; color: #176548; font-weight: 600; }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <h1>${title}</h1>
        <p>${idea}</p>
        <p>This POC was generated from your idea pipeline and is deployable as a static app.</p>
        <div class="waitlist">
          <input id="email" type="email" placeholder="Email for beta" />
          <button id="join">Join Beta</button>
        </div>
        <p id="msg"></p>
      </section>
    </main>
    <script>
      const email = document.getElementById('email');
      const join = document.getElementById('join');
      const msg = document.getElementById('msg');
      join.addEventListener('click', () => {
        if (!email.value.includes('@')) {
          msg.textContent = 'Enter a valid email.';
          return;
        }
        msg.textContent = 'You are on the beta list.';
      });
    </script>
  </body>
</html>`,
    };
  }

  return { decision: "CONDITIONAL_GO" };
}

export class ModelWrapper {
  constructor(env) {
    this.url = env.MODEL_WRAPPER_URL;
    this.apiKey = env.MODEL_WRAPPER_API_KEY;
    this.timeoutMs = Number(env.MODEL_WRAPPER_TIMEOUT_MS || 45000);
  }

  async runAgent({ agentName, systemPrompt, userPrompt, schemaHint, idea, context }) {
    if (!this.url) {
      return fallbackAgent(agentName, idea, context);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          agent: agentName,
          systemPrompt,
          userPrompt,
          schemaHint,
          input: {
            idea,
            context,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Wrapper returned ${response.status}: ${errorText}`);
      }

      const payload = await response.json();
      if (payload.json && typeof payload.json === "object") {
        return payload.json;
      }

      if (typeof payload.output === "string") {
        const parsed = safeJsonParse(payload.output);
        if (parsed) return parsed;
      }

      if (typeof payload.text === "string") {
        const parsed = safeJsonParse(payload.text);
        if (parsed) return parsed;
      }

      if (typeof payload === "object" && payload !== null) {
        return payload;
      }

      throw new Error("Wrapper response did not include a parseable JSON object");
    } finally {
      clearTimeout(timer);
    }
  }
}
