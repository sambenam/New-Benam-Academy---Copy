(function () {
  function fixKnownLinks() {
    document.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (href === "home.html") link.setAttribute("href", "index.html");
      if (href === "../html/home.html")
        link.setAttribute("href", "../html/index.html");
      if (href === "signup.html") link.setAttribute("href", "sign-up.html");
      if (href === "../html/signup.html")
        link.setAttribute("href", "../html/sign-up.html");
    });
  }

  function bindSearch() {
    document.querySelectorAll(".search-box input").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && input.value.trim()) {
          window.location.href =
            "list-page.html?query=" + encodeURIComponent(input.value.trim());
        }
      });
    });
  }

  function bindNewsletter() {
    document.querySelectorAll(".newsletter-form").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = form.querySelector('input[type="email"]');
        const button = form.querySelector("button");
        if (!input?.value.trim()) return;
        const original = button?.innerHTML;
        if (button) {
          button.disabled = true;
          button.innerHTML = "...";
        }
        try {
          const result = await appApi.newsletter.subscribe({
            email: input.value.trim(),
          });
          showShellMessage(form, result.message, "success");
          form.reset();
        } catch (error) {
          showShellMessage(form, error.message, "error");
        } finally {
          if (button) {
            button.disabled = false;
            button.innerHTML = original;
          }
        }
      });
    });
  }

  function showShellMessage(form, message, type) {
    let messageEl = form.querySelector(".shell-form-message");
    if (!messageEl) {
      messageEl = document.createElement("small");
      messageEl.className = "shell-form-message";
      form.appendChild(messageEl);
    }
    messageEl.textContent = message;
    messageEl.dataset.type = type || "info";
  }

  /**
   * Apply site settings managed from the admin panel via the API.
   * Markup opts in with data attributes:
   *   <span data-site-email>...</span>
   *   <span data-site-phone>...</span>
   * The text in the HTML stays as a fallback if the request fails.
   */
  async function applySiteSettings() {
    const emailNodes = document.querySelectorAll("[data-site-email]");
    const phoneNodes = document.querySelectorAll("[data-site-phone]");
    if (!emailNodes.length && !phoneNodes.length) return;

    let settings = null;
    try {
      if (typeof appApi !== "undefined" && appApi.admin) {
        settings = await appApi.admin.settings.get();
      }
    } catch (error) {
      console.warn("app-shell: could not load site settings", error);
    }
    if (!settings || typeof settings !== "object") return;

    if (settings.supportEmail) {
      emailNodes.forEach((node) => {
        node.textContent = settings.supportEmail;
      });
    }
    if (settings.supportPhone) {
      phoneNodes.forEach((node) => {
        node.textContent = settings.supportPhone;
      });
    }
  }

  /**
   * Site-wide  fallback.
   * Any image that fails to load swaps once to the site logo.
   */
  function bindImageFallbacks() {
    const FALLBACK = "../images/ravin.png";
    const swap = (img) => {
      if (!img || img.tagName !== "IMG") return;
      if (img.dataset.fallbackDone === "1") return;
      img.dataset.fallbackDone = "1";
      img.src = FALLBACK;
    };
    document.addEventListener(
      "error",
      (event) => swap(event.target),
      true,
    );
    document.querySelectorAll("img").forEach((img) => {
      if (img.complete && img.naturalWidth === 0) swap(img);
    });
  }

  function init() {
    // No default/demo session is seeded here. Sessions come only from the
    // backend (appApi.auth.*), so a fresh visit shows "ورود / عضویت" until
    // a real sign-in happens.
    fixKnownLinks();
    bindSearch();
    bindNewsletter();
    bindImageFallbacks();
    applySiteSettings();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
