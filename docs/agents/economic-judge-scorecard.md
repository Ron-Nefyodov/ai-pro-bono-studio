# Economic Judge Agent Scorecard

## Decision outputs

- `GO`: strong unit economics and realistic execution path.
- `CONDITIONAL_GO`: promising but requires specific de-risking actions.
- `NO_GO`: weak economics or unsolved critical risk.

## Weighted score dimensions (100 points)

1. Problem severity and urgency (20)
2. Target customer willingness to pay (20)
3. Distribution feasibility (15)
4. Gross margin potential (15)
5. Time-to-revenue (10)
6. Defensibility and moat potential (10)
7. Founder-market fit / execution risk (10)

## Scoring rubric (0-5 per dimension)

- 0: no evidence or clearly weak.
- 1: weak assumptions, no validation.
- 2: partial signal, major uncertainty.
- 3: decent signal, moderate uncertainty.
- 4: strong signal with validation.
- 5: exceptional signal with hard evidence.

## Formula

- Dimension score = `(raw_score / 5) * weight`
- Total viability score = sum of all dimension scores (0-100)

## Decision thresholds

- 75-100: `GO`
- 55-74: `CONDITIONAL_GO`
- 0-54: `NO_GO`

## Mandatory checks (fail any => at most CONDITIONAL_GO)

- Clear ICP (ideal customer profile) exists.
- MVP can launch in <= 4 weeks.
- At least one realistic distribution channel with test plan.
- No obvious legal/compliance blocker for pilot.

## Output format

```md
# Economic Judge Decision
- Idea:
- Score:
- Decision:
- Top strengths:
- Critical risks:
- Conditions to proceed:
- First 2-week validation plan:
```
