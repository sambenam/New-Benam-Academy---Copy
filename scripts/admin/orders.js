/**
 * Admin panel — orders tab and CSV export
 *
 * The orders table, summary tiles, per-order detail sheet and CSV downloads.
 * Data comes from appState.orders (hydrated via appApi). No localStorage.
 */

function csvCell(value) {
  let text = String(value === null || value === undefined ? "" : value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function csvRow(values) {
  return values.map(csvCell).join(",") + "\n";
}

function triggerCsvDownload(content, baseName) {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${baseName}-${stamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadOrdersReport() {
  if (!appState.orders || !appState.orders.length) {
    showToast("هیچ سفارشی برای گزارش‌گیری وجود ندارد.", "error");
    return;
  }

  let csvContent = "\uFEFF";
  csvContent += csvRow([
    "شماره سفارش",
    "نام خریدار",
    "موبایل خریدار",
    "ایمیل خریدار",
    "محصول",
    "مبلغ",
    "تاریخ ثبت",
    "وضعیت",
    "توضیح",
  ]);

  appState.orders.forEach((o) => {
    const phone = o.buyerPhone || "—";
    const email = o.buyerEmail || "—";
    const statusText = getStatusText(o.status);

    const fId = toPersianDigits(o.id);
    const fPhone = toPersianDigits(phone);
    const fAmount = formatOrderAmount(o.amount);
    const fDate = toPersianDigits(o.date || "—");

    csvContent += csvRow([
      fId,
      o.customer,
      fPhone,
      email,
      o.product,
      fAmount,
      fDate,
      statusText,
      o.failureReason || "",
    ]);
  });

  triggerCsvDownload(csvContent, "orders-report");
  showToast("گزارش اکسل سفارشات با موفقیت دانلود شد.", "success");
}

function downloadSingleOrderInvoice(orderId) {
  const order = appState.orders.find((o) => String(o.id) === String(orderId));
  if (!order) {
    showToast("سفارش پیدا نشد.", "error");
    return;
  }

  let csvContent = "\uFEFF";
  csvContent += "فاکتور خرید محصول پلتفرم بنام آکادمی\n\n";
  csvContent +=
    "شناسه سفارش,نام خریدار,موبایل خریدار,ایمیل خریدار,نام محصول,مبلغ پرداختی,تاریخ ثبت,وضعیت پرداخت\n";

  const phone = order.buyerPhone || "۰۹۱۲۳۴۵۶۷۸۹";
  const email = order.buyerEmail || "sam@example.com";
  const statusText = order.status === "success" ? "موفق (تکمیل شده)" : "ناموفق";

  const fId = toPersianDigits(order.id);
  const fPhone = toPersianDigits(phone);
  const fAmount = toPersianDigits(order.amount);
  const fDate = toPersianDigits(order.date);

  csvContent += `"${fId}","${order.customer}","${fPhone}","${email}","${order.product}","${fAmount}","${fDate}","${statusText}"\n`;

  triggerCsvDownload(csvContent, "invoice-" + String(order.id).replace(/[^0-9]/g, ""));
}

function openOrderDetailModal(orderId) {
  const order = appState.orders.find((o) => String(o.id) === String(orderId));
  if (!order) {
    showToast("سفارش پیدا نشد.", "error");
    return;
  }

  document.getElementById("detailOrderNum").textContent =
    "شماره سفارش: " + toPersianDigits(order.id);
  document.getElementById("detailOrderCustomer").textContent =
    order.customer || "نامشخص";
  document.getElementById("detailOrderPhone").textContent = toPersianDigits(
    order.buyerPhone || "۰۹۱۲۳۴۵۶۷۸۹",
  );
  document.getElementById("detailOrderEmail").textContent =
    order.buyerEmail || "sam@example.com";
  document.getElementById("detailOrderProduct").textContent =
    order.product || "محصول آموزشی";
  document.getElementById("detailOrderAmount").textContent = toPersianDigits(
    order.amount || "۰ تومان",
  );
  document.getElementById("detailOrderDate").textContent = toPersianDigits(
    order.date || "---",
  );

  const downloadContainer = document.getElementById(
    "detailOrderDownloadContainer",
  );
  if (downloadContainer) {
    const invoice = document.createElement("button");
    invoice.type = "button";
    invoice.className = "btn-primary";
    invoice.style.cssText =
      "background:#10b981;border-color:#10b981;padding:10px 20px;border-radius:8px;font-weight:bold;display:inline-flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;border:none;";
    invoice.innerHTML = '<i class="fas fa-file-excel"></i> دانلود فاکتور اکسل (CSV)';
    invoice.addEventListener("click", () => downloadSingleOrderInvoice(order.id));
    downloadContainer.replaceChildren(invoice);
  }

  openModal("orderDetailModal");
}

function renderOrdersTable() {
  const tbody = document.querySelector("#ordersFullTable tbody");
  if (!tbody) return;

  const filter = document.getElementById("orderStatusFilter")?.value || "all";
  const rows = appState.orders.filter(
    (order) => filter === "all" || order.status === filter,
  );

  tbody.innerHTML =
    rows
      .map((order) => {
        const safeId = String(order.id).replace(/'/g, "\\'");
        const amountColour =
          order.status === "success"
            ? "var(--success)"
            : "var(--text-secondary)";

        return `
        <tr>
            <td>${escapeHtml(toPersianDigits(order.id))}</td>
            <td>${escapeHtml(order.customer || "—")}</td>
            <td>${escapeHtml(order.product || "—")}</td>
            <td style="font-weight: bold; color: ${amountColour};">${escapeHtml(formatOrderAmount(order.amount))}</td>
            <td>${escapeHtml(toPersianDigits(order.date || "—"))}</td>
            <td><span class="status ${["success", "pending", "failed", "cancelled"].includes(order.status) ? order.status : "pending"}">${escapeHtml(getStatusText(order.status))}</span>
              ${order.failureReason ? `<small class="order-reason">${escapeHtml(order.failureReason)}</small>` : ""}
            </td>
            <td>
                <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px; cursor: pointer;" onclick="${escapeAttr(`openOrderDetailModal(${JSON.stringify(String(order.id))})`)}">بررسی جزئیات</button>
            </td>
        </tr>`;
      })
      .join("") ||
    '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-secondary);">سفارشی با این وضعیت ثبت نشده است.</td></tr>';

  renderOrderSummary();
}

function renderOrderSummary() {
  const host = document.getElementById("ordersSummary");
  if (!host) return;

  const all = appState.orders || [];
  const count = (s) => all.filter((o) => o.status === s).length;
  const revenue = calculateRevenue(all);

  host.innerHTML = [
    ["کل سفارش‌ها", toPersianDigits(all.length), ""],
    ["پرداخت موفق", toPersianDigits(count("success")), "ok"],
    ["ناموفق", toPersianDigits(count("failed")), "bad"],
    ["لغو شده", toPersianDigits(count("cancelled")), "warn"],
    ["درآمد", toPersianDigits(revenue.toLocaleString()) + " تومان", "ok"],
  ]
    .map(
      ([label, value, tone]) =>
        `<div class="order-stat order-stat--${tone || "plain"}">
           <small>${label}</small><strong>${value}</strong>
         </div>`,
    )
    .join("");
}

function getStatusText(status) {
  if (status === "success") return "پرداخت موفق";
  if (status === "pending") return "در حال پردازش";
  if (status === "failed") return "پرداخت ناموفق";
  if (status === "cancelled") return "لغو شده";
  return status;
}

function formatOrderAmount(amount) {
  if (typeof amount === "number") {
    return toPersianDigits(amount.toLocaleString()) + " تومان";
  }
  const text = String(amount || "").trim();
  if (!text) return "—";
  return /تومان/.test(text) ? toPersianDigits(text) : toPersianDigits(text) + " تومان";
}
