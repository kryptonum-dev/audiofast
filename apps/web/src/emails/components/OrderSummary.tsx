import { Hr, Section, Text } from '@react-email/components';
import * as React from 'react';

export type OrderSummaryItem = {
  id: string;
  brandName: string;
  productName: string;
  quantity: number;
  lineTotalCents: number;
  details: string[];
};

type OrderSummaryProps = {
  title: string;
  items: OrderSummaryItem[];
  subtotalCents: number;
  discountTotalCents: number;
  grandTotalCents: number;
};

export function OrderSummary({
  title,
  items,
  subtotalCents,
  discountTotalCents,
  grandTotalCents,
}: OrderSummaryProps) {
  return (
    <Section style={section}>
      <Text style={sectionEyebrow}>{title}</Text>
      {items.map((item, index) => (
        <Section key={item.id} style={itemCard}>
          <Text style={itemBrand}>{item.brandName}</Text>
          <Text style={itemName}>
            {item.productName} x{item.quantity}
          </Text>
          {item.details.map((detail) => (
            <Text key={`${item.id}-${detail}`} style={itemDetail}>
              {detail}
            </Text>
          ))}
          <Text style={itemTotal}>{formatCurrency(item.lineTotalCents)}</Text>
          {index < items.length - 1 ? <Hr style={itemDivider} /> : null}
        </Section>
      ))}
      <Section style={totalsCard}>
        <Section style={totalRow}>
          <Text style={totalLabel}>Suma produktów</Text>
          <Text style={totalValue}>{formatCurrency(subtotalCents)}</Text>
        </Section>
        {discountTotalCents > 0 ? (
          <Section style={totalRow}>
            <Text style={totalLabel}>Rabat</Text>
            <Text style={discountValue}>
              -{formatCurrency(discountTotalCents)}
            </Text>
          </Section>
        ) : null}
        <Hr style={totalsDivider} />
        <Section style={totalRow}>
          <Text style={grandTotalLabel}>Do zapłaty</Text>
          <Text style={grandTotalValue}>{formatCurrency(grandTotalCents)}</Text>
        </Section>
      </Section>
    </Section>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  }).format(value / 100);
}

const section = {
  padding: '0 32px 32px',
};

const sectionEyebrow = {
  fontSize: '12px',
  color: '#808080',
  textTransform: 'uppercase' as const,
  fontWeight: '600',
  letterSpacing: '0.06em',
  margin: '0 0 12px',
};

const itemCard = {
  backgroundColor: '#f8f8f8',
  border: '1px solid #e7e7e7',
  borderRadius: '14px',
  padding: '20px 18px',
  margin: '0 0 12px',
};

const itemBrand = {
  fontSize: '12px',
  color: '#808080',
  textTransform: 'uppercase' as const,
  fontWeight: '600',
  letterSpacing: '0.06em',
  margin: '0 0 4px',
};

const itemName = {
  fontSize: '16px',
  lineHeight: '1.4',
  color: '#303030',
  fontWeight: '600',
  margin: '0 0 8px',
};

const itemDetail = {
  fontSize: '13px',
  lineHeight: '1.5',
  color: '#5b5a5a',
  margin: '0 0 4px',
};

const itemTotal = {
  fontSize: '15px',
  lineHeight: '1.4',
  color: '#303030',
  fontWeight: '600',
  margin: '14px 0 0',
};

const itemDivider = {
  borderColor: '#e7e7e7',
  margin: '20px 0 0',
};

const totalsCard = {
  backgroundColor: '#f7f3f3',
  border: '1px solid #e7e7e7',
  borderRadius: '14px',
  padding: '20px 18px',
};

const totalRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  margin: '0 0 8px',
};

const totalLabel = {
  fontSize: '14px',
  color: '#5b5a5a',
  margin: '0',
};

const totalValue = {
  fontSize: '14px',
  color: '#303030',
  fontWeight: '500',
  margin: '0',
  textAlign: 'left' as const,
};

const discountValue = {
  ...totalValue,
  color: '#5b5a5a',
};

const totalsDivider = {
  borderColor: '#e7e7e7',
  margin: '12px 0',
};

const grandTotalLabel = {
  fontSize: '15px',
  color: '#303030',
  fontWeight: '600',
  margin: '0',
};

const grandTotalValue = {
  fontSize: '18px',
  color: '#303030',
  fontWeight: '700',
  margin: '0',
  textAlign: 'right' as const,
};
