import type { Metadata } from "next";
import LegalShell from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The rules for using no reality.: an AI video arena and REAL or SYNTH prediction rounds played with an internal points balance. We distribute — creators own.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "September 11, 2026";

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
    />
  );
}
