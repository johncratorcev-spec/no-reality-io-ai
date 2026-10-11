import type { Metadata } from "next";
import LegalShell from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The rules for using no reality.: an AI video arena and REAL or SYNTH prediction rounds played with an internal points balance. We distribute — creators own.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "September 11, 2026";

/* v18: полный русский вариант (LegalShell выбирает по выбранному языку) */
const RU = {
  kicker: "правовые документы",
  title: "Условия использования",
  updated: "11 сентября 2026",
  intro:
    "Настоящие Условия использования («Условия») регулируют доступ к no reality. и его использование («Платформа»), включая нашу ленту AI-видео и предикт-раунды РЕАЛ или СИНТИК с внутренним балансом. Просматривая, смотря, делясь или иным образом используя Платформу, вы принимаете эти Условия. Если вы с ними не согласны — пожалуйста, не используйте Платформу.",
  contactName: "Контакты",
  contactNote:
    "Вопросы, запросы на удаление, лицензирование и уведомления о нарушениях:",
  motto: "твой единственный предел — разум",
  sections: [
    {
      heading: "О Платформе",
      body: [
        "no reality. — независимая платформа дистрибуции и предикта. Мы показываем ленту AI-видео, публично опубликованных их авторами в сторонних сервисах (например, Threads), с указанием авторства везде, где это технически возможно.",
        "Платформа также проводит предикт-раунды («Раунды»), в которых посетители называют, является ли клип РЕАЛЬНОЙ съёмкой или СИНТЕТИКОЙ, делая ставки внутренним балансом, пополняемым криптовалютой. Во всём, что мы публикуем, наша роль — строго дистрибьютор, посредник и оператор раундов: мы не производим, не заказываем, не редактируем и не владеем работами, доступными через Платформу.",
      ],
    },
    {
      heading: "Права на контент — права остаются у авторов",
      body: [
        "Все видео, заголовки, описания и другие материалы, показанные на Платформе, остаются исключительной интеллектуальной собственностью их авторов. Ничто в этих Условиях и никакие ваши действия на Платформе не передают права собственности от автора к нам или к вам.",
        "Мы не заявляем авторство на чужие работы. Любые товарные знаки, хэндлы или имена, показанные на Платформе, принадлежат их владельцам и используются исключительно для идентификации и указания авторства.",
        "Если автор не предоставил вам более широких прав, вы получаете только личное, неисключительное, непередаваемое право просматривать контент на Платформе и использовать её функции шаринга. Любое коммерческое использование, перезалив, производная работа или ре­дистрибуция работы автора требуют отдельного разрешения этого автора.",
      ],
    },
    {
      heading: "Внутренний баланс, раунды и выплаты",
      body: [
        "Раунды играются внутренним балансом Платформы — предоплаченной учётной единицей без начисления процентов, используемой внутри Платформы. Баланс фиксируется в защищённом от подмены журнале транзакций; зачисление происходит только после подтверждения подписанным вебхуком нашего платёжного провайдера.",
        "Ставка списывается с баланса в момент попадания в банк раунда и не подлежит возврату, пока раунд открыт. Когда раунд разрешается, призовой банк делится пари-мьютюэль между выигравшей стороной пропорционально ставкам, за вычетом рейка, раскрытого в интерфейсе. Исход раунда определяется вердиктом Платформы по исходной съёмке.",
        "Внутренний баланс не является законным платёжным средством и в настоящий момент не имеет стоимости вне Платформы. В дорожной карте описан будущий токен на Base с конвертацией внутреннего баланса — любая такая конвертация и любой вывод реальных средств дополнительно потребуют верификации личности и будут исполняться только на кошелёк, контролируемый вами. Балансы, полученные через злоупотребления, автоматизацию или мошенничество, могут быть аннулированы.",
      ],
    },
    {
      heading: "Допустимое использование",
      body: [
        "Вы соглашаетесь не вмешиваться в работу Платформы, не пытаться получить несанкционированный доступ к её системам, не собирать контент массово, не обходить указание авторства и не использовать Платформу в незаконных целях. Вы также соглашаетесь не удалять, не скрывать и не искажать авторство, показанное на Платформе.",
        "Автоматизированный доступ разрешён только добросовестным поисковым краулерам, соблюдающим стандартные robots-правила. Всё, что ухудшает работу Платформы для других посетителей, может быть ограничено по частоте или заблокировано.",
      ],
    },
    {
      heading: "Авторские права и удаление",
      body: [
        "Мы уважаем права интеллектуальной собственности и ожидаем того же от каждого посетителя. Если вы считаете, что какой-либо контент на Платформе нарушает ваши права, отправьте нам уведомление с описанием работы, её расположением на Платформе и заявлением о добросовестности. Мы рассмотрим обращение и, где уместно, удалим или ограничим доступ к материалу.",
        "Авторы, чьи работы показаны в ленте, могут в любой момент запросить удаление собственного контента — мы выполним такой запрос без формального юридического уведомления.",
      ],
    },
    {
      heading: "Сторонние сервисы",
      body: [
        "Контент на Платформе происходит из публичных постов сторонних сервисов, прежде всего Threads от Meta. К оригинальным постам применяются условия использования и стандарты сообществ этих сервисов. Мы не аффилированы с Meta, Threads или авторами, чьи работы мы показываем, и не спонсируемся ими.",
        "Ссылки с Платформы на сторонние сайты (включая профиль автора или оплату нашего платёжного провайдера) приведены для удобства; мы не контролируем их содержимое и не отвечаем за него.",
      ],
    },
    {
      heading: "Отказ от гарантий",
      body: [
        "Платформа предоставляется «как есть» и «по мере доступности». В максимальной степени, допустимой законом, мы отказываемся от всех гарантий, явных и подразумеваемых, включая товарную пригодность, пригодность для конкретной цели и отсутствие нарушений. Мы не гарантируем бесперебойность ленты, отсутствие ошибок или разрешение конкретного раунда в определённый срок.",
      ],
    },
    {
      heading: "Ограничение ответственности",
      body: [
        "В максимальной степени, допустимой законом, no reality. и его оператор не несут ответственности за любые косвенные, случайные, специальные, последующие или штрафные убытки, а также за упущенную выгоду, данные или деловую репутацию, возникшие в связи с использованием Платформы или её контента.",
        "Если ответственность исключить нельзя, она ограничивается, по нашему выбору, повторным предоставлением услуги или стоимостью её повторного предоставления.",
      ],
    },
    {
      heading: "Изменения",
      body: [
        "Мы можем обновлять эти Условия по мере развития Платформы — в частности, по мере взросления экономики внутреннего баланса к фазе токена на Base. Дата «обновлено» выше всегда отражает текущую версию. Продолжение использования Платформы после обновления означает принятие пересмотренных Условий.",
      ],
    },
  ],
} as const;

export default function TermsPage() {
  return (
    <LegalShell
      kicker="legal"
      title="Terms of Service"
      updated={UPDATED}
      intro="These Terms of Service (“Terms”) govern your access to and use of no reality. (the “Platform”), including our feed of AI-generated videos and our REAL or SYNTH prediction raffles played with an internal balance. By browsing, watching, sharing or otherwise using the Platform you agree to be bound by these Terms. If you do not agree, please do not use the Platform."
      contactName="Contact"
      contactHandle="@your_betfriend"
      sections={[
        {
          heading: "About the Platform",
          body: [
            "no reality. is an independent curation and distribution platform. We display a feed of AI-generated videos that were originally shared publicly by their creators on third-party services (such as Threads), together with attribution to the original author wherever technically possible.",
            "The Platform also hosts prediction raffles (“Raffles”) in which visitors call whether a clip is REAL footage or SYNTHETIC, staking an internal balance that can be topped up in cryptocurrency. In everything we publish, our role is strictly that of a distributor, intermediary and raffle operator: we do not produce, commission, edit or own the works made available through the Platform.",
          ],
        },
        {
          heading: "Ownership of Content — Rights Stay With the Authors",
          body: [
            "All videos, titles, descriptions and other materials displayed on the Platform remain the exclusive intellectual property of their respective authors. Nothing in these Terms, and nothing you do on the Platform, transfers any ownership rights from an author to us or to you.",
            "We claim no authorship of any third-party work. Any trademarks, handles or names shown on the Platform belong to their owners and are used solely for identification and attribution purposes.",
            "Unless a creator grants you broader rights, you receive only a personal, non-exclusive, non-transferable right to view the content on the Platform and to use its sharing features. Any commercial use, re-upload, derivative work or redistribution of a creator’s work requires that creator’s separate permission.",
          ],
        },
        {
          heading: "Internal Balance, Raffles and Payouts",
          body: [
            "Raffles are played with the Platform’s internal balance — a prepaid, non-interest-bearing accounting unit used inside the Platform. Your balance is recorded in a tamper-evident transaction ledger; only balances confirmed by our payment provider’s signed webhook are credited.",
            "A stake is deducted from your balance the moment it enters the raffle pool and is not refundable while the round is open. When a round resolves, the prize pool is split pari-mutuel among the winning side pro-rata to stakes, minus the rake disclosed in the interface. Raffle outcomes are decided by the platform verdict on the underlying footage.",
            "Internal balance is not legal tender and currently has no off-platform value. Our roadmap describes a future token on Base with conversion of internal balance — any such conversion, and any withdrawal of real funds, will additionally require identity verification and will only ever be executed to a wallet you control. Balances obtained through abuse, automation or fraud may be voided.",
          ],
        },
        {
          heading: "Acceptable Use",
          body: [
            "You agree not to interfere with the Platform, attempt to gain unauthorised access to its systems, scrape or harvest content at scale, circumvent attribution, or use the Platform for any unlawful purpose. You also agree not to remove, obscure or falsify author attribution displayed on the Platform.",
            "Automated access is allowed only for well-behaved search-engine crawlers that respect standard robots rules. Anything that degrades performance for other visitors may be rate-limited or blocked.",
          ],
        },
        {
          heading: "Copyright and Takedown",
          body: [
            "We respect intellectual-property rights and expect every visitor to do the same. If you believe any content on the Platform infringes your rights, send us a notice with a description of the work, its location on the Platform and a statement of good faith. We will review and, where appropriate, remove or disable access to the material.",
            "Authors whose works are displayed in the feed may also request removal of their own content at any time — we will honour such requests without requiring a formal legal notice.",
          ],
        },
        {
          heading: "Third-Party Services",
          body: [
            "Content on the Platform originates from public posts on third-party services, first and foremost Threads by Meta. Those services have their own terms of service and community standards, which apply to the original posts. We are not affiliated with, endorsed by or sponsored by Meta, Threads or any author whose work we display.",
            "Links from the Platform to third-party sites (including a creator’s profile or our payment provider’s checkout) are provided for convenience; we do not control and are not responsible for their content.",
          ],
        },
        {
          heading: "Disclaimer of Warranties",
          body: [
            "The Platform is provided on an “as is” and “as available” basis. To the fullest extent permitted by law we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose and non-infringement. We do not warrant that the feed will be uninterrupted, error-free, or that any particular raffle round will resolve within a specific time.",
          ],
        },
        {
          heading: "Limitation of Liability",
          body: [
            "To the fullest extent permitted by law, no reality. and its operator shall not be liable for any indirect, incidental, special, consequential or punitive damages, or for any loss of profits, data or goodwill, arising from or related to your use of the Platform or its content.",
            "Where liability cannot be excluded, it is limited, at our option, to re-supply of the service or the cost of its re-supply.",
          ],
        },
        {
          heading: "Changes",
          body: [
            "We may update these Terms as the Platform evolves — in particular as the internal balance economy matures towards its Base-token phase. The “last updated” date above always reflects the current version. Continued use of the Platform after an update constitutes acceptance of the revised Terms.",
          ],
        },
      ]}
      ru={RU}
    />
  );
}
