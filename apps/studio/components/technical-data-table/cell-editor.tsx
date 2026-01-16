"use client";

import { LinkIcon } from "@sanity/icons";
import {
  Box,
  Button,
  Card,
  Flex,
  Stack,
  Text,
  TextArea,
  TextInput,
} from "@sanity/ui";
import { Bold, Italic, Link2, List, ListOrdered } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PortableTextBlock } from "sanity";

import { generateKey } from "./types";

type CellEditorProps = {
  initialContent: PortableTextBlock[];
  onSave: (content: PortableTextBlock[]) => void;
  onCancel: () => void;
};

type TextSelection = {
  start: number;
  end: number;
};

type MarkType = "strong" | "em";
type ListType = "bullet" | "number";

/**
 * Link editor popover component
 */
function LinkEditor({
  onSave,
  onClose,
  initialHref = "",
}: {
  onSave: (href: string, blank: boolean) => void;
  onClose: () => void;
  initialHref?: string;
}) {
  const [href, setHref] = useState(initialHref);
  const [blank, setBlank] = useState(true);

  const handleSave = () => {
    if (href.trim()) {
      onSave(href.trim(), blank);
    }
    onClose();
  };

  return (
    <Card
      padding={3}
      radius={2}
      shadow={2}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        zIndex: 100,
        background: "var(--card-bg-color)",
        minWidth: "300px",
        marginTop: "4px",
      }}
    >
      <Stack space={3}>
        <Text size={1} weight="semibold">
          Dodaj link
        </Text>
        <TextInput
          value={href}
          onChange={(e) => setHref(e.currentTarget.value)}
          placeholder="https://..."
          fontSize={1}
          autoFocus
        />
        <Flex gap={2} align="center">
          <input
            type="checkbox"
            id="blank-checkbox"
            checked={blank}
            onChange={(e) => setBlank(e.target.checked)}
          />
          <label htmlFor="blank-checkbox" style={{ fontSize: "13px" }}>
            Otwórz w nowej karcie
          </label>
        </Flex>
        <Flex gap={2} justify="flex-end">
          <Button text="Anuluj" mode="ghost" onClick={onClose} fontSize={1} />
          <Button
            text="Zapisz"
            tone="primary"
            onClick={handleSave}
            fontSize={1}
            disabled={!href.trim()}
          />
        </Flex>
      </Stack>
    </Card>
  );
}

/**
 * Convert Portable Text blocks to plain text for editing
 */
function blocksToText(blocks: PortableTextBlock[]): string {
  if (!blocks || blocks.length === 0) return "";

  return blocks
    .map((block) => {
      if (block._type !== "block") return "";

      const children = (block.children as Array<{ text?: string }>) || [];
      const text = children.map((child) => child.text || "").join("");

      // Add list prefix for display
      if (block.listItem === "bullet") {
        return `• ${text}`;
      }
      if (block.listItem === "number") {
        return `1. ${text}`;
      }

      return text;
    })
    .join("\n");
}

/**
 * Parse text into Portable Text blocks
 * Supports basic formatting detection and list prefixes
 */
function textToBlocks(text: string): PortableTextBlock[] {
  if (!text.trim()) return [];

  const lines = text.split("\n");
  const blocks: PortableTextBlock[] = [];

  lines.forEach((line) => {
    let listItem: ListType | undefined;
    let processedLine = line;

    // Detect bullet list
    if (line.match(/^[•\-\*]\s+/)) {
      listItem = "bullet";
      processedLine = line.replace(/^[•\-\*]\s+/, "");
    }
    // Detect numbered list
    else if (line.match(/^\d+\.\s+/)) {
      listItem = "number";
      processedLine = line.replace(/^\d+\.\s+/, "");
    }

    const block: PortableTextBlock = {
      _key: generateKey(),
      _type: "block",
      style: "normal",
      markDefs: [],
      children: [
        {
          _key: generateKey(),
          _type: "span",
          text: processedLine,
          marks: [],
        },
      ],
    };

    if (listItem) {
      (block as any).listItem = listItem;
      (block as any).level = 1;
    }

    blocks.push(block);
  });

  return blocks;
}

/**
 * Apply mark to selected text in blocks
 */
function applyMarkToBlocks(
  blocks: PortableTextBlock[],
  mark: MarkType,
): PortableTextBlock[] {
  return blocks.map((block) => {
    if (block._type !== "block") return block;

    const children = (block.children as any[]) || [];
    const newChildren = children.map((child) => {
      if (child._type !== "span") return child;

      const marks = child.marks || [];
      const hasMark = marks.includes(mark);

      return {
        ...child,
        marks: hasMark ? marks.filter((m: string) => m !== mark) : [...marks, mark],
      };
    });

    return {
      ...block,
      children: newChildren,
    };
  });
}

/**
 * Toggle list type on all blocks
 */
function toggleListOnBlocks(
  blocks: PortableTextBlock[],
  listType: ListType,
): PortableTextBlock[] {
  // Check if all blocks already have this list type
  const allHaveList = blocks.every(
    (block) => (block as any).listItem === listType,
  );

  return blocks.map((block) => {
    if (block._type !== "block") return block;

    if (allHaveList) {
      // Remove list
      const { listItem, level, ...rest } = block as any;
      return rest;
    } else {
      // Add list
      return {
        ...block,
        listItem: listType,
        level: 1,
      } as PortableTextBlock;
    }
  });
}

/**
 * Add link to blocks (wraps all text in a link)
 */
function addLinkToBlocks(
  blocks: PortableTextBlock[],
  href: string,
  blank: boolean,
): PortableTextBlock[] {
  const linkKey = generateKey();

  return blocks.map((block) => {
    if (block._type !== "block") return block;

    const markDefs = [...((block.markDefs as any[]) || [])];
    
    // Check if there's already a link
    const existingLinkIndex = markDefs.findIndex((m) => m._type === "link");
    if (existingLinkIndex >= 0) {
      // Update existing link
      markDefs[existingLinkIndex] = {
        ...markDefs[existingLinkIndex],
        href,
        blank,
      };
      return { ...block, markDefs };
    }

    // Add new link
    markDefs.push({
      _key: linkKey,
      _type: "link",
      href,
      blank,
    });

    const children = (block.children as any[]) || [];
    const newChildren = children.map((child) => {
      if (child._type !== "span") return child;
      const marks = child.marks || [];
      return {
        ...child,
        marks: [...marks, linkKey],
      };
    });

    return {
      ...block,
      markDefs,
      children: newChildren,
    };
  });
}

/**
 * Check if blocks have a specific mark
 */
function blocksHaveMark(blocks: PortableTextBlock[], mark: MarkType): boolean {
  return blocks.some((block) => {
    if (block._type !== "block") return false;
    const children = (block.children as any[]) || [];
    return children.some((child) => {
      const marks = child.marks || [];
      return marks.includes(mark);
    });
  });
}

/**
 * Check if blocks have a specific list type
 */
function blocksHaveList(blocks: PortableTextBlock[], listType: ListType): boolean {
  return blocks.some((block) => (block as any).listItem === listType);
}

/**
 * Check if blocks have a link
 */
function blocksHaveLink(blocks: PortableTextBlock[]): boolean {
  return blocks.some((block) => {
    if (block._type !== "block") return false;
    const markDefs = (block.markDefs as any[]) || [];
    return markDefs.some((m) => m._type === "link");
  });
}

/**
 * Remove links from blocks
 */
function removeLinksFromBlocks(blocks: PortableTextBlock[]): PortableTextBlock[] {
  return blocks.map((block) => {
    if (block._type !== "block") return block;

    const markDefs = (block.markDefs as any[]) || [];
    const linkKeys = markDefs.filter((m) => m._type === "link").map((m) => m._key);

    const newMarkDefs = markDefs.filter((m) => m._type !== "link");
    const children = (block.children as any[]) || [];
    const newChildren = children.map((child) => {
      if (child._type !== "span") return child;
      const marks = (child.marks || []).filter((m: string) => !linkKeys.includes(m));
      return { ...child, marks };
    });

    return {
      ...block,
      markDefs: newMarkDefs,
      children: newChildren,
    };
  });
}

/**
 * Portable Text Cell Editor Component
 * Provides a rich text editing experience for table cells using a textarea-based approach
 * that properly converts to/from Portable Text format
 */
export function CellEditor({
  initialContent,
  onSave,
  onCancel,
}: CellEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState<PortableTextBlock[]>(() => {
    if (!initialContent || initialContent.length === 0) {
      return [
        {
          _key: generateKey(),
          _type: "block",
          style: "normal",
          markDefs: [],
          children: [
            {
              _key: generateKey(),
              _type: "span",
              text: "",
              marks: [],
            },
          ],
        },
      ];
    }
    return initialContent.map((block) => ({
      ...block,
      _key: block._key || generateKey(),
    }));
  });

  const [text, setText] = useState(() => blocksToText(content));
  const [showLinkEditor, setShowLinkEditor] = useState(false);

  // Sync text changes back to blocks
  const syncTextToBlocks = useCallback(() => {
    const newBlocks = textToBlocks(text);
    
    // Preserve marks and markDefs from existing content where possible
    if (content.length > 0 && newBlocks.length > 0) {
      const existingMarks = content[0]?.children?.[0]?.marks || [];
      const existingMarkDefs = content[0]?.markDefs || [];
      
      if (existingMarks.length > 0 || existingMarkDefs.length > 0) {
        newBlocks.forEach((block) => {
          (block as any).markDefs = existingMarkDefs;
          const children = (block.children as any[]) || [];
          children.forEach((child) => {
            if (child._type === "span") {
              child.marks = [...existingMarks];
            }
          });
        });
      }
    }
    
    setContent(newBlocks);
  }, [text, content]);

  // Update blocks when text changes (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      syncTextToBlocks();
    }, 300);
    return () => clearTimeout(timeout);
  }, [text, syncTextToBlocks]);

  // Formatting state
  const hasBold = useMemo(() => blocksHaveMark(content, "strong"), [content]);
  const hasItalic = useMemo(() => blocksHaveMark(content, "em"), [content]);
  const hasBulletList = useMemo(() => blocksHaveList(content, "bullet"), [content]);
  const hasNumberList = useMemo(() => blocksHaveList(content, "number"), [content]);
  const hasLink = useMemo(() => blocksHaveLink(content), [content]);

  // Toolbar actions
  const handleBold = useCallback(() => {
    setContent((prev) => applyMarkToBlocks(prev, "strong"));
  }, []);

  const handleItalic = useCallback(() => {
    setContent((prev) => applyMarkToBlocks(prev, "em"));
  }, []);

  const handleBulletList = useCallback(() => {
    // Parse current text and apply list
    const blocks = textToBlocks(text);
    const newBlocks = toggleListOnBlocks(blocks, "bullet");
    setContent(newBlocks);
    setText(blocksToText(newBlocks));
  }, [text]);

  const handleNumberList = useCallback(() => {
    // Parse current text and apply list
    const blocks = textToBlocks(text);
    const newBlocks = toggleListOnBlocks(blocks, "number");
    setContent(newBlocks);
    setText(blocksToText(newBlocks));
  }, [text]);

  const handleLink = useCallback(() => {
    if (hasLink) {
      // Remove existing link
      setContent((prev) => removeLinksFromBlocks(prev));
    } else {
      setShowLinkEditor(true);
    }
  }, [hasLink]);

  const handleLinkSave = useCallback(
    (href: string, blank: boolean) => {
      // First sync text to blocks, then add link
      const blocks = textToBlocks(text);
      const linkedBlocks = addLinkToBlocks(blocks, href, blank);
      setContent(linkedBlocks);
      setShowLinkEditor(false);
    },
    [text],
  );

  const handleSave = useCallback(() => {
    // Make sure we have the latest content
    const finalBlocks = textToBlocks(text);
    
    // Preserve formatting from content state
    const mergedBlocks = finalBlocks.map((block, index) => {
      const existingBlock = content[index];
      if (!existingBlock) return block;
      
      return {
        ...block,
        markDefs: existingBlock.markDefs || [],
        children: (block.children as any[]).map((child, childIndex) => {
          const existingChild = (existingBlock.children as any[])?.[childIndex];
          return {
            ...child,
            marks: existingChild?.marks || [],
          };
        }),
      };
    });
    
    onSave(mergedBlocks.length > 0 ? mergedBlocks : content);
  }, [text, content, onSave]);

  return (
    <Box padding={4}>
      <Stack space={4}>
        {/* Toolbar */}
        <Card padding={2} border radius={2}>
          <Flex gap={1} wrap="wrap" style={{ position: "relative" }}>
            <Button
              icon={Bold}
              mode={hasBold ? "default" : "ghost"}
              tone={hasBold ? "primary" : "default"}
              padding={2}
              onClick={handleBold}
              title="Pogrubienie (stosuje do całego tekstu)"
            />
            <Button
              icon={Italic}
              mode={hasItalic ? "default" : "ghost"}
              tone={hasItalic ? "primary" : "default"}
              padding={2}
              onClick={handleItalic}
              title="Kursywa (stosuje do całego tekstu)"
            />
            <Box
              style={{
                width: "1px",
                background: "var(--card-border-color)",
                margin: "0 4px",
                alignSelf: "stretch",
              }}
            />
            <Button
              icon={List}
              mode={hasBulletList ? "default" : "ghost"}
              tone={hasBulletList ? "primary" : "default"}
              padding={2}
              onClick={handleBulletList}
              title="Lista wypunktowana"
            />
            <Button
              icon={ListOrdered}
              mode={hasNumberList ? "default" : "ghost"}
              tone={hasNumberList ? "primary" : "default"}
              padding={2}
              onClick={handleNumberList}
              title="Lista numerowana"
            />
            <Box
              style={{
                width: "1px",
                background: "var(--card-border-color)",
                margin: "0 4px",
                alignSelf: "stretch",
              }}
            />
            <Button
              icon={Link2}
              mode={hasLink ? "default" : "ghost"}
              tone={hasLink ? "primary" : "default"}
              padding={2}
              onClick={handleLink}
              title={hasLink ? "Usuń link" : "Dodaj link"}
            />
            {showLinkEditor && (
              <LinkEditor
                onSave={handleLinkSave}
                onClose={() => setShowLinkEditor(false)}
              />
            )}
          </Flex>
        </Card>

        {/* Text Area */}
        <Card padding={0} border radius={2}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Wpisz tekst..."
            autoFocus
            style={{
              width: "100%",
              minHeight: "150px",
              padding: "12px",
              fontSize: "14px",
              lineHeight: "1.6",
              fontFamily: "inherit",
              border: "none",
              outline: "none",
              resize: "vertical",
              background: "transparent",
              color: "inherit",
              fontWeight: hasBold ? 600 : 400,
              fontStyle: hasItalic ? "italic" : "normal",
            }}
          />
        </Card>

        {/* Hints */}
        <Stack space={2}>
          <Text size={1} muted>
            Wskazówki:
          </Text>
          <Text size={1} muted>
            • Użyj "• " lub "- " na początku linii dla listy wypunktowanej
          </Text>
          <Text size={1} muted>
            • Użyj "1. " na początku linii dla listy numerowanej
          </Text>
          <Text size={1} muted>
            • Przyciski formatowania stosują styl do całego tekstu
          </Text>
        </Stack>

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
