import { BASE_URL } from "@/src/global/constants";
import type { PagebuilderType } from "@/src/global/types";
import { portableTextToHtml } from "@/src/global/utils";

type FaqSchemaProps = NonNullable<PagebuilderType<"faqSection">["faqList"]>;

/**
 * FAQ Schema Component
 *
 * Implements schema.org/FAQPage structured data for better SEO and rich results in search engines.
 * Each question/answer pair becomes a Question entity with an acceptedAnswer.
 * The answer is converted from Portable Text to HTML with proper semantic markup.
 *
 * @see https://schema.org/FAQPage
 * @see https://developers.google.com/search/docs/appearance/structured-data/faqpage
 */
export default function FaqSchema({ faqList }: { faqList: FaqSchemaProps }) {
  if (!faqList || faqList.length === 0) {
    return null;
  }

  // Filter out invalid FAQ items and convert to schema format
  const mainEntity = faqList
    .filter((faq) => faq.question && faq.answer)
    .map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: portableTextToHtml(faq.answer),
      },
    }));

  // Don't render if no valid FAQ items
  if (mainEntity.length === 0) {
    return null;
  }

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${BASE_URL}#faq`,
    mainEntity,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
