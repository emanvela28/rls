const generatedAtEl = document.getElementById("generatedAt");
const writerTotalEl = document.getElementById("writerTotal");
const funnelStatsEl = document.getElementById("funnelStats");
const stagePeopleStatsEl = document.getElementById("stagePeopleStats");
const funnelColumnsEl = document.getElementById("funnelColumns");
const cohortCountsEl = document.getElementById("cohortCounts");
const metricsTableBody = document.getElementById("metricsTableBody");
const metricsCohortToggle = document.getElementById("metricsCohortToggle");
const metricsDisplayToggle = document.getElementById("metricsDisplayToggle");
const onboardedLastUpdatedEl = document.getElementById("onboardedLastUpdated");
const progressTableBody = document.getElementById("progressTableBody");
const authorProgressCountEl = document.getElementById("authorProgressCount");
const stageFilterChips = document.getElementById("stageFilterChips");
const authorSearchInput = document.getElementById("authorSearch");
const detailPanel = document.getElementById("authorDetail");
const detailNameEl = document.getElementById("detailName");
const detailEmailEl = document.getElementById("detailEmail");
const detailCountEl = document.getElementById("detailCount");
const detailTableBody = document.getElementById("detailTableBody");
const detailScoreEl = document.getElementById("detailScore");
const detailBadgeEl = document.getElementById("detailBadge");
const contributorScoreBtn = document.getElementById("contributorScoreInfoBtn");
const contributorScoreModal = document.getElementById("contributorScoreModal");
const contributorScoreCloseButtons = contributorScoreModal
  ? contributorScoreModal.querySelectorAll("[data-modal-close]")
  : [];
const OVERRIDE_BY_EMAIL = {
  "g748044d6fa8c271@c-mercor.com": { name: "HAMILTON ADRIAN", email: "g748044d6fa8c271@c-mercor.com" },
  "p92f5194510e036b@c-mercor.com": { name: "Brian D'Amore", email: "p92f5194510e036b@c-mercor.com" },
  "hd5c2be12ae2aca6@c-mercor.com": { name: "Howard Yan", email: "hd5c2be12ae2aca6@c-mercor.com" },
  "ob65449bcf28bea1@c-mercor.com": { name: "Muhammad Hossain", email: "ob65449bcf28bea1@c-mercor.com" },
  "g58b2d103e8b0a86@c-mercor.com": { name: "Brandon Evans", email: "g58b2d103e8b0a86@c-mercor.com" },
  "d1f02345a5a0400d@c-mercor.com": { name: "Wooil Kim", email: "d1f02345a5a0400d@c-mercor.com" },
  "erich.nicholai@gmail.com": { name: "Erich Mussak, MD", email: "medical61@c-mercor.com" },
  "matthew.a.haber@gmail.com": { name: "Matthew Haber", email: "c1093c720d7223b4@c-mercor.com" },
};
const OVERRIDE_BY_NAME = {
  "contractor c1093c": { name: "Matthew Haber", email: "c1093c720d7223b4@c-mercor.com" },
  "contractor d1f023": { name: "Wooil Kim", email: "d1f02345a5a0400d@c-mercor.com" },
  "contractor p92f51": { name: "Brian D'Amore", email: "p92f5194510e036b@c-mercor.com" },
  "contractor hd5c2b": { name: "Howard Yan", email: "hd5c2be12ae2aca6@c-mercor.com" },
  "contractor ob544": { name: "Muhammad Hossain", email: "ob65449bcf28bea1@c-mercor.com" },
  "contractor ob6544": { name: "Muhammad Hossain", email: "ob65449bcf28bea1@c-mercor.com" },
  "contractor g58b2d": { name: "Brandon Evans", email: "g58b2d103e8b0a86@c-mercor.com" },
  "hamilton adrian": { name: "HAMILTON ADRIAN", email: "g748044d6fa8c271@c-mercor.com" },
  "m b": { name: "Erich Mussak, MD", email: "medical61@c-mercor.com" },
  "erich mussak, md": { name: "Erich Mussak, MD", email: "medical61@c-mercor.com" },
  "matthew haber": { name: "Matthew Haber", email: "c1093c720d7223b4@c-mercor.com" },
  "dr. shah": { name: "Summit Shah", email: "pf4425cf2100bf8d@c-mercor.com" },
  "dr shah": { name: "Summit Shah", email: "pf4425cf2100bf8d@c-mercor.com" },
};
const normalizeEmail = (value) => (value || "").trim().toLowerCase();
const normalizeName = (value) => (value || "").trim().toLowerCase().replace(/\s+/g, " ");
const extractContractorCode = (value) => {
  const normalized = normalizeName(value);
  if (normalized.startsWith("contractor ")) {
    return normalized.split(" ").slice(1).join(" ").trim();
  }
  return "";
};
const findContractorMatchByCode = (code, emailMap = {}) => {
  if (!code) return "";
  const target = code.toLowerCase();
  return (
    Object.keys(emailMap).find((email) =>
      email.split("@")[0].toLowerCase().startsWith(target),
    ) || ""
  );
};
const PST_TIMEZONE = "America/Los_Angeles";
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PST_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
});

const formatPst = (value) => {
  if (!value) return "—";
  const cleaned = value.replace(" UTC", "Z").replace(" ", "T");
  const dt = new Date(cleaned);
  if (Number.isNaN(dt.getTime())) return value;
  return `${dateTimeFormatter.format(dt)} PST`;
};
const ONBOARDED_UPDATED_BY_KEY = "onboarded_updated_by";
const ONBOARDED_UPDATED_AT_KEY = "onboarded_updated_at";
let cachedOnboardedUser = "";

const updateOnboardedLastUpdatedDisplay = (byOverride = null, atOverride = null) => {
  if (!onboardedLastUpdatedEl) return;
  const by = byOverride ?? window.localStorage.getItem(ONBOARDED_UPDATED_BY_KEY) ?? "";
  const at = atOverride ?? window.localStorage.getItem(ONBOARDED_UPDATED_AT_KEY) ?? "";
  if (!by && !at) {
    onboardedLastUpdatedEl.textContent = "Onboarded metrics last updated by: —";
    return;
  }
  const formattedAt = at ? formatPst(at) : "";
  if (by && formattedAt) {
    onboardedLastUpdatedEl.textContent = `Onboarded metrics last updated by: ${by} on ${formattedAt}`;
    return;
  }
  onboardedLastUpdatedEl.textContent = `Onboarded metrics last updated by: ${by || formattedAt}`;
};

const loadCurrentUserLabel = async () => {
  if (cachedOnboardedUser) return cachedOnboardedUser;
  if (!window.supabaseClient?.auth?.getUser) {
    cachedOnboardedUser = "Unknown user";
    return cachedOnboardedUser;
  }
  try {
    const { data } = await window.supabaseClient.auth.getUser();
    const user = data?.user;
    cachedOnboardedUser =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email ||
      "Unknown user";
  } catch (_err) {
    cachedOnboardedUser = "Unknown user";
  }
  return cachedOnboardedUser;
};

const markOnboardedLastUpdated = () => {
  const timestamp = new Date().toISOString();
  loadCurrentUserLabel().then((label) => {
    window.localStorage.setItem(ONBOARDED_UPDATED_BY_KEY, label);
    window.localStorage.setItem(ONBOARDED_UPDATED_AT_KEY, timestamp);
    updateOnboardedLastUpdatedDisplay(label, timestamp);
  });
};
const normalizeNameLoose = (value) => {
  if (!value) return "";
  const lowered = value.toLowerCase();
  const cleaned = lowered.replace(/[^a-z0-9\\s]/g, " ");
  const parts = cleaned.split(/\\s+/).filter(Boolean);
  if (parts.length && (parts[parts.length - 1] === "dr" || parts[parts.length - 1] === "md")) {
    parts.pop();
  }
  if (parts[0] === "steve") {
    parts[0] = "stephen";
  }
  return parts.join(" ");
};
let oldNewMap = {};
let noRlsMap = { names: new Set(), emails: new Set() };
let nameEmailMap = {};
let reviewerMap = { names: new Set(), emails: new Set(), contractorEmails: new Set() };
let metricsCohort = "both";
let metricsDisplay = "raw";
let metricsData = null;
const historyLabel = (name) => {
  const key = normalizeName(name);
  return key ? oldNewMap[key] || "" : "";
};
const isReviewer = (name, email) => {
  const nameKey = normalizeName(name);
  const emailKey = normalizeEmail(email);
  return (
    (nameKey && reviewerMap.names.has(nameKey)) ||
    (emailKey && reviewerMap.emails.has(emailKey)) ||
    (emailKey && reviewerMap.contractorEmails.has(emailKey))
  );
};
const isNoRls = (name, email) => {
  const nameKey = normalizeName(name);
  const emailKey = normalizeEmail(email);
  return (
    (nameKey && noRlsMap.names.has(nameKey)) ||
    (emailKey && noRlsMap.emails.has(emailKey))
  );
};
const isNoRlsEligible = (name, email, stage) => {
  if (!isNoRls(name, email)) return false;
  if (!stage) return true;
  return stage === "unstarted";
};
const historyTooltip = (name, email, stage) => {
  const tags = [];
  const reviewer = isReviewer(name, email);
  if (reviewer) {
    tags.push("Reviewer");
  } else {
    const label = historyLabel(name);
    if (label) tags.push(label);
  }
  if (isNoRlsEligible(name, email, stage)) tags.push("Not in RLS");
  if (!tags.length) return "";
  return tags.join(" • ");
};

const historyBadgeTags = (name, email, stage) => {
  const tags = [];
  const reviewer = isReviewer(name, email);
  if (reviewer) {
    tags.push('<span class="history-tag history-tag--reviewer">Reviewer</span>');
  } else {
    const label = historyLabel(name);
    if (label) {
      const key = normalizeName(label);
      const className = key === "old" || key === "new" ? ` history-tag--${key}` : "";
      tags.push(`<span class="history-tag${className}">${label}</span>`);
    }
  }
  if (isNoRlsEligible(name, email, stage)) {
    tags.push('<span class="history-tag history-tag--no-rls">Not in RLS</span>');
  }
  return tags.join("");
};
const applyTaskOverrides = (tasks, emailMap = {}) =>
  tasks.map((task) => {
    const normalizedEmail = normalizeEmail(task.owned_by_user_email);
    const normalizedName = normalizeName(task.owned_by_user_name);
    let updated = { ...task };

    if (!normalizedEmail) {
      const contractorCode = extractContractorCode(task.owned_by_user_name);
      const matchedEmail = findContractorMatchByCode(contractorCode, emailMap);
      if (matchedEmail) {
        updated.owned_by_user_email = matchedEmail;
        updated.owned_by_user_name = emailMap[matchedEmail] || updated.owned_by_user_name;
      }
    }

    // Priority: explicit email map from server
    if (normalizedEmail && emailMap[normalizedEmail]) {
      updated.owned_by_user_name = emailMap[normalizedEmail];
    }

    // Explicit email overrides
    const emailOverride = normalizedEmail ? OVERRIDE_BY_EMAIL[normalizedEmail] : null;
    if (emailOverride) {
      updated.owned_by_user_name = emailOverride.name;
      updated.owned_by_user_email = emailOverride.email;
    }

    // Name-based overrides (for contractor-style names or missing email matches)
    const nameOverride = OVERRIDE_BY_NAME[normalizedName];
    if (nameOverride) {
      updated.owned_by_user_name = nameOverride.name;
      updated.owned_by_user_email = updated.owned_by_user_email || nameOverride.email;
    }

    return updated;
  });
if (detailPanel) {
  detailPanel.hidden = true;
}

const closeContributorScoreModal = () => {
  if (!contributorScoreModal) return;
  contributorScoreModal.hidden = true;
  document.body.classList.remove("modal-open");
};

const openContributorScoreModal = () => {
  if (!contributorScoreModal) return;
  contributorScoreModal.hidden = false;
  document.body.classList.add("modal-open");
  const closeBtn = contributorScoreModal.querySelector(".modal__close");
  if (closeBtn) {
    closeBtn.focus();
  }
};

if (contributorScoreBtn && contributorScoreModal) {
  contributorScoreBtn.addEventListener("click", openContributorScoreModal);
  contributorScoreCloseButtons.forEach((button) => {
    button.addEventListener("click", closeContributorScoreModal);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !contributorScoreModal.hidden) {
      closeContributorScoreModal();
    }
  });
}

const APPROVED_STATUSES = new Set(["approved", "qa awaiting review"]);
const SUBMITTED_STATUSES = new Set(["awaiting review", "in review"]);
const CLAIMED_STATUSES = new Set(["pending"]);
const STAGE_ORDER = ["unstarted", "claimed", "submitted", "approved"];
const STAGE_LABELS = {
  unstarted: "No activity yet",
  approved: "Approved / QA Awaiting Review",
  submitted: "Awaiting Review / In Review",
  claimed: "Pending",
};
const METRICS_KEYS = [
  { key: "writers", label: "Writers" },
  { key: "onboarded", label: "Onboarded" },
  { key: "inRls", label: "In RLS" },
  { key: "claimed", label: "Claimed A Task" },
  { key: "submitted", label: "Submitted A Task" },
  { key: "approved", label: "Approved A Task" },
];
// Contributor weights ignore statuses authors don't control (QA, in review)
const CONTRIBUTOR_WEIGHTS = {
  approved: 3,
  "awaiting review": 1.5,
  pending: 0.5,
};

const pct = (count, total) => {
  if (!total) return "0%";
  return `${((count / total) * 100).toFixed(2)}%`;
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
const emailFromName = (name) => {
  const key = normalizeName(name);
  if (key && nameEmailMap[key]) return nameEmailMap[key];
  const loose = normalizeNameLoose(name);
  if (loose && nameEmailMap[loose]) return nameEmailMap[loose];
  const parts = loose.split(" ");
  if (parts.length >= 2) {
    const firstLast = `${parts[0]} ${parts[parts.length - 1]}`;
    if (nameEmailMap[firstLast]) return nameEmailMap[firstLast];
  }
  if (parts.length >= 3) {
    const firstMiddleLast = `${parts[0]} ${parts[1]} ${parts[parts.length - 1]}`;
    if (nameEmailMap[firstMiddleLast]) return nameEmailMap[firstMiddleLast];
  }
  return "";
};

const loadOnboardedInput = (key) => {
  const raw = window.localStorage.getItem(`onboarded_${key}`);
  const num = raw ? Number(raw) : NaN;
  return Number.isFinite(num) ? num : "";
};

const saveOnboardedInput = (key, value) => {
  const normalized = value === "" ? "" : Number(value);
  if (normalized === "" || Number.isFinite(normalized)) {
    window.localStorage.setItem(`onboarded_${key}`, value);
  }
};

const contributionWeight = (status) => {
  const normalized = (status || "").trim().toLowerCase();
  return CONTRIBUTOR_WEIGHTS[normalized] || 0;
};

const computeMetrics = (tasks, roles, noRlsPeople) => {
  const writerMap = new Map();
  const addWriter = (entry) => {
    const key = normalizeKey(entry.name, entry.email);
    if (!key) return;
    const existing = writerMap.get(key);
    if (existing) {
      if ((!existing.name || existing.name === "Unknown") && entry.name) {
        existing.name = entry.name;
      }
      if (!existing.email && entry.email) {
        existing.email = entry.email;
      }
      writerMap.set(key, existing);
      return;
    }
    writerMap.set(key, {
      key,
      name: entry.name || entry.email || "Unknown",
      email: entry.email || "",
    });
  };

  roles.forEach((entry) => addWriter(entry));
  noRlsPeople.forEach((entry) => addWriter(entry));

  const flags = new Map();
  tasks.forEach((task) => {
    const stage = statusToStage(task.status_name);
    if (!stage) return;
    const key = normalizeKey(task.owned_by_user_name, task.owned_by_user_email);
    if (!key) return;
    const entry = flags.get(key) || { claimed: false, submitted: false, approved: false };
    if (stage === "approved") {
      entry.approved = true;
      entry.submitted = true;
      entry.claimed = true;
    } else if (stage === "submitted") {
      entry.submitted = true;
      entry.claimed = true;
    } else if (stage === "claimed") {
      entry.claimed = true;
    }
    flags.set(key, entry);
  });

  const totals = { total: 0, new: 0, old: 0 };
  const counts = {
    writers: { total: 0, new: 0, old: 0 },
    onboarded: { total: 0, new: 0, old: 0 },
    inRls: { total: 0, new: 0, old: 0 },
    claimed: { total: 0, new: 0, old: 0 },
    submitted: { total: 0, new: 0, old: 0 },
    approved: { total: 0, new: 0, old: 0 },
  };

  writerMap.forEach((writer) => {
    const history = historyLabel(writer.name);
    const historyKey = (history || "").toLowerCase();
    const isNew = historyKey === "new";
    const isOld = historyKey === "old";
    totals.total += 1;
    if (isNew) totals.new += 1;
    if (isOld) totals.old += 1;

    counts.writers.total += 1;
    if (isNew) counts.writers.new += 1;
    if (isOld) counts.writers.old += 1;

    const flag = flags.get(writer.key);
    const notInRls = isNoRlsEligible(
      writer.name,
      writer.email,
      flag?.approved ? "approved" : flag?.submitted ? "submitted" : flag?.claimed ? "claimed" : "unstarted",
    );
    if (!notInRls) {
      counts.inRls.total += 1;
      if (isNew) counts.inRls.new += 1;
      if (isOld) counts.inRls.old += 1;
    }

    if (flag?.claimed) {
      counts.claimed.total += 1;
      if (isNew) counts.claimed.new += 1;
      if (isOld) counts.claimed.old += 1;
    }
    if (flag?.submitted) {
      counts.submitted.total += 1;
      if (isNew) counts.submitted.new += 1;
      if (isOld) counts.submitted.old += 1;
    }
    if (flag?.approved) {
      counts.approved.total += 1;
      if (isNew) counts.approved.new += 1;
      if (isOld) counts.approved.old += 1;
    }
  });

  return { totals, counts };
};

const renderMetricsToggles = () => {
  if (!metricsCohortToggle || !metricsDisplayToggle) return;
  const cohortOptions = [
    { key: "both", label: "New + Old" },
    { key: "new", label: "New Only" },
    { key: "old", label: "Old Only" },
  ];
  metricsCohortToggle.innerHTML = "";
  cohortOptions.forEach((opt) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    if (metricsCohort === opt.key) chip.classList.add("active");
    chip.type = "button";
    chip.textContent = opt.label;
    chip.addEventListener("click", () => {
      metricsCohort = opt.key;
      renderMetricsToggles();
      renderMetricsTable(metricsData);
    });
    metricsCohortToggle.appendChild(chip);
  });

  const displayOptions = [
    { key: "raw", label: "Raw" },
    { key: "percent", label: "Percent" },
  ];
  metricsDisplayToggle.innerHTML = "";
  displayOptions.forEach((opt) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    if (metricsDisplay === opt.key) chip.classList.add("active");
    chip.type = "button";
    chip.textContent = opt.label;
    chip.addEventListener("click", () => {
      metricsDisplay = opt.key;
      renderMetricsToggles();
      renderMetricsTable(metricsData);
    });
    metricsDisplayToggle.appendChild(chip);
  });
};

const renderMetricsTable = (metrics) => {
  if (!metricsTableBody || !metrics) return;
  const headers =
    metricsTableBody.closest("table")?.querySelectorAll("th[data-metrics-col]") || [];
  headers.forEach((th) => {
    const col = th.dataset.metricsCol;
    const hide =
      (metricsCohort === "new" && col === "old") ||
      (metricsCohort === "old" && col === "new");
    th.classList.toggle("is-hidden", hide);
  });

  metricsTableBody.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const totals = metrics.totals;

  const renderValue = (key, col) => {
    if (metricsDisplay === "raw") {
      return metrics.counts[key]?.[col] ?? "—";
    }
    const denominator = totals[col] || 0;
    const numerator = metrics.counts[key]?.[col] ?? 0;
    if (key === "writers") return "100%";
    if (!denominator) return "—";
    return pct(numerator, denominator);
  };

  METRICS_KEYS.forEach((metric) => {
    const tr = document.createElement("tr");
    tr.dataset.metricKey = metric.key;
    const totalVal = renderValue(metric.key, "total");
    const newVal = renderValue(metric.key, "new");
    const oldVal = renderValue(metric.key, "old");

    if (metric.key === "onboarded") {
      const totalInput = loadOnboardedInput("total");
      const newInput = loadOnboardedInput("new");
      const oldInput = loadOnboardedInput("old");
      const totalCell =
        metricsDisplay === "raw"
          ? `<input class="metrics-input" type="number" min="0" data-onboarded-key="total" value="${totalInput}" placeholder="—" />`
          : (totalInput === "" ? "—" : pct(Number(totalInput), totals.total));
      const newCell =
        metricsDisplay === "raw"
          ? `<input class="metrics-input" type="number" min="0" data-onboarded-key="new" value="${newInput}" placeholder="—" />`
          : (newInput === "" ? "—" : pct(Number(newInput), totals.new));
      const oldCell =
        metricsDisplay === "raw"
          ? `<input class="metrics-input" type="number" min="0" data-onboarded-key="old" value="${oldInput}" placeholder="—" />`
          : (oldInput === "" ? "—" : pct(Number(oldInput), totals.old));

      tr.innerHTML = `
        <td>${metric.label}</td>
        <td data-metrics-col="total">${totalCell}</td>
        <td data-metrics-col="new">${newCell}</td>
        <td data-metrics-col="old">${oldCell}</td>
      `;
    } else {
      tr.innerHTML = `
        <td>${metric.label}</td>
        <td data-metrics-col="total">${totalVal}</td>
        <td data-metrics-col="new">${newVal}</td>
        <td data-metrics-col="old">${oldVal}</td>
      `;
    }
    fragment.appendChild(tr);
  });

  metricsTableBody.appendChild(fragment);

  const inputs = metricsTableBody.querySelectorAll(".metrics-input");
  inputs.forEach((input) => {
    input.addEventListener("focus", (event) => {
      event.target.dataset.prevValue = event.target.value;
      event.target.dataset.skipBlurUpdate = "0";
    });
    input.addEventListener("input", (event) => {
      const key = event.target.dataset.onboardedKey;
      saveOnboardedInput(key, event.target.value);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if ((event.target.dataset.prevValue || "") !== event.target.value) {
        markOnboardedLastUpdated();
        event.target.dataset.skipBlurUpdate = "1";
      }
      const index = Array.from(inputs).indexOf(event.target);
      if (index >= 0 && index < inputs.length - 1) {
        inputs[index + 1].focus();
      } else {
        event.target.blur();
      }
    });
    input.addEventListener("blur", (event) => {
      if (event.target.dataset.skipBlurUpdate === "1") {
        event.target.dataset.skipBlurUpdate = "0";
      } else if ((event.target.dataset.prevValue || "") !== event.target.value) {
        markOnboardedLastUpdated();
      }
      const key = event.target.dataset.onboardedKey;
      saveOnboardedInput(key, event.target.value);
    });
  });

  const cells = metricsTableBody.querySelectorAll("[data-metrics-col]");
  cells.forEach((cell) => {
    const col = cell.dataset.metricsCol;
    const hide =
      (metricsCohort === "new" && col === "old") ||
      (metricsCohort === "old" && col === "new");
    cell.classList.toggle("is-hidden", hide);
  });
  updateOnboardedLastUpdatedDisplay();
};

const buildRoleList = (roles, emailMap = {}) => {
  const normalizedEmailMap = Object.fromEntries(
    Object.entries(emailMap || {}).map(([email, name]) => [normalizeEmail(email), name]),
  );
  const list = [];
  const seen = new Set();
  (roles || []).forEach((entry) => {
    const email = normalizeEmail(typeof entry === "string" ? entry : entry.email);
    if (!email || seen.has(email)) return;
    seen.add(email);
    const override = OVERRIDE_BY_EMAIL[email];
    const name =
      (override && override.name) ||
      normalizedEmailMap[email] ||
      (typeof entry === "object" ? entry.name : "") ||
      email;
    list.push({ email, name });
  });
  return list;
};

const buildNoRlsList = (people, emailMap = {}, existing = { names: new Set(), emails: new Set() }) => {
  const normalizedEmailMap = Object.fromEntries(
    Object.entries(emailMap || {}).map(([email, name]) => [normalizeEmail(email), name]),
  );
  const list = [];
  const seen = new Set();
  (people || []).forEach((person) => {
    const contractor = normalizeEmail(person.contractor_email);
    const email = normalizeEmail(person.email);
    const pickedEmail = contractor || email || normalizeEmail(emailFromName(person.name));
    const key = pickedEmail || normalizeName(person.name);
    if (!key || seen.has(key)) return;
    const nameKey = normalizeName(person.name);
    const looseKey = normalizeNameLoose(person.name);
    if (nameKey && existing.names.has(nameKey)) return;
    if (looseKey && existing.names.has(looseKey)) return;
    if (pickedEmail && existing.emails.has(pickedEmail)) return;
    seen.add(key);
    const override = pickedEmail ? OVERRIDE_BY_EMAIL[pickedEmail] : null;
    const name =
      (override && override.name) ||
      normalizedEmailMap[pickedEmail] ||
      person.name ||
      pickedEmail ||
      "Unknown";
    list.push({ email: pickedEmail || "", name });
  });
  return list;
};

const buildFunnel = (tasks, roles = []) => {
  const authors = new Map();
  const existingNames = new Set();
  const stagePeople = {
    approved: new Set(),
    submitted: new Set(),
    claimed: new Set(),
  };

  tasks.forEach((task) => {
    const stage = statusToStage(task.status_name);
    if (!stage) return;

    const name = (task.owned_by_user_name || "").trim() || "Unknown";
    const email = (task.owned_by_user_email || "").trim() || emailFromName(name);
    const key = normalizeKey(name, email);
    if (name && name !== "Unknown") {
      existingNames.add(normalizeName(name));
      const loose = normalizeNameLoose(name);
      if (loose) existingNames.add(loose);
    }

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

  roles.forEach((role) => {
    const name = (role.name || "").trim() || "Unknown";
    const email = (role.email || "").trim() || emailFromName(name);
    const nameKey = normalizeName(name);
    const looseKey = normalizeNameLoose(name);
    if (!email && nameKey && existingNames.has(nameKey)) {
      return;
    }
    if (!email && looseKey && existingNames.has(looseKey)) {
      return;
    }
    const key = normalizeKey(name, email);
    if (!key) return;
    const existing = authors.get(key);
    if (existing) {
      if ((!existing.name || existing.name === "Unknown") && name !== "Unknown") {
        existing.name = name;
      }
      if (!existing.email && email) {
        existing.email = email;
      }
      if (!existing.bestStage) {
        existing.bestStage = "unstarted";
      }
      authors.set(key, existing);
      if (nameKey) {
        existingNames.add(nameKey);
      }
      return;
    }
    authors.set(key, {
      key,
      name,
      email,
      bestStage: "unstarted",
      counts: { approved: 0, submitted: 0, claimed: 0 },
      contributionScore: 0,
    });
    if (nameKey) {
      existingNames.add(nameKey);
    }
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
    notInRls: authorList.filter((a) => isNoRlsEligible(a.name, a.email, a.bestStage)),
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
let searchQuery = "";

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
  if (!funnelStatsEl) return;
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
    { key: "notInRls", title: "Not in RLS", authors: funnel.cohorts.notInRls },
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
        const history = historyTooltip(author.name, author.email, author.bestStage);
        const details = [author.name, history, `${author.counts.approved} approved`]
          .filter(Boolean)
          .join(" • ");
        li.dataset.tooltip = details;
        li.innerHTML = `
          <div class="funnel-list__name">${author.name}</div>
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
  const totalCount = funnel.authorList.length;
  authorProgressCountEl.textContent = `${totalCount.toLocaleString()} authors`;
  setHeaderSortState();

  let rows = [...funnel.authorList];

  if (stageFilter !== "all") {
    rows = rows.filter((a) => a.bestStage === stageFilter);
  }
  if (searchQuery) {
    rows = rows.filter((a) => {
      const name = (a.name || "").toLowerCase();
      const email = (a.email || "").toLowerCase();
      return name.includes(searchQuery) || email.includes(searchQuery);
    });
  }
  if (rows.length !== totalCount) {
    authorProgressCountEl.textContent = `${rows.length.toLocaleString()} of ${totalCount.toLocaleString()} authors`;
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
    const tooltip = historyTooltip(author.name, author.email, author.bestStage);
    const badges = historyBadgeTags(author.name, author.email, author.bestStage);
    tr.innerHTML = `
      <td><span class="name-with-tooltip" data-tooltip="${tooltip}">${author.name}</span>${badges}</td>
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
    generatedAtEl.textContent = `Updated: ${formatPst(data.generated_at)}`;
    const emailMap = data.email_map || {};
    oldNewMap = {};
    Object.entries(data.old_new_map || {}).forEach(([key, value]) => {
      oldNewMap[normalizeName(key)] = value;
    });
    noRlsMap = {
      names: new Set(data.no_rls_map?.names || []),
      emails: new Set(data.no_rls_map?.emails || []),
    };
    reviewerMap = {
      names: new Set(data.reviewer_map?.names || []),
      emails: new Set(data.reviewer_map?.emails || []),
      contractorEmails: new Set(data.reviewer_map?.contractor_emails || []),
    };
    nameEmailMap = {};
    Object.entries(data.name_email_map || {}).forEach(([key, value]) => {
      nameEmailMap[normalizeName(key)] = value;
    });
    const tasks = applyTaskOverrides(data.tasks || [], emailMap);
    const roles = buildRoleList(data.roles || [], emailMap);
    const existing = { names: new Set(), emails: new Set() };
    tasks.forEach((task) => {
      const nameKey = normalizeName(task.owned_by_user_name);
      const emailKey = normalizeEmail(task.owned_by_user_email);
      if (nameKey) existing.names.add(nameKey);
      const looseKey = normalizeNameLoose(task.owned_by_user_name);
      if (looseKey) existing.names.add(looseKey);
      if (emailKey) existing.emails.add(emailKey);
    });
    roles.forEach((role) => {
      const nameKey = normalizeName(role.name);
      const emailKey = normalizeEmail(role.email);
      if (nameKey) existing.names.add(nameKey);
      const looseKey = normalizeNameLoose(role.name);
      if (looseKey) existing.names.add(looseKey);
      if (emailKey) existing.emails.add(emailKey);
    });
    const noRlsPeople = buildNoRlsList(data.no_rls_people || [], emailMap, existing);
    window.__allTasks = tasks;
    const funnel = buildFunnel(tasks, [...roles, ...noRlsPeople]);
    cachedFunnel = funnel;
    metricsData = computeMetrics(tasks, roles, noRlsPeople);
    writerTotalEl.textContent = `Writers counted: ${metricsData.totals.total.toLocaleString()}`;
    renderMetricsToggles();
    renderMetricsTable(metricsData);
    renderCohorts(funnel);
    renderStageFilterChips();
    renderProgressTable(funnel);
  })
  .catch((err) => {
    if (metricsTableBody) {
      metricsTableBody.innerHTML = `<tr><td colspan="4">Failed to load funnel data: ${err}</td></tr>`;
    }
  });

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (window.signOut) {
      window.signOut();
    }
  });
}

if (authorSearchInput) {
  authorSearchInput.addEventListener("input", (event) => {
    searchQuery = (event.target.value || "").trim().toLowerCase();
    if (cachedFunnel) {
      renderProgressTable(cachedFunnel);
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
  if (detailBadgeEl) {
    detailNameEl.textContent = author.name;
    const badgeTags = historyBadgeTags(author.name, author.email, author.bestStage);
    if (badgeTags) {
      detailBadgeEl.innerHTML = badgeTags;
      detailBadgeEl.className = "history-tags";
      detailBadgeEl.hidden = false;
    } else {
      detailBadgeEl.hidden = true;
    }
  } else {
    detailNameEl.textContent = author.name;
  }
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
