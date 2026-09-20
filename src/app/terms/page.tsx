import type { Metadata } from "next";
import LegalShell from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The rules for using no reality.: a curated feed of AI video and an upcoming marketplace of prompts and instructions. We distribute — creators own.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "September 11, 2026";

export default function TermsPage() {
  return (
    <LegalShell
      kicker="legal"
      title="Terms of Service"
      updated={UPDATED}
      intro="These Terms of Service (“Terms”) govern your access to and use of no reality. (the “Platform”), including our feed of AI-generated videos and, as it launches, our marketplace of prompts and instructions. By browsing, watching, sharing or otherwise using the Platform you agree to be bound by these Terms. If you do not agree, please do not use the Platform."
      contactName="Contact"
      contactHandle="@your_betfriend"
      sections={[
        {
          heading: "About the Platform",
          body: [
            "no reality. is an independent curation and distribution platform. We display a feed of AI-generated videos that were originally shared publicly by their creators on third-party services (such as Threads), together with attribution to the original author wherever technically possible.",
            "We are developing a marketplace where creators can offer prompts, instructions and related know-how to other users. In everything we publish or will publish, our role is strictly that of a distributor and intermediary: we do not produce, commission, edit or own the works made available through the Platform.",
          ],
        },
        {
          heading: "Ownership of Content — Rights Stay With the Authors",
          body: [
            "All videos, prompts, instructions, titles, descriptions and other materials displayed on the Platform remain the exclusive intellectual property of their respective authors. Nothing in these Terms, and nothing you do on the Platform, transfers any ownership rights from an author to us or to you.",
            "We claim no authorship of any third-party work. Any trademarks, handles or names shown on the Platform belong to their owners and are used solely for identification and attribution purposes.",
            "Unless a creator grants you broader rights (for example, through the terms of a marketplace listing), you receive only a personal, non-exclusive, non-transferable right to view the content on the Platform and to use its sharing features. Any commercial use, re-upload, derivative work or redistribution of a creator’s work requires that creator’s separate permission.",
          ],
        },
        {
          heading: "The Marketplace of Prompts and Instructions",
          body: [
            "The marketplace will allow creators to list prompts, workflows and instructions for discovery, purchase and delivery through the Platform. Listings are created, described and supported by the creators who publish them; the Platform facilitates presentation, checkout and delivery but does not itself generate, test or warrant the results any prompt or instruction may produce.",
            "When you acquire a prompt or instruction through the marketplace, the licence you receive is the one granted by the selling creator on the listing page. The Platform takes no commission in rights: a purchase never makes the Platform an owner or co-author of the item.",
            "Because transactions happen between you and the selling creator, disputes about quality, suitability or expected results should be raised with the creator first. We may step in to moderate listings that violate these Terms or the rights of others.",
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
            "Links from the Platform to third-party sites (including a creator’s profile or a marketplace listing) are provided for convenience; we do not control and are not responsible for their content.",
          ],
        },
        {
          heading: "Disclaimer of Warranties",
          body: [
            "The Platform is provided on an “as is” and “as available” basis. To the fullest extent permitted by law we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose and non-infringement. We do not warrant that the feed will be uninterrupted, error-free, or that any particular video, prompt or instruction will remain available.",
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
            "We may update these Terms as the Platform evolves — in particular as the marketplace of prompts and instructions launches and matures. The “last updated” date above always reflects the current version. Continued use of the Platform after an update constitutes acceptance of the revised Terms.",
          ],
        },
      ]}
    />
  );
}
