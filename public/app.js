const tableBody = document.getElementById("tableBody");
const generatedAtEl = document.getElementById("generatedAt");
const rowCountEl = document.getElementById("rowCount");
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

let allTasks = [];
let sortKey = "updated_at";
let sortDirection = "desc";
let currentPage = 1;
let pageSize = Number(pageSizeSelect.value);

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
      <td>${task.owned_by_user_name || "—"}</td>
      <td>${task.verifier_count ?? "—"}</td>
      <td>${task.final_score ?? "—"}</td>
      <td class="${task.has_gt_grade ? "gt-true" : "gt-false"}">${
        task.has_gt_grade ? "Yes" : "No"
      }</td>
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
    generatedAtEl.textContent = `Updated: ${data.generated_at || "—"}`;
    rowCountEl.textContent = `Rows: ${data.rows_returned || 0}`;
    allTasks = data.tasks || [];
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

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (window.signOut) {
      window.signOut();
    }
  });
}
