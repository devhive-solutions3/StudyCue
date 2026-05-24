import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Help & FAQ',
  description: 'Get help using StudyCue Planner, including scheduling, tasks, focus sessions, Cue AI, and account support.',
  alternates: { canonical: canonical('/help') },
};

export default function HelpPage() {
  const faqs = [
    {
      question: 'What is StudyCue Planner?',
      answer:
        'StudyCue Planner is a smart study planner for students that combines class schedules, tasks, notes, focus sessions, and Cue AI in one web workspace.',
    },
    {
      question: 'How do I create a study schedule?',
      answer:
        'Open your planner, add your class blocks first, then place study sessions around them for the week. Keep the plan realistic by blocking specific times for review, homework, and catch-up.',
    },
    {
      question: 'How do I add tasks?',
      answer:
        'Create a task with a title, due date, and any helpful details. Use tasks for homework, projects, readings, or exam prep so your deadlines stay visible next to your schedule.',
    },
    {
      question: 'How does the focus timer work?',
      answer:
        'The focus timer helps you start a dedicated study session and stay on one task for a set period. Use it when you want a clear start and stop point for focused work.',
    },
    {
      question: 'What is Cue AI?',
      answer:
        'Cue AI is the built-in planning assistant inside StudyCue Planner. It helps students think through priorities, organize workloads, and decide on the next practical step.',
    },
    {
      question: 'How do I reset my password?',
      answer:
        'Go to the forgot password page, enter the email connected to your account, and follow the reset link sent to your inbox. Check spam if the message does not appear right away.',
    },
    {
      question: 'How do I report a bug?',
      answer:
        'Use the contact page to report a bug. Include what happened, what device or browser you were using, and the steps that led to the problem so the team can reproduce it faster.',
    },
  ];

  return (
    <article className="space-y-6 text-text-primary">
      <header>
        <h1 className="font-serif text-4xl">StudyCue Planner help</h1>
        <p className="max-w-3xl text-text-secondary">
          Find answers about scheduling, tasks, notes, focus sessions, Cue AI, and account support for StudyCue
          Planner.
        </p>
      </header>
      <section className="grid gap-4">
        {faqs.map((faq) => (
          <div key={faq.question} className="rounded-2xl border border-border bg-surface px-5 py-6 shadow-[var(--sc-shadow-card)]">
            <h2 className="text-xl font-semibold text-text-primary">{faq.question}</h2>
            <p className="mt-3 text-text-secondary">{faq.answer}</p>
          </div>
        ))}
      </section>
      <div className="rounded-2xl border border-border bg-surface px-5 py-6 shadow-[var(--sc-shadow-card)]">
        <h2 className="text-xl font-semibold text-text-primary">Still need help?</h2>
        <p className="mt-3 text-text-secondary">
          If your question is not covered here, contact the team with a short description of the issue and any helpful
          screenshots or steps.
        </p>
        <div className="mt-4">
          <Link
            href="/contact"
            className="inline-flex rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-accent"
          >
            Contact us
          </Link>
        </div>
      </div>
    </article>
  );
}
