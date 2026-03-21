"use client";

export type CashfreeMode = "sandbox" | "production" | (string & {});

export type CashfreeCheckoutOptions = {
  paymentSessionId: string;
  redirectTarget?: string;
  returnUrl?: string;
  components?: string[];
};

export type CashfreeSDK = {
  checkout: (options: CashfreeCheckoutOptions) => Promise<unknown>;
};

type CashfreeFactory = (options?: { mode?: CashfreeMode }) => CashfreeSDK;

declare global {
  interface Window {
    Cashfree?: CashfreeFactory;
  }
}

const CASHFREE_SCRIPT_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";
const CASHFREE_SCRIPT_REGEX =
  /^https:\/\/sdk\.cashfree\.com\/js\/v3\/?(\?.*)?$/;
const EXISTING_SCRIPT_MESSAGE =
  "load was called but an existing Cashfree.js script already exists in the document; existing script parameters will be used";

let cashfreePromise: Promise<CashfreeFactory | null> | null = null;

function findScript() {
  const scripts = document.querySelectorAll(
    `script[src^="${CASHFREE_SCRIPT_URL}"]`,
  );

  for (const script of scripts) {
    if (CASHFREE_SCRIPT_REGEX.test(script.getAttribute("src") || "")) {
      return script as HTMLScriptElement;
    }
  }

  return null;
}

function injectScript() {
  const script = document.createElement("script");
  script.src = CASHFREE_SCRIPT_URL;
  const headOrBody = document.head || document.body;

  if (!headOrBody) {
    throw new Error(
      "Expected document.body not to be null. Cashfree.js requires a <body> element.",
    );
  }

  headOrBody.appendChild(script);
  return script;
}

function loadScript(params: { mode?: CashfreeMode } | null) {
  if (cashfreePromise) {
    return cashfreePromise;
  }

  cashfreePromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      resolve(null);
      return;
    }

    if (window.Cashfree && params) {
      console.warn(EXISTING_SCRIPT_MESSAGE);
    }

    if (window.Cashfree) {
      resolve(window.Cashfree);
      return;
    }

    try {
      let script = findScript();

      if (script && params) {
        console.warn(EXISTING_SCRIPT_MESSAGE);
      } else if (!script) {
        script = injectScript();
      }

      script.addEventListener("load", () => {
        if (window.Cashfree) {
          resolve(window.Cashfree);
        } else {
          reject(new Error("Cashfree.js not available"));
        }
      });
      script.addEventListener("error", () => {
        reject(new Error("Failed to load Cashfree.js"));
      });
    } catch (error) {
      reject(error);
    }
  });

  return cashfreePromise;
}

const cashfreeBootPromise = Promise.resolve().then(() => loadScript(null));
let loadCalled = false;

cashfreeBootPromise.catch((error) => {
  if (!loadCalled) {
    console.warn(error);
  }
});

export async function load(options?: { mode?: CashfreeMode }) {
  loadCalled = true;
  const maybeCashfree = await cashfreeBootPromise;

  if (!maybeCashfree) {
    return null;
  }

  return maybeCashfree(options);
}
