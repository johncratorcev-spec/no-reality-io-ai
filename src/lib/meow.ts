/**
 * Мяу: мягкий синтезированный звук (public/sfx/meow.mp3) для переходов
 * на профиль партнёра недели. Один общий Audio — без задержки на повторных
 * кликах; playing не ломает навигацию (target=_blank).
 */
let audio: HTMLAudioElement | null = null;

export function playMeow() {
  try {
    if (!audio) {
      audio = new Audio("/sfx/meow.mp3");
      audio.volume = 0.55;
      audio.preload = "auto";
    }
    audio.currentTime = 0;
    void audio.play().catch(() => {}); // без пользовательского жеста браузер молчит — и ладно
  } catch {
    /* звук — украшение: любые проблемы игнорируем */
  }
}
