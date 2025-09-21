import { PageBuilder } from '../components/shared/PageBuilder';
import Button from '../components/ui/Button';
import { client } from '../global/sanity/client';
import { queryHomePage } from '../global/sanity/query';
import { getSEOMetadata } from '../global/seo';

async function fetchHomePageData() {
  return await client.fetch(queryHomePage);
}

export async function generateMetadata() {
  const homePageData = await fetchHomePageData();
  return getSEOMetadata(
    homePageData
      ? {
          seo: homePageData?.seo,
          slug: homePageData?.slug,
          openGraph: homePageData?.openGraph,
        }
      : {}
  );
}

export default async function Page() {
  const homePageData = await fetchHomePageData();

  return <PageBuilder pageBuilder={homePageData.pageBuilder} />;
}
