import type { Metadata } from "next";
import LegalShell from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Creator Agreement",
  description:
    "For authors whose work appears on no reality.: you keep every right. We are a distributor, not a rights-holder. A marketplace of prompts and instructions is coming.",
};

const UPDATED = "September 11, 2026";

export default function CreatorsPage() {
  return (
    <LegalShell
      kicker="for creators"
      title="Creator Agreement"
      updated={UPDATED}
      intro="This Creator Agreement (“Agreement”) explains the relationship between no reality. (the “Platform”) and the authors whose videos, prompts, instructions and other works appear on it. The short version: your work stays yours, we stay a distributor, and the marketplace of prompts and instructions exists to help you earn from what you make."
      contactName="Contact for Creators"
      contactHandle="@your_betfriend"
      sections={[
        {
          heading: "Who This Agreement Covers",
          body: [
            "This Agreement applies to every creator whose work is displayed on the Platform — whether the work was submitted by you directly, added through our self-service panel from your public post, or surfaced by our editors from public feeds such as Threads.",
            "By keeping your work on the Platform after learning about it, or by submitting work through our panel or marketplace, you accept this Agreement. If you do not accept it, contact us and we will remove your work.",
          ],
        },
        {
          heading: "Your Rights Remain Yours",
          body: [
            "You retain 100% of the ownership and intellectual-property rights in everything you create. Nothing in this Agreement transfers, assigns or licenses any of your rights to the Platform, its operator or its visitors beyond the specific licence described below.",
            "We do not claim co-authorship, we do not edit or alter your works, and we will never present your work as anything other than yours. You remain free to publish, license, monetise or remove your work anywhere else, at any time, without asking us.",
          ],
        },
        {
          heading: "The Licence You Grant Us",
          body: [
            "To run the Platform we need one limited licence from you: a non-exclusive, worldwide, royalty-free, revocable licence to host, reproduce, display, distribute and publicly promote your work as part of the feed and (in the future) your marketplace listings, together with your handle for attribution.",
            "This licence exists for one purpose — distributing and promoting your work through the Platform. We may not sell your videos, sublicense them to third parties for their own use, or use them in paid advertising without your separate written consent. You may revoke the licence at any time by requesting removal; we will act on it within five business days.",
          ],
        },
        {
          heading: "We Are a Distributor — Nothing More",
          body: [
            "The Platform operates strictly as a distributor and intermediary. We do not commission works, direct their creation, participate in production, or hold any rights in the works themselves. Responsibility for the content of a work — including that it is lawful, original and does not infringe third-party rights — stays with its author.",
            "Because of this, the Platform makes no warranties about any individual work and cannot negotiate licences on a creator’s behalf. If a visitor wants rights beyond viewing, they must obtain them from you directly.",
          ],
        },
        {
          heading: "What You Promise Us",
          body: [
            "By having your work on the Platform you confirm that: (a) you are the author or an authorised representative of the author; (b) you hold all rights needed for the work to be displayed — including rights to any source footage, music, voices or likenesses incorporated in it; (c) the work complies with applicable law and with the rules of the platform where it was originally published; and (d) the work does not infringe anyone’s copyright, trademark, privacy or other rights.",
            "If any of these turns out not to be true, you agree to cover the losses the Platform reasonably incurs as a result (an indemnity).",
          ],
        },
        {
          heading: "Marketplace of Prompts and Instructions",
          body: [
            "The marketplace lets you list prompts, workflows, instructions and related know-how, set your own price and terms of use for each listing, and receive payments from buyers who acquire them. The Platform provides the storefront, checkout and delivery tooling.",
            "We take no ownership of listed items and never become a party to the licence between you and your buyer — the terms shown on your listing are yours. Our role is facilitation: presentation, payment processing and delivery. Platform fees or commissions, if any, will always be disclosed on the listing form before you publish.",
            "You are responsible for the accuracy of your listing, for delivering what was promised, and for answering reasonable buyer questions. Listings that infringe others’ rights or mislead buyers may be moderated or removed.",
          ],
        },
        {
          heading: "Attribution and Removal",
          body: [
            "We credit the author wherever technically possible and will correct or complete attribution on request. You can ask us to remove any or all of your works at any time, for any reason, without a formal legal notice — write to us and we will action it within five business days.",
            "For marketplace listings, removal takes effect once transactions already paid for by buyers have been delivered; new purchases stop immediately.",
          ],
        },
        {
          heading: "Prohibited Content",
          body: [
            "Works that are unlawful, that infringe third-party rights, that contain real-world violence, sexual content involving minors, targeted harassment, or deceptive deepfakes of real people presented as authentic are not allowed on the Platform. We may remove such works and, for serious or repeated violations, refuse further distribution of an author’s work.",
          ],
        },
        {
          heading: "Liability",
          body: [
            "To the fullest extent permitted by law, the Platform is not liable to a creator for indirect or consequential damages, and its total liability under this Agreement is limited to the fees the Platform actually received in connection with that creator’s marketplace listings in the twelve months before the claim (or zero, if none). Each party remains responsible for its own promises under this Agreement.",
          ],
        },
        {
          heading: "Changes",
          body: [
            "As the marketplace launches and develops, we may update this Agreement. Material changes that reduce your rights will be announced in advance on this page, and the “last updated” date will always show the current version. Keeping your work on the Platform after a change means you accept it.",
          ],
        },
      ]}
    />
  );
}
