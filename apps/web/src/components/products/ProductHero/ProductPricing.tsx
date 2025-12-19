import { fetchProductPricing } from '@/src/global/supabase/queries';

import PricingConfigurator from './PricingConfigurator';
import styles from './styles.module.scss';

interface ProductPricingProps {
  slug: string;
}

/**
 * Async server component that fetches pricing data from Supabase.
 * Designed to be wrapped in Suspense for streaming.
 */
export default async function ProductPricing({ slug }: ProductPricingProps) {
  const pricingData = await fetchProductPricing(slug);

  if (!pricingData) {
    return <span className={styles.price}>Brak ceny</span>;
  }

  return <PricingConfigurator pricingData={pricingData} />;
}
