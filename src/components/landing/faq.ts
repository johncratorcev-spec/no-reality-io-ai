/**
 * FAQ лендинга — общий источник данных для двух потребителей:
 * 1) секция FAQ на лендинге (рендер <details>);
 * 2) JSON-LD FAQPage в src/app/page.tsx (для Google и генеративных движков).
 *
 * GEO-замечание: ответы сформулированы как самодостаточные фактические
 * утверждения — LLM-поисковики (Perplexity, AI Overviews) цитируют
 * именно такие формулировки, а не маркетинговые лозунги.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is no reality.?",
    a: "no reality. is a curation project and prediction game for AI video. It runs two feeds: the feed — an endless stream of synthetic cinema found on Threads and Instagram — and the raffles, where every clip is either REAL footage or an AI-generated fake and viewers call it. Every clip is credited to its author and carries a shareable deep link.",
  },
  {
    q: "How does a bet work?",
    a: "A round opens with each clip: you pick REAL or SYNTH and put $1–5 into the side of the pool you believe in. When the round closes, the verdict is revealed and the winning side splits the whole pot in proportion to their stake; the house keeps a small rake. Rounds resolve in under a minute, and no account is required to play.",
  },
  {
    q: "Where do the videos come from?",
    a: "All clips are public posts on Threads and Instagram, created with AI video tools (or plain cameras) by their authors. no reality. is an independent distributor: videos are surfaced, verified as REAL or SYNTH by curators before the verdict, credited, and every card links back to the original post. Rights stay 100% with the creators.",
  },
  {
    q: "Is no reality. free to watch?",
    a: "Yes. Watching, scrolling and sharing the feed is completely free, no account required. Betting is optional and starts at $1. Some authors also sell the prompt behind their video — those unlock with a one-time payment, but the feed itself never asks for money.",
  },
  {
    q: "What are the raffles?",
    a: "The raffles are blind prediction rounds: the clip loses its title and author, so only the footage itself is on trial. You pick REAL or SYNTH, back the call with $1–5, and the winning side splits the pool when the curator's verdict lands. It is the purest test of your eye for synthetic content.",
  },
  {
    q: "What is a deep link on no reality.?",
    a: "Every video has a permanent shareable URL of the form /v/[code]. Opening it drops you straight into the feed at that exact clip with the live bet pool attached, so you can send one video — not the whole feed — to friends, chats or social bios.",
  },
  {
    q: "How does the referral program work?",
    a: "Every player gets an invite code. When someone joins through your link, you earn 20% of the house rake from their bets — not from their deposits — credited automatically and paid out in USDT. The attribution lasts 90 days.",
  },
  {
    q: "Who is behind no reality.?",
    a: "A small decentralized crew of curators, editors and engineers scattered across different corners of the planet. There is no office: the feed is handed off between time zones as the sun moves, which is why it never sleeps.",
  },
];
