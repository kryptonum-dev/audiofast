import {
  Button,
  Checkbox,
  Dialog,
  Flex,
  Stack,
  Text,
  TextInput,
} from '@sanity/ui';
import React, { useEffect, useState } from 'react';

interface ExistingSecondaryFeature {
  featureName: string;
}

interface AddSecondaryToVariantDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string, addGlobally: boolean) => void;
  initialName?: string;
  existingFeatures?: ExistingSecondaryFeature[];
  showGlobalOption?: boolean;
}

export function AddSecondaryToVariantDialog({
  open,
  onClose,
  onConfirm,
  initialName = '',
  existingFeatures = [],
  showGlobalOption = false,
}: AddSecondaryToVariantDialogProps) {
  const [featureName, setFeatureName] = useState(initialName);
  const [addGlobally, setAddGlobally] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (open) {
      setFeatureName(initialName);
      setAddGlobally(false); // Reset checkbox when dialog opens
      setNameError('');
    }
  }, [open, initialName]);

  const validateName = (name: string): string => {
    const trimmedName = name.trim();
    if (!trimmedName) return '';

    const duplicate = existingFeatures.find(
      (feature) =>
        feature.featureName.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) {
      return `Cecha o nazwie "${trimmedName}" już istnieje w tym wariancie`;
    }

    return '';
  };

  const handleNameChange = (value: string) => {
    setFeatureName(value);
    const error = validateName(value);
    setNameError(error);
  };

  const handleConfirm = () => {
    const name = featureName.trim();
    const error = validateName(name);

    if (error) {
      setNameError(error);
      return;
    }

    if (name && !error) {
      onConfirm(name, addGlobally);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && featureName.trim() && !nameError) {
      handleConfirm();
    }
  };

  if (!open) return null;

  return (
    <Dialog
      id="add-secondary-to-variant-dialog"
      header="Dodaj cechę do wariantu"
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
            disabled={!featureName.trim() || !!nameError}
            style={{ cursor: 'pointer' }}
          />
        </Flex>
      }>
      <Stack space={3} padding={4}>
        <Text>Nazwa nowej cechy:</Text>
        <TextInput
          value={featureName}
          onChange={(e) => handleNameChange(e.currentTarget.value)}
          placeholder="np. Długość, Kolor, Moc"
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
        {showGlobalOption && (
          <Flex align="center" gap={3}>
            <label
              htmlFor="add-globally-checkbox"
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
              <Checkbox
                id="add-globally-checkbox"
                checked={addGlobally}
                onChange={(e) => setAddGlobally(e.currentTarget.checked)}
              />
              <Text size={1} muted>
                Dodaj również do wszystkich innych wariantów (które nie mają już
                tej cechy)
              </Text>
            </label>
          </Flex>
        )}
      </Stack>
    </Dialog>
  );
}
