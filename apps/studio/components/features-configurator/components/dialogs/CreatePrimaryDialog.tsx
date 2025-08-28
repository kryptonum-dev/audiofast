import { Button, Dialog, Flex, Stack, Text, TextInput } from '@sanity/ui';
import React, { useEffect, useState } from 'react';

interface CreatePrimaryDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  initialName?: string;
}

export function CreatePrimaryDialog({
  open,
  onClose,
  onConfirm,
  initialName = '',
}: CreatePrimaryDialogProps) {
  const [featureName, setFeatureName] = useState(initialName);

  useEffect(() => {
    if (open) {
      setFeatureName(initialName);
    }
  }, [open, initialName]);

  const handleConfirm = () => {
    const name = featureName.trim() || 'Cecha główna';
    onConfirm(name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && featureName.trim()) {
      handleConfirm();
    }
  };

  if (!open) return null;

  return (
    <Dialog
      id="create-primary-dialog"
      header="Dodaj główną cechę"
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
            disabled={!featureName.trim()}
            style={{ cursor: 'pointer' }}
          />
        </Flex>
      }>
      <Stack space={3} padding={4}>
        <Text>Wprowadź nazwę nowej głównej cechy:</Text>
        <TextInput
          value={featureName}
          onChange={(e) => setFeatureName(e.currentTarget.value)}
          placeholder="np. Rozmiar, Kolor, Wersja"
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </Stack>
    </Dialog>
  );
}
