const tableBody = document.getElementById("tableBody");
const generatedAtEl = document.getElementById("generatedAt");
const visibleCountEl = document.getElementById("visibleCount");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const statsEl = document.getElementById("stats");
const statusChips = document.getElementById("statusChips");
const pageSizeSelect = document.getElementById("pageSize");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const pageInfoEl = document.getElementById("pageInfo");
const headers = document.querySelectorAll("thead th[data-key]");
const exportCsvBtn = document.getElementById("exportCsv");

let allTasks = [];
let sortKey = "updated_at";
let sortDirection = "desc";
let currentPage = 1;
let pageSize = Number(pageSizeSelect.value);
let lastFilteredSorted = [];
let oldNewMap = {};
let noRlsMap = { names: new Set(), emails: new Set() };
let reviewerMap = { names: new Set(), emails: new Set(), contractorEmails: new Set() };
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
const isNoRlsEligibleForTask = (name, email, status) => {
  if (!isNoRls(name, email)) return false;
  const normalized = (status || "").trim().toLowerCase();
  return !normalized;
};
const historyBadges = (name, email, status) => {
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
  if (isNoRlsEligibleForTask(name, email, status)) {
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

    if (normalizedEmail && emailMap[normalizedEmail]) {
      updated.owned_by_user_name = emailMap[normalizedEmail];
    }

    const emailOverride = normalizedEmail ? OVERRIDE_BY_EMAIL[normalizedEmail] : null;
    if (emailOverride) {
      updated.owned_by_user_name = emailOverride.name;
      updated.owned_by_user_email = emailOverride.email;
    }

    const nameOverride = OVERRIDE_BY_NAME[normalizedName];
    if (nameOverride) {
      updated.owned_by_user_name = nameOverride.name;
      updated.owned_by_user_email = updated.owned_by_user_email || nameOverride.email;
    }

    return updated;
  });

const formatDate = (value) => {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toISOString().replace("T", " ").slice(0, 16);
};

const renderStats = (tasks) => {
  const statuses = tasks.reduce((acc, task) => {
    const key = task.status_name || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const statusEntries = Object.entries(statuses).sort((a, b) => b[1] - a[1]);

  statsEl.innerHTML = "";
  statusChips.innerHTML = "";

  const topStatus = statusEntries[0];
  const cards = [
    { label: "Total Tasks", value: tasks.length.toLocaleString() },
    {
      label: "Most Common Status",
      value: topStatus ? `${topStatus[0]} (${topStatus[1]})` : "—",
    },
    {
      label: "Unique Statuses",
      value: statusEntries.length.toString(),
    },
  ];

  statsEl.append(
    ...cards.map((card) => {
      const div = document.createElement("div");
      div.className = "stat-card";
      div.innerHTML = `<div class="stat-label">${card.label}</div>
        <div class="stat-value">${card.value}</div>`;
      return div;
    }),
  );

  statusEntries.forEach(([status, count]) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.innerHTML = `<strong>${status}</strong> ${count}`;
    chip.addEventListener("click", () => {
      statusFilter.value = status;
      currentPage = 1;
      applyFilters();
    });
    statusChips.appendChild(chip);
  });
};

const populateStatusFilter = (tasks) => {
  const statuses = [
    ...new Set(tasks.map((task) => task.status_name || "Unknown")),
  ].sort((a, b) => a.localeCompare(b));
  statuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    statusFilter.appendChild(option);
  });
};

const renderTable = (tasks) => {
  tableBody.innerHTML = "";
  const fragment = document.createDocumentFragment();

  tasks.forEach((task) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${task.task_name || "—"}</td>
      <td><span class="status-pill">${task.status_name || "Unknown"}</span></td>
      <td>${task.owned_by_user_name || "—"}${historyBadges(task.owned_by_user_name, task.owned_by_user_email, task.status_name)}</td>
      <td>${formatDate(task.updated_at)}</td>
      <td>${task.task_id || "—"}</td>
    `;
    fragment.appendChild(row);
  });

  tableBody.appendChild(fragment);
};

const compareValues = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? -1 : 1;
  return String(a).localeCompare(String(b));
};

const getSortedTasks = (tasks) => {
  const sorted = [...tasks].sort((a, b) => {
    const value = compareValues(a[sortKey], b[sortKey]);
    return sortDirection === "asc" ? value : -value;
  });
  return sorted;
};

const updateSortIndicators = () => {
  headers.forEach((header) => {
    header.classList.remove("sorted-asc", "sorted-desc");
    if (header.dataset.key === sortKey) {
      header.classList.add(sortDirection === "asc" ? "sorted-asc" : "sorted-desc");
    }
  });
};

const applyFilters = () => {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;

  const filtered = allTasks.filter((task) => {
    const matchesStatus = status === "all" || (task.status_name || "Unknown") === status;
    if (!matchesStatus) return false;
    if (!query) return true;
    const haystack = [
      task.task_name,
      task.status_name,
      task.owned_by_user_name,
      task.task_id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  const sorted = getSortedTasks(filtered);
  lastFilteredSorted = sorted;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);

  renderTable(pageItems);
  visibleCountEl.textContent = `Showing ${pageItems.length.toLocaleString()} of ${sorted.length.toLocaleString()}`;
  pageInfoEl.textContent = `Page ${currentPage} of ${totalPages}`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
  updateSortIndicators();
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
    allTasks = applyTaskOverrides(data.tasks || [], emailMap);
    renderStats(allTasks);
    populateStatusFilter(allTasks);
    applyFilters();
  })
  .catch((err) => {
    tableBody.innerHTML = `<tr><td colspan="8">Failed to load data.json: ${err}</td></tr>`;
  });

searchInput.addEventListener("input", () => {
  currentPage = 1;
  applyFilters();
});

statusFilter.addEventListener("change", () => {
  currentPage = 1;
  applyFilters();
});

pageSizeSelect.addEventListener("change", (event) => {
  pageSize = Number(event.target.value);
  currentPage = 1;
  applyFilters();
});

prevPageBtn.addEventListener("click", () => {
  currentPage = Math.max(1, currentPage - 1);
  applyFilters();
});

nextPageBtn.addEventListener("click", () => {
  currentPage += 1;
  applyFilters();
});

headers.forEach((header) => {
  header.addEventListener("click", () => {
    const key = header.dataset.key;
    if (sortKey === key) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDirection = "asc";
    }
    currentPage = 1;
    applyFilters();
  });
});

const escapeCsv = (value) => {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const exportFilteredCsv = () => {
  const rows = [
    ["task_name", "author_name", "author_email", "status_name", "task_id"],
    ...lastFilteredSorted.map((task) => [
      task.task_name || "",
      task.owned_by_user_name || "",
      task.owned_by_user_email || "",
      task.status_name || "",
      task.task_id || "",
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tasks-filtered.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", exportFilteredCsv);
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (window.signOut) {
      window.signOut();
    }
  });
}
