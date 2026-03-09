/**
 * Mood Board Canvas Component
 * Free-form canvas using react-konva for drag, resize, and arrange items
 */

import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer, Group } from 'react-konva';
import type Konva from 'konva';
import type { MoodBoardItem } from '@/types/moodBoard.types';

interface MoodBoardCanvasProps {
  items: MoodBoardItem[];
  canvasWidth: number;
  canvasHeight: number;
  editable?: boolean;
  onItemUpdate: (itemId: string, updates: Partial<MoodBoardItem>) => void;
  onItemDelete: (itemId: string) => void;
  selectedItemId: string | null;
  onItemSelect: (itemId: string | null) => void;
}

// Hook to load image
function useImage(url: string | null | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!url) {
      setImage(null);
      return;
    }

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = url;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  return image;
}

// Image item component
function ImageItem({
  item,
  isSelected,
  onSelect,
  onChange,
  editable,
}: {
  item: MoodBoardItem;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<MoodBoardItem>) => void;
  editable: boolean;
}) {
  const backendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
  const imageUrl = item.imageUrl ? `${backendUrl}${item.imageUrl}` : null;
  const image = useImage(imageUrl);
  const shapeRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  if (!image) {
    return (
      <Rect
        x={item.positionX}
        y={item.positionY}
        width={item.width}
        height={item.height}
        fill="#f3f4f6"
        stroke="#e5e7eb"
        strokeWidth={1}
        onClick={onSelect}
        onTap={onSelect}
      />
    );
  }

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image}
        x={item.positionX}
        y={item.positionY}
        width={item.width}
        height={item.height}
        rotation={item.rotation}
        draggable={editable}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            positionX: Math.round(e.target.x()),
            positionY: Math.round(e.target.y()),
          });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          if (!node) return;

          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          node.scaleX(1);
          node.scaleY(1);

          onChange({
            positionX: Math.round(node.x()),
            positionY: Math.round(node.y()),
            width: Math.round(Math.max(50, node.width() * scaleX)),
            height: Math.round(Math.max(50, node.height() * scaleY)),
            rotation: Math.round(node.rotation()),
          });
        }}
      />
      {isSelected && editable && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 50 || newBox.height < 50) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}

// Color swatch item component
function ColorItem({
  item,
  isSelected,
  onSelect,
  onChange,
  editable,
}: {
  item: MoodBoardItem;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<MoodBoardItem>) => void;
  editable: boolean;
}) {
  const shapeRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Rect
        ref={shapeRef}
        x={item.positionX}
        y={item.positionY}
        width={item.width}
        height={item.height}
        fill={item.colorHex || '#cccccc'}
        cornerRadius={8}
        stroke={isSelected ? '#3b82f6' : '#e5e7eb'}
        strokeWidth={isSelected ? 2 : 1}
        shadowColor="black"
        shadowBlur={4}
        shadowOpacity={0.1}
        shadowOffset={{ x: 2, y: 2 }}
        draggable={editable}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            positionX: Math.round(e.target.x()),
            positionY: Math.round(e.target.y()),
          });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          if (!node) return;

          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          node.scaleX(1);
          node.scaleY(1);

          onChange({
            positionX: Math.round(node.x()),
            positionY: Math.round(node.y()),
            width: Math.round(Math.max(50, node.width() * scaleX)),
            height: Math.round(Math.max(50, node.height() * scaleY)),
          });
        }}
      />
      {isSelected && editable && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 50 || newBox.height < 50) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}

// Text item component
function TextItem({
  item,
  isSelected,
  onSelect,
  onChange,
  editable,
}: {
  item: MoodBoardItem;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updates: Partial<MoodBoardItem>) => void;
  editable: boolean;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Group
        ref={groupRef}
        x={item.positionX}
        y={item.positionY}
        width={item.width}
        height={item.height}
        draggable={editable}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            positionX: Math.round(e.target.x()),
            positionY: Math.round(e.target.y()),
          });
        }}
        onTransformEnd={() => {
          const node = groupRef.current;
          if (!node) return;

          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          node.scaleX(1);
          node.scaleY(1);

          onChange({
            positionX: Math.round(node.x()),
            positionY: Math.round(node.y()),
            width: Math.round(Math.max(100, item.width * scaleX)),
            height: Math.round(Math.max(50, item.height * scaleY)),
          });
        }}
      >
        <Rect
          width={item.width}
          height={item.height}
          fill="white"
          cornerRadius={4}
          stroke={isSelected ? '#3b82f6' : '#e5e7eb'}
          strokeWidth={isSelected ? 2 : 1}
          shadowColor="black"
          shadowBlur={4}
          shadowOpacity={0.1}
          shadowOffset={{ x: 2, y: 2 }}
        />
        <Text
          x={8}
          y={8}
          width={item.width - 16}
          height={item.height - 16}
          text={item.title || 'Text'}
          fontSize={14}
          fontStyle="bold"
          fill="#374151"
        />
        {item.caption && (
          <Text
            x={8}
            y={28}
            width={item.width - 16}
            height={item.height - 36}
            text={item.caption}
            fontSize={12}
            fill="#6b7280"
          />
        )}
      </Group>
      {isSelected && editable && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 100 || newBox.height < 50) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}

export function MoodBoardCanvas({
  items,
  canvasWidth,
  canvasHeight,
  editable = true,
  onItemUpdate,
  onItemDelete,
  selectedItemId,
  onItemSelect,
}: MoodBoardCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [, setContainerSize] = useState({ width: 0, height: 0 });

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });

        // Calculate scale to fit canvas in container
        const scaleX = rect.width / canvasWidth;
        const scaleY = rect.height / canvasHeight;
        setScale(Math.min(scaleX, scaleY, 1));
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [canvasWidth, canvasHeight]);

  // Sort items by zIndex
  const sortedItems = [...items].sort((a, b) => a.zIndex - b.zIndex);

  // Handle click on empty area to deselect
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) {
      onItemSelect(null);
    }
  };

  // Handle keyboard events for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItemId && editable) {
          onItemDelete(selectedItemId);
          onItemSelect(null);
        }
      }
      if (e.key === 'Escape') {
        onItemSelect(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, editable, onItemDelete, onItemSelect]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gray-200 overflow-hidden flex items-center justify-center"
    >
      <Stage
        ref={stageRef}
        width={canvasWidth * scale}
        height={canvasHeight * scale}
        scaleX={scale}
        scaleY={scale}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer>
          {/* Canvas background */}
          <Rect
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            fill="white"
            shadowColor="black"
            shadowBlur={10}
            shadowOpacity={0.1}
            shadowOffset={{ x: 5, y: 5 }}
          />

          {/* Canvas border */}
          <Rect
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            stroke="#e5e7eb"
            strokeWidth={1}
          />

          {/* Render items */}
          {sortedItems.map((item) => {
            const isSelected = selectedItemId === item.id;

            switch (item.itemType) {
              case 'IMAGE':
                return (
                  <ImageItem
                    key={item.id}
                    item={item}
                    isSelected={isSelected}
                    onSelect={() => onItemSelect(item.id)}
                    onChange={(updates) => onItemUpdate(item.id, updates)}
                    editable={editable}
                  />
                );
              case 'COLOR':
                return (
                  <ColorItem
                    key={item.id}
                    item={item}
                    isSelected={isSelected}
                    onSelect={() => onItemSelect(item.id)}
                    onChange={(updates) => onItemUpdate(item.id, updates)}
                    editable={editable}
                  />
                );
              case 'TEXT':
                return (
                  <TextItem
                    key={item.id}
                    item={item}
                    isSelected={isSelected}
                    onSelect={() => onItemSelect(item.id)}
                    onChange={(updates) => onItemUpdate(item.id, updates)}
                    editable={editable}
                  />
                );
              default:
                return null;
            }
          })}
        </Layer>
      </Stage>
    </div>
  );
}

export default MoodBoardCanvas;
