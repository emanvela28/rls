const generatedAtEl = document.getElementById("generatedAt");
const writerTotalEl = document.getElementById("writerTotal");
const funnelStatsEl = document.getElementById("funnelStats");
const stagePeopleStatsEl = document.getElementById("stagePeopleStats");
const funnelColumnsEl = document.getElementById("funnelColumns");
const cohortCountsEl = document.getElementById("cohortCounts");
const progressTableBody = document.getElementById("progressTableBody");
const authorProgressCountEl = document.getElementById("authorProgressCount");
const stageFilterChips = document.getElementById("stageFilterChips");
const detailPanel = document.getElementById("authorDetail");
const detailNameEl = document.getElementById("detailName");
const detailEmailEl = document.getElementById("detailEmail");
const detailCountEl = document.getElementById("detailCount");
const detailTableBody = document.getElementById("detailTableBody");
const detailScoreEl = document.getElementById("detailScore");
const applyTaskOverrides = (tasks) =>
  tasks.map((task) => {
    const normalized = (task.owned_by_user_name || "").trim().toLowerCase();
    if (normalized === "contractor d1f023") {
      return {
        ...task,
        owned_by_user_name: "Wooil Kim",
        owned_by_user_email: "d1f02345a5a0400d@c-mercor.com",
      };
    }
    return task;
  });
if (detailPanel) {
  detailPanel.hidden = true;
}

const APPROVED_STATUSES = new Set(["approved", "qa awaiting review"]);
const SUBMITTED_STATUSES = new Set(["awaiting review", "in review"]);
const CLAIMED_STATUSES = new Set(["pending"]);
const STAGE_ORDER = ["claimed", "submitted", "approved"];
const STAGE_LABELS = {
  approved: "Approved / QA Awaiting Review",
  submitted: "Awaiting Review / In Review",
  claimed: "Pending",
};
// Contributor weights ignore statuses authors don't control (QA, in review)
const CONTRIBUTOR_WEIGHTS = {
  approved: 3,
  "awaiting review": 1.5,
  pending: 0.5,
};

const pct = (count, total) => {
  if (!total) return "0%";
  return `${Math.round((count / total) * 100)}%`;
};

const statusToStage = (status) => {
  const normalized = (status || "").trim().toLowerCase();
  if (APPROVED_STATUSES.has(normalized)) return "approved";
  if (SUBMITTED_STATUSES.has(normalized)) return "submitted";
  if (CLAIMED_STATUSES.has(normalized)) return "claimed";
  return null;
};

const normalizeKey = (name, email) => {
  if (email && email.trim()) return email.trim().toLowerCase();
  if (name && name.trim()) return name.trim().toLowerCase();
  return "";
};

const contributionWeight = (status) => {
  const normalized = (status || "").trim().toLowerCase();
  return CONTRIBUTOR_WEIGHTS[normalized] || 0;
};

const buildFunnel = (tasks) => {
  const authors = new Map();
  const stagePeople = {
    approved: new Set(),
    submitted: new Set(),
    claimed: new Set(),
  };

  tasks.forEach((task) => {
    const stage = statusToStage(task.status_name);
    if (!stage) return;

    const name = (task.owned_by_user_name || "").trim() || "Unknown";
    const email = (task.owned_by_user_email || "").trim();
    const key = normalizeKey(name, email);

    stagePeople[stage].add(key);

    const entry =
      authors.get(key) || {
        key,
        name,
        email,
        bestStage: "",
        counts: { approved: 0, submitted: 0, claimed: 0 },
        contributionScore: 0,
      };

    entry.counts[stage] += 1;
    entry.contributionScore += contributionWeight(task.status_name);
    const currentRank = STAGE_ORDER.indexOf(entry.bestStage);
    const incomingRank = STAGE_ORDER.indexOf(stage);
    if (incomingRank > currentRank) {
      entry.bestStage = stage;
    }
    authors.set(key, entry);
  });

  const authorList = Array.from(authors.values());
  const totalAuthors = authorList.length;
  const approvedAuthors = authorList.filter((a) => a.bestStage === "approved");
  const submittedAuthors = authorList.filter(
    (a) => STAGE_ORDER.indexOf(a.bestStage) >= STAGE_ORDER.indexOf("submitted"),
  );
  const claimedAuthors = authorList.filter(
    (a) => STAGE_ORDER.indexOf(a.bestStage) >= STAGE_ORDER.indexOf("claimed"),
  );

  const cohorts = {
    approved: approvedAuthors,
    submittedOnly: authorList.filter((a) => a.bestStage === "submitted"),
    claimedOnly: authorList.filter((a) => a.bestStage === "claimed"),
  };

  return {
    totalAuthors,
    authorList,
    authorMap: authors,
    counts: {
      approved: approvedAuthors.length,
      submitted: submittedAuthors.length,
      claimed: claimedAuthors.length,
    },
    stagePeopleCounts: {
      approved: stagePeople.approved.size,
      submitted: stagePeople.submitted.size,
      claimed: stagePeople.claimed.size,
    },
    stageCampaignCounts: {
      approved: approvedAuthors.length,
      submitted: authorList.filter((a) => a.bestStage === "submitted").length,
      claimed: authorList.filter((a) => a.bestStage === "claimed").length,
    },
    cohorts,
  };
};

let stageFilter = "all";
let sortKey = "stage";
let sortDirection = "desc";
let cachedFunnel = null;

const renderStageFilterChips = () => {
  if (!stageFilterChips) return;
  const options = [
    { key: "all", label: "All" },
    { key: "approved", label: "Approved" },
    { key: "submitted", label: "Submitted" },
    { key: "claimed", label: "Claimed" },
  ];
  stageFilterChips.innerHTML = "";
  options.forEach((opt) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    if (stageFilter === opt.key) chip.classList.add("active");
    chip.type = "button";
    chip.textContent = opt.label;
    chip.addEventListener("click", () => {
      stageFilter = opt.key;
      renderStageFilterChips();
      renderProgressTable(cachedFunnel);
    });
    stageFilterChips.appendChild(chip);
  });
};

const renderStats = (funnel) => {
  funnelStatsEl.innerHTML = "";
  const cards = [
    {
      label: "Who has a task approved",
      value: `${funnel.counts.approved.toLocaleString()} (${pct(funnel.counts.approved, funnel.totalAuthors)})`,
    },
    {
      label: "Who submitted a task",
      value: `${funnel.counts.submitted.toLocaleString()} (${pct(funnel.counts.submitted, funnel.totalAuthors)})`,
    },
    {
      label: "Who claimed a task",
      value: `${funnel.counts.claimed.toLocaleString()} (${pct(funnel.counts.claimed, funnel.totalAuthors)})`,
    },
  ];

  cards.forEach((card) => {
    const div = document.createElement("div");
    div.className = "stat-card";
    div.innerHTML = `<div class="stat-label">${card.label}</div>
      <div class="stat-value">${card.value}</div>`;
    funnelStatsEl.appendChild(div);
  });
};

const renderStagePeopleStats = (funnel) => {
  if (!stagePeopleStatsEl) return;
  stagePeopleStatsEl.innerHTML = "";
  const cards = [
    {
      label: "Awaiting review (awaiting review / in review)",
      cohort: funnel.stagePeopleCounts.submitted,
      campaign: funnel.stageCampaignCounts.submitted,
    },
    {
      label: "Pending claims",
      cohort: funnel.stagePeopleCounts.claimed,
      campaign: funnel.stageCampaignCounts.claimed,
    },
    {
      label: "QA or approved",
      cohort: funnel.stagePeopleCounts.approved,
      campaign: funnel.stageCampaignCounts.approved,
    },
  ];

  cards.forEach((card) => {
    const div = document.createElement("div");
    div.className = "stat-card";
    div.innerHTML = `<div class="stat-label">${card.label}</div>
      <div class="stat-value">${card.cohort.toLocaleString()}</div>
      <div class="stat-subvalue">Cohort stuck: ${card.cohort.toLocaleString()}</div>
      <div class="stat-subvalue">Campaign stuck: ${card.campaign.toLocaleString()}</div>`;
    stagePeopleStatsEl.appendChild(div);
  });
};

const renderCohorts = (funnel) => {
  funnelColumnsEl.innerHTML = "";
  cohortCountsEl.textContent = `${funnel.totalAuthors.toLocaleString()} authors tracked`;

  const MAX_VISIBLE = 8;

  const columnData = [
    { key: "approved", title: "Approved", authors: funnel.cohorts.approved },
    { key: "submittedOnly", title: "Submitted (no approval yet)", authors: funnel.cohorts.submittedOnly },
    { key: "claimedOnly", title: "Claimed (not submitted yet)", authors: funnel.cohorts.claimedOnly },
  ];

  columnData.forEach((col) => {
    const column = document.createElement("div");
    column.className = "funnel-column";
    column.innerHTML = `
      <div class="funnel-column__header">
        <div class="stage-badge stage-badge--${col.key}">${col.title}</div>
        <span>${col.authors.length.toLocaleString()} authors</span>
      </div>
    `;

    const list = document.createElement("ul");
    list.className = "funnel-list";

    const sorted = [...col.authors].sort((a, b) => a.name.localeCompare(b.name));
    const visible = sorted.slice(0, MAX_VISIBLE);
    const hidden = sorted.slice(MAX_VISIBLE);

    if (!sorted.length) {
      const li = document.createElement("li");
      li.className = "funnel-list__empty";
      li.textContent = "None yet";
      list.appendChild(li);
    } else {
      const makeItem = (author) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <div class="funnel-list__name">${author.name} (${author.counts.approved} approved)</div>
          <div class="funnel-list__email">${author.email || "—"}</div>
        `;
        li.dataset.authorKey = author.key;
        li.addEventListener("click", () => {
          showAuthorTasks(author, window.__allTasks || []);
        });
        return li;
      };

      visible.forEach((author) => list.appendChild(makeItem(author)));

      if (hidden.length) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "funnel-list__toggle";
        toggle.textContent = `Show all ${sorted.length} authors`;
        let expanded = false;
        const hiddenItems = hidden.map((author) => makeItem(author));
        toggle.addEventListener("click", () => {
          expanded = !expanded;
          if (expanded) {
            hiddenItems.forEach((item) => list.appendChild(item));
            toggle.textContent = "Show less";
          } else {
            hiddenItems.forEach((item) => item.remove());
            toggle.textContent = `Show all ${sorted.length} authors`;
          }
        });
        list.appendChild(toggle);
      }
    }

    column.appendChild(list);
    funnelColumnsEl.appendChild(column);
  });
};

const renderProgressTable = (funnel) => {
  progressTableBody.innerHTML = "";
  authorProgressCountEl.textContent = `${funnel.authorList.length.toLocaleString()} authors`;
  setHeaderSortState();

  let rows = [...funnel.authorList];

  if (stageFilter !== "all") {
    rows = rows.filter((a) => a.bestStage === stageFilter);
  }

  const baseSorters = {
    stage: (a, b) => STAGE_ORDER.indexOf(a.bestStage) - STAGE_ORDER.indexOf(b.bestStage) || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name),
    email: (a, b) => (a.email || "").localeCompare(b.email || ""),
    approved: (a, b) => a.counts.approved - b.counts.approved || a.name.localeCompare(b.name),
    submitted: (a, b) => a.counts.submitted - b.counts.submitted || a.name.localeCompare(b.name),
    claimed: (a, b) => a.counts.claimed - b.counts.claimed || a.name.localeCompare(b.name),
    score: (a, b) => a.contributionScore - b.contributionScore || a.name.localeCompare(b.name),
  };
  const sorter = baseSorters[sortKey] || baseSorters.stage;
  rows.sort(sorter);
  if (sortDirection === "desc") {
    rows.reverse();
  }

  const fragment = document.createDocumentFragment();
  rows.forEach((author) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${author.name}</td>
      <td>${author.email || "—"}</td>
      <td><span class="stage-pill stage-pill--${author.bestStage}">${STAGE_LABELS[author.bestStage] || "—"}</span></td>
      <td>${author.contributionScore.toFixed(1)}</td>
      <td>${author.counts.approved}</td>
      <td>${author.counts.submitted}</td>
      <td>${author.counts.claimed}</td>
    `;
    fragment.appendChild(tr);
  });

  progressTableBody.appendChild(fragment);
};

window.authFetch("/api/data")
  .then((response) => response.json())
  .then((data) => {
    generatedAtEl.textContent = `Updated: ${data.generated_at || "—"}`;
    const tasks = applyTaskOverrides(data.tasks || []);
    window.__allTasks = tasks;
    const funnel = buildFunnel(tasks);
    cachedFunnel = funnel;
    writerTotalEl.textContent = `Writers counted: ${funnel.totalAuthors.toLocaleString()}`;
    renderStats(funnel);
    renderStagePeopleStats(funnel);
    renderCohorts(funnel);
    renderStageFilterChips();
    renderProgressTable(funnel);
  })
  .catch((err) => {
    funnelStatsEl.innerHTML = `<div class="stat-card">Failed to load funnel data: ${err}</div>`;
  });

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (window.signOut) {
      window.signOut();
    }
  });
}

const showAuthorTasks = (author, tasks) => {
  if (!detailPanel || !author) return;
  const key = normalizeKey(author.name, author.email);
  const matching = tasks.filter((task) => {
    const taskKey = normalizeKey(task.owned_by_user_name, task.owned_by_user_email);
    return taskKey === key;
  });

  if (!matching.length) {
    detailPanel.hidden = true;
    return;
  }

  detailPanel.hidden = false;
  detailNameEl.textContent = author.name;
  detailEmailEl.textContent = author.email || "No email";
  detailCountEl.textContent = `${matching.length} tasks`;
  if (detailScoreEl) {
    const score = typeof author.contributionScore === "number" ? author.contributionScore.toFixed(1) : "—";
    detailScoreEl.textContent = `Score: ${score}`;
  }
  detailTableBody.innerHTML = "";

  matching
    .sort((a, b) => (a.status_name || "").localeCompare(b.status_name || ""))
    .forEach((task) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${task.status_name || "—"}</td>
        <td>${task.task_name || "—"}</td>
        <td>${task.task_id || "—"}</td>
      `;
      detailTableBody.appendChild(tr);
    });

  detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
};

const progressTableEl = document.querySelector("#progressTableBody")?.closest("table");
const progressHeaders = progressTableEl
  ? progressTableEl.querySelectorAll("thead th[data-sort-key]")
  : [];

const syncSortSelect = () => {
  // no-op (dropdown removed)
};

const clearHeaderSortState = () => {
  progressHeaders.forEach((th) => th.classList.remove("sorted-asc", "sorted-desc"));
};

const applyHeaderSort = (key) => {
  if (sortKey === key) {
    sortDirection = sortDirection === "asc" ? "desc" : "asc";
  } else {
    sortKey = key;
    sortDirection = "desc";
  }
  clearHeaderSortState();
  (progressHeaders || []).forEach((th) => {
    if (th.dataset.sortKey === sortKey) {
      th.classList.add(sortDirection === "asc" ? "sorted-asc" : "sorted-desc");
    }
  });
  syncSortSelect();
  renderProgressTable(cachedFunnel);
};

progressHeaders.forEach((th) => {
  th.addEventListener("click", () => applyHeaderSort(th.dataset.sortKey));
});

const setHeaderSortState = () => {
  clearHeaderSortState();
  progressHeaders.forEach((th) => {
    if (th.dataset.sortKey === sortKey) {
      th.classList.add(sortDirection === "asc" ? "sorted-asc" : "sorted-desc");
    }
  });
};
