const changelogBody = document.getElementById("changelogBody");
const changelogCount = document.getElementById("changelogCount");
const downloadCsv = document.getElementById("downloadCsv");

const formatDate = (value) => {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toISOString().replace("T", " ").slice(0, 16);
};

window.authFetch("/api/changelog")
  .then((response) => response.json())
  .then((entries) => {
    changelogBody.innerHTML = "";
    if (!entries.length) {
      changelogBody.innerHTML = `<tr><td colspan="4">No approvals logged yet.</td></tr>`;
      changelogCount.textContent = "0 entries";
      return;
    }
    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${entry.task_name || "—"}</td>
        <td>${entry.original_author || "—"}</td>
        <td>${entry.original_author_email || "—"}</td>
        <td>${formatDate(entry.approved_at)}</td>
        <td>${entry.task_id || "—"}</td>
      `;
      fragment.appendChild(row);
    });
    changelogBody.appendChild(fragment);
    changelogCount.textContent = `${entries.length.toLocaleString()} entries`;
  })
  .catch((err) => {
    changelogBody.innerHTML = `<tr><td colspan="4">Failed to load changelog.json: ${err}</td></tr>`;
  });

downloadCsv.addEventListener("click", async () => {
  try {
    const response = await window.authFetch("/api/changelog.csv");
    if (!response.ok) {
      throw new Error("Unable to download CSV.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "changelog.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("CSV download failed. Please sign in and try again.");
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
