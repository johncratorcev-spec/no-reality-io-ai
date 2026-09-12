import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * Анонимный идентификатор покупателя.
 *
 * Пользователь явно разрешил «visitor hash / cookie» на первом этапе.
 * httpOnly-cookie (не фингерпринт по ip+ua): при оплате стабильность важнее
 * скрытности — ip и User-Agent плавают между сетями и устройствами, а
 * потерянная покупка = потерянные деньги. Cookie живёт год, в ней случайный
 * UUID без персональных данных.
 *
 * ВАЖНО (урок первого прогона E2E): cookie можно ставить только на ТОТ
 * ответ, который реально уйдёт клиенту. Паттерн «создал res в начале,
 * поставил cookie, а вернул другой NextResponse» молча теряет cookie —
 * покупатель менялся бы на каждый запрос. Поэтому: readBuyer() в начале
 * роута → jsonResponse() в КАЖДОЙ точке выхода.
 */

const COOKIE = "nr_buyer";
const YEAR = 60 * 60 * 24 * 365;

export interface Buyer {
  id: string;
  isNew: boolean;
}

export function readBuyer(req: NextRequest): Buyer {
  const existing = req.cookies.get(COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
    return { id: existing, isNew: false };
  }
  return { id: randomUUID(), isNew: true };
}

/** JSON-ответ, который гарантирует доставку cookie нового покупателя. */
export function jsonResponse(
  buyer: Buyer,
  body: unknown,
  status = 200
): NextResponse {
  const res = NextResponse.json(body, { status });
  if (buyer.isNew) {
    res.cookies.set(COOKIE, buyer.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: YEAR,
      path: "/",
    });
  }
  return res;
}
