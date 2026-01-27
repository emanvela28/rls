const reviewerSummaryBody = document.getElementById("reviewerSummaryBody");
const reviewerSummaryCount = document.getElementById("reviewerSummaryCount");
const reviewerGeneratedAt = document.getElementById("reviewerGeneratedAt");
const reviewerCount = document.getElementById("reviewerCount");
const reviewerL7Body = document.getElementById("reviewerL7Body");
const reviewerL7Count = document.getElementById("reviewerL7Count");
const reviewerDetail = document.getElementById("reviewerDetail");
const reviewerDetailName = document.getElementById("reviewerDetailName");
const reviewerDetailTitle = document.getElementById("reviewerDetailTitle");
const reviewerDetailTotal = document.getElementById("reviewerDetailTotal");
const reviewerDateInput = document.getElementById("reviewerDate");
const reviewerByDayBody = document.getElementById("reviewerByDayBody");
const reviewerDayCount = document.getElementById("reviewerDayCount");
const reviewerSelectedTitle = document.getElementById("reviewerSelectedTitle");
const reviewerSelectedCount = document.getElementById("reviewerSelectedCount");
const reviewerSelectedBody = document.getElementById("reviewerSelectedBody");
const reviewerSelectedPanel = document.getElementById("reviewerSelectedPanel");
const reviewerSelectedToggle = document.getElementById("reviewerSelectedToggle");
const reviewerSelectedTableWrap = document.getElementById("reviewerSelectedTableWrap");
const reviewerSelectedPager = document.getElementById("reviewerSelectedPager");
const reviewerSelectedPrev = document.getElementById("reviewerSelectedPrev");
const reviewerSelectedNext = document.getElementById("reviewerSelectedNext");
const reviewerSelectedPageInfo = document.getElementById("reviewerSelectedPageInfo");
const reviewerSelectedPageSize = document.getElementById("reviewerSelectedPageSize");
const reviewerSelectedVisibleCount = document.getElementById("reviewerSelectedVisibleCount");
let selectedListOpen = false;
let allApprovalsByDay = new Map();
let selectedApprovals = [];
let selectedPage = 1;
let selectedPageSize = Number(reviewerSelectedPageSize?.value || 25);

const PST_TIMEZONE = "America/Los_Angeles";
const APPROVED_STATUSES = new Set(["approved", "qa awaiting review"]);
const headerFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PST_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PST_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PST_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
});

const dateKeyFromIso = (value) => {
  if (!value) return "";
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dateFormatter.format(dt);
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return timeFormatter.format(dt);
};

const normalizeReviewer = (value) => (value || "").trim();
const formatPstHeader = (value) => {
  if (!value) return "—";
  const cleaned = value.replace(" UTC", "Z").replace(" ", "T");
  const dt = new Date(cleaned);
  if (Number.isNaN(dt.getTime())) return value;
  return `${headerFormatter.format(dt)} PST`;
};

const buildReviewerStats = (tasks) => {
  const map = new Map();
  tasks.forEach((task) => {
    const reviewer = normalizeReviewer(task.claiming_reviewer);
    const approvedAt = task.approved_at;
    if (!reviewer || !approvedAt) return;
    const status = (task.status_name || "").trim().toLowerCase();
    if (status && !APPROVED_STATUSES.has(status)) return;
    const dateKey = dateKeyFromIso(approvedAt);
    if (!dateKey) return;

    if (!map.has(reviewer)) {
      map.set(reviewer, {
        name: reviewer,
        total: 0,
        byDay: new Map(),
        tasksByDay: new Map(),
        latestApprovedAt: "",
      });
    }
    const entry = map.get(reviewer);
    entry.total += 1;
    entry.byDay.set(dateKey, (entry.byDay.get(dateKey) || 0) + 1);
    if (!entry.tasksByDay.has(dateKey)) {
      entry.tasksByDay.set(dateKey, []);
    }
    entry.tasksByDay.get(dateKey).push({
      task_name: task.task_name || "—",
      author_name: task.owned_by_user_name || "—",
      reviewer_name: reviewer,
      approved_at: approvedAt,
    });
    if (!entry.latestApprovedAt || new Date(approvedAt) > new Date(entry.latestApprovedAt)) {
      entry.latestApprovedAt = approvedAt;
    }
  });

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
};

const buildAllApprovalsByDay = (tasks) => {
  const map = new Map();
  tasks.forEach((task) => {
    const reviewer = normalizeReviewer(task.claiming_reviewer);
    const approvedAt = task.approved_at;
    if (!reviewer || !approvedAt) return;
    const status = (task.status_name || "").trim().toLowerCase();
    if (status && !APPROVED_STATUSES.has(status)) return;
    const dayKey = dateKeyFromIso(approvedAt);
    if (!dayKey) return;
    if (!map.has(dayKey)) {
      map.set(dayKey, []);
    }
    map.get(dayKey).push({
      task_name: task.task_name || "—",
      author_name: task.owned_by_user_name || "—",
      reviewer_name: reviewer,
      approved_at: approvedAt,
    });
  });
  return map;
};

const buildL7Approvals = (tasks) => {
  const map = new Map();
  tasks.forEach((task) => {
    const reviewer = normalizeReviewer(task.claiming_reviewer);
    const approvedAt = task.approved_at;
    if (!reviewer || !approvedAt) return;
    const status = (task.status_name || "").trim().toLowerCase();
    if (status && !APPROVED_STATUSES.has(status)) return;
    const dayKey = dateKeyFromIso(approvedAt);
    if (!dayKey) return;
    map.set(dayKey, (map.get(dayKey) || 0) + 1);
  });

  const todayKey = dateKeyFromIso(new Date());
  const days = [];
  if (todayKey) {
    const [year, month, day] = todayKey.split("-").map(Number);
    const anchor = new Date(Date.UTC(year, month - 1, day, 12));
    for (let i = 0; i < 7; i += 1) {
      const dt = new Date(anchor);
      dt.setUTCDate(anchor.getUTCDate() - i);
      days.push(dateKeyFromIso(dt));
    }
  }

  return days.map((day) => ({ day, count: map.get(day) || 0 }));
};

const renderL7Table = (items) => {
  if (!reviewerL7Body || !reviewerL7Count) return;
  const todayKey = dateKeyFromIso(new Date());
  reviewerL7Body.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const total = items.reduce((sum, item) => sum + item.count, 0);
  items.forEach((item) => {
    const label = item.day === todayKey ? `Today (${item.day})` : item.day;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${label || "—"}</td>
      <td>${item.count.toLocaleString()}</td>
    `;
    fragment.appendChild(tr);
  });
  reviewerL7Body.appendChild(fragment);
  reviewerL7Count.textContent = `${total.toLocaleString()} total`;
};

const renderSummary = (reviewers, todayKey) => {
  reviewerSummaryBody.innerHTML = "";
  const fragment = document.createDocumentFragment();
  reviewers.forEach((reviewer) => {
    const tr = document.createElement("tr");
    const todayCount = reviewer.byDay.get(todayKey) || 0;
    tr.innerHTML = `
      <td>${reviewer.name}</td>
      <td>${todayCount.toLocaleString()}</td>
      <td>${reviewer.total.toLocaleString()}</td>
      <td>${reviewer.latestApprovedAt ? formatDateTime(reviewer.latestApprovedAt) : "—"}</td>
    `;
    tr.addEventListener("click", () => renderDetail(reviewer, todayKey, true));
    fragment.appendChild(tr);
  });
  reviewerSummaryBody.appendChild(fragment);
  reviewerSummaryCount.textContent = `${reviewers.length.toLocaleString()} reviewers`;
  reviewerCount.textContent = `Reviewers: ${reviewers.length.toLocaleString()}`;
};

const renderByDay = (reviewer) => {
  reviewerByDayBody.innerHTML = "";
  const days = Array.from(reviewer.byDay.entries())
    .sort((a, b) => b[0].localeCompare(a[0]));
  const fragment = document.createDocumentFragment();
  days.forEach(([day, count]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${day}</td>
      <td>${count.toLocaleString()}</td>
    `;
    fragment.appendChild(tr);
  });
  reviewerByDayBody.appendChild(fragment);
  reviewerDayCount.textContent = `${days.length.toLocaleString()} days`;
};

const renderSelectedDayAll = (dateKey) => {
  reviewerSelectedBody.innerHTML = "";
  selectedApprovals = allApprovalsByDay.get(dateKey) || [];
  selectedPage = 1;
  const items = selectedApprovals;
  renderSelectedPage(items);
  reviewerSelectedTitle.textContent = `Approvals on ${dateKey || "—"}`;
  reviewerSelectedCount.textContent = `${items.length.toLocaleString()} approvals`;
  if (reviewerSelectedPanel) {
    reviewerSelectedPanel.hidden = false;
  }
  if (reviewerSelectedPager) {
    reviewerSelectedPager.hidden = !selectedListOpen;
  }
  if (reviewerSelectedToggle && reviewerSelectedTableWrap) {
    reviewerSelectedTableWrap.hidden = !selectedListOpen;
    reviewerSelectedToggle.textContent = selectedListOpen ? "Hide list" : "Show list";
  }
};

const renderSelectedPage = (items) => {
  reviewerSelectedBody.innerHTML = "";
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / selectedPageSize));
  selectedPage = Math.min(selectedPage, totalPages);
  const start = (selectedPage - 1) * selectedPageSize;
  const pageItems = items.slice(start, start + selectedPageSize);
  const fragment = document.createDocumentFragment();
  pageItems.forEach((task) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${task.task_name}</td>
      <td>${task.author_name}</td>
      <td>${task.reviewer_name || "—"}</td>
      <td>${formatDateTime(task.approved_at)}</td>
    `;
    fragment.appendChild(tr);
  });
  reviewerSelectedBody.appendChild(fragment);
  if (reviewerSelectedPager && reviewerSelectedPageInfo && reviewerSelectedPrev && reviewerSelectedNext) {
    reviewerSelectedPager.hidden = !selectedListOpen;
    reviewerSelectedPageInfo.textContent = `Page ${selectedPage} of ${totalPages}`;
    reviewerSelectedPrev.disabled = selectedPage <= 1;
    reviewerSelectedNext.disabled = selectedPage >= totalPages;
  }
  if (reviewerSelectedVisibleCount) {
    reviewerSelectedVisibleCount.textContent = `Showing ${pageItems.length.toLocaleString()} of ${total.toLocaleString()}`;
  }
};

const renderDetail = (reviewer, defaultDateKey, shouldScroll = false) => {
  if (!reviewerDetail) return;
  reviewerDetail.hidden = false;
  if (reviewerSelectedPanel) {
    reviewerSelectedPanel.hidden = true;
  }
  if (reviewerSelectedToggle && reviewerSelectedTableWrap) {
    selectedListOpen = false;
    reviewerSelectedTableWrap.hidden = true;
    reviewerSelectedToggle.textContent = "Show list";
  }
  if (reviewerSelectedPager) {
    reviewerSelectedPager.hidden = true;
  }
  if (reviewerSelectedVisibleCount) {
    reviewerSelectedVisibleCount.textContent = "Showing —";
  }
  reviewerDetailTitle.textContent = "Reviewer";
  reviewerDetailName.textContent = reviewer.name;
  reviewerDetailTotal.textContent = `${reviewer.total.toLocaleString()} approvals`;
  renderByDay(reviewer);
  if (reviewerDateInput) {
    reviewerDateInput.value = defaultDateKey || "";
    reviewerDateInput.onchange = () => renderSelectedDayAll(reviewerDateInput.value);
  }
  renderSelectedDayAll(reviewerDateInput?.value || defaultDateKey);
  if (shouldScroll) {
    reviewerDetail.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

window.authFetch("/api/data")
  .then((response) => response.json())
  .then((data) => {
    reviewerGeneratedAt.textContent = `Updated: ${formatPstHeader(data.generated_at)}`;
    const tasks = data.tasks || [];
    const reviewers = buildReviewerStats(tasks);
    allApprovalsByDay = buildAllApprovalsByDay(tasks);
    const l7 = buildL7Approvals(tasks);
    const todayKey = dateKeyFromIso(new Date());
    renderSummary(reviewers, todayKey);
    renderL7Table(l7);
    if (reviewers.length) {
      renderDetail(reviewers[0], todayKey, false);
    }
  })
  .catch((err) => {
    reviewerSummaryBody.innerHTML = `<tr><td colspan="4">Failed to load data.json: ${err}</td></tr>`;
  });

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (window.signOut) {
      window.signOut();
    }
  });
}

if (reviewerSelectedToggle && reviewerSelectedTableWrap) {
  reviewerSelectedToggle.addEventListener("click", () => {
    selectedListOpen = !selectedListOpen;
    reviewerSelectedTableWrap.hidden = !selectedListOpen;
    reviewerSelectedToggle.textContent = selectedListOpen ? "Hide list" : "Show list";
    if (reviewerSelectedPager) {
      reviewerSelectedPager.hidden = !selectedListOpen;
    }
    if (selectedListOpen) {
      renderSelectedPage(selectedApprovals);
    }
  });
}

if (reviewerSelectedPrev && reviewerSelectedNext) {
  reviewerSelectedPrev.addEventListener("click", () => {
    selectedPage = Math.max(1, selectedPage - 1);
    renderSelectedPage(selectedApprovals);
  });
  reviewerSelectedNext.addEventListener("click", () => {
    selectedPage += 1;
    renderSelectedPage(selectedApprovals);
  });
}

if (reviewerSelectedPageSize) {
  reviewerSelectedPageSize.addEventListener("change", (event) => {
    selectedPageSize = Number(event.target.value);
    selectedPage = 1;
    renderSelectedPage(selectedApprovals);
  });
}
