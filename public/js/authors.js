const authorsBody = document.getElementById("authorsBody");
const authorCount = document.getElementById("authorCount");
const authorHeaderCount = document.getElementById("authorHeaderCount");
const authorSearch = document.getElementById("authorSearch");
const authorStats = document.getElementById("authorStats");
const statsTitle = document.getElementById("statsTitle");
const statsTotal = document.getElementById("statsTotal");
const statusStats = document.getElementById("statusStats");
const statusTableBody = document.getElementById("statusTableBody");
const authorFilterGroups = document.getElementById("authorFilterGroups");
const addFilterGroupBtn = document.getElementById("addFilterGroup");
const clearFilterGroupsBtn = document.getElementById("clearFilterGroups");

let authors = [];
let oldNewMap = {};
let noRlsMap = { names: new Set(), emails: new Set() };
let nameEmailMap = {};
let reviewerMap = { names: new Set(), emails: new Set(), contractorEmails: new Set() };
let statusOptions = [];
let filterGroups = [];
let filterIdCounter = 0;
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
  "erich m": { name: "Erich Mussak, MD", email: "medical61@c-mercor.com" },
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
  return Object.keys(emailMap).find((email) => email.split("@")[0].toLowerCase().startsWith(target)) || "";
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

const normalize = (value) => (value || "").toLowerCase();
const createId = () => `filter_${Date.now()}_${filterIdCounter++}`;
const FILTER_FIELDS = [
  { value: "status_count", label: "Status count" },
  { value: "history", label: "History" },
  { value: "role", label: "Role" },
  { value: "rls", label: "RLS" },
];
const FILTER_OPERATORS = [
  { value: "gte", label: "≥" },
  { value: "gt", label: ">" },
  { value: "eq", label: "=" },
  { value: "lte", label: "≤" },
  { value: "lt", label: "<" },
];
const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last3", label: "Last 3 days" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];
const createRule = (type = "status_count") => {
  if (type === "history") {
    return { id: createId(), type, value: "new" };
  }
  if (type === "role") {
    return { id: createId(), type, value: "writer" };
  }
  if (type === "rls") {
    return { id: createId(), type, value: "inRls" };
  }
  return {
    id: createId(),
    type: "status_count",
    status: "Approved",
    operator: "gte",
    count: "",
    dateRange: "all",
    customStart: "",
    customEnd: "",
  };
};
const createGroup = () => ({ id: createId(), rules: [] });
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

const parseDateInput = (value) => {
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

const buildDateRange = (rangeKey, customStart, customEnd) => {
  if (!rangeKey || rangeKey === "all") return null;
  const today = new Date();
  if (rangeKey === "today") {
    return { start: startOfDay(today), end: endOfDay(today) };
  }
  if (rangeKey === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
  }
  if (rangeKey.startsWith("last")) {
    const days = Number(rangeKey.replace("last", ""));
    if (Number.isFinite(days) && days > 0) {
      const start = new Date(today);
      start.setDate(today.getDate() - (days - 1));
      return { start: startOfDay(start), end: endOfDay(today) };
    }
  }
  if (rangeKey === "custom") {
    const start = parseDateInput(customStart);
    const end = parseDateInput(customEnd);
    if (!start && !end) return null;
    if (start && end) return { start: startOfDay(start), end: endOfDay(end) };
    if (start) return { start: startOfDay(start), end: endOfDay(today) };
    return { start: startOfDay(end), end: endOfDay(end) };
  }
  return null;
};

const pickTaskDate = (task, statusName) => {
  const statusKey = normalize(statusName);
  const useApproved = statusKey.includes("approved");
  const value = useApproved
    ? task.approvedAt || task.updatedAt || task.createdAt
    : task.updatedAt || task.createdAt || task.approvedAt;
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const countTasksByStatus = (author, statusName, range) => {
  const target = normalize(statusName);
  const matchAny = target === "any";
  let count = 0;
  (author.tasks || []).forEach((task) => {
    if (!matchAny && normalize(task.status) !== target) return;
    if (!range) {
      count += 1;
      return;
    }
    const date = pickTaskDate(task, statusName);
    if (!date) return;
    if (date >= range.start && date <= range.end) {
      count += 1;
    }
  });
  return count;
};

const evaluateRule = (author, rule) => {
  if (!rule || !rule.type) return true;
  if (rule.type === "history") {
    const label = normalize(historyLabel(author.name));
    if (rule.value === "unknown") return !label;
    return label === rule.value;
  }
  if (rule.type === "role") {
    if (rule.value === "reviewer") return isReviewer(author.name, author.email);
    return !isReviewer(author.name, author.email);
  }
  if (rule.type === "rls") {
    const isNotInRls = isNoRlsEligibleForAuthor(
      author.name,
      author.email,
      author.statuses,
      author.total,
    );
    return rule.value === "notInRls" ? isNotInRls : !isNotInRls;
  }
  if (rule.type === "status_count") {
    const countValue = Number.parseInt(rule.count, 10);
    if (!Number.isFinite(countValue)) return true;
    const range = buildDateRange(rule.dateRange, rule.customStart, rule.customEnd);
    const statusName = rule.status || "Approved";
    const total = countTasksByStatus(author, statusName, range);
    switch (rule.operator) {
      case "gt":
        return total > countValue;
      case "eq":
        return total === countValue;
      case "lte":
        return total <= countValue;
      case "lt":
        return total < countValue;
      case "gte":
      default:
        return total >= countValue;
    }
  }
  return true;
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
        tasks: [],
      });
    }
    const entry = map.get(key);
    entry.total += 1;
    entry.statuses[status] = (entry.statuses[status] || 0) + 1;
    entry.tasks.push({
      status,
      updatedAt: task.updated_at,
      approvedAt: task.approved_at,
      createdAt: task.created_at,
    });
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
        tasks: [],
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

const getStatusOptions = () => {
  if (statusOptions.length) return statusOptions;
  return ["Approved"];
};

const ensureFilterGroups = () => {
  if (!filterGroups.length) {
    filterGroups = [createGroup()];
  }
};

const renderFilterBuilder = () => {
  if (!authorFilterGroups) return;
  ensureFilterGroups();
  authorFilterGroups.innerHTML = "";
  filterGroups.forEach((group, groupIndex) => {
    const wrapper = document.createElement("div");
    wrapper.className = "filter-group";
    wrapper.dataset.groupId = group.id;
    const groupTitle = `Group ${groupIndex + 1}`;
    wrapper.innerHTML = `
      <div class="filter-group__header">
        <div>
          <div class="filter-group__title">${groupTitle}</div>
          <div class="filter-group__logic">Match all rules (AND)</div>
        </div>
        <div class="filter-group__actions">
          <button class="btn-ghost btn-ghost--compact" data-action="add-rule" type="button">
            Add rule
          </button>
          <button class="btn-ghost btn-ghost--compact" data-action="remove-group" type="button">
            Remove
          </button>
        </div>
      </div>
      <div class="filter-rules">
        ${
          group.rules.length
            ? group.rules.map((rule) => renderRule(rule)).join("")
            : `<div class="filter-empty">No rules yet. Add a rule to filter authors.</div>`
        }
      </div>
    `;
    authorFilterGroups.appendChild(wrapper);
    if (groupIndex < filterGroups.length - 1) {
      const divider = document.createElement("div");
      divider.className = "filter-or";
      divider.textContent = "OR";
      authorFilterGroups.appendChild(divider);
    }
  });
};

const renderRule = (rule) => {
  const fieldOptions = FILTER_FIELDS.map(
    (field) =>
      `<option value="${field.value}" ${rule.type === field.value ? "selected" : ""}>${field.label}</option>`,
  ).join("");
  if (rule.type === "status_count") {
    const statusOptionsHtml = ["Any", ...getStatusOptions()].map((status) => {
      const value = status === "Any" ? "any" : status;
      const selected = (rule.status || "Approved") === value ? "selected" : "";
      return `<option value="${value}" ${selected}>${status}</option>`;
    }).join("");
    const operatorOptions = FILTER_OPERATORS.map(
      (op) =>
        `<option value="${op.value}" ${rule.operator === op.value ? "selected" : ""}>${op.label}</option>`,
    ).join("");
    const dateOptions = DATE_RANGE_OPTIONS.map(
      (opt) =>
        `<option value="${opt.value}" ${rule.dateRange === opt.value ? "selected" : ""}>${opt.label}</option>`,
    ).join("");
    const customDates =
      rule.dateRange === "custom"
        ? `
        <input type="date" data-action="custom-start" value="${rule.customStart || ""}" />
        <span class="filter-rule__pill">to</span>
        <input type="date" data-action="custom-end" value="${rule.customEnd || ""}" />
      `
        : "";
    return `
      <div class="filter-rule" data-rule-id="${rule.id}">
        <select data-action="field">${fieldOptions}</select>
        <select data-action="status">${statusOptionsHtml}</select>
        <select data-action="operator">${operatorOptions}</select>
        <input type="number" min="0" step="1" placeholder="Count" data-action="count" value="${rule.count ?? ""}" />
        <select data-action="date-range">${dateOptions}</select>
        ${customDates}
        <button class="btn-ghost btn-ghost--compact" data-action="remove-rule" type="button">
          Remove
        </button>
      </div>
    `;
  }
  const valueOptions = (() => {
    if (rule.type === "history") {
      return [
        { value: "new", label: "New" },
        { value: "old", label: "Old" },
        { value: "unknown", label: "Unknown" },
      ];
    }
    if (rule.type === "role") {
      return [
        { value: "writer", label: "Writer" },
        { value: "reviewer", label: "Reviewer" },
      ];
    }
    return [
      { value: "inRls", label: "In RLS" },
      { value: "notInRls", label: "Not in RLS" },
    ];
  })();
  const valueOptionsHtml = valueOptions
    .map(
      (opt) =>
        `<option value="${opt.value}" ${rule.value === opt.value ? "selected" : ""}>${opt.label}</option>`,
    )
    .join("");
  return `
    <div class="filter-rule" data-rule-id="${rule.id}">
      <select data-action="field">${fieldOptions}</select>
      <select data-action="value">${valueOptionsHtml}</select>
      <button class="btn-ghost btn-ghost--compact" data-action="remove-rule" type="button">
        Remove
      </button>
    </div>
  `;
};

const updateRule = (groupId, ruleId, changes) => {
  const group = filterGroups.find((entry) => entry.id === groupId);
  if (!group) return;
  const ruleIndex = group.rules.findIndex((rule) => rule.id === ruleId);
  if (ruleIndex === -1) return;
  group.rules[ruleIndex] = { ...group.rules[ruleIndex], ...changes };
};

const replaceRule = (groupId, ruleId, nextRule) => {
  const group = filterGroups.find((entry) => entry.id === groupId);
  if (!group) return;
  const ruleIndex = group.rules.findIndex((rule) => rule.id === ruleId);
  if (ruleIndex === -1) return;
  group.rules[ruleIndex] = { ...nextRule, id: ruleId };
};

const applyFilterGroups = (items) => {
  const activeGroups = filterGroups.filter((group) => group.rules.length);
  if (!activeGroups.length) return items;
  return items.filter((author) =>
    activeGroups.some((group) => group.rules.every((rule) => evaluateRule(author, rule))),
  );
};

const handleFilterInput = (event) => {
  const target = event.target;
  if (!target || !target.dataset.action) return;
  const ruleEl = target.closest(".filter-rule");
  const groupEl = target.closest(".filter-group");
  if (!groupEl || !ruleEl) return;
  const groupId = groupEl.dataset.groupId;
  const ruleId = ruleEl.dataset.ruleId;
  if (!groupId || !ruleId) return;
  const action = target.dataset.action;
  let shouldRender = false;
  if (action === "field") {
    const nextRule = createRule(target.value);
    replaceRule(groupId, ruleId, nextRule);
    shouldRender = true;
  } else if (action === "status") {
    updateRule(groupId, ruleId, { status: target.value });
  } else if (action === "operator") {
    updateRule(groupId, ruleId, { operator: target.value });
  } else if (action === "count") {
    updateRule(groupId, ruleId, { count: target.value });
  } else if (action === "date-range") {
    updateRule(groupId, ruleId, { dateRange: target.value });
    shouldRender = true;
  } else if (action === "custom-start") {
    updateRule(groupId, ruleId, { customStart: target.value });
  } else if (action === "custom-end") {
    updateRule(groupId, ruleId, { customEnd: target.value });
  } else if (action === "value") {
    updateRule(groupId, ruleId, { value: target.value });
  }
  if (shouldRender) {
    renderFilterBuilder();
  }
  applyAuthorFilter();
};

const handleFilterClick = (event) => {
  const target = event.target;
  if (!target || !target.dataset.action) return;
  const action = target.dataset.action;
  const groupEl = target.closest(".filter-group");
  if (!groupEl) return;
  const groupId = groupEl.dataset.groupId;
  if (!groupId) return;
  if (action === "add-rule") {
    const group = filterGroups.find((entry) => entry.id === groupId);
    if (group) {
      group.rules.push(createRule());
      renderFilterBuilder();
      applyAuthorFilter();
    }
    return;
  }
  if (action === "remove-group") {
    filterGroups = filterGroups.filter((entry) => entry.id !== groupId);
    ensureFilterGroups();
    renderFilterBuilder();
    applyAuthorFilter();
    return;
  }
  if (action === "remove-rule") {
    const ruleEl = target.closest(".filter-rule");
    if (!ruleEl) return;
    const ruleId = ruleEl.dataset.ruleId;
    const group = filterGroups.find((entry) => entry.id === groupId);
    if (!group || !ruleId) return;
    group.rules = group.rules.filter((rule) => rule.id !== ruleId);
    renderFilterBuilder();
    applyAuthorFilter();
  }
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
  filtered = applyFilterGroups(filtered);
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
    statusOptions = Array.from(
      new Set(tasks.map((task) => task.status_name || "Unknown")),
    ).sort((a, b) => a.localeCompare(b));
    if (!statusOptions.includes("Approved")) {
      statusOptions.unshift("Approved");
    }
    renderFilterBuilder();
    applyAuthorFilter();
  })
  .catch((err) => {
    authorsBody.innerHTML = `<tr><td colspan="3">Failed to load data.json: ${err}</td></tr>`;
  });

authorSearch.addEventListener("input", applyAuthorFilter);
renderFilterBuilder();
if (authorFilterGroups) {
  authorFilterGroups.addEventListener("change", handleFilterInput);
  authorFilterGroups.addEventListener("input", handleFilterInput);
  authorFilterGroups.addEventListener("click", handleFilterClick);
}
if (addFilterGroupBtn) {
  addFilterGroupBtn.addEventListener("click", () => {
    filterGroups.push(createGroup());
    renderFilterBuilder();
    applyAuthorFilter();
  });
}
if (clearFilterGroupsBtn) {
  clearFilterGroupsBtn.addEventListener("click", () => {
    filterGroups = [createGroup()];
    renderFilterBuilder();
    applyAuthorFilter();
  });
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (window.signOut) {
      window.signOut();
    }
  });
}
