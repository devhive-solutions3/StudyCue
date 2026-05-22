import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Contact' };

export default function ContactPage() {
  const email = 'solutions.devhive@gmail.com';
  const messenger = 'https://www.facebook.com/share/1apeFAUjcM/?mibextid=wwXIfr';

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl text-text-primary">Contact</h1>
      <p className="max-w-xl text-text-secondary">For questions and support, contact DevHive using the channels below.</p>

      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
        <div>
          <p className="text-lg font-semibold text-text-primary">Email</p>
          <a href={`mailto:${email}`} className="text-text-secondary hover:text-accent">
            {email}
          </a>
        </div>
        <div>
          <p className="text-lg font-semibold text-text-primary">Messenger</p>
          <a href={messenger} target="_blank" rel="noreferrer" className="text-text-secondary hover:text-accent">
            Send a message
          </a>
        </div>
      </div>
    </div>
  );
}
