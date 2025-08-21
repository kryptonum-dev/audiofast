import { defineLocations } from 'sanity/presentation';

export const locations = {
  blog: defineLocations({
    select: {
      slug: 'slug.current',
      name: 'name',
    },
    resolve: (doc) => {
      console.log(doc);
      return {
        locations: [
          {
            title: doc?.name || 'Untitled',
            href: `${doc?.slug}`,
          },
          {
            title: 'Blog',
            href: '/blog',
          },
        ],
      };
    },
  }),
  home: defineLocations({
    select: {
      title: 'title',
      slug: 'slug.current',
    },
    resolve: () => {
      return {
        locations: [
          {
            title: 'Strona główna',
            href: '/',
          },
        ],
      };
    },
  }),
  page: defineLocations({
    select: {
      slug: 'slug.current',
      name: 'name',
    },
    resolve: (doc) => {
      return {
        locations: [
          {
            title: doc?.name || 'Untitled',
            href: `${doc?.slug}`,
          },
        ],
      };
    },
  }),
};
