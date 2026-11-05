/**
 * Checkout page.
 *
 * No localStorage / sessionStorage is used. Cart contents and the buyer's
 * details travel through appApi once the backend is wired. Until then the
 * cart is empty and the page renders nothing to buy.
 */
document.addEventListener("DOMContentLoaded", () => {
  const cart = []; // populated by appApi once the backend is live

  const discountInput = document.getElementById("discountInput");
  const discountButton = document.getElementById("discountBtn");
  const discountRow = document.getElementById("discountRow");
  const discountAmount = document.getElementById("discountAmount");
  const subtotalPrice = document.getElementById("cartSubtotalPrice");
  const finalPrice = document.getElementById("cartFinalPrice");
  let finalAmount = 0;

  const formatMoney = (value) =>
    `${Number(value).toLocaleString("fa-IR")} تومان`;

  if (subtotalPrice) subtotalPrice.textContent = formatMoney(0);
  if (finalPrice) finalPrice.textContent = formatMoney(0);

  const container = document.querySelector(".cart-items-list");
  if (container) {
    container.innerHTML =
      '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">سبد خرید شما خالی است.</p>';
  }

  const showMessage = (message, type) => {
    let messageEl = document.querySelector(".checkout-message");
    if (!messageEl) {
      messageEl = document.createElement("p");
      messageEl.className = "checkout-message";
      discountInput?.closest(".form-group")?.after(messageEl);
    }
    messageEl.textContent = message;
    messageEl.dataset.type = type || "info";
  };

  discountButton?.addEventListener("click", async () => {
    const code = discountInput.value.trim();
    if (!code) {
      showMessage("کد تخفیف را وارد کنید.", "error");
      return;
    }

    discountButton.disabled = true;
    try {
      const result = await appApi.commerce.validateCoupon({ code });
      const discount = Math.round((0 * result.percent) / 100);
      finalAmount = 0 - discount;
      discountRow.hidden = false;
      discountAmount.textContent = formatMoney(discount);
      finalPrice.textContent = formatMoney(finalAmount);
      showMessage(result.message, "success");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      discountButton.disabled = false;
    }
  });

  // Handle Checkout Form Submission (Billing Form)
  const checkoutForm = document.getElementById("checkoutForm");
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const name = document.getElementById("billingName").value.trim();
      const phone = document.getElementById("billingPhone").value.trim();
      const email = document.getElementById("billingEmail").value.trim();

      if (!name || !phone || !email) {
        alert("لطفاً کلیه مشخصات خریدار را به درستی پر کنید.");
        return;
      }

      // Carry the buyer forward so the payment call can record a complete order.
      const checkout = {
        total: 0,
        finalAmount: 0,
        buyer: { name, phone, email },
        items: [],
      };

      // Redirect to Gateway — the gateway calls appApi.commerce.createPayment.
      window.location.href = "gateway.html";
    });
  }

  function renderCheckoutItems() {
    const container = document.querySelector(".cart-items-list");
    if (!container) return;
    container.replaceChildren();
    if (!cart.length) {
      container.innerHTML =
        '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">سبد خرید شما خالی است.</p>';
      return;
    }
    cart.forEach((item) => {
      const row = document.createElement("div");
      row.className = "cart-item";
      const image = document.createElement("img");
      image.src = item.img || "../images/ravin.png";
      image.alt = item.name || "محصول";
      const info = document.createElement("div");
      info.className = "cart-item-info";
      const title = document.createElement("h4");
      title.textContent = item.name || "محصول بدون نام";
      const price = document.createElement("p");
      price.className = "price";
      price.textContent = `${Number(item.price || 0).toLocaleString("fa-IR")} تومان (تعداد: ${item.qty || 1})`;
      info.append(title, price);
      row.append(image, info);
      container.appendChild(row);
    });
  }

  renderCheckoutItems();
});
