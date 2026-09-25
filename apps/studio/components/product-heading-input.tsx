import { Card, Stack, Text } from '@sanity/ui';
import { useEffect, useState } from 'react';
import { type ObjectInputProps, useClient, useFormValue } from 'sanity';

type HeadingOverride = {
  _type?: string;
  upper?: string;
  lower?: string;
};

export function ProductHeadingInput(props: ObjectInputProps<HeadingOverride>) {
  const client = useClient({ apiVersion: '2025-02-19' });
  const name = useFormValue(['name']) as string | undefined;
  const brandRef = useFormValue(['brand', '_ref']) as string | undefined;
  const [brand, setBrand] = useState<{
    ref: string;
    name: string | null;
  } | null>(null);

  useEffect(() => {
    if (!brandRef) return;
    let active = true;

    client
      .fetch<string | null>(
        '*[_id == $id][0].name',
        { id: brandRef.replace(/^drafts\./, '') },
        { perspective: 'drafts' },
      )
      .then((brandName) => {
        if (active) setBrand({ ref: brandRef, name: brandName });
      })
      .catch(() => {
        if (active) setBrand({ ref: brandRef, name: null });
      });

    return () => {
      active = false;
    };
  }, [brandRef, client]);

  const brandName = brand?.ref === brandRef ? brand?.name : undefined;
  const upper = props.value?.upper?.trim() || brandName?.trim();
  const lower = props.value?.lower?.trim() || name?.trim();
  const needsBrand = !props.value?.upper?.trim() && !!brandRef;
  const preview = [upper, lower].filter(Boolean).join(' ');

  return (
    <Stack space={4}>
      {props.renderDefault(props)}
      <Card padding={3} border radius={2}>
        <Stack space={3}>
          <Text size={1} weight="semibold">
            Wynikowy nagłówek H1
          </Text>
          <Text size={1}>
            {needsBrand && !brandName
              ? brandName === undefined
                ? 'Ładowanie nazwy marki…'
                : 'Nie udało się odczytać nazwy marki do podglądu.'
              : preview || 'Uzupełnij markę i nazwę produktu.'}
          </Text>
          <Text size={1} muted>
            Na stronie górna i dolna część mają dotychczasowy wygląd i są
            wyświetlane jedna pod drugą.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
