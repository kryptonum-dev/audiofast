import { BASE_URL } from '@/src/global/constants';

export type BreadcrumbItem = {
  name: string;
  path: string;
};

type Props = {
  data: BreadcrumbItem[];
};

export default function BreadcrumbsSchema({ data }: Props) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${BASE_URL}#breadcrumb`,
    itemListOrder: 'ItemListOrderAscending',
    numberOfItems: data.length,
    itemListElement: data.map(({ name, path }, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: name,
      item: `${BASE_URL}${path}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
