import Link from 'next/link';
import { Fragment } from 'react';

import type { BreadcrumbItem } from '@/src/components/schema/BreadcrumbsSchema';
import BreadcrumbsSchema from '@/src/components/schema/BreadcrumbsSchema';

import styles from './styles.module.scss';

type Props = {
  data: BreadcrumbItem[];
  firstItemType?: string;
};

export default function Breadcrumbs({ data = [], firstItemType }: Props) {
  const breadcrumbsData = [
    {
      name: 'Strona główna',
      path: '/',
    },

    ...data,
  ];

  const maxWidthClass =
    firstItemType && ['contactForm', 'imageWithVideo'].includes(firstItemType)
      ? 'max-width-block'
      : 'max-width';

  const theme = firstItemType === 'heroStatic' ? 'dark' : 'light';

  return (
    <>
      <BreadcrumbsSchema data={breadcrumbsData} />
      <nav
        className={`${styles.breadcrumbs} ${maxWidthClass}`}
        data-theme={theme}
        data-first-item-type={firstItemType}
      >
        {breadcrumbsData.map(({ name, path }, i) => {
          const isLastItem = i === breadcrumbsData.length - 1;
          const truncatedName =
            name.length > 40 ? name.slice(0, 40) + '...' : name;
          return (
            <Fragment key={i}>
              {!isLastItem ? (
                <Link href={path} className={styles.item}>
                  {truncatedName}
                </Link>
              ) : (
                <span className={styles.item}>{truncatedName}</span>
              )}
              {!isLastItem && <Chevron />}
            </Fragment>
          );
        })}
      </nav>
    </>
  );
}

const Chevron = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none">
    <g clipPath="url(#a)">
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m7.5 5 5 5-5 5"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="none" d="M0 0h20v20H0z" />
      </clipPath>
    </defs>
  </svg>
);
