const authorsBody = document.getElementById("authorsBody");
const authorCount = document.getElementById("authorCount");
const authorHeaderCount = document.getElementById("authorHeaderCount");
const authorSearch = document.getElementById("authorSearch");
const authorStats = document.getElementById("authorStats");
const statsTitle = document.getElementById("statsTitle");
const statsTotal = document.getElementById("statsTotal");
const statusStats = document.getElementById("statusStats");
const statusTableBody = document.getElementById("statusTableBody");
const authorHistoryChips = document.getElementById("authorHistoryChips");
const authorRlsChips = document.getElementById("authorRlsChips");
const authorRoleChips = document.getElementById("authorRoleChips");

let authors = [];
let oldNewMap = {};
let noRlsMap = { names: new Set(), emails: new Set() };
let nameEmailMap = {};
let reviewerMap = { names: new Set(), emails: new Set(), contractorEmails: new Set() };
let authorHistoryFilter = "all";
let authorRlsFilter = "all";
let authorRoleFilter = "all";
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
};
const normalizeEmail = (value) => (value || "").trim().toLowerCase();
const normalizeName = (value) => (value || "").trim().toLowerCase().replace(/\s+/g, " ");
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
const normalizeKey = (name, email) => {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) return normalizedEmail;
  const normalizedName = normalizeName(name);
  if (normalizedName) return normalizedName;
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
const isNoRlsEligibleForAuthor = (name, email, statuses = {}, total = 0) => {
  if (!isNoRls(name, email)) return false;
  if (total > 0) return false;
  const normalized = Object.keys(statuses).map((status) =>
    (status || "").trim().toLowerCase(),
  );
  return normalized.length === 0;
};
const historyBadges = (name, email, statuses, total = 0) => {
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
  if (isNoRlsEligibleForAuthor(name, email, statuses, total)) {
    tags.push('<span class="history-tag history-tag--no-rls">Not in RLS</span>');
  }
  return tags.join("");
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

const buildAuthors = (tasks, roles = []) => {
  const map = new Map();
  const existingNames = new Set();
  tasks.forEach((task) => {
    const name = task.owned_by_user_name;
    const email = task.owned_by_user_email || emailFromName(name) || "";
    const status = task.status_name || "Unknown";
    const key = normalizeKey(name, email);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        name: name || email || "Unknown",
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
    if (name) {
      existingNames.add(normalizeName(name));
      const loose = normalizeNameLoose(name);
      if (loose) existingNames.add(loose);
    }
  });
  roles.forEach((role) => {
    const nameKey = normalizeName(role.name);
    const looseKey = normalizeNameLoose(role.name);
    if (!role.email && nameKey && existingNames.has(nameKey)) {
      return;
    }
    if (!role.email && looseKey && existingNames.has(looseKey)) {
      return;
    }
    const roleEmail = role.email || emailFromName(role.name) || "";
    const key = normalizeKey(role.name, roleEmail);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        name: role.name || roleEmail || "Unknown",
        email: roleEmail,
        total: 0,
        statuses: {},
      });
      return;
    }
    const entry = map.get(key);
    if ((!entry.name || entry.name === "Unknown") && role.name) {
      entry.name = role.name;
    }
    if (!entry.email && roleEmail) {
      entry.email = roleEmail;
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
    row.dataset.authorKey = normalizeKey(author.name, author.email);
    row.innerHTML = `
      <td>${author.name}${historyBadges(author.name, author.email, author.statuses, author.total)}</td>
      <td>${author.email || "—"}</td>
      <td>${author.total.toLocaleString()}</td>
    `;
    fragment.appendChild(row);
  });
  authorsBody.appendChild(fragment);
  const authorCountText = `${items.length.toLocaleString()} authors`;
  authorCount.textContent = authorCountText;
  if (authorHeaderCount) {
    authorHeaderCount.textContent = `Authors: ${items.length.toLocaleString()}`;
  }
};

authorsBody.addEventListener("click", (event) => {
  const row = event.target.closest("tr");
  if (!row) return;
  const key = row.dataset.authorKey || "";
  if (!key) return;
  const author = authors.find(
    (entry) => normalizeKey(entry.name, entry.email) === key,
  );
  if (!author) return;
  console.log("Author row clicked (delegated):", author.name);
  renderStats(author);
});

const renderStats = (author) => {
  authorStats.removeAttribute("hidden");
  statsTitle.innerHTML = `${author.name}${historyBadges(author.name, author.email, author.statuses, author.total)}`;
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

const applyAuthorHistoryFilter = (items) => {
  if (authorHistoryFilter === "all") return items;
  return items.filter(
    (author) => historyLabel(author.name).toLowerCase() === authorHistoryFilter,
  );
};

const applyAuthorRlsFilter = (items) => {
  if (authorRlsFilter === "all") return items;
  if (authorRlsFilter === "notInRls") {
    return items.filter((author) =>
      isNoRlsEligibleForAuthor(author.name, author.email, author.statuses, author.total),
    );
  }
  return items.filter(
    (author) => !isNoRlsEligibleForAuthor(author.name, author.email, author.statuses, author.total),
  );
};

const applyAuthorRoleFilter = (items) => {
  if (authorRoleFilter === "all") return items;
  if (authorRoleFilter === "reviewer") {
    return items.filter((author) => isReviewer(author.name, author.email));
  }
  return items.filter((author) => !isReviewer(author.name, author.email));
};

const renderAuthorChips = () => {
  if (!authorHistoryChips || !authorRlsChips || !authorRoleChips) return;
  const historyOptions = [
    { key: "all", label: "All" },
    { key: "new", label: "New" },
    { key: "old", label: "Old" },
  ];
  authorHistoryChips.innerHTML = "";
  historyOptions.forEach((opt) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    if (authorHistoryFilter === opt.key) chip.classList.add("active");
    chip.type = "button";
    chip.textContent = opt.label;
    chip.addEventListener("click", () => {
      authorHistoryFilter = opt.key;
      renderAuthorChips();
      applyAuthorFilter();
    });
    authorHistoryChips.appendChild(chip);
  });

  const rlsOptions = [
    { key: "all", label: "All" },
    { key: "inRls", label: "In RLS" },
    { key: "notInRls", label: "Not in RLS" },
  ];
  authorRlsChips.innerHTML = "";
  rlsOptions.forEach((opt) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    if (authorRlsFilter === opt.key) chip.classList.add("active");
    chip.type = "button";
    chip.textContent = opt.label;
    chip.addEventListener("click", () => {
      authorRlsFilter = opt.key;
      renderAuthorChips();
      applyAuthorFilter();
    });
    authorRlsChips.appendChild(chip);
  });

  const roleOptions = [
    { key: "all", label: "All" },
    { key: "writer", label: "Writers" },
    { key: "reviewer", label: "Reviewers" },
  ];
  authorRoleChips.innerHTML = "";
  roleOptions.forEach((opt) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    if (authorRoleFilter === opt.key) chip.classList.add("active");
    chip.type = "button";
    chip.textContent = opt.label;
    chip.addEventListener("click", () => {
      authorRoleFilter = opt.key;
      renderAuthorChips();
      applyAuthorFilter();
    });
    authorRoleChips.appendChild(chip);
  });
};

const applyAuthorFilter = () => {
  const query = normalize(authorSearch.value.trim());
  let filtered = authors;
  if (query) {
    filtered = filtered.filter(
      (author) =>
        normalize(author.name).includes(query) ||
        normalize(author.email).includes(query),
    );
  }
  filtered = applyAuthorHistoryFilter(filtered);
  filtered = applyAuthorRlsFilter(filtered);
  filtered = applyAuthorRoleFilter(filtered);
  renderAuthorTable(filtered);
};

window.authFetch("/api/data")
  .then((response) => response.json())
  .then((data) => {
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
    authors = buildAuthors(tasks, [...roles, ...noRlsPeople]);
    renderAuthorChips();
    applyAuthorFilter();
  })
  .catch((err) => {
    authorsBody.innerHTML = `<tr><td colspan="3">Failed to load data.json: ${err}</td></tr>`;
  });

authorSearch.addEventListener("input", applyAuthorFilter);
renderAuthorChips();

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (window.signOut) {
      window.signOut();
    }
  });
}
