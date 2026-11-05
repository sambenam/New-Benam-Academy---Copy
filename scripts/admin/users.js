/**
 * Admin panel — users, staff and access management
 *
 * Two tabs share this file because they share their data: the users tab
 * lists everyone, the access-management tab lists only staff, and both read
 * appState.users.
 *
 * No localStorage: staff audit logs and pending profile changes are removed;
 * the server owns the audit trail and review queue.
 */

function maskPhone(value) {
  const phone = String(value || "").trim();
  if (!phone || phone === "—") return "—";
  const visible = phone.slice(0, 4);
  return visible + "•".repeat(Math.max(phone.length - 4, 3));
}

let profileReviewState = { timer: null, confirm: null, cancel: null };
function openProfileChangePreview(changes, onConfirm, onCancel) {
  const modal = document.getElementById("profileChangeReviewModal"),
    list = document.getElementById("profileReviewChanges"),
    timer = document.getElementById("profileReviewTimer");
  if (!modal || !list) return;
  list.innerHTML = changes.length
    ? changes
        .map(
          (change) =>
            `<article class="profile-review-row"><strong>${escapeHtml(change.label || "—")}</strong><div class="profile-review-before"><small>قبل از تغییر</small><span>${escapeHtml(change.before || "—")}</span></div><i class="fas fa-arrow-left" style="font-size:13px;color:var(--primary);align-self:center;justify-self:center;flex-shrink:0;"></i><div class="profile-review-after"><small>پس از تغییر</small><span>${escapeHtml(change.after || "—")}</span></div></article>`,
        )
        .join("")
    : '<p class="profile-review-empty">تغییری در اطلاعات پروفایل ثبت نشده است.</p>';
  profileReviewState.confirm = onConfirm;
  profileReviewState.cancel = onCancel;
  let remaining = 15;
  timer.textContent = remaining.toLocaleString("fa-IR");
  openModal("profileChangeReviewModal");
  const finish = function (approved) {
    clearInterval(profileReviewState.timer);
    closeModal("profileChangeReviewModal");
    const action = approved ? profileReviewState.confirm : profileReviewState.cancel;
    profileReviewState.confirm = profileReviewState.cancel = null;
    if (typeof action === "function") action();
  };
  document.getElementById("profileReviewConfirm").onclick = () => finish(true);
  document.getElementById("profileReviewCancel").onclick = () => finish(false);
  profileReviewState.timer = setInterval(() => {
    remaining--;
    timer.textContent = remaining.toLocaleString("fa-IR");
    if (remaining <= 0) finish(true);
  }, 1000);
}

let safetyWarningState = {
  timer: null,
  countdown: 10,
  actionCallback: null,
};

function triggerSafetyWarning(actionText, callback) {
  if (safetyWarningState.timer) {
    clearInterval(safetyWarningState.timer);
  }

  safetyWarningState.countdown = 10;
  safetyWarningState.actionCallback = callback;

  document.getElementById("warningActionText").textContent = actionText;
  document.getElementById("warningTimerCount").textContent = safetyWarningState.countdown.toLocaleString("fa-IR");

  openModal("safetyWarningModal");

  safetyWarningState.timer = setInterval(() => {
    safetyWarningState.countdown--;
    document.getElementById("warningTimerCount").textContent = safetyWarningState.countdown.toLocaleString("fa-IR");

    if (safetyWarningState.countdown <= 0) {
      clearInterval(safetyWarningState.timer);
      executeWarningAction();
    }
  }, 1000);
}

function executeWarningAction() {
  if (safetyWarningState.timer) {
    clearInterval(safetyWarningState.timer);
  }
  closeModal("safetyWarningModal");
  if (typeof safetyWarningState.actionCallback === "function") {
    safetyWarningState.actionCallback();
  }
}

function cancelWarningAction() {
  if (safetyWarningState.timer) {
    clearInterval(safetyWarningState.timer);
  }
  closeModal("safetyWarningModal");
  showToast("عملیات با موفقیت لغو شد.", "info");
}

let recentlyUpdatedStaffId = null;
let recentStaffFieldChanges = {};
let staffModalReviewChanges = {};

function activatePendingStaffReviews() {
  /* no pending-changes store remains; server owns the review queue */
}

function renderStaffTable() {
  const tbody = document.querySelector("#staffManageTable tbody");
  if (!tbody) return;

  const input = document.getElementById("staffTableSearch");
  const query = input ? input.value.trim().toLowerCase() : "";
  const manager = isManager();

  const addStaffBtn = document.querySelector("#view-staff .btn-primary");
  if (addStaffBtn) addStaffBtn.style.display = manager ? "inline-flex" : "none";

  const staff = appState.users
    .filter(function (user) {
      if (!user || rankOf(user.role) > 2) return false;
      return [user.id, user.name, user.email, user.phone, user.role]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort(function (a, b) {
      return rankOf(a.role) - rankOf(b.role);
    });

  const onlyManagerLeft = managerCount() <= 1;

  tbody.innerHTML =
    staff
      .map(function (user) {
        const isSelf = String(user.id) === String(currentStaffProfileId);
        const verdict = canActOnStaff(user, "edit");
        const changedFields = manager ? recentStaffFieldChanges[user.id] || [] : [];
        const updated = changedFields.length > 0;
        const pendingDelete =
          window.pendingStaffDeletion &&
          window.pendingStaffDeletion.id === user.id;

        const cue = function (field) {
          return changedFields.includes(field) ? "staff-field-changed" : "";
        };

        const phone = manager
          ? escapeHtml(toPersianDigits(user.phone || "—"))
          : maskPhone(user.phone);
        const phoneClass = manager ? "" : " user-cell--restricted";

        const badges =
          '<span class="staff-role-badge ' +
          (isManagerRole(user.role) ? "manager" : "admin") +
          '">' +
          escapeHtml(user.role || "—") +
          "</span>" +
          (isSelf ? '<span class="staff-self-badge">شما</span>' : "") +
          (isManagerRole(user.role) && onlyManagerLeft
            ? '<span class="staff-locked-badge" title="تنها مدیر سامانه">آخرین مدیر</span>'
            : "");

        const action = verdict.allowed
          ? `<button class="btn-secondary" style="padding:6px 14px;font-size:12px;cursor:pointer;border-radius:8px;" onclick="${escapeAttr(`editStaff(${JSON.stringify(String(user.id))})`)}">بررسی و ویرایش</button>`
          : `<button class="btn-secondary user-action--locked" disabled title="${escapeAttr(verdict.reason || "")}"><i class="fas fa-lock" style="margin-left:6px;font-size:11px;"></i>ویرایش</button>`;

        return (
          '<tr class="' +
          (pendingDelete ? "user-pending-delete" : "") +
          '">' +
          "<td>#" +
          escapeHtml(toPersianDigits(user.id)) +
          (updated
            ? '<span class="staff-update-dot staff-update-dot--between" title="تغییر جدید ثبت شده"></span>'
            : "") +
          "</td>" +
          '<td style="font-weight:500;"><span class="staff-field-value ' +
          cue("name") +
          '">' +
          escapeHtml(user.name || "—") +
          "</span></td>" +
          "<td>" +
          badges +
          "</td>" +
          '<td class="user-contact-cell"><span class="staff-field-value ' +
          cue("email") +
          '">' +
          escapeHtml(user.email || "—") +
          "</span></td>" +
          '<td class="user-contact-cell' +
          phoneClass +
          '"><span class="staff-field-value ' +
          cue("phone") +
          '">' +
          phone +
          "</span></td>" +
          '<td><span class="status ' +
          (user.status === "فعال" ? "success" : "cancelled") +
          '">' +
          escapeHtml(user.status || "—") +
          "</span></td>" +
          "<td>" +
          action +
          "</td>" +
          "</tr>"
        );
      })
      .join("") ||
    '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-secondary);">مدیر یا ادمینی برای نمایش وجود ندارد.</td></tr>';

  renderStaffPermissionNotice(manager);
}

function renderStaffPermissionNotice(manager) {
  const view = document.getElementById("view-staff");
  if (!view) return;

  let notice = document.getElementById("staffPermissionNotice");
  if (manager) {
    if (notice) notice.remove();
    return;
  }
  if (notice) return;

  const card = view.querySelector(".glass-card");
  if (!card) return;

  notice = document.createElement("div");
  notice.id = "staffPermissionNotice";
  notice.className = "permission-notice";
  notice.innerHTML =
    '<i class="fas fa-lock"></i>' +
    "<span>شما با نقش «ادمین» وارد شده‌اید. مدیریت سطوح دسترسی فقط برای «مدیر سایت» در دسترس است.</span>";
  card.parentElement.insertBefore(notice, card);
}

function refreshStaffModalChangeCues(id) {
  const changed = staffModalReviewChanges[id] || [];
  document.querySelectorAll(".staff-modal-field-dot").forEach(function (dot) {
    dot.hidden = changed.indexOf(dot.getAttribute("data-staff-field")) === -1;
  });
}

function populateStaffRoleField(staff) {
  const select = document.getElementById("editStaffRole");
  const hint = document.getElementById("editStaffRoleHint");
  if (!select) return;

  const isSelf = String(staff.id) === String(currentStaffProfileId);
  const lastManager = isManagerRole(staff.role) && managerCount() <= 1;

  const options = assignableRoles().slice();
  if (options.indexOf(staff.role) === -1) options.unshift(staff.role);

  select.innerHTML = options
    .map(function (role) {
      const label = role === "کاربر عادی" ? "کاربر عادی (تنزل به کاربر)" : role;
      return '<option value="' + escapeAttr(role) + '">' + escapeHtml(label) + "</option>";
    })
    .join("");
  select.value = staff.role;

  select.disabled = lastManager;

  if (hint) {
    if (lastManager) {
      hint.textContent =
        "این تنها مدیر سامانه است؛ تا زمانی که مدیر دیگری اضافه نشود، سطح دسترسی او قابل تغییر نیست.";
    } else if (isSelf) {
      hint.textContent =
        "این حساب خود شماست؛ در تغییر سطح دسترسی خود دقت کنید.";
    } else {
      hint.textContent = "";
    }
  }
}

function editStaff(id) {
  const staff = appState.users.find(function (user) {
    return user && String(user.id) === String(id);
  });

  const verdict = canActOnStaff(staff, "edit");
  if (!verdict.allowed) {
    showToast(verdict.reason, "error");
    return;
  }

  document.getElementById("editStaffId").value = id;
  populateStaffRoleField(staff);
  document.getElementById("staffModalDisplayName").textContent =
    staff.name || "—";
  document.getElementById("staffIdDisplay").textContent =
    "#" + toPersianDigits(staff.id);
  document.getElementById("staffNameDisplay").textContent = staff.name || "—";
  document.getElementById("staffEmailDisplay").textContent = staff.email || "—";
  document.getElementById("staffPhoneDisplay").textContent = toPersianDigits(
    staff.phone || "—",
  );
  document.getElementById("editStaffStatus").value = staff.status || "فعال";
  const modalChanges = staffModalReviewChanges[id] || [];
  refreshStaffModalChangeCues(id);
  if (modalChanges.length)
    setTimeout(function () {
      delete staffModalReviewChanges[id];
      refreshStaffModalChangeCues(id);
    }, 8000);
  openModal("editStaffModal");
}

function openStaffAuditModal() {
  const id = Number(document.getElementById("editStaffId").value),
    staff = appState.users.find((u) => u.id === id),
    list = document.getElementById("staffAuditList");
  const entries = [];
  list.innerHTML = entries.length
    ? entries
        .map(
          (entry) => `
    <article class="staff-audit-item" style="padding:16px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(148,163,184,0.1);margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <i class="fas fa-pen-to-square" style="font-size:18px;color:var(--primary);"></i>
        <strong style="font-size:14px;color:var(--text-primary);">${escapeHtml(staff ? staff.name : "کاربر")}</strong>
        <span style="font-size:11px;color:var(--text-secondary);margin-right:auto;">تغییر پروفایل</span>
      </div>
      <div style="padding:10px 12px;background:rgba(234,179,8,0.04);border-right:3px solid #eab308;border-radius:9px;margin-bottom:10px;">
        <strong style="font-size:12px;color:var(--text-secondary);">موارد تغییر کرده :</strong>
        <span style="font-size:12px;color:var(--text-primary);font-weight:bold;margin-right:6px;">${escapeHtml(entry.change ? entry.change.label || (entry.text || "").split(" ")[0] || "—" : entry.text || "—")}</span>
      </div>
      ${
        entry.change
          ? `
      <div style="padding:10px 12px;background:rgba(15,23,42,0.03);border-radius:9px;margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-size:13px;color:var(--text-primary);font-weight:bold;">${escapeHtml(entry.change.label || "—")}</span>
        <span style="font-size:10px;color:var(--text-secondary);">قبل از تغییر</span>
        <b style="font-size:13px;color:#ef4444;">${escapeHtml(entry.change.before || "—")}</b>
        <i class="fas fa-arrow-left" style="font-size:11px;color:var(--primary);flex-shrink:0;"></i>
        <b style="font-size:13px;color:#16a34a;">${escapeHtml(entry.change.after || "—")}</b>
        <span style="font-size:10px;color:var(--text-secondary);">بعد از تغییر</span>
      </div>`
          : `<p style="margin:0 0 10px;font-size:13px;color:var(--text-secondary);line-height:1.8;">${escapeHtml(entry.text || "—")}</p>`
      }
      <div style="font-size:11px;color:var(--text-secondary);border-top:1px solid rgba(148,163,184,0.1);padding-top:8px;">
        <strong>زمان تغییر :</strong> ${escapeHtml(entry.date || "—")}
      </div>
    </article>
  `,
        )
        .join("")
    : '<p class="staff-audit-empty">تغییری برای این حساب ثبت نشده است.</p>';
  openModal("staffAuditModal");
}

function editUser(id) {
  if (!isManager()) {
    showToast("ویرایش کاربران فقط برای مدیر سایت مجاز است.", "error");
    return;
  }
  const user = appState.users.find(function (u) {
    return String(u.id) === String(id) && u.role === "کاربر عادی";
  });
  if (!user) return;
  document.getElementById("editUserId").value = id;
  document.getElementById("userModalDisplayName").textContent =
    user.name || "—";
  document.getElementById("editUserIdDisplay").textContent =
    "#" + toPersianDigits(user.id);
  document.getElementById("editUserNameDisplay").textContent = user.name || "—";
  document.getElementById("editUserEmailDisplay").textContent =
    user.email || "—";
  document.getElementById("editUserPhoneDisplay").textContent = toPersianDigits(
    user.phone || "—",
  );
  document.getElementById("editUserStatus").value = user.status || "فعال";
  renderUserOrders(user);
  openModal("editUserModal");
}

function renderUserOrders(user) {
  const list = document.getElementById("userOrdersList");
  const count = document.getElementById("userOrdersCount");
  if (!list || !count) return;
  const orders = appState.orders.filter(function (order) {
    return (
      String(order.customer || "").trim() === String(user.name || "").trim() ||
      (order.buyerEmail &&
        String(order.buyerEmail).toLowerCase() ===
          String(user.email).toLowerCase())
    );
  });
  count.textContent = orders.length
    ? toPersianDigits(orders.length) + " سفارش · برای مشاهده کلیک کنید"
    : "سفارشی ثبت نشده است";
  list.innerHTML = orders.length
    ? orders
        .map(function (order) {
          return `<article class="user-order-item"><div class="user-order-item__top"><span>${escapeHtml(order.id || "—")}</span><span class="status ${["success", "pending", "failed", "cancelled"].includes(order.status) ? order.status : "pending"}">${escapeHtml(getStatusText(order.status))}</span></div><p>${escapeHtml(order.product || "محصول")}</p><div class="user-order-item__meta"><span>${escapeHtml(toPersianDigits(order.date || "—"))}</span><strong>${escapeHtml(toPersianDigits(order.amount || "—"))}</strong></div></article>`;
        })
        .join("")
    : '<p style="text-align:center;color:var(--text-secondary);font-size:12px;padding:10px 0;margin:0;">هنوز سفارشی برای این کاربر ثبت نشده است.</p>';
}
