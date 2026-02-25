/**
 * Mood Board Types
 * TypeScript types for mood board functionality with free-form canvas
 */

export type MoodBoardStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type MoodBoardItemType = 'IMAGE' | 'COLOR' | 'TEXT' | 'FABRIC_REF' | 'STYLE_REF';

export interface MoodBoardItem {
  id: string;
  moodBoardId: string;
  itemType: MoodBoardItemType;
  imageUrl?: string | null;
  colorHex?: string | null;
  fabricId?: string | null;
  styleId?: string | null;
  title?: string | null;
  caption?: string | null;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  createdAt: string;
}

export interface MoodBoard {
  id: string;
  name: string;
  description?: string | null;
  seasonId?: string | null;
  status: MoodBoardStatus;
  canvasWidth: number;
  canvasHeight: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  items: MoodBoardItem[];
  season?: {
    id: string;
    name: string;
  } | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface CreateMoodBoardDTO {
  name: string;
  description?: string;
  seasonId?: string;
  status?: MoodBoardStatus;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface UpdateMoodBoardDTO {
  name?: string;
  description?: string;
  seasonId?: string;
  status?: MoodBoardStatus;
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface CreateMoodBoardItemDTO {
  itemType: MoodBoardItemType;
  imageUrl?: string;
  colorHex?: string;
  fabricId?: string;
  styleId?: string;
  title?: string;
  caption?: string;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
}

export interface UpdateMoodBoardItemDTO {
  itemType?: MoodBoardItemType;
  title?: string;
  caption?: string;
  colorHex?: string;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
}

// Canvas state for react-konva
export interface CanvasItem extends MoodBoardItem {
  isSelected?: boolean;
  isDragging?: boolean;
}

// API Response types
export interface MoodBoardsResponse {
  data: MoodBoard[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MoodBoardResponse {
  data: MoodBoard;
  message?: string;
}

export interface MoodBoardItemResponse {
  data: MoodBoardItem;
  message?: string;
}

// Filter options
export interface MoodBoardFilters {
  seasonId?: string;
  status?: MoodBoardStatus;
  search?: string;
}
