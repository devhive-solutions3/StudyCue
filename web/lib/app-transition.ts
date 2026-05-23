'use client';

const START_EVENT = 'studycue:transition:start';
const STOP_EVENT = 'studycue:transition:stop';

export function startAppTransition(message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(START_EVENT, { detail: { message } }));
}

export function stopAppTransition() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(STOP_EVENT));
}

export { START_EVENT as APP_TRANSITION_START_EVENT, STOP_EVENT as APP_TRANSITION_STOP_EVENT };
