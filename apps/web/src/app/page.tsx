import Button from '../components/ui/Button';
import { sanityFetch } from '../global/sanity/live';
import { queryHomePage } from '../global/sanity/query';
import { getSEOMetadata } from '../global/seo';

async function fetchHomePageData() {
  return await sanityFetch({
    query: queryHomePage,
  });
}

export async function generateMetadata() {
  const { data: homePageData } = await fetchHomePageData();
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
  const { data: homePageData } = await fetchHomePageData();

  console.log(homePageData.pageBuilder[0].buttons);

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        margin: '40px auto',
        padding: '40px',
      }}
    >
      <h1 style={{ marginBottom: '40px' }}>Hello World</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Button>Przykładowy button</Button>
        <Button variant="secondary">Przykładowy button</Button>
      </div>
    </section>
  );
}
