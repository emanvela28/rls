const authorsBody = document.getElementById("authorsBody");
const authorCount = document.getElementById("authorCount");
const authorSearch = document.getElementById("authorSearch");
const authorStats = document.getElementById("authorStats");
const statsTitle = document.getElementById("statsTitle");
const statsTotal = document.getElementById("statsTotal");
const statusStats = document.getElementById("statusStats");
const statusTableBody = document.getElementById("statusTableBody");

let authors = [];
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

const normalize = (value) => (value || "").toLowerCase();

const buildAuthors = (tasks) => {
  const map = new Map();
  tasks.forEach((task) => {
    const name = task.owned_by_user_name;
    if (!name) return;
    const email = task.owned_by_user_email || "";
    const status = task.status_name || "Unknown";
    const key = normalize(name);
    if (!map.has(key)) {
      map.set(key, {
        name,
        email,
        total: 0,
        statuses: {},
      });
    }
    const entry = map.get(key);
    entry.total += 1;
    entry.statuses[status] = (entry.statuses[status] || 0) + 1;
    if (!entry.email && email) {
      entry.email = email;
    }
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
};

const renderAuthorTable = (items) => {
  authorsBody.innerHTML = "";
  const fragment = document.createDocumentFragment();
  items.forEach((author) => {
    const row = document.createElement("tr");
    row.className = "clickable-row";
    row.dataset.authorKey = normalize(author.name);
    row.innerHTML = `
      <td>${author.name}</td>
      <td>${author.email || "—"}</td>
      <td>${author.total.toLocaleString()}</td>
    `;
    fragment.appendChild(row);
  });
  authorsBody.appendChild(fragment);
  authorCount.textContent = `${items.length.toLocaleString()} authors`;
};

authorsBody.addEventListener("click", (event) => {
  const row = event.target.closest("tr");
  if (!row) return;
  const key = row.dataset.authorKey || "";
  if (!key) return;
  const author = authors.find((entry) => normalize(entry.name) === key);
  if (!author) return;
  console.log("Author row clicked (delegated):", author.name);
  renderStats(author);
});

const renderStats = (author) => {
  authorStats.removeAttribute("hidden");
  statsTitle.textContent = author.name;
  statsTotal.textContent = `${author.total.toLocaleString()} tasks`;
  statusStats.innerHTML = "";
  statusTableBody.innerHTML = "";

  const statusEntries = Object.entries(author.statuses).sort((a, b) => b[1] - a[1]);
  statusEntries.forEach(([status, count]) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<div class="stat-label">${status}</div>
      <div class="stat-value">${count}</div>`;
    statusStats.appendChild(card);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${status}</td>
      <td>${count.toLocaleString()}</td>
    `;
    statusTableBody.appendChild(row);
  });

  try {
    authorStats.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error("Failed to scroll to author stats:", err);
  }
};

const applyAuthorFilter = () => {
  const query = normalize(authorSearch.value.trim());
  if (!query) {
    renderAuthorTable(authors);
    return;
  }
  const filtered = authors.filter(
    (author) =>
      normalize(author.name).includes(query) ||
      normalize(author.email).includes(query),
  );
  renderAuthorTable(filtered);
};

window.authFetch("/api/data")
  .then((response) => response.json())
  .then((data) => {
    authors = buildAuthors(applyTaskOverrides(data.tasks || []));
    renderAuthorTable(authors);
  })
  .catch((err) => {
    authorsBody.innerHTML = `<tr><td colspan="3">Failed to load data.json: ${err}</td></tr>`;
  });

authorSearch.addEventListener("input", applyAuthorFilter);

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (window.signOut) {
      window.signOut();
    }
  });
}
