## Contributor Score

Purpose: rank authors by how much they advance work, discounting stages they don't control.

Formula (per author):
- Start at 0.
- For each task, add the weight for its current status:
  - Approved: +3
  - Awaiting Review: +1.5
  - Pending: +0.5
- Statuses like QA / In Review are not weighted (they depend on reviewers, not authors).
- Final score is the sum across all tasks for that author.

Usage in UI:
- Funnel → Author Progress table shows a "Contributor Score" column and lets you sort high → low or low → high.
- Sorting by score will prioritize authors with more approvals, then submissions, then claims.

Notes:
- Because QA/In Review are excluded, a long reviewer queue won't inflate a writer's score.
- If you want recency weighting later, we can add a time decay on top of this base score.
