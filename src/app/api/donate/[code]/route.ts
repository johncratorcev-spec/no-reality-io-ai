import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getPostByCode } from "@/lib/csv";
import { PARTNER_OF_WEEK } from "@/lib/site";
import {
  create2328Payment,
  get2328PaymentInfo,
  is2328PaymentConfigured,
  Pay2328ApiError,
  Pay2328ConfigError,
} from "@/lib/2328/payment";
import { isPaidStatus } from "@/lib/2328/webhook";

export const dynamic = "force-dynamic";

/* ================================================================
   ПИЛОТ 2328.IO: крипто-донат на закреплённый пост партнёра недели.
   Stateless: invoice живёт у провайдера, порядок такой:
   POST  /api/donate/[code]  { amountUsdt } → { payUrl, orderId }
   GET   /api/donate/[code]?orderId=…       → { status, paid }
   Статус читаем прямо у 2328 (/v1/payment/info) — без своей БД,
   поэтому донату не страшны холодные старты и ротация /tmp.
   ================================================================ */

/** срезаем XSS/инъекции в order_id при поллинге */
const ORDER_RE = /^don-[A-Za-z0-9_-]{6,32}$/;

function publicBase(req: NextRequest): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return host ? `${proto}://${host}` : "";
}

function nanoid(n = 12): string {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // 8 стартов оплаты / мин с одного IP — донаты много чаще не нужны
  const rl = rateLimit(`donate:${ip}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // пилот: донат только на постах партнёра недели
  if (!PARTNER_OF_WEEK.donatePostUtms.includes(code)) {
    return NextResponse.json(
      { error: "Donations are open only for the pinned partner posts" },
      { status: 404 }
    );
  }

  const post = getPostByCode(code);
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (!is2328PaymentConfigured()) {
    return NextResponse.json(
      { error: "Payments are not configured yet — try again later" },
      { status: 503 }
    );
  }

  let amountUsdt: string;
  try {
    const body = (await req.json()) as { amountUsdt?: string };
    const raw = String(body.amountUsdt ?? "").trim();
    // только пресеты из конфига — никаких произвольных сумм в пилоте
    const presets = PARTNER_OF_WEEK.donatePresetsUsdt as readonly string[];
    if (!presets.includes(raw)) {
      return NextResponse.json(
        { error: "Choose one of the suggested amounts" },
        { status: 400 }
      );
    }
    amountUsdt = raw;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = `don-${nanoid()}`;

  try {
    const payment = await create2328Payment({
      amountUsdt,
      orderId,
      urlCallback: `${publicBase(req)}/api/webhooks/2328`,
      urlReturn: `${publicBase(req)}/v/${code}`,
      description: `no reality. donation — ${post.title || post.utmCode}`,
    });

    return NextResponse.json({
      ok: true,
      payUrl: payment.payUrl,
      orderId: payment.orderId || orderId,
      amountUsdt,
    });
  } catch (e) {
    if (e instanceof Pay2328ConfigError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    console.error(
      "[donate] 2328 create payment failed:",
      e instanceof Error ? e.message : e
    );
    const status =
      e instanceof Pay2328ApiError && e.status >= 400 && e.status < 500 ? 400 : 502;
    return NextResponse.json(
      { error: "Payment provider error — try again" },
      { status }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!PARTNER_OF_WEEK.donatePostUtms.includes(code)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const orderId = req.nextUrl.searchParams.get("orderId") || "";
  if (!ORDER_RE.test(orderId)) {
    return NextResponse.json({ error: "Bad orderId" }, { status: 400 });
  }

  try {
    const info = await get2328PaymentInfo({ orderId });
    const status = String(info?.payment_status ?? "unknown");
    return NextResponse.json({ ok: true, status, paid: isPaidStatus(status) });
  } catch (e) {
    console.error(
      "[donate] status check failed:",
      e instanceof Error ? e.message : e
    );
    return NextResponse.json(
      { error: "Status check failed — try again" },
      { status: 502 }
    );
  }
}
