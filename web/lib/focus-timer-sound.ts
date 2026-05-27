const TIMER_SOUND_SRC = '/sounds/timer.mp3';

let timerAudio: HTMLAudioElement | null = null;

function getTimerAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!timerAudio) {
    timerAudio = new Audio(TIMER_SOUND_SRC);
    timerAudio.preload = 'auto';
  }
  return timerAudio;
}

/** Call when the user starts a session (unlocks playback in the browser after their click). */
export function preloadFocusTimerSound() {
  const audio = getTimerAudio();
  if (!audio) return;
  audio.load();
  const volume = audio.volume;
  audio.volume = 0.001;
  void audio
    .play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = volume;
    })
    .catch(() => {
      audio.volume = volume;
    });
}

/** Play completion bell when the timer reaches zero. */
export function playFocusTimerCompleteSound() {
  const audio = getTimerAudio();
  if (!audio) return;
  audio.currentTime = 0;
  void audio.play().catch(() => {});
}
