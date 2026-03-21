"use client";
import { useState } from 'react';

export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    try {
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      const res = await fetch('/api/contact/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send');
      }
      setStatus("sent");
      form.reset();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl">
      <div className="grid grid-cols-1 gap-5 sm:gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-700">Name</label>
          <input
            id="name"
            name="name"
            required
            placeholder="John Doe"
            className="w-full h-12 rounded-lg border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            required
            placeholder="john@school.edu"
            className="w-full h-12 rounded-lg border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
          />
        </div>
      </div>

      <div>
        <label htmlFor="institution" className="mb-2 block text-sm font-medium text-slate-700">Institution / School</label>
        <input
          id="institution"
          name="institution"
          placeholder="St. Xavier's High School"
          className="w-full h-12 rounded-lg border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
        />
      </div>

      <div>
        <label htmlFor="message" className="mb-2 block text-sm font-medium text-slate-700">Message</label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="How can we help you transform your school?"
          className="w-full min-h-[140px] rounded-lg border border-slate-200 bg-slate-50 p-4 text-base text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition resize-none"
        />
      </div>

      <button
        disabled={status === "sending" || status === "sent"}
        className="w-full h-12 rounded-lg bg-emerald-600 px-5 font-semibold text-white shadow-lg transition hover:bg-emerald-500 hover:shadow-emerald-500/25 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {status === "sending" ? "Sending..." : status === "sent" ? "Message Sent!" : "Send Message"}
      </button>
      
      {status === "sent" && (
        <p className="text-sm text-emerald-600 text-center animate-pulse">Thank you! We&apos;ll be in touch shortly.</p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-600 text-center">{errorMsg}</p>
      )}
    </form>
  );
}
