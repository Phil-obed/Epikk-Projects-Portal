// EPiKK Project Portal — shared frontend behavior.
// No backend calls anywhere in here — everything reads from mock-data.js.
// Page-specific rendering (dashboard, project workspace, users table) lives
// in an inline <script> at the bottom of each page, so each page stays
// readable on its own.

function escapeHtml(s) {
  return (s || "")
    .toString()
    .replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m],
    );
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}
function fmtMoney(amount) {
  return amount === undefined || amount === null || amount === ""
    ? "—"
    : new Intl.NumberFormat("en-GH", {
        style: "currency",
        currency: "GHS",
        maximumFractionDigits: 2,
      }).format(Number(amount));
}
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  return fmtDate(iso);
}
function initials(name) {
  return (name || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
function displayName(user) {
  return user?.username || user?.fullName || "User";
}
function roleLabel(r) {
  return r === "super_admin"
    ? "Super Admin"
    : r === "engineer"
      ? "Engineer"
      : "Client";
}

// ---------- real logged-in user (populated by data.js's loadAppData()) ----------
function activeUser() {
  return CURRENT_USER;
}
// withRole() used to append the ?role= preview param to every internal link.
// Real auth means the server already knows who you are, so this is now a
// no-op — kept only so every existing withRole(href) call site still works.
function withRole(href) {
  return href;
}

// ---------- toast ----------
function toast(msg) {
  let wrap = document.getElementById("toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toast-wrap";
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const el = document.createElement("div");
  el.className = "toast fade-in";
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

// ---------- page chrome: sidebar, topbar, role gating ----------
function initChrome() {
  const user = activeUser();

  document.querySelectorAll("[data-logout]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const existingModal = document.getElementById("logout-modal");
      if (existingModal) return;

      const overlay = document.createElement("div");
      overlay.id = "logout-modal";
      overlay.className = "modal-overlay logout-overlay";
      overlay.innerHTML = `<div class="modal logout-modal" role="dialog" aria-modal="true" aria-labelledby="logout-title">
        <div class="modal-header"><div class="logout-heading"><span class="logout-icon">↪</span><div><h2 id="logout-title">Log out?</h2><p>Your current session will be ended.</p></div></div><button class="modal-close" type="button" aria-label="Close">×</button></div>
        <div class="logout-actions"><button class="btn btn-secondary logout-cancel" type="button">Stay signed in</button><button class="btn btn-danger logout-confirm" type="button">Log out</button></div>
      </div>`;
      document.body.appendChild(overlay);

      const closeModal = () => {
        overlay.remove();
        document.removeEventListener("keydown", handleKeydown);
      };
      const handleKeydown = (keyEvent) => {
        if (keyEvent.key === "Escape") closeModal();
      };
      overlay
        .querySelector(".logout-cancel")
        .addEventListener("click", closeModal);
      overlay
        .querySelector(".modal-close")
        .addEventListener("click", closeModal);
      overlay
        .querySelector(".logout-confirm")
        .addEventListener("click", async () => {
          await sb.auth.signOut();
          window.location.href = link.href;
        });
      overlay.addEventListener("click", (keyEvent) => {
        if (keyEvent.target === overlay) closeModal();
      });
      document.addEventListener("keydown", handleKeydown);
      overlay.querySelector(".logout-cancel").focus();
    });
  });

  // fix up every internal nav link so the role preview persists as you click around
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  document.querySelectorAll("a[data-nav]").forEach((a) => {
    a.setAttribute("href", withRole(a.getAttribute("href")));
    a.addEventListener("click", () => {
      if (sidebar && overlay) {
        sidebar.classList.remove("open");
        overlay.classList.remove("open");
      }
    });
  });

  // profile block
  const avatarEl = document.querySelector("[data-profile-avatar]");
  const nameEl = document.querySelector("[data-profile-name]");
  const roleEl = document.querySelector("[data-profile-role]");
  if (avatarEl) avatarEl.textContent = initials(displayName(user));
  if (nameEl) nameEl.textContent = displayName(user);
  if (roleEl) roleEl.textContent = roleLabel(user.role);

  // role-gated nav items (Users / Activity Log — Super Admin only)
  document.querySelectorAll("[data-role-only]").forEach((el) => {
    const allowed = el.getAttribute("data-role-only").split(",");
    el.style.display = allowed.includes(user.role) ? "" : "none";
  });

  // mobile sidebar
  const menuBtn = document.querySelector(".mobile-menu-btn");
  if (menuBtn && sidebar && overlay) {
    menuBtn.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 820px)").matches) {
        sidebar.classList.add("open");
        overlay.classList.add("open");
      } else {
        sidebar.classList.toggle("collapsed");
      }
    });
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("open");
    });
  }

  // notifications dropdown
  const notifBtn = document.getElementById("notif-btn");
  const notifDropdown = document.getElementById("notif-dropdown");
  if (notifBtn && notifDropdown) {
    const unread =
      typeof NOTIFICATIONS !== "undefined"
        ? NOTIFICATIONS.filter((n) => !n.read).length
        : 0;
    const badge = notifBtn.querySelector(".dot-badge");
    if (badge && unread === 0) badge.style.display = "none";
    notifDropdown.style.cssText =
      "position:absolute;top:46px;right:0;width:300px;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(20,18,10,0.14);z-index:100;overflow:hidden;display:none;";
    notifDropdown.innerHTML =
      typeof NOTIFICATIONS === "undefined"
        ? ""
        : `
      <div style="padding:11px 15px;border-bottom:1px solid var(--line);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);">Notifications</div>
      <div style="max-height:280px;overflow-y:auto;">
      ${
        NOTIFICATIONS.length === 0
          ? `<div style="padding:20px;text-align:center;color:var(--muted);font-size:12.5px;">You're all caught up.</div>`
          : NOTIFICATIONS.map(
              (
                n,
              ) => `<div style="padding:11px 15px;border-bottom:1px solid var(--line-soft);font-size:12.5px;${n.read ? "" : "background:var(--gold-wash);"}">
        <div>${escapeHtml(n.message)}</div><div style="color:var(--muted);font-size:10.5px;margin-top:3px;" class="mono">${timeAgo(n.createdAt)}</div>
      </div>`,
            ).join("")
      }
      </div>`;
    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      notifDropdown.style.display =
        notifDropdown.style.display === "none" ? "block" : "none";
    });
    document.addEventListener(
      "click",
      () => (notifDropdown.style.display = "none"),
    );
    notifDropdown.addEventListener("click", (e) => e.stopPropagation());
  }

  // floating messages: admins can browse every client conversation
  if (typeof PROJECTS !== "undefined" && document.querySelector(".sidebar"))
    initMessages(user);

  return user;
}

function initMessages(user) {
  if (document.getElementById("global-message-fab")) return;

  const projects = visibleProjects(user);
  const fab = document.createElement("a");
  fab.id = "global-message-fab";
  fab.className = "chat-fab";
  fab.href = withRole("projects.html");
  fab.setAttribute("aria-label", "Open messages");
  fab.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-9 8.4A8.5 8.5 0 1 1 21 11.5Z"/></svg><span class="chat-dot" style="display:none;"></span>`;

  const panel = document.createElement("div");
  panel.id = "global-message-panel";
  panel.className = "message-panel";
  panel.style.display = "none";
  document.body.append(fab, panel);

  let latestMessageId = null;
  function conversations() {
    return projects
      .map((project) => ({
        project,
        messages: project.discussion
          .filter((message) => {
            if (user.role === "super_admin")
              return userById(message.userId)?.role === "client";
            return message.userId !== user.id;
          })
          .slice()
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      }))
      .filter((row) => row.messages.length)
      .sort(
        (a, b) =>
          new Date(b.messages[0].createdAt) - new Date(a.messages[0].createdAt),
      );
  }
  function renderMessages(showPreview) {
    const rows = conversations();
    const latest = rows[0];
    const dot = fab.querySelector(".chat-dot");
    const latestId = latest ? latest.messages[0].id : null;
    dot.style.display = latest ? "flex" : "none";
    dot.textContent = latest
      ? user.role === "super_admin"
        ? rows.length
        : "!"
      : "";
    panel.innerHTML = `<div class="message-panel-header"><b>Messages</b><button class="message-panel-close" type="button" aria-label="Close messages">×</button></div>
      <div class="message-panel-list">${
        rows.length
          ? rows
              .map((row) => {
                const message = row.messages[0];
                const sender =
                  message.userId === "system"
                    ? "EPiKK System"
                    : userById(message.userId)?.fullName || "Someone";
                return `<a class="message-thread" href="${withRole(`project.html?id=${row.project.id}&open=chat`)}" data-nav>
          <span class="avatar avatar-sm">${initials(sender)}</span><span class="message-thread-copy"><b>${escapeHtml(row.project.title)}</b><span>${escapeHtml(sender)}: ${escapeHtml(message.message)}</span><small>${timeAgo(message.createdAt)}</small></span>
        </a>`;
              })
              .join("")
          : `<div class="message-empty">No messages yet.</div>`
      }</div>`;
    panel
      .querySelector(".message-panel-close")
      .addEventListener("click", () => {
        panel.style.display = "none";
      });
    if (showPreview && latest && latestId !== latestMessageId) {
      showMessagePreview(latest.project, latest.messages[0]);
    }
    latestMessageId = latestId;
  }
  function showMessagePreview(project, message) {
    const preview = document.createElement("div");
    preview.className = "message-preview";
    const sender =
      message.userId === "system"
        ? "EPiKK System"
        : userById(message.userId)?.fullName || "Someone";
    preview.innerHTML = `<b>${escapeHtml(project.title)}</b><span>${escapeHtml(sender)}: ${escapeHtml(message.message)}</span>`;
    document.body.appendChild(preview);
    setTimeout(() => preview.remove(), 6000);
  }
  fab.addEventListener("click", (event) => {
    event.preventDefault();
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
    if (panel.style.display === "flex") renderMessages(false);
  });
  document.addEventListener("click", (event) => {
    if (
      !panel.contains(event.target) &&
      event.target !== fab &&
      !fab.contains(event.target)
    )
      panel.style.display = "none";
  });
  renderMessages(true);
  setInterval(() => renderMessages(true), 3000);
}
