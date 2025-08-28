import React, { useState, useEffect } from 'react';
import { Button, Dialog, Flex, Stack, Text, TextInput } from '@sanity/ui';

interface ExistingSecondaryFeature {
  featureName: string;
}

interface AddSecondaryFeatureDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  initialName?: string;
  existingFeatures?: ExistingSecondaryFeature[];
}

export function AddSecondaryFeatureDialog({
  open,
  onClose,
  onConfirm,
  initialName = '',
  existingFeatures = [],
}: AddSecondaryFeatureDialogProps) {
  const [featureName, setFeatureName] = useState(initialName);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (open) {
      setFeatureName(initialName);
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
      return `Cecha o nazwie "${trimmedName}" już istnieje`;
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
      onConfirm(name);
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
      id="add-secondary-dialog"
      header="Dodaj cechę"
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
          placeholder="np. Długość, Kolor"
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
      </Stack>
    </Dialog>
  );
}
