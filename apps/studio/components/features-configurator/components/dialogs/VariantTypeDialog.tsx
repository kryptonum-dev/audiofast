// eslint-disable-next-line simple-import-sort/imports
import React, { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  Flex,
  Radio,
  Stack,
  Text,
  TextInput,
  Checkbox,
} from '@sanity/ui';

export type VariantKindChoice = 'text' | 'choice' | 'increment';

interface ExistingOption {
  label: string;
  value: string;
}

interface VariantTypeDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (
    kind: VariantKindChoice,
    name: string,
    addGlobally: boolean
  ) => void;
  showGlobalOption?: boolean;
  initialName?: string;
  existingOptions?: ExistingOption[];
}

export function VariantTypeDialog({
  open,
  onClose,
  onConfirm,
  showGlobalOption = false,
  initialName = '',
  existingOptions = [],
}: VariantTypeDialogProps) {
  const [selected, setSelected] = useState<VariantKindChoice>('text');
  const [variantName, setVariantName] = useState(initialName);
  const [addGlobally, setAddGlobally] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (open) {
      setVariantName(initialName);
      setAddGlobally(false); // Reset checkbox when dialog opens
      setNameError('');
    }
  }, [open, initialName]);

  const validateName = (name: string): string => {
    const trimmedName = name.trim();
    if (!trimmedName) return '';

    const duplicate = existingOptions.find(
      (option) => option.label.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) {
      return `Opcja o nazwie "${trimmedName}" już istnieje w tej cesze`;
    }

    return '';
  };

  const handleNameChange = (value: string) => {
    setVariantName(value);
    const error = validateName(value);
    setNameError(error);
  };

  const handleConfirm = () => {
    const name = variantName.trim() || 'Nowa opcja';
    const error = validateName(name);

    if (error) {
      setNameError(error);
      return;
    }

    if (name && !error) {
      onConfirm(selected, name, addGlobally);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && variantName.trim() && !nameError) {
      handleConfirm();
    }
  };

  if (!open) return null;

  return (
    <Dialog
      id="variant-type-dialog"
      header="Wybierz rodzaj wariantu"
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
            disabled={!variantName.trim() || !!nameError}
            style={{ cursor: 'pointer' }}
          />
        </Flex>
      }>
      <Stack space={4} padding={4}>
        <Text size={2} muted>
          Wybierz typ, który zdeterminuje pola edycji wariantu.
        </Text>

        <Text>Nazwa wariantu:</Text>
        <TextInput
          value={variantName}
          onChange={(e) => handleNameChange(e.currentTarget.value)}
          placeholder="np. Czarny, Mały, Podstawowy"
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

        <Stack space={2}>
          <label
            htmlFor="variant-kind-text"
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
            <Radio
              id="variant-kind-text"
              name="variant-kind"
              value="text"
              checked={selected === 'text'}
              onChange={() => setSelected('text')}
            />
            <Text>Tekst (stała cena)</Text>
          </label>
          <label
            htmlFor="variant-kind-choice"
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
            <Radio
              id="variant-kind-choice"
              name="variant-kind"
              value="choice"
              checked={selected === 'choice'}
              onChange={() => setSelected('choice')}
            />
            <Text>Wybór (lista podrzędnych opcji)</Text>
          </label>
          <label
            htmlFor="variant-kind-increment"
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
            <Radio
              id="variant-kind-increment"
              name="variant-kind"
              value="increment"
              checked={selected === 'increment'}
              onChange={() => setSelected('increment')}
            />
            <Text>Inkrementalny (np. długość)</Text>
          </label>
        </Stack>

        {showGlobalOption && (
          <Flex align="center" gap={3}>
            <label
              htmlFor="add-variant-globally"
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
              <Checkbox
                id="add-variant-globally"
                checked={addGlobally}
                onChange={(e) => setAddGlobally(e.currentTarget.checked)}
              />
              <Text size={1} muted>
                Dodaj również do wszystkich innych wariantów głównych (które nie
                mają już tej cechy lub wariantu)
              </Text>
            </label>
          </Flex>
        )}
      </Stack>
    </Dialog>
  );
}

export default VariantTypeDialog;
