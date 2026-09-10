import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-5 bg-white px-6 text-center">
      <p className="text-3xl font-extrabold tracking-tight text-[#10161d]">
        no reality here
      </p>
      <p className="max-w-xs text-sm leading-relaxed text-[#10161d]/60">
        этого видео больше нет в ленте — возможно, истекла ссылка CDN или пост
        удалили из Threads
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 rounded-full bg-[#0a0a0a] px-5 py-2.5 text-[0.8rem] font-bold text-white transition-transform duration-300 hover:scale-[1.03] active:scale-95"
      >
        <ArrowLeft className="h-4 w-4" />
        в ленту
      </Link>
    </div>
  );
}
