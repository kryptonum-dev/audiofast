import { Button, Dialog, Flex, Stack, Text, TextInput } from '@sanity/ui';
import React, { useEffect, useState } from 'react';

interface ExistingVariant {
  label: string;
  value: string;
}

interface AddPrimaryVariantDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string, price: number) => void;
  initialName?: string;
  initialPrice?: number;
  existingVariants?: ExistingVariant[];
}

export function AddPrimaryVariantDialog({
  open,
  onClose,
  onConfirm,
  initialName = '',
  initialPrice = 0,
  existingVariants = [],
}: AddPrimaryVariantDialogProps) {
  const [variantName, setVariantName] = useState(initialName);
  const [variantPrice, setVariantPrice] = useState(initialPrice);
  const [nameError, setNameError] = useState('');
  const [priceError, setPriceError] = useState('');

  useEffect(() => {
    if (open) {
      setVariantName(initialName);
      setVariantPrice(initialPrice);
      setNameError('');
      setPriceError('');
    }
  }, [open, initialName, initialPrice]);

  const validateName = (name: string): string => {
    const trimmedName = name.trim();
    if (!trimmedName) return '';

    const duplicate = existingVariants.find(
      (variant) => variant.label.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) {
      return `Wariant o nazwie "${trimmedName}" już istnieje`;
    }

    return '';
  };

  const validatePrice = (value: string): string => {
    if (value.trim() === '') return 'Cena jest wymagana';

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return 'Cena musi być prawidłową liczbą';
    }

    return '';
  };

  const handleNameChange = (value: string) => {
    setVariantName(value);
    const error = validateName(value);
    setNameError(error);
  };

  const handlePriceChange = (value: string) => {
    const error = validatePrice(value);
    setPriceError(error);

    // Only update the price if it's a valid number or empty
    const numValue = parseFloat(value);
    if (!error && !isNaN(numValue)) {
      setVariantPrice(numValue);
    } else if (value.trim() === '') {
      setVariantPrice(0);
    }
  };

  const handleConfirm = () => {
    const name = variantName.trim();
    const nameError = validateName(name);
    const priceError = validatePrice(variantPrice.toString());

    if (nameError) {
      setNameError(nameError);
      return;
    }

    if (priceError) {
      setPriceError(priceError);
      return;
    }

    if (name && !nameError && !priceError) {
      onConfirm(name, variantPrice);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && variantName.trim() && !nameError && !priceError) {
      handleConfirm();
    }
  };

  if (!open) return null;

  return (
    <Dialog
      id="add-primary-variant-dialog"
      header="Dodaj wariant główny"
      onClose={onClose}
      footer={
        <Flex gap={2} justify="flex-end">
          <Button
            text="Anuluj"
            mode="ghost"
            onClick={onClose}
            style={{ cursor: 'pointer' }}
          />
          <Button
            text="Dodaj"
            tone="primary"
            onClick={handleConfirm}
            disabled={!variantName.trim() || !!nameError || !!priceError}
            style={{ cursor: 'pointer' }}
          />
        </Flex>
      }>
      <Stack space={3} padding={4}>
        <Text>Wprowadź nazwę nowego wariantu:</Text>
        <TextInput
          value={variantName}
          onChange={(e) => handleNameChange(e.currentTarget.value)}
          placeholder="np. Standard, Long, Custom"
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            borderColor: nameError ? '#db4437' : undefined,
          }}
        />
        {nameError && (
          <Text size={1} style={{ marginTop: '4px', color: '#db4437' }}>
            {nameError}
          </Text>
        )}
        <Text>Wprowadź cenę bazową (PLN):</Text>
        <TextInput
          type="number"
          value={variantPrice.toString()}
          onChange={(e) => handlePriceChange(e.currentTarget.value)}
          placeholder="0.00"
          step={0.01}
          style={{
            borderColor: priceError ? '#db4437' : undefined,
          }}
        />
        {priceError && (
          <Text size={1} style={{ marginTop: '4px', color: '#db4437' }}>
            {priceError}
          </Text>
        )}
      </Stack>
    </Dialog>
  );
}
