'use client';

import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { parseCueCommandFromResponse, type CueCommand } from '@/lib/cue-chat-response';
import { useMirror } from '@/context/mirror-context';
import { applyCueCommandToMirror } from '@/lib/cue-command-apply';
import { useWebAuth } from '@/lib/firebase-client';
import {
  isCueImageFile,
  prepareCueScheduleImage,
  revokeCueScheduleImagePreview,
  type CueScheduleImage,
} from '@/lib/cue-image';
import { fetchCueResponseWeb, snapshotToPlanningPrompt, type CueMsg } from '@/lib/cue-web';

const IMAGE_ONLY_PROMPT =
  'Extract the weekly class schedule from this image and add it to my calendar. Use eventType "class" unless clearly a quiz or exam.';

export default function ChatRoutePage() {
  const auth = useWebAuth();
  const { mirror, commitMirror } = useMirror();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [msgs, setMsgs] = React.useState<CueMsg[]>([{ role: 'cue', text: 'Hi! I can help you plan your week, tasks, and study schedule.' }]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [includePlanning, setIncludePlanning] = React.useState(true);
  const [pendingImage, setPendingImage] = React.useState<CueScheduleImage | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [imageErr, setImageErr] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    document.getElementById('cue-input')?.focus();
  }, []);

  React.useEffect(() => {
    return () => revokeCueScheduleImagePreview(pendingImage);
  }, [pendingImage]);

  async function setPendingFromFile(file: File) {
    setImageErr(null);
    try {
      const prepared = await prepareCueScheduleImage(file);
      setPendingImage((prev) => {
        revokeCueScheduleImagePreview(prev);
        return prepared;
      });
    } catch (e) {
      setImageErr(e instanceof Error ? e.message : 'Could not load that image.');
    }
  }

  function clearPendingImage() {
    setPendingImage((prev) => {
      revokeCueScheduleImagePreview(prev);
      return null;
    });
    setImageErr(null);
  }

  async function executeCueCommand(command: CueCommand): Promise<string> {
    if (command.kind === 'empty_calendar') {
      return "I couldn't find any classes to extract from that image.";
    }
    if (!auth.user) {
      if (command.kind === 'add_tasks') return 'You need to be signed in to save tasks.';
      return 'You need to be signed in to update your calendar.';
    }

    if (command.kind === 'add_calendar') {
      const uniqueSubjects = new Set(command.classes.map((p) => p.title.trim().toLowerCase())).size;
      commitMirror((prev) => applyCueCommandToMirror(prev, command));
      return `I successfully added ${uniqueSubjects} subject${uniqueSubjects === 1 ? '' : 's'} to your calendar.`;
    }

    if (command.kind === 'clear_classes') {
      commitMirror((prev) => applyCueCommandToMirror(prev, command));
      return 'Done! All classes have been cleared from your calendar.';
    }

    if (command.kind === 'replace_classes') {
      const uniqueSubjects = new Set(command.classes.map((p) => p.title.trim().toLowerCase())).size;
      commitMirror((prev) => applyCueCommandToMirror(prev, command));
      return `Done! I replaced your schedule with ${uniqueSubjects} subject${uniqueSubjects === 1 ? '' : 's'}.`;
    }

    commitMirror((prev) => applyCueCommandToMirror(prev, command));
    return `I have successfully added ${command.tasks.length} tasks to your to-do list.`;
  }

  async function submit() {
    const userLine = input.trim();
    const imageForSend = pendingImage;
    if (!userLine && !imageForSend) return;

    const displayText = userLine || (imageForSend ? 'Schedule image attached' : '');
    const apiText = userLine || (imageForSend ? IMAGE_ONLY_PROMPT : '');

    const nextHistory: CueMsg[] = [
      ...msgs,
      {
        role: 'user',
        text: displayText,
        imagePreviewUrl: imageForSend?.dataUrl,
      },
    ];
    setMsgs(nextHistory);
    setInput('');
    clearPendingImage();
    setBusy(true);
    setErr(null);
    setImageErr(null);

    const planning = includePlanning ? snapshotToPlanningPrompt(mirror) : undefined;
    const intentMessage = userLine || (imageForSend ? IMAGE_ONLY_PROMPT : '');

    try {
      const txt = await fetchCueResponseWeb({
        history: nextHistory,
        latestUserText: apiText,
        attachment: imageForSend
          ? { dataUrl: imageForSend.dataUrl, mimeType: imageForSend.mimeType }
          : undefined,
        planningContext: planning,
        getIdToken: async () => (await auth.getIdToken()) ?? '',
      });
      let finalResponseText = txt;
      const parsed = parseCueCommandFromResponse(txt, intentMessage);
      if (parsed.status === 'ok') {
        finalResponseText = await executeCueCommand(parsed.command);
      } else if (parsed.status === 'calendar_intent_tasks_only') {
        finalResponseText =
          'You asked for calendar changes, but I only got to-do JSON. Please include weekday and HH:MM start/end time in your request.';
      } else if (parsed.status === 'invalid_json') {
        finalResponseText = 'I had trouble reading the response format. Please try again.';
      } else if (parsed.status === 'invalid_payload') {
        finalResponseText =
          'I understood this as a command but some required fields are missing or invalid. Please try again with clearer times and titles.';
      } else if (parsed.status === 'unsupported') {
        finalResponseText = 'I got an unsupported command format. Please ask again in plain language.';
      } else if (txt.includes('```json')) {
        finalResponseText = 'I had trouble saving your schedule. Please ask again.';
      }

      setMsgs((m) => [...m, { role: 'cue', text: finalResponseText }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Cue unreachable';
      setErr(msg);
      const proxyHint = /GROQ_API_KEY|proxy|Groq failed/i.test(msg)
        ? ' Check GROQ_API_KEY on Vercel and EXPO_PUBLIC_AI_PROXY_URL=/api/cue (or unset).'
        : '';
      setMsgs((m) => [
        ...m,
        {
          role: 'cue',
          text: imageForSend
            ? `I couldn't process that image right now.${proxyHint} Please retry in a moment.`
            : `I could not connect right now.${proxyHint} Please try again in a moment.`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const canSend = Boolean(input.trim() || pendingImage) && !busy;

  return (
    <div className="mx-auto grid w-full min-w-0 max-w-full gap-6 xl:max-w-[1080px] xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,360px)]">
      <section
        className="flex min-h-[640px] min-w-0 flex-col overflow-hidden"
        style={{
          background: 'color-mix(in srgb, var(--sc-surface) 88%, transparent)',
          border: '1px solid var(--sc-border)',
          borderRadius: 'var(--sc-radius-lg)',
          boxShadow: 'var(--sc-shadow-md)',
        }}
      >
        <div
          className="flex items-center justify-between gap-5 px-6 pb-[18px] pt-6"
          style={{ borderBottom: '1px solid var(--sc-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="relative inline-flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-[18px]"
              style={{
                background: 'var(--sc-accent-soft)',
                boxShadow: 'var(--sc-shadow-sm)',
              }}
            >
              <Image
                src="/cue-icon-light.png"
                alt="Cue"
                width={58}
                height={58}
                className="h-[58px] w-[58px] object-contain dark:hidden"
                priority
              />
              <Image
                src="/cue-icon-dark-cropped.png"
                alt="Cue"
                width={58}
                height={58}
                className="hidden h-[58px] w-[58px] object-contain dark:block"
                priority
              />
            </div>
            <div>
              <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-text-muted">Study assistant</p>
              <h1 className="text-[26px] font-extrabold leading-none tracking-[-0.045em] text-text-primary">Cue</h1>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] font-bold text-text-secondary">
            <input
              type="checkbox"
              checked={includePlanning}
              onChange={(e) => setIncludePlanning(e.target.checked)}
              className="accent-accent"
            />{' '}
            Include my schedule details
          </label>
        </div>
        <div className="flex min-h-[320px] flex-1 flex-col gap-3.5 overflow-y-auto px-6 py-5 text-[14.5px] leading-[1.55] text-text-primary">
          {msgs.map((m, idx) =>
            m.role === 'cue' ? (
              <div key={`${idx}-cue`} className="flex items-start gap-2.5">
                <div
                  className="mt-0.5 inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-xl"
                  style={{ background: 'var(--sc-accent-soft)' }}
                >
                  <Image
                    src="/cue-icon-light.png"
                    alt="Cue"
                    width={34}
                    height={34}
                    className="h-[34px] w-[34px] object-contain dark:hidden"
                  />
                  <Image
                    src="/cue-icon-dark-cropped.png"
                    alt="Cue"
                    width={34}
                    height={34}
                    className="hidden h-[34px] w-[34px] object-contain dark:block"
                  />
                </div>
                <div
                  className="flex-1 px-4 py-3.5"
                  style={{
                    background: 'var(--sc-surface-soft)',
                    border: '1px solid var(--sc-border)',
                    borderRadius: '18px',
                    borderTopLeftRadius: '8px',
                  }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div key={`${idx}-user`} className="flex justify-end">
                <div
                  className="max-w-[85%] min-w-0 px-4 py-3.5"
                  style={{
                    background: 'var(--sc-accent)',
                    color: 'white',
                    boxShadow: 'var(--sc-shadow-accent)',
                    borderRadius: '18px',
                    borderTopRightRadius: '8px',
                  }}
                >
                  {m.imagePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.imagePreviewUrl}
                      alt="Attached schedule"
                      className="mb-2 max-h-48 w-full rounded-xl object-contain"
                    />
                  ) : null}
                  {m.text ? <p className="whitespace-pre-wrap">{m.text}</p> : null}
                </div>
              </div>
            ),
          )}
        </div>

        <form
          className="mt-auto px-6 pb-6 pt-[18px]"
          style={{ borderTop: '1px solid var(--sc-border)' }}
          onSubmit={(evt) => {
            evt.preventDefault();
            void submit();
          }}
          onDragEnter={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setDragOver(true);
            }
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setDragOver(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = Array.from(e.dataTransfer.files).find(isCueImageFile);
            if (file) void setPendingFromFile(file);
          }}
        >
          {err ? <p className="mb-3 text-[11px] text-rose-500">{err}</p> : null}
          {imageErr ? <p className="mb-3 text-[11px] text-rose-500">{imageErr}</p> : null}
          <div
            className={clsx(
              'overflow-hidden rounded-[20px] border bg-surface shadow-[var(--sc-shadow-sm)] transition',
              dragOver ? 'border-accent ring-2 ring-accent/25' : 'border-border',
            )}
          >
            {pendingImage ? (
              <div className="relative border-b border-border bg-surface-soft p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingImage.previewUrl}
                  alt="Schedule preview"
                  className="max-h-40 w-full rounded-xl object-contain"
                />
                <button
                  type="button"
                  onClick={clearPendingImage}
                  className="absolute right-5 top-5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-sm font-bold text-white hover:bg-black/70"
                  aria-label="Remove attached image"
                >
                  ×
                </button>
              </div>
            ) : null}
            <textarea
              id="cue-input"
              rows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Cue how to reschedule an impossible week… or drop a schedule screenshot here"
              className="min-h-[112px] max-h-[210px] w-full resize-y border-0 bg-transparent p-4 text-[15px] leading-[1.55] text-text-primary outline-none placeholder:text-text-muted"
            />
            <div className="flex items-center justify-between gap-3 border-t border-border p-3 max-sm:flex-col max-sm:items-stretch">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-text-muted">
                <span>Planning context: {includePlanning ? 'included' : 'off'}</span>
                <span className="text-text-muted/60">·</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface-soft px-2.5 py-1.5 text-xs font-extrabold text-text-secondary transition hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Attach schedule
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void setPendingFromFile(file);
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={!canSend}
                className={clsx(
                  'inline-flex h-11 min-w-[108px] items-center justify-center rounded-[14px] text-sm font-extrabold text-white transition',
                  canSend ? 'hover:translate-y-[-1px]' : 'opacity-50',
                )}
                style={{
                  background: canSend ? 'var(--sc-accent)' : 'var(--sc-text-muted)',
                  boxShadow: canSend ? 'var(--sc-shadow-accent)' : 'none',
                }}
              >
                {busy ? 'Thinking…' : 'Send'}
              </button>
            </div>
          </div>
        </form>
      </section>

      <aside
        className="min-h-[640px] p-6 text-xs text-text-secondary max-xl:hidden"
        style={{
          background: 'var(--sc-surface)',
          border: '1px solid var(--sc-border)',
          borderRadius: 'var(--sc-radius-lg)',
          boxShadow: 'var(--sc-shadow-sm)',
        }}
      >
        <p className="text-base font-extrabold text-text-primary">Shortcuts</p>
        <ul className="mt-4 list-disc space-y-3 px-5">
          <li>
            <kbd
              className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
              style={{
                background: 'var(--sc-surface-soft)',
                border: '1px solid var(--sc-border)',
                color: 'var(--sc-text-primary)',
              }}
            >
              /
            </kbd>{' '}
            focuses this textarea (when not typing in inputs).
          </li>
          <li>
            Attach a schedule screenshot or drag it onto the composer — Cue reads it with vision and can add classes to your calendar.
          </li>
          <li>
            <Link href="/app/calendar" className="text-accent hover:text-accent-hover">
              Open calendar
            </Link>{' '}
            after import to review events.
          </li>
          <li>
            <Link href="/app" className="text-accent hover:text-accent-hover">
              Back home
            </Link>
          </li>
          <li>Turn off schedule details when you want a general planning chat.</li>
        </ul>
      </aside>
    </div>
  );
}
