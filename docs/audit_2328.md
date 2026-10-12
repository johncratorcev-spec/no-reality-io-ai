# Аудит 2328.io — цепочка «ввод → баланс → вывод» (v20)

Дата: 2026-10-13 · код: v20 (Task 22) · домен: no-reality.fun · стек: бесплатный
(Vercel Hobby + Supabase Free + 2328.io существующий аккаунт)

## 1. Каналы денег

| Канал | order_id | Куда пишется | Экономический эффект |
|---|---|---|---|
| Пополнение депозита | `dp-<uuid>` | `DepositOrder` + `LedgerTxn(kind=deposit)` | EYE в игровой баланс (источник истины — ledger) |
| Бонус пакета пополнения | `dp-<uuid>` (bonus) | `LedgerTxn(kind=deposit_bonus)` | тот же webhook, отдельная идемпотентная строка |
| Пачка EYE | `eye-<accountId>-<sku>-<nonce>` | `PayOrder` + `LedgerTxn(kind=pack_purchase)` | EYE в баланс; $NR не минтит, вес не пишет |
| Revshare-разблокировка | `rev-<accountId>` | `PayOrder(kind=rev)` | только флаг `Account.revshare`; монеты не начисляет |
| Ставка криптой (легаси rb-*) | `rb-…` | `Bet` (webhook confirmBetPayment сохранён) | режим удалён из UI; в flights доехавшие инвойсы помечаются late/active |
| Выплата автору рынка | `pay-<purchaseId>-<ts>` | `Purchase` (легаси) | канал неактивен: FEATURE_PAYMENTS=0 закрывает всё пользовательское |

**Комиссии считаются ТОЛЬКО на сервере**: рейк пари-мьютюэля в
`resolveRound` (`RAKE_PCT` от общего пула, `authorShareOfRake` — доля автора),
каждое начисление — строка `[money-op][bet] round_resolved` с total/rake/authorShare/
prizePaid/dust. Клиентский код не участвует в расчётах вообще.

## 2. Идемпотентность и атомарность

- ЕДИНЫЙ источник истины баланса — `LedgerTxn` (двусторонний журнал,
  `refKey unique`). Повторный webhook/клик → unique-конфликт → no-op.
- Списания: `updateMany` с guard'ом `balanceCents >= |delta|` — в минус уйти
  нельзя; ставка создаётся в той же транзакции, что и списание
  (`placeBetBalance`), нет денег → откат всего.
- Резолв раунда: пошагово-атомарный (Supavisor :6543 не держит длинные
  интерактивные транзакции) — гейт `round: open|locked → locked` даёт
  единственного исполнителя; каждый шаг (`bet.updateMany` по status=active,
  ledger по unique refKey, `round/clip.updateMany` по статус-гейту)
  идемпотентен, повторный тик дотягивает недописанное.
- Пополнение: `DepositOrder.updateMany(status: pending→paid)` — гейт от
  двойного зачисления; бонус пакета — отдельный refKey `deposit_bonus:<paymentUuid>`.
- v20-новое: реферальная квалификация — `ReferralReward.refereeId unique`
  (одна первая ставка = одна награда), шоп — `ShopPurchase.(accountId,sku) unique`,
  фрибет — `Freebet.(accountId,source)` + `(source,username) unique`,
  шеры — ledger refKey `share:<kind>:<день>:<аккаунт>`.

## 3. Вывод (крючковая экономика, ТЗ §3/§11)

- **Self-service вывода НЕ СУЩЕСТВУЕТ.** `POST /api/me/cashout` закрыт
  двойным замком: `FEATURE_PAYMENTS=1` И `WITHDRAWALS_ENABLED=1` — оба
  требуются, иначе 403; даже с обоими флагами отвечает
  `cashout_manual_only` (только ручная админ-ревизия).
- **Вывода EYE не существует ни в каком виде**: нет API-дорожки EYE→USDT,
  нет UI, нет админ-обработчика конверсии. Попытки логируются в
  `WithdrawAttempt` (кто, откуда, когда) — спрос на вывод виден, метрика
  для анти-чёрта.
- Единственный выход ценности — сезонный snapshot → $NR merkle-клейм
  (`SeasonClaim`, `/claim`): вес = верные ставки × time-decay ×
  крючковые множители (стрик входов до +30%, активированные рефералы до
  +20%, winrate>50% до +25%, потолок ×2.0), кеп аккаунта 2% игровой пачки.
- Реферальные USDT-выплаты (20% с пачек) — только через админ-реестр
  (порог 5 USDT, `refEarnedCents/refPaidCents`), self-service нет.

## 4. Бесплатность стека

- Vercel Hobby: один дев-домен, serverless-функции в лимите Hobby
  (прокси видео/медиа — обычные Node-функции, кэш-заголовки выставлены).
- Supabase Free: Auth (OTP+Google) и Postgres в одном проекте; лимит писем
  OTP обрабатывается честным 429 `otp_rate_limited`.
- Turnstile (Cloudflare) — бесплатный, включается только при обоих ключах.
- Никаких платных сервисов: Stripe-каналы удалены из дерева (legacy),
  аналитика — собственный `TrackEvent`/PageVisit.

## 5. Инварианты для проверок (selftest v22)

1. welcome-бонус идемпотентен; xref-бонус платится только при атрибуции.
2. Реф-квалификация: первая ставка друга → награда referrer'у РОВНО один
   раз; тот же device/IP (fp совпадение) → held, награды нет; velocity-кап.
3. Шеринг win/streak: +EYE раз в UTC-день на вид, повтор в тот же день — no-op.
4. Фрибет: один на аккаунт и один на ник; повтор — отказ.
5. Шоп: списание атомарно; нет баланса → 402 и товар не выдаётся.
6. Попытка cashout → 403 + строка в WithdrawAttempt.
7. Авторезолв: окно закрывается, пари-мьютюэль + рейк + бейджи (first_win,
   winstreak) начисляются; void возвращает ставки.
8. EYE-баланс не имеет исходящих дорожек в крипту (grep по кодовой базе:
   2328 payout вызывается только из удалённого легаси-канала).
