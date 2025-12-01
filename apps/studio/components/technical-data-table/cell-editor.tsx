'use client';

import { LinkIcon } from '@sanity/icons';
import {
  PortableTextEditable,
  PortableTextEditor,
  type PortableTextEditableProps,
  type RenderAnnotationFunction,
  type RenderBlockFunction,
  type RenderChildFunction,
  type RenderDecoratorFunction,
  type RenderListItemFunction,
  type RenderStyleFunction,
} from '@sanity/portable-text-editor';
import { Box, Button, Card, Flex, Stack, Text, TextInput } from '@sanity/ui';
import { useCallback, useMemo, useState } from 'react';
import type { PortableTextBlock } from 'sanity';

import { generateKey } from './types';

type CellEditorProps = {
  initialContent: PortableTextBlock[];
  onSave: (content: PortableTextBlock[]) => void;
  onCancel: () => void;
};

// Schema type definition for the Portable Text editor
const CELL_SCHEMA_TYPE = {
  name: 'cellContent',
  type: 'array' as const,
  of: [
    {
      name: 'block',
      type: 'block' as const,
      styles: [{ title: 'Normal', value: 'normal' as const }],
      lists: [
        { title: 'Bullet', value: 'bullet' as const },
        { title: 'Number', value: 'number' as const },
      ],
      marks: {
        decorators: [
          { title: 'Bold', value: 'strong' as const },
          { title: 'Italic', value: 'em' as const },
        ],
        annotations: [
          {
            name: 'link',
            type: 'object' as const,
            title: 'Link',
            icon: LinkIcon,
            fields: [
              {
                name: 'href',
                type: 'url' as const,
                title: 'URL',
              },
              {
                name: 'blank',
                type: 'boolean' as const,
                title: 'Open in new tab',
                initialValue: true,
              },
            ],
          },
        ],
      },
      children: [{ name: 'span', type: 'span' as const }],
    },
  ],
};

// Render functions for the Portable Text editor
const renderBlock: RenderBlockFunction = (props) => {
  const { children, value } = props;
  const style = value.style || 'normal';

  if (style === 'normal') {
    return (
      <p style={{ margin: '0.5em 0', lineHeight: 1.5 }}>{children}</p>
    );
  }

  return <p style={{ margin: '0.5em 0' }}>{children}</p>;
};

const renderChild: RenderChildFunction = (props) => {
  return <>{props.children}</>;
};

const renderDecorator: RenderDecoratorFunction = (props) => {
  const { children, value } = props;

  switch (value) {
    case 'strong':
      return <strong>{children}</strong>;
    case 'em':
      return <em>{children}</em>;
    default:
      return <>{children}</>;
  }
};

const renderAnnotation: RenderAnnotationFunction = (props) => {
  const { children, value } = props;

  if (value._type === 'link') {
    return (
      <span
        style={{
          color: 'var(--card-link-color)',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
        title={value.href}
      >
        {children}
      </span>
    );
  }

  return <>{children}</>;
};

const renderListItem: RenderListItemFunction = (props) => {
  return <li style={{ marginLeft: '1.5em' }}>{props.children}</li>;
};

const renderStyle: RenderStyleFunction = (props) => {
  return <>{props.children}</>;
};

/**
 * Link annotation editor component
 */
function LinkEditor({
  value,
  onChange,
  onClose,
}: {
  value: { href?: string; blank?: boolean };
  onChange: (value: { href: string; blank: boolean }) => void;
  onClose: () => void;
}) {
  const [href, setHref] = useState(value.href || '');
  const [blank, setBlank] = useState(value.blank ?? true);

  const handleSave = () => {
    onChange({ href, blank });
    onClose();
  };

  return (
    <Card padding={3} radius={2} shadow={2} style={{ position: 'absolute', zIndex: 100, background: 'var(--card-bg-color)', minWidth: '300px' }}>
      <Stack space={3}>
        <Text size={1} weight="semibold">Dodaj link</Text>
        <TextInput
          value={href}
          onChange={(e) => setHref(e.currentTarget.value)}
          placeholder="https://..."
          fontSize={1}
        />
        <Flex gap={2} align="center">
          <input
            type="checkbox"
            id="blank"
            checked={blank}
            onChange={(e) => setBlank(e.target.checked)}
          />
          <label htmlFor="blank" style={{ fontSize: '13px' }}>
            Otwórz w nowej karcie
          </label>
        </Flex>
        <Flex gap={2} justify="flex-end">
          <Button text="Anuluj" mode="ghost" onClick={onClose} fontSize={1} />
          <Button text="Zapisz" tone="primary" onClick={handleSave} fontSize={1} />
        </Flex>
      </Stack>
    </Card>
  );
}

/**
 * Portable Text Cell Editor Component
 * Provides a proper rich text editing experience for table cells
 */
export function CellEditor({ initialContent, onSave, onCancel }: CellEditorProps) {
  // Ensure content has valid keys
  const normalizedContent = useMemo(() => {
    if (!initialContent || initialContent.length === 0) {
      return [
        {
          _key: generateKey(),
          _type: 'block',
          style: 'normal',
          markDefs: [],
          children: [
            {
              _key: generateKey(),
              _type: 'span',
              text: '',
              marks: [],
            },
          ],
        },
      ] as PortableTextBlock[];
    }

    return initialContent.map((block) => ({
      ...block,
      _key: block._key || generateKey(),
      children: Array.isArray(block.children)
        ? block.children.map((child: any) => ({
            ...child,
            _key: child._key || generateKey(),
          }))
        : block.children,
    })) as PortableTextBlock[];
  }, [initialContent]);

  const [content, setContent] = useState<PortableTextBlock[]>(normalizedContent);
  const [editor, setEditor] = useState<PortableTextEditor | null>(null);
  const [linkEditor, setLinkEditor] = useState<{
    value: { href?: string; blank?: boolean };
  } | null>(null);

  const handleChange = useCallback(
    (change: { patches: any[]; snapshot: PortableTextBlock[] | undefined }) => {
      if (change.snapshot) {
        setContent(change.snapshot);
      }
    },
    []
  );

  const handleSave = useCallback(() => {
    onSave(content);
  }, [content, onSave]);

  // Toolbar actions
  const handleBold = useCallback(() => {
    if (!editor) return;
    PortableTextEditor.toggleMark(editor, 'strong');
    PortableTextEditor.focus(editor);
  }, [editor]);

  const handleItalic = useCallback(() => {
    if (!editor) return;
    PortableTextEditor.toggleMark(editor, 'em');
    PortableTextEditor.focus(editor);
  }, [editor]);

  const handleBulletList = useCallback(() => {
    if (!editor) return;
    PortableTextEditor.toggleList(editor, 'bullet');
    PortableTextEditor.focus(editor);
  }, [editor]);

  const handleNumberList = useCallback(() => {
    if (!editor) return;
    PortableTextEditor.toggleList(editor, 'number');
    PortableTextEditor.focus(editor);
  }, [editor]);

  const handleLink = useCallback(() => {
    if (!editor) return;

    const selection = PortableTextEditor.getSelection(editor);
    if (!selection) return;

    // Check if there's an existing link
    const activeAnnotations = PortableTextEditor.activeAnnotations(editor);
    const existingLink = activeAnnotations.find((a) => a._type === 'link');

    if (existingLink) {
      // Remove existing link
      PortableTextEditor.removeAnnotation(editor, existingLink);
      PortableTextEditor.focus(editor);
    } else {
      // Open link editor
      setLinkEditor({ value: {} });
    }
  }, [editor]);

  const handleLinkSave = useCallback(
    (value: { href: string; blank: boolean }) => {
      if (!editor) return;

      const key = generateKey();
      PortableTextEditor.addAnnotation(
        editor,
        { _type: 'link', name: 'link' } as any,
        { _key: key, href: value.href, blank: value.blank }
      );
      PortableTextEditor.focus(editor);
      setLinkEditor(null);
    },
    [editor]
  );

  const editableProps: Partial<PortableTextEditableProps> = useMemo(
    () => ({
      renderBlock,
      renderChild,
      renderDecorator,
      renderAnnotation,
      renderListItem,
      renderStyle,
      style: {
        outline: 'none',
        minHeight: '150px',
        padding: '12px',
        fontSize: '14px',
        lineHeight: '1.5',
      },
    }),
    []
  );

  return (
    <Box padding={4}>
      <Stack space={4}>
        {/* Toolbar */}
        <Card padding={2} border radius={2}>
          <Flex gap={1} wrap="wrap" style={{ position: 'relative' }}>
            <Button
              text="B"
              mode="ghost"
              padding={2}
              fontSize={1}
              onClick={handleBold}
              style={{ fontWeight: 'bold' }}
              title="Pogrubienie"
            />
            <Button
              text="I"
              mode="ghost"
              padding={2}
              fontSize={1}
              onClick={handleItalic}
              style={{ fontStyle: 'italic' }}
              title="Kursywa"
            />
            <Box style={{ width: '1px', background: 'var(--card-border-color)', margin: '0 4px' }} />
            <Button
              icon={() => <span style={{ fontSize: '12px' }}>•</span>}
              mode="ghost"
              padding={2}
              onClick={handleBulletList}
              title="Lista wypunktowana"
            />
            <Button
              icon={() => <span style={{ fontSize: '12px' }}>1.</span>}
              mode="ghost"
              padding={2}
              onClick={handleNumberList}
              title="Lista numerowana"
            />
            <Box style={{ width: '1px', background: 'var(--card-border-color)', margin: '0 4px' }} />
            <Button
              icon={LinkIcon}
              mode="ghost"
              padding={2}
              onClick={handleLink}
              title="Link"
            />
            {linkEditor && (
              <LinkEditor
                value={linkEditor.value}
                onChange={handleLinkSave}
                onClose={() => setLinkEditor(null)}
              />
            )}
          </Flex>
        </Card>

        {/* Editor */}
        <Card padding={0} border radius={2}>
          <PortableTextEditor
            ref={(ref) => setEditor(ref)}
            schemaType={CELL_SCHEMA_TYPE as any}
            value={content}
            onChange={handleChange}
          >
            <PortableTextEditable {...editableProps} />
          </PortableTextEditor>
        </Card>

        {/* Hints */}
        <Text size={1} muted>
          Wskazówka: Zaznacz tekst, aby sformatować. Obsługiwane: pogrubienie, kursywa, linki, listy.
        </Text>

        {/* Actions */}
        <Flex gap={3} justify="flex-end">
          <Button text="Anuluj" mode="ghost" onClick={onCancel} />
          <Button text="Zapisz" tone="primary" onClick={handleSave} />
        </Flex>
      </Stack>
    </Box>
  );
}

export default CellEditor;
