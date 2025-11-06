'use client';

import Button from '../Button';

interface ProductHeroButtonsProps {
  className?: string;
}

export default function ProductHeroButtons({
  className,
}: ProductHeroButtonsProps) {
  // Handle "Zobacz w salonie" button - scroll to store locations
  const handleViewInStore = () => {
    const storeSection = document.getElementById('gdzie-kupic');
    if (storeSection) {
      storeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className={className}>
      <Button text="Zapytaj o produkt" variant="primary" href="/#kontakt" />
      <Button
        text="Zobacz w salonie"
        variant="secondary"
        href={null}
        onClick={handleViewInStore}
      />
    </div>
  );
}
