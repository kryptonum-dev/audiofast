import React from 'react';
import PortableText from 'react-portable-text';

type Props = {
  value: unknown[];
  className?: string;
  headingLevel?: 'h1' | 'h2' | 'h3' | 'h4';
};

export function PortableTextRenderer({
  value,
  className,
  headingLevel,
}: Props) {
  if (!value) return null;

  const serializers = {
    // Render all "normal" blocks as either a paragraph or a heading tag
    normal: ({ children }: { children: React.ReactNode }) => {
      const Tag = (headingLevel || 'p') as React.ElementType;
      return <Tag className={className}>{children}</Tag>;
    },
  } as const;

  return (
    <PortableText
      content={value as object[]}
      serializers={serializers as unknown as Record<string, unknown>}
      projectId={process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}
      dataset={process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'}
    />
  );
}

export default PortableTextRenderer;
