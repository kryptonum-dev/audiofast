// eslint-disable-next-line simple-import-sort/imports
import React, { useMemo, useState } from 'react';
import { Box, Card, Text } from '@sanity/ui';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

type HandleProps = { attributes: any; listeners: any; isDragging?: boolean };

type SortableListProps<T> = {
  items: T[];
  getId: (item: T, index: number) => string;
  onReorder: (oldIndex: number, newIndex: number) => void;
  renderItem: (args: {
    item: T;
    index: number;
    handleProps: HandleProps;
  }) => React.ReactNode;
  getLabel?: (item: T, index: number) => string;
  overlayRenderer?: (args: { item: T; index: number }) => React.ReactNode;
  /** If true, items won't visually shift during drag. Default: true */
  staticDuringDrag?: boolean;
};

function SortableItem({
  id,
  isDropTarget,
  staticDuringDrag,
  children,
}: {
  id: string;
  isDropTarget: boolean;
  staticDuringDrag: boolean;
  children: (handle: HandleProps) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = staticDuringDrag
    ? { transition, opacity: isDragging ? 0.9 : 1 }
    : {
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
        opacity: isDragging ? 0.9 : 1,
      };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ position: 'relative' }}>
        {children({ attributes, listeners, isDragging })}
        {isDropTarget && (
          <Box
            style={{
              position: 'absolute',
              top: -4,
              left: -4,
              right: -4,
              bottom: -4,
              border: '2px dashed #3b82f6',
              borderRadius: 8,
              backgroundColor: 'rgba(59,130,246,0.1)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  getLabel,
  overlayRenderer,
  staticDuringDrag = true,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => items.map((it, i) => getId(it, i)), [items, getId]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragOver = (e: DragOverEvent) => {
    setOverId(e.over ? String(e.over.id) : null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const from = String(e.active.id);
    const to = e.over ? String(e.over.id) : null;
    setActiveId(null);
    setOverId(null);
    if (!to || from === to) return;
    const oldIndex = ids.indexOf(from);
    const newIndex = ids.indexOf(to);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(oldIndex, newIndex);
  };

  const activeIndex = activeId ? ids.indexOf(activeId) : -1;
  const activeItem = activeIndex >= 0 ? items[activeIndex] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => {
          const id = ids[index];
          const isDropTarget = Boolean(overId === id && activeId);
          return (
            <SortableItem
              key={id}
              id={id}
              isDropTarget={isDropTarget}
              staticDuringDrag={staticDuringDrag}>
              {(handleProps) => renderItem({ item, index, handleProps })}
            </SortableItem>
          );
        })}
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          overlayRenderer ? (
            overlayRenderer({ item: activeItem, index: activeIndex })
          ) : (
            <Card
              padding={3}
              tone="transparent"
              style={{
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                border: '1px solid var(--card-border-color)',
                background: 'var(--card-bg-color)',
                borderRadius: 8,
              }}>
              <Text weight="medium">
                {getLabel
                  ? getLabel(activeItem, activeIndex)
                  : String(getId(activeItem, activeIndex))}
              </Text>
            </Card>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default SortableList;
