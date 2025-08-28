import React from 'react';
import { Button, Dialog, Flex, Stack, Text } from '@sanity/ui';

interface ApplyTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  templateVariantName: string;
  targetVariantsCount: number;
}

export function ApplyTemplateDialog({
  open,
  onClose,
  onConfirm,
  templateVariantName,
  targetVariantsCount,
}: ApplyTemplateDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog
      id="apply-template-dialog"
      header="Zastosuj szablon"
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
            text="Zastosuj do wszystkich"
            tone="primary"
            onClick={handleConfirm}
            style={{ cursor: 'pointer' }}
          />
        </Flex>
      }>
      <Stack space={3} padding={4}>
        <Text>
          Czy chcesz zastosować cechy pomocnicze z wariantu "
          {templateVariantName}" do wszystkich pozostałych wariantów?
        </Text>
        <Text size={1} muted>
          Ta akcja skopiuje wszystkie cechy pomocnicze ({targetVariantsCount}{' '}
          wariantów zostanie zaktualizowanych). Istniejące cechy w innych
          wariantach zostaną nadpisane.
        </Text>
      </Stack>
    </Dialog>
  );
}
