/**
 * Smart Receipt JavaScript
 *
 * Reads URL query params (?status=success or ?status=failed) and updates UI
 * dynamically. Order details come from appApi.commerce.myOrders() — no
 * localStorage / sessionStorage is used.
 */

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get("status") || "unknown";

  const card = document.getElementById("receiptCard");
  const iconElem = document.getElementById("iconElement");
  const titleElem = document.getElementById("receiptTitle");
  const subtitleElem = document.getElementById("receiptSubtitle");
  const statusBadge = document.getElementById("statusBadge");
  const actionsContainer = document.getElementById("receiptActions");
  const orderIdElem = document.getElementById("orderId");
  const trxIdElem = document.getElementById("trxId");
  const amountElem = document.querySelector(".price-text");
  const orderId = urlParams.get("orderId");

  if (orderIdElem && orderId) {
    orderIdElem.textContent = orderId;
  }
  if (trxIdElem && orderId) {
    trxIdElem.textContent =
      "TRX-" +
      orderId.replace(/[^0-9A-Za-z]/g, "").slice(-8).toUpperCase();
  }

  fillReceiptDetails(orderId);

  if (status === "unknown") {
    card.classList.add("failed");
    iconElem.className = "fas fa-circle-question";
    titleElem.textContent = "رسیدی برای نمایش وجود ندارد";
    subtitleElem.textContent =
      "این صفحه پس از پرداخت نمایش داده می‌شود. برای خرید به سبد خرید خود مراجعه کنید.";
    statusBadge.textContent = "نامشخص";
    actionsContainer.innerHTML =
      '<a href="user-profile.html" class="btn-action-secondary">' +
      '<i class="fas fa-user"></i> سفارش‌های من</a>' +
      '<a href="index.html" class="btn-action-primary">' +
      '<i class="fas fa-house"></i> بازگشت به صفحه اصلی</a>';
    return;
  }

  if (status === "success") {
    card.classList.add("success");
    iconElem.className = "fas fa-check";
    titleElem.textContent = "تراکنش با موفقیت انجام شد";
    subtitleElem.textContent = "پرداخت شما با موفقیت ثبت و تایید گردید";
    statusBadge.textContent = "موفق (تایید شده)";

    actionsContainer.innerHTML =
      '<button type="button" class="btn-action-secondary" onclick="window.print()"><i class="fas fa-print"></i> چاپ فاکتور</button>' +
      '<a href="index.html" class="btn-action-primary"><i class="fas fa-house"></i> بازگشت به صفحه اصلی</a>';
  } else {
    const cancelled = status === "cancelled";

    card.classList.add("failed");
    iconElem.className = "fas fa-times";
    titleElem.textContent = cancelled ? "پرداخت لغو شد" : "تراکنش ناموفق بود";
    subtitleElem.textContent = cancelled
      ? "شما از ادامه پرداخت منصرف شدید. سبد خرید شما دست‌نخورده باقی مانده است."
      : "عملیات پرداخت با خطا مواجه گردید";
    statusBadge.textContent = cancelled ? "لغو شده" : "ناموفق (خطا)";

    actionsContainer.innerHTML =
      '<a href="gateway.html" class="btn-action-secondary" style="background:#fee2e2; color:#991b1b;"><i class="fas fa-redo"></i> تلاش مجدد</a>' +
      '<a href="../html/user-profile.html" class="btn-action-primary" style="background:#ef4444;"><i class="fas fa-arrow-right"></i> بازگشت به پروفایل</a>';
  }
});

/**
 * Put the real order on the receipt from the API.
 */
async function fillReceiptDetails(orderId) {
  const amountEl = document.getElementById("receiptAmount");
  const dateEl = document.getElementById("receiptDate");
  const buyerEl = document.getElementById("receiptBuyer");
  const productEl = document.getElementById("receiptProduct");

  let order = null;
  if (orderId && typeof appApi !== "undefined" && appApi.commerce) {
    try {
      const mine = await appApi.commerce.myOrders();
      if (Array.isArray(mine)) {
        order = mine.find((o) => String(o.id) === String(orderId)) || null;
      }
    } catch (error) {
      order = null;
    }
  }

  const amount = order ? order.amount : 0;
  if (amountEl && (amount || amount === 0)) {
    amountEl.textContent = Number(amount).toLocaleString("fa-IR") + " تومان";
  }

  if (dateEl) {
    const when = new Date();
    let stamp;
    try {
      stamp = new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(when);
    } catch (error) {
      stamp = when.toLocaleString("fa-IR");
    }
    dateEl.textContent =
      order && order.date ? order.date + " - " + stamp.split(" ").pop() : stamp;
  }

  const buyerName = order && order.customer ? order.customer : "";
  if (buyerEl && buyerName) {
    buyerEl.textContent = buyerName;
    document.getElementById("receiptBuyerRow").hidden = false;
  }

  const productName = order && order.product ? order.product : "";
  if (productEl && productName) {
    productEl.textContent = productName;
    document.getElementById("receiptProductRow").hidden = false;
  }
}

/**
 * Record a checkout the customer walked away from.
 */
async function recordAbandonedOrder() {
  // No local checkout state exists without the backend, so there is nothing
  // to record here. The gateway/appApi handles cancelled orders server-side.
}
