import { LaunchIcon, SearchIcon } from "@sanity/icons";
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Grid,
  Inline,
  Spinner,
  Stack,
  Text,
  TextInput,
} from "@sanity/ui";
import { type KeyboardEvent, useMemo, useState } from "react";

import { sanityAppConfig } from "../../config.js";
import type { AdminCouponProductOption } from "../types.js";
import { SanityThumbnail } from "./SanityThumbnail.js";

type CouponProductPickerProps = {
  disabled?: boolean;
  error: string | null;
  loading: boolean;
  products: AdminCouponProductOption[];
  selectedProductKeys: string[];
  onChange: (productKeys: string[]) => void;
};

export function CouponProductPicker({
  disabled = false,
  error,
  loading,
  onChange,
  products,
  selectedProductKeys,
}: CouponProductPickerProps) {
  const [search, setSearch] = useState("");
  const selectedKeys = useMemo(
    () => new Set(selectedProductKeys),
    [selectedProductKeys],
  );
  const selectedProductCount = products.filter((product) =>
    product.productKeys.every((productKey) => selectedKeys.has(productKey)),
  ).length;
  const filteredProducts = products.filter((product) =>
    [product.productName, product.brandName, product.productKey]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  function toggleProduct(product: AdminCouponProductOption) {
    const nextKeys = new Set(selectedProductKeys);
    const isSelected = product.productKeys.every((productKey) =>
      nextKeys.has(productKey),
    );

    for (const productKey of product.productKeys) {
      if (isSelected) {
        nextKeys.delete(productKey);
      } else {
        nextKeys.add(productKey);
      }
    }

    onChange(Array.from(nextKeys));
  }

  function clearSelection() {
    onChange([]);
  }

  return (
    <Card border padding={3} radius={2}>
      <Stack space={3}>
        <Flex align="center" justify="space-between" wrap="wrap">
          <Stack space={2}>
            <Text size={1} weight="medium">
              Produkty objęte kuponem
            </Text>
          </Stack>
          <Inline space={2}>
            <Badge fontSize={1} padding={2} tone="primary">
              {selectedProductCount} wybranych
            </Badge>
            <Badge fontSize={1} padding={2}>
              {products.length} dostępnych
            </Badge>
          </Inline>
        </Flex>

        <Grid columns={[1, 1, 2]} gap={3}>
          <TextInput
            disabled={disabled || loading}
            fontSize={1}
            icon={SearchIcon}
            onChange={(event) => setSearch(event.currentTarget.value)}
            padding={3}
            placeholder="Szukaj po nazwie, marce albo kluczu"
            radius={2}
            value={search}
          />
          <Flex align="center" justify="flex-end">
            <Button
              disabled={disabled || selectedProductKeys.length === 0}
              mode="ghost"
              onClick={clearSelection}
              text="Wyczyść wybór"
              type="button"
            />
          </Flex>
        </Grid>

        {loading ? (
          <Flex align="center" gap={3}>
            <Spinner muted />
            <Text muted size={1}>
              Ładowanie produktów z Sanity...
            </Text>
          </Flex>
        ) : null}

        {error ? (
          <Card padding={3} radius={2} tone="critical">
            <Text size={1}>{error}</Text>
          </Card>
        ) : null}

        {!loading && !error && filteredProducts.length === 0 ? (
          <Card padding={3} radius={2} tone="caution">
            <Text size={1}>
              Nie znaleziono pasujących produktów dostępnych do sprzedaży.
            </Text>
          </Card>
        ) : null}

        {!loading && !error && filteredProducts.length > 0 ? (
          <Box
            style={{
              maxHeight: 360,
              overflow: "auto",
            }}
          >
            <Stack space={2}>
              {filteredProducts.map((product) => {
                const isSelected = product.productKeys.every((productKey) =>
                  selectedKeys.has(productKey),
                );
                const productLabel = product.brandName
                  ? `${product.brandName} ${product.productName}`
                  : product.productName;

                return (
                  <Card
                    aria-pressed={isSelected}
                    border
                    key={product.id}
                    onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                      if (disabled) {
                        return;
                      }

                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleProduct(product);
                      }
                    }}
                    onClick={() => toggleProduct(product)}
                    padding={3}
                    radius={2}
                    role="button"
                    style={{
                      cursor: disabled ? "default" : "pointer",
                      textAlign: "left",
                      width: "100%",
                    }}
                    tabIndex={disabled ? -1 : 0}
                    tone={isSelected ? "primary" : "default"}
                  >
                    <Flex align="center" gap={3}>
                      <Checkbox checked={isSelected} readOnly />
                      <SanityThumbnail
                        alt={product.image?.alt ?? productLabel}
                        className="couponProductPickerImage"
                        height={44}
                        image={product.image}
                        placeholderClassName="couponProductPickerImagePlaceholder"
                        width={44}
                      />
                      <Stack space={2} flex={1}>
                        <Flex align="center" gap={2} wrap="wrap">
                          <Text size={1} weight="medium">
                            {productLabel}
                          </Text>
                          <Badge fontSize={1} padding={2}>
                            {product.lineType === "cpo" ? "CPO" : "Produkt"}
                          </Badge>
                        </Flex>
                      </Stack>
                      <Button
                        as="a"
                        href={buildSanityDocumentHref(product)}
                        icon={LaunchIcon}
                        mode="bleed"
                        onClick={(event) => event.stopPropagation()}
                        target="_blank"
                        text="Otwórz"
                      />
                    </Flex>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        ) : null}
      </Stack>
    </Card>
  );
}

function buildSanityDocumentHref(product: AdminCouponProductOption): string {
  const schemaType = product.lineType === "cpo" ? "cpoProduct" : "product";
  const documentId = encodeURIComponent(product.id);

  return `${sanityAppConfig.studioUrl}/intent/edit/id=${documentId};type=${schemaType}`;
}
