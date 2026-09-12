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
    a: "no reality. is a curated discovery feed of AI-generated video found on Threads. Clips are organized into four moods — SWAG, WELCOME TO THE FUTURE, CREEPY and UFO — every card links back to the original author, and a built-in marketplace lets you unlock the exact prompt behind a video.",
  },
  {
    q: "Where do the videos come from?",
    a: "All clips are public posts on Threads, created with AI video tools by their authors. no reality. is an independent distributor: videos are surfaced and credited, rights stay 100% with the creators, and every card links back to the original post.",
  },
  {
    q: "Is no reality. free to watch?",
    a: "Yes. Watching, scrolling and sharing the feed is completely free, no account required. Some authors choose to sell the prompt behind their video — those unlock with a one-time payment in USDT, but the feed itself never asks for money.",
  },
  {
    q: "How do creators earn money on no reality.?",
    a: "A creator lists the prompt behind their video at their own price. A buyer unlocks it with USDT through 2328.io, the creator keeps 75% of the sale (the 25% platform commission is shown upfront), and earnings are paid out in USDT to the creator’s own crypto wallet.",
  },
  {
    q: "What do the badges SWAG, WELCOME TO THE FUTURE, CREEPY and UFO mean?",
    a: "They are the four moods of the feed: SWAG is pure style and attitude, WELCOME TO THE FUTURE is tomorrow arriving early, CREEPY is the uncanny valley done right, and UFO is the unexplainable. Follow a mood and the feed becomes a channel for exactly that reality.",
  },
  {
    q: "What is a deep link on no reality.?",
    a: "Every video has a permanent shareable URL of the form /v/[code]. Opening it drops you straight into the feed at that exact clip, so you can send one video — not the whole feed — to friends, chats or social bios.",
  },
  {
    q: "How often is the feed updated?",
    a: "Continuously. The curation team is decentralized and works across time zones, so new clips land around the clock. The ranking also updates in real time based on real attention: views, clicks and shares move the strongest clips up.",
  },
  {
    q: "Who is behind no reality.?",
    a: "A small decentralized crew of curators, editors and engineers scattered across different corners of the planet. There is no office: the feed is handed off between time zones as the sun moves, which is why it never sleeps.",
  },
];
