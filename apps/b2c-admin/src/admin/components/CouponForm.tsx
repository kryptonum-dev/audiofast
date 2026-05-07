import {
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Grid,
  Label,
  Select,
  Stack,
  Text,
  TextInput,
} from "@sanity/ui";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import type {
  AdminCouponDiscountType,
  AdminCouponMutationInput,
  AdminCouponProductOption,
} from "../types.js";
import { CouponProductPicker } from "./CouponProductPicker.js";

export type CouponFormValues = {
  code: string;
  discountType: AdminCouponDiscountType;
  discountValuePln: string;
  discountPercent: string;
  selectedProductKeys: string[];
  usageLimit: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
};

type CouponFormProps = {
  disabled?: boolean;
  initialValues?: CouponFormValues;
  productOptions: AdminCouponProductOption[];
  productOptionsError?: string | null;
  productOptionsLoading?: boolean;
  submitText: string;
  onDirtyChange?: (isDirty: boolean) => void;
  onSubmit: (input: AdminCouponMutationInput) => void;
};

const DEFAULT_FORM_VALUES: CouponFormValues = {
  code: "",
  discountType: "fixed_order",
  discountValuePln: "",
  discountPercent: "",
  selectedProductKeys: [],
  usageLimit: "",
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

export function CouponForm({
  disabled = false,
  initialValues = DEFAULT_FORM_VALUES,
  onDirtyChange,
  onSubmit,
  productOptions,
  productOptionsError = null,
  productOptionsLoading = false,
  submitText,
}: CouponFormProps) {
  const [values, setValues] = useState<CouponFormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const isFixedDiscount = values.discountType.startsWith("fixed");
  const isProductScoped = values.discountType.endsWith("_product");
  const earliestDateTime = getTodayDateTimeInputMin();
  const expiryDateTimeMin = values.startsAt || earliestDateTime;

  useEffect(() => {
    onDirtyChange?.(!areCouponFormValuesEqual(values, initialValues));
  }, [initialValues, onDirtyChange, values]);

  function updateValue<TKey extends keyof CouponFormValues>(
    key: TKey,
    value: CouponFormValues[TKey],
  ) {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const input = buildCouponInput(values);

      setError(null);
      onSubmit(input);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Nie udało się przygotować danych kuponu.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack space={4}>
        {error ? (
          <Card border padding={3} radius={2} tone="critical">
            <Text size={1}>{error}</Text>
          </Card>
        ) : null}

        <Card padding={4} radius={2}>
          <Stack space={4}>
            <Grid columns={[1, 1, 2]} gap={4}>
              <Field label="Kod kuponu">
                <TextInput
                  disabled={disabled}
                  fontSize={1}
                  onChange={(event) =>
                    updateValue("code", event.currentTarget.value)
                  }
                  padding={3}
                  placeholder="AUDIO100"
                  radius={2}
                  value={values.code}
                />
              </Field>

              <Field label="Typ rabatu">
                <Select
                  disabled={disabled}
                  fontSize={1}
                  onChange={(event) =>
                    updateValue(
                      "discountType",
                      event.currentTarget.value as AdminCouponDiscountType,
                    )
                  }
                  padding={3}
                  radius={2}
                  value={values.discountType}
                >
                  <option value="fixed_order">Kwota na koszyk</option>
                  <option value="fixed_product">Kwota na produkty</option>
                  <option value="percent_order">% na koszyk</option>
                  <option value="percent_product">% na produkty</option>
                </Select>
              </Field>

              {isFixedDiscount ? (
                <Field label="Kwota rabatu">
                  <TextInput
                    disabled={disabled}
                    fontSize={1}
                    onChange={(event) =>
                      updateValue("discountValuePln", event.currentTarget.value)
                    }
                    padding={3}
                    placeholder="100.00"
                    radius={2}
                    suffix={<InputSuffix label="PLN" />}
                    step="0.01"
                    type="number"
                    value={values.discountValuePln}
                  />
                </Field>
              ) : (
                <Field label="Procent rabatu">
                  <TextInput
                    disabled={disabled}
                    fontSize={1}
                    max={100}
                    min={1}
                    onChange={(event) =>
                      updateValue("discountPercent", event.currentTarget.value)
                    }
                    padding={3}
                    placeholder="15"
                    radius={2}
                    step={1}
                    suffix={<InputSuffix label="%" />}
                    type="number"
                    value={values.discountPercent}
                  />
                </Field>
              )}

              <Field label="Limit użyć">
                <TextInput
                  disabled={disabled}
                  fontSize={1}
                  min={1}
                  onChange={(event) =>
                    updateValue("usageLimit", event.currentTarget.value)
                  }
                  padding={3}
                  placeholder="Bez limitu"
                  radius={2}
                  step={1}
                  type="number"
                  value={values.usageLimit}
                />
              </Field>

              <Field label="Aktywny od">
                <TextInput
                  disabled={disabled}
                  fontSize={1}
                  min={earliestDateTime}
                  onChange={(event) =>
                    updateValue("startsAt", event.currentTarget.value)
                  }
                  padding={3}
                  radius={2}
                  type="datetime-local"
                  value={values.startsAt}
                />
              </Field>

              <Field label="Wygasa">
                <TextInput
                  disabled={disabled}
                  fontSize={1}
                  min={expiryDateTimeMin}
                  onChange={(event) =>
                    updateValue("expiresAt", event.currentTarget.value)
                  }
                  padding={3}
                  radius={2}
                  type="datetime-local"
                  value={values.expiresAt}
                />
              </Field>
            </Grid>

            {isProductScoped ? (
              <CouponProductPicker
                disabled={disabled}
                error={productOptionsError}
                loading={productOptionsLoading}
                products={productOptions}
                selectedProductKeys={values.selectedProductKeys}
                onChange={(productKeys) =>
                  updateValue("selectedProductKeys", productKeys)
                }
              />
            ) : null}

            <Card border padding={3} radius={2}>
              <Flex align="center" gap={3}>
                <Checkbox
                  checked={values.isActive}
                  disabled={disabled}
                  onChange={(event) =>
                    updateValue("isActive", event.currentTarget.checked)
                  }
                />
                <Stack space={2}>
                  <Text size={1} weight="medium">
                    Kupon aktywny
                  </Text>
                  <Text muted size={1}>
                    Nieaktywny kupon pozostaje w administracji, ale nie działa w
                    koszyku.
                  </Text>
                </Stack>
              </Flex>
            </Card>
          </Stack>
        </Card>

        <Flex justify="flex-end">
          <Button
            disabled={disabled}
            mode="default"
            text={submitText}
            tone="primary"
            type="submit"
          />
        </Flex>
      </Stack>
    </form>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Box>
      <Label muted size={1}>
        {label}
      </Label>
      <Box marginTop={2}>{children}</Box>
    </Box>
  );
}

function InputSuffix({ label }: { label: string }) {
  return <span className="couponDiscountInputSuffix">{label}</span>;
}

function buildCouponInput(values: CouponFormValues): AdminCouponMutationInput {
  const code = values.code.trim();
  const isProductScoped = values.discountType.endsWith("_product");
  const productKeys = isProductScoped
    ? Array.from(new Set(values.selectedProductKeys.map((key) => key.trim())))
        .filter(Boolean)
        .sort()
    : [];
  const todayStart = getTodayStart();
  const startsAt = parseDateTime(values.startsAt, "Aktywny od");
  const expiresAt = parseDateTime(values.expiresAt, "Wygasa");
  const usageLimit = parseOptionalPositiveInteger(
    values.usageLimit,
    "Limit użyć",
  );

  if (!code) {
    throw new Error("Kod kuponu jest wymagany.");
  }

  if (isProductScoped && productKeys.length === 0) {
    throw new Error(
      "Kupon produktowy wymaga wyboru co najmniej jednego produktu.",
    );
  }

  if (startsAt && Date.parse(startsAt) < todayStart.getTime()) {
    throw new Error("Data startu nie może być wcześniejsza niż dzisiaj.");
  }

  if (expiresAt && Date.parse(expiresAt) < todayStart.getTime()) {
    throw new Error("Data wygaśnięcia nie może być wcześniejsza niż dzisiaj.");
  }

  if (startsAt && expiresAt && Date.parse(startsAt) >= Date.parse(expiresAt)) {
    throw new Error("Data startu musi być wcześniejsza niż data wygaśnięcia.");
  }

  if (values.discountType.startsWith("fixed")) {
    return {
      code,
      discountType: values.discountType,
      discountValueCents: parseMoneyToCents(values.discountValuePln),
      discountPercent: null,
      productKeys,
      usageLimit,
      startsAt,
      expiresAt,
      isActive: values.isActive,
    };
  }

  return {
    code,
    discountType: values.discountType,
    discountValueCents: null,
    discountPercent: parsePercent(values.discountPercent),
    productKeys,
    usageLimit,
    startsAt,
    expiresAt,
    isActive: values.isActive,
  };
}

function parseMoneyToCents(value: string): number {
  const normalized = value.trim().replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Kwota rabatu musi być większa od 0.");
  }

  return Math.round(amount * 100);
}

function parsePercent(value: string): number {
  const percent = Number(value.trim());

  if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
    throw new Error("Procent rabatu musi być liczbą od 1 do 100.");
  }

  return percent;
}

function parseOptionalPositiveInteger(
  value: string,
  label: string,
): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} musi być liczbą całkowitą większą od 0.`);
  }

  return parsed;
}

function parseDateTime(value: string, label: string): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} musi być poprawną datą.`);
  }

  return parsed.toISOString();
}

function getTodayStart(): Date {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getTodayDateTimeInputMin(): string {
  const today = getTodayStart();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}T00:00`;
}

function areCouponFormValuesEqual(
  left: CouponFormValues,
  right: CouponFormValues,
): boolean {
  return (
    left.code === right.code &&
    left.discountType === right.discountType &&
    left.discountValuePln === right.discountValuePln &&
    left.discountPercent === right.discountPercent &&
    areStringArraysEqual(left.selectedProductKeys, right.selectedProductKeys) &&
    left.usageLimit === right.usageLimit &&
    left.startsAt === right.startsAt &&
    left.expiresAt === right.expiresAt &&
    left.isActive === right.isActive
  );
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return sortedLeft.every((item, index) => item === sortedRight[index]);
}
