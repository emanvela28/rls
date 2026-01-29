const analyticsGeneratedAt = document.getElementById("analyticsGeneratedAt");
const analyticsRangeLabel = document.getElementById("analyticsRangeLabel");
const analyticsRangeChips = document.getElementById("analyticsRangeChips");
const analyticsAnchorDate = document.getElementById("analyticsAnchorDate");
const throughputStats = document.getElementById("throughputStats");
const reviewStats = document.getElementById("reviewStats");
const throughputSummary = document.getElementById("throughputSummary");
const reviewSummary = document.getElementById("reviewSummary");
const dailyTotalsBody = document.getElementById("dailyTotalsBody");
const dailyRangeLabel = document.getElementById("dailyRangeLabel");
const metricsPopover = document.getElementById("metricsPopover");
const metricsPopoverTitle = document.getElementById("metricsPopoverTitle");
const metricsPopoverNew = document.getElementById("metricsPopoverNew");
const metricsPopoverOld = document.getElementById("metricsPopoverOld");
const metricsPopoverMercor = document.getElementById("metricsPopoverMercor");

const RANGE_OPTIONS = [
  { key: "daily", label: "Daily", days: 1 },
  { key: "l3", label: "L3", days: 3 },
  { key: "l7", label: "L7", days: 7 },
  { key: "l14", label: "L14", days: 14 },
  { key: "campaign", label: "Campaign", days: null },
];
const STATUS_KEYS = {
  approved: "approved",
  submitted: "awaiting review",
  claimed: "pending",
  inReview: "in review",
  needsEdits: "needs edits",
};

let analyticsRange = "daily";
let anchorDate = null;
let tasks = [];
let oldNewMap = {};
let emailMap = {};

const normalize = (value) => (value || "").trim().toLowerCase();
const normalizeName = (value) => normalize(value).replace(/\s+/g, " ");
const normalizeEmail = (value) => normalize(value);
const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};
const parseAnchorDate = (value) => {
  if (!value) return null;
  const parts = value.split("-").map((part) => Number(part));
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};
const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};
const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const getAnchorDate = () => {
  if (anchorDate) return new Date(anchorDate);
  return new Date();
};

const getRange = (key) => {
  const selected = RANGE_OPTIONS.find((opt) => opt.key === key) || RANGE_OPTIONS[0];
  if (!selected.days) return null;
  const endDate = getAnchorDate();
  const start = new Date(endDate);
  start.setDate(endDate.getDate() - (selected.days - 1));
  return { start: startOfDay(start), end: endOfDay(endDate) };
};

const formatRangeLabel = (range) => {
  if (!range) return "All time";
  const start = range.start.toLocaleDateString();
  const end = range.end.toLocaleDateString();
  return `${start} – ${end}`;
};

const inRange = (date, range) => {
  if (!range) return true;
  if (!date) return false;
  return date >= range.start && date <= range.end;
};

const resolveName = (task) => {
  const email = normalizeEmail(task.owned_by_user_email);
  if (email && emailMap[email]) return emailMap[email];
  return task.owned_by_user_name || "";
};

const getHistory = (task) => {
  const nameKey = normalizeName(resolveName(task));
  if (!nameKey) return "unknown";
  const label = oldNewMap[nameKey] || "";
  const normalized = normalize(label);
  if (normalized === "new") return "new";
  if (normalized === "old") return "old";
  const email = normalizeEmail(task.owned_by_user_email);
  if (email && email.endsWith("@c-mercor.com")) return "mercor";
  return "new";
};

const createMetric = () => ({ total: 0, new: 0, old: 0, mercor: 0, unknown: 0 });

const addCount = (metric, history, value = 1) => {
  if (history === "new") {
    metric.new += value;
    metric.total += value;
  } else if (history === "old") {
    metric.old += value;
    metric.total += value;
  } else if (history === "mercor") {
    metric.mercor += value;
  } else {
    metric.unknown += value;
  }
};

const buildMetrics = (range) => {
  const approved = createMetric();
  const submitted = createMetric();
  const claimed = createMetric();
  const reviewed = createMetric();
  const sentBack = createMetric();

  tasks.forEach((task) => {
    const status = normalize(task.status_name);
    const history = getHistory(task);
    const updatedAt = parseDate(task.updated_at);
    const approvedAt = parseDate(task.approved_at) || updatedAt;

    if (status === STATUS_KEYS.approved && inRange(approvedAt, range)) {
      addCount(approved, history);
    }
    if (status === STATUS_KEYS.submitted && inRange(updatedAt, range)) {
      addCount(submitted, history);
    }
    if (status === STATUS_KEYS.claimed && inRange(updatedAt, range)) {
      addCount(claimed, history);
    }
    if (
      (status === STATUS_KEYS.inReview ||
        status === STATUS_KEYS.approved ||
        status === STATUS_KEYS.needsEdits) &&
      inRange(updatedAt, range)
    ) {
      addCount(reviewed, history);
    }
    if (status === STATUS_KEYS.needsEdits && inRange(updatedAt, range)) {
      addCount(sentBack, history);
    }
  });

  return { approved, submitted, claimed, reviewed, sentBack };
};

const passRate = (approvedCount, sentBackCount) => {
  const denom = approvedCount + sentBackCount;
  if (!denom) return 0;
  return approvedCount / denom;
};

const formatNumber = (value) => value.toLocaleString();

const renderCard = (title, metric, suffix = "tasks") => {
  if (!metric) return "";
  const totalValue = `${formatNumber(metric.total)} ${suffix}`;
  const subValue = `New ${formatNumber(metric.new)} · Old ${formatNumber(metric.old)} · Mercor ${formatNumber(metric.mercor)}`;
  return `
    <div class="stat-card">
      <div class="stat-label">${title}</div>
      <div class="stat-value">${totalValue}</div>
      <div class="stat-subvalue">${subValue}</div>
    </div>
  `;
};

const renderRateCard = (title, approvedMetric, sentBackMetric) => {
  const totalRate = passRate(approvedMetric.total, sentBackMetric.total);
  const totalValue = `${Math.round(totalRate * 100)}%`;
  const subValue = `New ${Math.round(passRate(approvedMetric.new, sentBackMetric.new) * 100)}% · Old ${Math.round(
    passRate(approvedMetric.old, sentBackMetric.old) * 100,
  )}%`;
  return `
    <div class="stat-card">
      <div class="stat-label">${title}</div>
      <div class="stat-value">${totalValue}</div>
      <div class="stat-subvalue">${subValue}</div>
    </div>
  `;
};

const getDayKey = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildDailyMetrics = (range) => {
  if (!range) return [];
  const buckets = new Map();
  const days = [];
  const cursor = new Date(range.start);
  while (cursor <= range.end) {
    const key = getDayKey(cursor);
    buckets.set(key, {
      date: new Date(cursor),
      approved: createMetric(),
      submitted: createMetric(),
      claimed: createMetric(),
      reviewed: createMetric(),
      sentBack: createMetric(),
    });
    days.push(key);
    cursor.setDate(cursor.getDate() + 1);
  }

  const addToBucket = (key, metricName, history) => {
    const bucket = buckets.get(key);
    if (!bucket) return;
    addCount(bucket[metricName], history);
  };

  tasks.forEach((task) => {
    const status = normalize(task.status_name);
    const history = getHistory(task);
    const updatedAt = parseDate(task.updated_at);
    const approvedAt = parseDate(task.approved_at) || updatedAt;

    if (status === STATUS_KEYS.approved && inRange(approvedAt, range)) {
      addToBucket(getDayKey(approvedAt), "approved", history);
    }
    if (status === STATUS_KEYS.submitted && inRange(updatedAt, range)) {
      addToBucket(getDayKey(updatedAt), "submitted", history);
    }
    if (status === STATUS_KEYS.claimed && inRange(updatedAt, range)) {
      addToBucket(getDayKey(updatedAt), "claimed", history);
    }
    if (
      (status === STATUS_KEYS.inReview ||
        status === STATUS_KEYS.approved ||
        status === STATUS_KEYS.needsEdits) &&
      inRange(updatedAt, range)
    ) {
      addToBucket(getDayKey(updatedAt), "reviewed", history);
    }
    if (status === STATUS_KEYS.needsEdits && inRange(updatedAt, range)) {
      addToBucket(getDayKey(updatedAt), "sentBack", history);
    }
  });

  return days.map((key) => buckets.get(key));
};

const renderDailyTable = (range) => {
  if (!dailyTotalsBody) return;
  const rows = buildDailyMetrics(range);
  if (!rows.length) {
    dailyTotalsBody.innerHTML = `<tr><td colspan="7">No data in range.</td></tr>`;
    return;
  }
  const anchorKey = getDayKey(getAnchorDate());
  dailyTotalsBody.innerHTML = "";
  const totalFragment = document.createDocumentFragment();
  rows
    .slice()
    .reverse()
    .forEach((day) => {
      const totalRow = document.createElement("tr");
      const key = getDayKey(day.date);
      if (key === anchorKey) {
        totalRow.classList.add("is-anchor");
      }
      const passTotal = passRate(day.approved.total, day.sentBack.total);
      totalRow.innerHTML = `
        <td>${day.date.toLocaleDateString()}</td>
        <td class="metric-cell" data-metric="Approved" data-new="${day.approved.new}" data-old="${day.approved.old}" data-mercor="${day.approved.mercor}">
          ${formatNumber(day.approved.total)}
        </td>
        <td class="metric-cell" data-metric="Submitted" data-new="${day.submitted.new}" data-old="${day.submitted.old}" data-mercor="${day.submitted.mercor}">
          ${formatNumber(day.submitted.total)}
        </td>
        <td class="metric-cell" data-metric="Claimed" data-new="${day.claimed.new}" data-old="${day.claimed.old}" data-mercor="${day.claimed.mercor}">
          ${formatNumber(day.claimed.total)}
        </td>
        <td class="metric-cell" data-metric="Reviewed" data-new="${day.reviewed.new}" data-old="${day.reviewed.old}" data-mercor="${day.reviewed.mercor}">
          ${formatNumber(day.reviewed.total)}
        </td>
        <td class="metric-cell" data-metric="Sent Back" data-new="${day.sentBack.new}" data-old="${day.sentBack.old}" data-mercor="${day.sentBack.mercor}">
          ${formatNumber(day.sentBack.total)}
        </td>
        <td class="metric-cell" data-metric="Pass Rate" data-new="${Math.round(passRate(day.approved.new, day.sentBack.new) * 100)}%" data-old="${Math.round(passRate(day.approved.old, day.sentBack.old) * 100)}%" data-mercor="—">
          ${Math.round(passTotal * 100)}%
        </td>
      `;
      totalFragment.appendChild(totalRow);
    });
  dailyTotalsBody.appendChild(totalFragment);
};

const renderMetrics = () => {
  const range = getRange(analyticsRange);
  const metrics = buildMetrics(range);
  if (analyticsRangeLabel) {
    analyticsRangeLabel.textContent = `Window: ${formatRangeLabel(range)}`;
  }

  if (throughputStats) {
    throughputStats.innerHTML = [
      renderCard("Approved", metrics.approved),
      renderCard("Submitted", metrics.submitted),
      renderCard("Claimed", metrics.claimed),
    ].join("");
  }
  if (reviewStats) {
    reviewStats.innerHTML = [
      renderCard("Reviewed", metrics.reviewed),
      renderCard("Sent Back", metrics.sentBack),
      renderRateCard("Review Pass Rate", metrics.approved, metrics.sentBack),
    ].join("");
  }
  if (throughputSummary) {
    throughputSummary.textContent = `${formatNumber(metrics.approved.total)} approved`;
  }
  if (reviewSummary) {
    reviewSummary.textContent = `${formatNumber(metrics.reviewed.total)} reviewed`;
  }
  const tableRange = range || getRange("l14");
  if (dailyRangeLabel) {
    dailyRangeLabel.textContent = `Window: ${formatRangeLabel(tableRange)}`;
  }
  renderDailyTable(tableRange);
};

const renderChips = () => {
  if (analyticsRangeChips) {
    analyticsRangeChips.innerHTML = "";
    RANGE_OPTIONS.forEach((opt) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      if (analyticsRange === opt.key) chip.classList.add("active");
      chip.type = "button";
      chip.textContent = opt.label;
      chip.addEventListener("click", () => {
        analyticsRange = opt.key;
        renderChips();
        renderMetrics();
      });
      analyticsRangeChips.appendChild(chip);
    });
  }
};

window.authFetch("/api/data")
  .then((response) => response.json())
  .then((data) => {
    tasks = data.tasks || [];
    emailMap = Object.fromEntries(
      Object.entries(data.email_map || {}).map(([key, value]) => [normalizeEmail(key), value]),
    );
    oldNewMap = {};
    Object.entries(data.old_new_map || {}).forEach(([key, value]) => {
      oldNewMap[normalizeName(key)] = value;
    });
    if (analyticsGeneratedAt) {
      analyticsGeneratedAt.textContent = `Updated: ${data.generated_at || "—"}`;
    }
    if (analyticsAnchorDate && !analyticsAnchorDate.value) {
      anchorDate = new Date();
      analyticsAnchorDate.value = getDayKey(anchorDate);
    }
    renderChips();
    renderMetrics();
  })
  .catch((err) => {
    if (throughputStats) {
      throughputStats.innerHTML = `<div class="stat-card">Failed to load data: ${err}</div>`;
    }
  });

if (analyticsAnchorDate) {
  analyticsAnchorDate.addEventListener("change", () => {
    anchorDate = parseAnchorDate(analyticsAnchorDate.value);
    renderMetrics();
  });
}

const hidePopover = () => {
  if (!metricsPopover) return;
  metricsPopover.hidden = true;
};

const showPopover = (target) => {
  if (!metricsPopover || !metricsPopoverTitle || !metricsPopoverNew || !metricsPopoverOld || !metricsPopoverMercor) return;
  const rect = target.getBoundingClientRect();
  const metric = target.dataset.metric || "Details";
  metricsPopoverTitle.textContent = metric;
  metricsPopoverNew.textContent = target.dataset.new ?? "—";
  metricsPopoverOld.textContent = target.dataset.old ?? "—";
  metricsPopoverMercor.textContent = target.dataset.mercor ?? "—";
  metricsPopover.hidden = false;
  const popoverRect = metricsPopover.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - popoverRect.width / 2;
  let top = rect.bottom + 8;
  if (left < 12) left = 12;
  if (left + popoverRect.width > window.innerWidth - 12) {
    left = window.innerWidth - popoverRect.width - 12;
  }
  if (top + popoverRect.height > window.innerHeight - 12) {
    top = rect.top - popoverRect.height - 8;
  }
  metricsPopover.style.left = `${left}px`;
  metricsPopover.style.top = `${top}px`;
};

if (dailyTotalsBody) {
  dailyTotalsBody.addEventListener("click", (event) => {
    const cell = event.target.closest(".metric-cell");
    if (!cell) return;
    showPopover(cell);
  });
}

document.addEventListener("click", (event) => {
  if (!metricsPopover || metricsPopover.hidden) return;
  const target = event.target;
  if (target.closest(".metric-cell") || target.closest("#metricsPopover")) return;
  hidePopover();
});

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (window.signOut) {
      window.signOut();
    }
  });
}
