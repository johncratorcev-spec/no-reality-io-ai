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
    a: "no reality. is a vertical feed of synthetic cinema found on Threads. Every clip is either REAL footage or an AI-generated fake, viewers call it — REAL or SYNTH — and can back their call with a $1–5 bet against a live pool. Clips are organized into four moods — SWAG, WELCOME TO THE FUTURE, CREEPY and UFO — and every card links back to the original author.",
  },
  {
    q: "How does a bet work?",
    a: "A round opens with each clip: you pick REAL or SYNTH and put $1–5 into the side of the pool you believe in. When the round closes, the verdict is revealed and the winning side splits the whole pot in proportion to their stake; the house keeps a small rake. Rounds resolve in under a minute, and no account is required to play.",
  },
  {
    q: "Where do the videos come from?",
    a: "All clips are public posts on Threads, created with AI video tools by their authors. no reality. is an independent distributor: videos are surfaced, verified as REAL or SYNTH by curators before the verdict, credited, and every card links back to the original post. Rights stay 100% with the creators.",
  },
  {
    q: "Is no reality. free to watch?",
    a: "Yes. Watching, scrolling and sharing the feed is completely free, no account required. Betting is optional and starts at $1. Some authors also sell the prompt behind their video — those unlock with a one-time payment, but the feed itself never asks for money.",
  },
  {
    q: "What do the badges SWAG, WELCOME TO THE FUTURE, CREEPY and UFO mean?",
    a: "They are the four moods of the feed: SWAG is pure style and attitude, WELCOME TO THE FUTURE is tomorrow arriving early, CREEPY is the uncanny valley done right, and UFO is the unexplainable. Follow a mood and the feed becomes a channel for exactly that reality.",
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
