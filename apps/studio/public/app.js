const form = document.getElementById("ideaForm");
const submitBtn = document.getElementById("submitBtn");
const progressFill = document.getElementById("progressFill");
const progressPercent = document.getElementById("progressPercent");
const progressStage = document.getElementById("progressStage");
const stageChips = document.getElementById("stageChips");
const resultPanel = document.getElementById("resultPanel");
const blockedPanel = document.getElementById("blockedPanel");
const pocPanel = document.getElementById("pocPanel");
const decisionText = document.getElementById("decisionText");
const reasonText = document.getElementById("reasonText");
const agentCards = document.getElementById("agentCards");
const pocTitle = document.getElementById("pocTitle");
const pocFrame = document.getElementById("pocFrame");
const appealText = document.getElementById("appealText");
const appealBtn = document.getElementById("appealBtn");
const paidBtn = document.getElementById("paidBtn");
const blockedMsg = document.getElementById("blockedMsg");
const tokenBudget = document.getElementById("tokenBudget");
const tokenUsed = document.getElementById("tokenUsed");
const tokenLeft = document.getElementById("tokenLeft");

let lastPayload = null;
let appealTokenLimit = 220;
let progressTimer = null;
let simulatedStageIndex = -1;

const stages = [
  "Economic Judge",
  "Market & Competitor",
  "Product Service",
  "Engineering Manager",
  "POC Builder",
];

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

function renderStageChips(activeIndex, completedCount) {
  stageChips.innerHTML = "";

  stages.forEach((stage, index) => {
    const chip = document.createElement("span");
    chip.className = "stage-chip";

    if (index < completedCount) chip.classList.add("done");
    else if (index === activeIndex) chip.classList.add("active");

    chip.textContent = `${index + 1}. ${stage}`;
    stageChips.appendChild(chip);
  });
}

function setProgress(activeIndex, completedCount) {
  const completedRatio = stages.length === 0 ? 0 : completedCount / stages.length;
  const percent = Math.max(0, Math.min(100, Math.round(completedRatio * 100)));

  progressFill.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  progressStage.textContent = activeIndex >= 0 ? stages[activeIndex] : "Idle";
  renderStageChips(activeIndex, completedCount);
}

function startProgressSimulation() {
  simulatedStageIndex = 0;
  setProgress(simulatedStageIndex, 0);

  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (simulatedStageIndex < stages.length - 1) {
      simulatedStageIndex += 1;
      const completedCount = Math.max(0, simulatedStageIndex - 1);
      setProgress(simulatedStageIndex, completedCount);
      return;
    }

    clearInterval(progressTimer);
    progressTimer = null;
  }, 1400);
}

function stopProgressSimulation() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function refreshAppealTokenUI() {
  const used = estimateTokens(appealText.value || "");
  const left = Math.max(0, appealTokenLimit - used);

  tokenBudget.textContent = String(appealTokenLimit);
  tokenUsed.textContent = String(used);
  tokenLeft.textContent = String(left);

  if (used > appealTokenLimit) {
    blockedMsg.textContent = `Your argument is over budget (${used}/${appealTokenLimit} tokens).`;
    appealBtn.disabled = true;
    return;
  }

  if (blockedMsg.textContent.includes("over budget")) {
    blockedMsg.textContent = "";
  }
  appealBtn.disabled = false;
}

function statusClass(decision) {
  const value = (decision || "").toLowerCase();
  if (value === "go") return "go";
  if (value === "no_go") return "no_go";
  return "conditional_go";
}

function renderAgentCards(agents) {
  agentCards.innerHTML = "";

  for (const item of agents || []) {
    const card = document.createElement("article");
    card.className = "agent-card";

    const tag = document.createElement("span");
    tag.className = `tag ${statusClass(item.output?.decision)}`;
    tag.textContent = item.output?.decision || "UNKNOWN";

    const title = document.createElement("h3");
    title.textContent = item.agent;

    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(item.output, null, 2);

    card.append(tag, title, pre);
    agentCards.appendChild(card);
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let msg = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  return response.json();
}

function setProgressFromResult(result) {
  stopProgressSimulation();

  const completedCore = Array.isArray(result.agents) ? result.agents.length : 0;
  const completedCount = result.poc?.html ? Math.min(stages.length, completedCore + 1) : completedCore;

  if (completedCount <= 0) {
    setProgress(-1, 0);
    return;
  }

  const activeIndex = Math.min(stages.length - 1, completedCount - 1);
  setProgress(activeIndex, completedCount);
}

function renderResult(result) {
  appealTokenLimit = Number(result.appealTokenLimit || appealTokenLimit);
  refreshAppealTokenUI();

  decisionText.textContent = `Decision: ${result.decision}`;
  reasonText.textContent = result.reason || "";
  renderAgentCards(result.agents || []);
  resultPanel.classList.remove("hidden");

  if (result.decision === "REJECTED") {
    blockedPanel.classList.remove("hidden");
  } else {
    blockedPanel.classList.add("hidden");
    blockedMsg.textContent = "";
  }

  if (result.poc?.html) {
    pocTitle.textContent = result.poc.title || "Generated POC";
    pocFrame.srcdoc = result.poc.html;
    pocPanel.classList.remove("hidden");
  } else {
    pocPanel.classList.add("hidden");
  }

  setProgressFromResult(result);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const data = Object.fromEntries(new FormData(form).entries());
  const idea = String(data.idea || "").trim();

  if (!idea) return;

  lastPayload = data;
  submitBtn.disabled = true;
  resultPanel.classList.add("hidden");
  blockedPanel.classList.add("hidden");
  pocPanel.classList.add("hidden");
  blockedMsg.textContent = "";
  startProgressSimulation();

  try {
    const result = await postJson("/api/idea-to-poc", data);
    renderResult(result);
  } catch (error) {
    stopProgressSimulation();
    setProgress(-1, 0);
    progressStage.textContent = `Error: ${error.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});

appealText.addEventListener("input", () => {
  refreshAppealTokenUI();
});

appealBtn.addEventListener("click", async () => {
  if (!lastPayload) return;
  const appeal = String(appealText.value || "").trim();
  const used = estimateTokens(appeal);

  if (!appeal) {
    blockedMsg.textContent = "Add your argument before sending appeal.";
    return;
  }
  if (used > appealTokenLimit) {
    blockedMsg.textContent = `Your argument is over budget (${used}/${appealTokenLimit} tokens).`;
    return;
  }

  appealBtn.disabled = true;
  blockedMsg.textContent = "Re-running agents with your argument...";
  startProgressSimulation();

  try {
    const result = await postJson("/api/appeal", { ...lastPayload, appeal });
    blockedMsg.textContent = result.appealAccepted
      ? "Appeal accepted by pipeline."
      : "Appeal reviewed, still blocked.";
    renderResult(result);
  } catch (error) {
    stopProgressSimulation();
    blockedMsg.textContent = `Appeal failed: ${error.message}`;
  } finally {
    appealBtn.disabled = false;
  }
});

paidBtn.addEventListener("click", async () => {
  if (!lastPayload) return;

  const email = String(lastPayload.email || "").trim();
  if (!email) {
    blockedMsg.textContent = "Email is required to request paid build.";
    return;
  }

  paidBtn.disabled = true;
  blockedMsg.textContent = "Sending paid override request...";

  try {
    const result = await postJson("/api/paid-override", {
      ...lastPayload,
      notes: String(appealText.value || "").trim(),
    });
    blockedMsg.textContent = `${result.message} Request id: ${result.record.id}`;
  } catch (error) {
    blockedMsg.textContent = `Paid request failed: ${error.message}`;
  } finally {
    paidBtn.disabled = false;
  }
});

setProgress(-1, 0);
refreshAppealTokenUI();
