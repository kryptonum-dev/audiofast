// eslint-disable-next-line simple-import-sort/imports
import React, { useEffect, useRef, useState } from 'react';
import { Box, Text } from '@sanity/ui';

type InlineEditableProps = {
  value: string | number;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
  suffix?: string; // e.g. " zł"
  minWidth?: number;
  fontSize?: number;
  width?: number; // fixed width, for right-aligned price
  align?: 'left' | 'right';
};

export function InlineEditable({
  value,
  onChange,
  placeholder,
  type = 'text',
  suffix,
  minWidth = 60,
  fontSize = 2,
  width,
  align = 'left',
}: InlineEditableProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const spanRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (editing && spanRef.current) {
      // Initialize content and place caret at end
      const el = spanRef.current;
      el.innerText = String(value ?? '');
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false); // caret at end
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing, value]);

  useEffect(() => {
    // While not editing, mirror external value into the DOM to avoid jumps
    if (!editing && spanRef.current) {
      const next = String(value ?? '');
      setDraft(next);
      spanRef.current.innerText = next;
    }
  }, [value, editing]);

  const commit = () => {
    const current = spanRef.current?.innerText ?? draft;
    if (type === 'number') {
      const trimmed = current.trim();
      if (trimmed === '' || trimmed === '-' || trimmed === '+') {
        // Empty or incomplete number, use 0
        onChange('0');
      } else {
        const parsed = parseFloat(trimmed);
        if (isNaN(parsed)) {
          // Invalid number, keep the original value
          onChange(String(value ?? '0'));
        } else {
          // Valid number (including negative and zero)
          onChange(String(parsed));
        }
      }
    } else {
      // For text labels, do not allow empty strings; revert to previous value
      const safe = current.trim() === '' ? String(value ?? '') : current;
      onChange(safe);
    }
    setEditing(false);
  };

  const cancel = () => {
    // Restore DOM to current external value and exit
    const next = String(value ?? '');
    if (spanRef.current) spanRef.current.innerText = next;
    setDraft(next);
    setEditing(false);
  };

  return (
    <Box
      style={{
        minWidth,
        width,
        display: 'inline-flex',
        alignItems: 'center',
        borderBottom: editing
          ? '1px dashed var(--card-border-color)'
          : '1px solid transparent',
        cursor: 'pointer',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
      }}
      onClick={() => setEditing(true)}>
      <Text
        size={fontSize}
        muted={String(value ?? '') === '' && !editing}
        style={{
          textAlign: align === 'right' ? 'right' : 'left',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          lineHeight: fontSize <= 2 ? 2.5 : 2.3,
        }}>
        <span
          ref={spanRef}
          contentEditable={editing}
          suppressContentEditableWarning
          onBlur={commit}
          onBeforeInput={(e) => {
            const ev: any = e as any;
            const el = spanRef.current;
            if (!editing || !el) return;
            const inputType: string | undefined = ev.nativeEvent?.inputType;

            if (type === 'number') {
              // For number inputs, validate the input data
              const data = ev.data;
              if (data && !/^[-+]?[0-9]*\.?[0-9]*$/.test(data)) {
                // Allow digits, decimal point, minus sign, and plus sign
                if (!/^[0-9.-]$/.test(data)) {
                  e.preventDefault();
                  return;
                }
                // Additional validation for minus sign (only at start)
                if (
                  data === '-' &&
                  el.innerText.length > 0 &&
                  !el.innerText.startsWith('-')
                ) {
                  e.preventDefault();
                  return;
                }
                // Additional validation for decimal point (only one allowed)
                if (data === '.' && el.innerText.includes('.')) {
                  e.preventDefault();
                  return;
                }
              }
            } else if (inputType && inputType.startsWith('delete')) {
              if (el.innerText.length <= 1) {
                // Prevent deleting the last remaining character
                e.preventDefault();
              }
            }
          }}
          onInput={(e) => {
            const el = e.target as HTMLElement;
            let text = el.innerText;
            if (type === 'number') {
              // Remove any invalid characters that might have slipped through
              const cleaned = text.replace(/[^-+.\d]/g, '');
              if (cleaned !== text) {
                el.innerText = cleaned;
                text = cleaned;
              }

              // Handle empty input
              if (text.trim() === '') {
                el.innerText = '0';
                const range = document.createRange();
                range.selectNodeContents(el);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
                text = '0';
              } else {
                // Ensure only one decimal point
                const parts = text.split('.');
                if (parts.length > 2) {
                  el.innerText = parts[0] + '.' + parts.slice(1).join('');
                  text = el.innerText;
                }

                // Ensure minus sign is only at the beginning
                if (text.includes('-') && !text.startsWith('-')) {
                  el.innerText = text.replace('-', '');
                  text = el.innerText;
                }
              }
            }
            // Keep caret at end for stability when not selecting explicitly
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          onPaste={(e) => {
            if (type === 'number') {
              // Allow paste but clean the content
              const pasted = e.clipboardData.getData('text');
              const cleaned = pasted.replace(/[^-+.\d]/g, '');
              if (cleaned !== pasted) {
                e.preventDefault();
                // Insert cleaned content
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  range.deleteContents();
                  const textNode = document.createTextNode(cleaned);
                  range.insertNode(textNode);
                  range.setStartAfter(textNode);
                  range.setEndAfter(textNode);
                  selection.removeAllRanges();
                  selection.addRange(range);
                }
              }
            }
          }}
          style={{
            outline: 'none',
          }}>
          {editing ? draft : String(value ?? '') || placeholder || '—'}
        </span>
        {suffix ? ` ${suffix}` : ''}
      </Text>
    </Box>
  );
}

export default InlineEditable;
