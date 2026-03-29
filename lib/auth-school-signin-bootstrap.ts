export const SCHOOL_SIGNIN_READY_EVENT = "app:school-signin-ready";
export const SCHOOL_SIGNIN_READY_GLOBAL = "__APP_SCHOOL_SIGNIN_READY__";
export const NEXT_AUTH_CSRF_GLOBAL = "__APP_NEXT_AUTH_CSRF_TOKEN__";

type SchoolSignInBootstrapParams = {
  explicitCallbackUrl?: string;
  studentCallbackUrl?: string;
  staffCallbackUrl?: string;
};

function toJsonLiteral(value: unknown) {
  return JSON.stringify(value ?? "");
}

export function getSchoolSignInBootstrapScript(
  params: SchoolSignInBootstrapParams,
) {
  const explicitCallbackUrl = String(params.explicitCallbackUrl || "").trim();
  const studentCallbackUrl = String(
    params.studentCallbackUrl || "/student/tests",
  ).trim();
  const staffCallbackUrl = String(
    params.staffCallbackUrl || "/workspace",
  ).trim();

  return `
(() => {
  const readyEventName = ${toJsonLiteral(SCHOOL_SIGNIN_READY_EVENT)};
  const readyGlobalKey = ${toJsonLiteral(SCHOOL_SIGNIN_READY_GLOBAL)};
  const csrfGlobalKey = ${toJsonLiteral(NEXT_AUTH_CSRF_GLOBAL)};
  const explicitCallbackUrl = ${toJsonLiteral(explicitCallbackUrl)};
  const studentCallbackUrl = ${toJsonLiteral(studentCallbackUrl)};
  const staffCallbackUrl = ${toJsonLiteral(staffCallbackUrl)};

  const markReady = (form, csrfToken) => {
    if (!form) {
      return;
    }

    const normalizedToken = String(csrfToken || "").trim();
    if (!normalizedToken) {
      form.setAttribute("data-school-signin-ready", "error");
      return;
    }

    form
      .querySelectorAll('input[data-school-signin-csrf="true"]')
      .forEach((input) => {
        input.value = normalizedToken;
      });

    window[csrfGlobalKey] = normalizedToken;
    window[readyGlobalKey] = true;
    form.setAttribute("data-school-signin-ready", "true");
    window.dispatchEvent(new CustomEvent(readyEventName));
  };

  const syncCallbackUrl = (form) => {
    const callbackInput = form.querySelector(
      'input[data-school-signin-callback="true"]',
    );
    if (!callbackInput) {
      return;
    }

    if (explicitCallbackUrl) {
      callbackInput.value = explicitCallbackUrl;
      return;
    }

    const identifierInput = form.querySelector("#identifier");
    const identifier = String(identifierInput && "value" in identifierInput ? identifierInput.value : "").trim();
    callbackInput.value =
      identifier && !identifier.includes("@")
        ? studentCallbackUrl
        : staffCallbackUrl;
  };

  const bootstrap = () => {
    const form = document.querySelector(
      'form[data-school-signin-form="school-user"]',
    );
    if (!form) {
      return;
    }

    if (form.getAttribute("data-school-signin-bootstrapped") === "true") {
      syncCallbackUrl(form);
      return;
    }

    form.setAttribute("data-school-signin-bootstrapped", "true");
    syncCallbackUrl(form);

    const identifierInput = form.querySelector("#identifier");
    if (identifierInput && typeof identifierInput.addEventListener === "function") {
      identifierInput.addEventListener("input", () => {
        syncCallbackUrl(form);
      });
    }

    const cachedToken = String(window[csrfGlobalKey] || "").trim();
    if (cachedToken) {
      markReady(form, cachedToken);
      return;
    }

    fetch("/api/auth/csrf", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    })
      .then((response) => response.json().catch(() => ({})))
      .then((data) => {
        markReady(form, data && typeof data.csrfToken === "string" ? data.csrfToken : "");
      })
      .catch(() => {
        form.setAttribute("data-school-signin-ready", "error");
      });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
  `.trim();
}
