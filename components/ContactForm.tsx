"use client";

import { useState, type FormEvent } from "react";

export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      const response = await fetch("/api/contact/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send");
      }

      setStatus("sent");
      form.reset();
    } catch (error: unknown) {
      setErrorMsg(
        error instanceof Error ? error.message : "Something went wrong",
      );
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="public-form-shell space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
        <div>
          <label htmlFor="name" className="public-form-label">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="John Doe"
            className="public-form-input"
          />
        </div>

        <div>
          <label htmlFor="email" className="public-form-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            placeholder="john@school.edu"
            className="public-form-input"
          />
        </div>
      </div>

      <div>
        <label htmlFor="institution" className="public-form-label">
          Institution / School
        </label>
        <input
          id="institution"
          name="institution"
          placeholder="St. Xavier's High School"
          className="public-form-input"
        />
      </div>

      <div>
        <label htmlFor="message" className="public-form-label">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="How can we help you transform your school?"
          className="public-form-textarea"
        />
      </div>

      <div className="space-y-3">
        <button
          disabled={status === "sending" || status === "sent"}
          className="public-button-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "sending"
            ? "Sending..."
            : status === "sent"
              ? "Message Sent"
              : "Send Message"}
        </button>

        <p className="public-form-status text-[13px] text-[hsl(var(--public-muted))]">
          We usually respond within one working day.
        </p>
      </div>

      {status === "sent" ? (
        <p className="public-form-status public-form-status-success">
          Thank you. We&apos;ll be in touch shortly.
        </p>
      ) : null}

      {status === "error" ? (
        <p className="public-form-status public-form-status-error">{errorMsg}</p>
      ) : null}
    </form>
  );
}
