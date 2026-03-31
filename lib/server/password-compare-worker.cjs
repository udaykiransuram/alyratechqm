"use strict";

const bcrypt = require("bcryptjs");
const { parentPort } = require("node:worker_threads");

if (parentPort) {
  parentPort.on("message", (message) => {
    const id = Number(message && message.id);

    try {
      const password =
        message && typeof message.password === "string" ? message.password : "";
      const hash =
        message && typeof message.hash === "string" ? message.hash : "";
      const matched = Boolean(hash) && bcrypt.compareSync(password, hash);

      parentPort.postMessage({
        id,
        matched,
      });
    } catch (error) {
      parentPort.postMessage({
        id,
        error:
          error && typeof error.message === "string"
            ? error.message
            : "Password compare failed.",
      });
    }
  });
}
