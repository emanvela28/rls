const authorsBody = document.getElementById("authorsBody");
const authorCount = document.getElementById("authorCount");
const authorSearch = document.getElementById("authorSearch");
const authorStats = document.getElementById("authorStats");
const statsTitle = document.getElementById("statsTitle");
const statsTotal = document.getElementById("statsTotal");
const statusStats = document.getElementById("statusStats");
const statusTableBody = document.getElementById("statusTableBody");

let authors = [];
const OVERRIDE_BY_EMAIL = {
  "g748044d6fa8c271@c-mercor.com": { name: "HAMILTON ADRIAN", email: "g748044d6fa8c271@c-mercor.com" },
  "p92f5194510e036b@c-mercor.com": { name: "Brian D'Amore", email: "p92f5194510e036b@c-mercor.com" },
  "hd5c2be12ae2aca6@c-mercor.com": { name: "Howard Yan", email: "hd5c2be12ae2aca6@c-mercor.com" },
  "ob65449bcf28bea1@c-mercor.com": { name: "Muhammad Hossain", email: "ob65449bcf28bea1@c-mercor.com" },
  "g58b2d103e8b0a86@c-mercor.com": { name: "Brandon Evans", email: "g58b2d103e8b0a86@c-mercor.com" },
  "d1f02345a5a0400d@c-mercor.com": { name: "Wooil Kim", email: "d1f02345a5a0400d@c-mercor.com" },
};
const OVERRIDE_BY_NAME = {
  "contractor d1f023": { name: "Wooil Kim", email: "d1f02345a5a0400d@c-mercor.com" },
  "contractor p92f51": { name: "Brian D'Amore", email: "p92f5194510e036b@c-mercor.com" },
  "contractor hd5c2b": { name: "Howard Yan", email: "hd5c2be12ae2aca6@c-mercor.com" },
  "contractor ob544": { name: "Muhammad Hossain", email: "ob65449bcf28bea1@c-mercor.com" },
  "contractor ob6544": { name: "Muhammad Hossain", email: "ob65449bcf28bea1@c-mercor.com" },
  "contractor g58b2d": { name: "Brandon Evans", email: "g58b2d103e8b0a86@c-mercor.com" },
  "hamilton adrian": { name: "HAMILTON ADRIAN", email: "g748044d6fa8c271@c-mercor.com" },
};
const normalizeEmail = (value) => (value || "").trim().toLowerCase();
const normalizeName = (value) => (value || "").trim().toLowerCase();
const applyTaskOverrides = (tasks, emailMap = {}) =>
  tasks.map((task) => {
    const normalizedEmail = normalizeEmail(task.owned_by_user_email);
    const normalizedName = normalizeName(task.owned_by_user_name);
    let updated = { ...task };

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
    const emailMap = data.email_map || {};
    authors = buildAuthors(applyTaskOverrides(data.tasks || [], emailMap));
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
