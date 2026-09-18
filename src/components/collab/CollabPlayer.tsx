"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

/**
 * Плеер коллаборационного видео на /collab.
 * Источник — тот же подписанный CDN-URL из CSV, что и в ленте:
 * обновляется тем же refresh-пайплайном (GitHub Action → редеплой).
 * Если ссылка всё же умерла — мягкий фолбэк на оригинал в Threads.
 */
export default function CollabPlayer({
  src,
  threadsUrl,
  caption,
}: {
  src: string;
  threadsUrl: string;
  caption: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <a
        href={threadsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex aspect-[9/16] max-h-[70vh] w-full max-w-xs flex-col items-center justify-center gap-3 rounded-[2rem] bg-gradient-to-b from-[#10161d] to-[#232f3d] text-center text-white/90 transition-transform duration-300 hover:scale-[1.02] sm:max-w-sm"
      >
        <span className="text-5xl transition-transform duration-300 group-hover:scale-110">🎬</span>
        <span className="px-6 text-[0.8rem] font-extrabold leading-relaxed">
          watch the collab on Threads
        </span>
        <span className="inline-flex items-center gap-1 text-[0.62rem] font-bold text-white/60">
          open original <ExternalLink className="h-3 w-3" aria-hidden />
        </span>
      </a>
    );
  }

  return (
    <figure className="flex flex-col items-center">
      <div className="nr-collab-frame relative overflow-hidden rounded-[2rem] shadow-[0_24px_80px_-24px_rgba(16,22,29,.45)]">
        <video
          src={src}
          className="aspect-[9/16] max-h-[70vh] w-full max-w-xs object-cover sm:max-w-sm"
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="metadata"
          onError={() => setFailed(true)}
        />
      </div>
      <figcaption className="mt-3 max-w-xs text-center text-[0.62rem] font-semibold leading-relaxed text-[#10161d]/55 sm:max-w-sm">
        {caption}
      </figcaption>
    </figure>
  );
}
