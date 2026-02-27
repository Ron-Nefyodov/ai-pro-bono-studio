const form = document.getElementById("intakeForm");
const resultCard = document.getElementById("resultCard");
const decisionText = document.getElementById("decisionText");
const scoreText = document.getElementById("scoreText");
const payloadView = document.getElementById("payloadView");

function clampScore(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  if (num < 1) return 1;
  if (num > 5) return 5;
  return num;
}

function scoreIdea(values) {
  const urgency = clampScore(values.urgency);
  const willingnessToPay = clampScore(values.willingnessToPay);
  const executionConfidence = clampScore(values.executionConfidence);

  const weighted =
    (urgency / 5) * 40 +
    (willingnessToPay / 5) * 40 +
    (executionConfidence / 5) * 20;

  if (weighted >= 75) {
    return { score: Math.round(weighted), decision: "GO" };
  }
  if (weighted >= 55) {
    return { score: Math.round(weighted), decision: "CONDITIONAL_GO" };
  }
  return { score: Math.round(weighted), decision: "NO_GO" };
}

function loadSubmissions() {
  try {
    return JSON.parse(localStorage.getItem("intake_submissions") || "[]");
  } catch {
    return [];
  }
}

function saveSubmission(payload) {
  const existing = loadSubmissions();
  const updated = [payload, ...existing];
  localStorage.setItem("intake_submissions", JSON.stringify(updated));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const formData = new FormData(form);
  const values = Object.fromEntries(formData.entries());
  const scoring = scoreIdea(values);

  const payload = {
    submittedAt: new Date().toISOString(),
    ...values,
    ...scoring,
  };

  saveSubmission(payload);

  decisionText.textContent = `Decision: ${scoring.decision}`;
  scoreText.textContent = `Viability score: ${scoring.score}/100`;
  payloadView.textContent = JSON.stringify(payload, null, 2);
  resultCard.classList.remove("hidden");
});
