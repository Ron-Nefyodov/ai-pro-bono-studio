# Engineering Manager Agent Orchestration Contract

## Objective

Translate approved MVP spec into a shipped product on shared infrastructure with explicit ownership boundaries.

## Inputs required

- Economic Judge decision
- Market brief
- MVP spec
- Success metrics

## Workstream owners

- Frontend agent: UX/UI and client app
- Backend agent: APIs, auth, business logic
- Data agent: analytics events, dashboards, experiment support
- DevOps agent: deployment, environments, monitoring, rollback

## Interface contracts

For each workstream provide:

- API/schema contract
- Definition of done
- Handoff owner
- Dependencies

## Operating cadence

- Daily async status updates
- Blocker SLA: <= 4 hours response
- Scope change process: explicit change request + re-estimate

## Quality gates

- Functional tests for critical path
- Basic security checks (authz/authn input validation)
- Observability baseline (logs + errors + uptime signal)
- Launch checklist complete

## Deployment contract

- Staging deployment before production
- Production guarded by manual approval gate
- Rollback path validated before launch window

## Output format

```md
# Engineering Delivery Plan
- MVP name:
- Build owners:
- Dependencies:
- Risks:
- Milestones:
- Launch date:
- Rollback owner:
```
