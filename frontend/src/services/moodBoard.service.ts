/**
 * Mood Board Service
 * API service for mood board functionality
 */

import api from '../lib/api';
import type {
  MoodBoard,
  MoodBoardItem,
  MoodBoardsResponse,
  MoodBoardResponse,
  MoodBoardItemResponse,
  MoodBoardFilters,
  CreateMoodBoardDTO,
  UpdateMoodBoardDTO,
  CreateMoodBoardItemDTO,
  UpdateMoodBoardItemDTO,
} from '../types/moodBoard.types';

export const moodBoardService = {
  /**
   * Get all mood boards with optional filters
   */
  getAll: async (
    filters?: MoodBoardFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ moodBoards: MoodBoard[]; total: number; totalPages: number }> => {
    const response = await api.get<MoodBoardsResponse>('/mood-boards', {
      params: { ...filters, page, limit },
    });
    return {
      moodBoards: response.data.data,
      total: response.data.pagination?.total || response.data.data.length,
      totalPages: response.data.pagination?.totalPages || 1,
    };
  },

  /**
   * Get a single mood board by ID
   */
  getById: async (id: string): Promise<MoodBoard> => {
    const response = await api.get<MoodBoardResponse>(`/mood-boards/${id}`);
    return response.data.data;
  },

  /**
   * Create a new mood board
   */
  create: async (data: CreateMoodBoardDTO): Promise<MoodBoard> => {
    const response = await api.post<MoodBoardResponse>('/mood-boards', data);
    return response.data.data;
  },

  /**
   * Update a mood board
   */
  update: async (id: string, data: UpdateMoodBoardDTO): Promise<MoodBoard> => {
    const response = await api.patch<MoodBoardResponse>(`/mood-boards/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete a mood board
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/mood-boards/${id}`);
  },

  // ─────────────────────────────────────────────────────────────────
  // Item Management
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add an item to a mood board (with file upload)
   */
  addItem: async (
    boardId: string,
    file: File | null,
    data: CreateMoodBoardItemDTO
  ): Promise<MoodBoardItem> => {
    const formData = new FormData();
    if (file) {
      formData.append('image', file);
    }
    // Append all data fields
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    const response = await api.post<MoodBoardItemResponse>(
      `/mood-boards/${boardId}/items`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data;
  },

  /**
   * Add a color swatch item (no file)
   */
  addColorItem: async (
    boardId: string,
    colorHex: string,
    title?: string,
    positionX: number = 0,
    positionY: number = 0
  ): Promise<MoodBoardItem> => {
    const response = await api.post<MoodBoardItemResponse>(
      `/mood-boards/${boardId}/items`,
      {
        itemType: 'COLOR',
        colorHex,
        title,
        positionX,
        positionY,
        width: 100,
        height: 100,
      }
    );
    return response.data.data;
  },

  /**
   * Add a text item
   */
  addTextItem: async (
    boardId: string,
    title: string,
    caption?: string,
    positionX: number = 0,
    positionY: number = 0
  ): Promise<MoodBoardItem> => {
    const response = await api.post<MoodBoardItemResponse>(
      `/mood-boards/${boardId}/items`,
      {
        itemType: 'TEXT',
        title,
        caption,
        positionX,
        positionY,
        width: 200,
        height: 100,
      }
    );
    return response.data.data;
  },

  /**
   * Update an item
   */
  updateItem: async (
    boardId: string,
    itemId: string,
    data: UpdateMoodBoardItemDTO
  ): Promise<MoodBoardItem> => {
    const response = await api.patch<MoodBoardItemResponse>(
      `/mood-boards/${boardId}/items/${itemId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete an item
   */
  deleteItem: async (boardId: string, itemId: string): Promise<void> => {
    await api.delete(`/mood-boards/${boardId}/items/${itemId}`);
  },

  /**
   * Batch update item positions (for canvas saves)
   */
  updateItemPositions: async (
    boardId: string,
    updates: Array<{
      id: string;
      positionX: number;
      positionY: number;
      width?: number;
      height?: number;
      rotation?: number;
      zIndex?: number;
    }>
  ): Promise<void> => {
    // Update items one by one (could be optimized with batch endpoint)
    await Promise.all(
      updates.map((update) =>
        api.patch(`/mood-boards/${boardId}/items/${update.id}`, {
          positionX: update.positionX,
          positionY: update.positionY,
          width: update.width,
          height: update.height,
          rotation: update.rotation,
          zIndex: update.zIndex,
        })
      )
    );
  },
};

export default moodBoardService;
