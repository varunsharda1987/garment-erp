/**
 * Style Image Service
 * API service for style gallery functionality
 */

import api from '../lib/api';
import type {
  StyleImage,
  StyleImagesResponse,
  StyleImageResponse,
  StyleImageTypesResponse,
  UpdateStyleImageDTO,
  StyleImageType,
} from '../types/styleImage.types';

export const styleImageService = {
  /**
   * Get all images for a style
   */
  getImages: async (styleId: string): Promise<StyleImage[]> => {
    const response = await api.get<StyleImagesResponse>(`/styles/${styleId}/images`);
    return response.data.data;
  },

  /**
   * Upload a new image for a style
   */
  uploadImage: async (
    styleId: string,
    file: File,
    imageType?: StyleImageType,
    caption?: string
  ): Promise<StyleImage> => {
    const formData = new FormData();
    formData.append('image', file);
    if (imageType) {
      formData.append('imageType', imageType);
    }
    if (caption) {
      formData.append('caption', caption);
    }

    const response = await api.post<StyleImageResponse>(
      `/styles/${styleId}/images`,
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
   * Update an image's metadata
   */
  updateImage: async (
    styleId: string,
    imageId: string,
    data: UpdateStyleImageDTO
  ): Promise<StyleImage> => {
    const response = await api.patch<StyleImageResponse>(
      `/styles/${styleId}/images/${imageId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete an image
   */
  deleteImage: async (styleId: string, imageId: string): Promise<void> => {
    await api.delete(`/styles/${styleId}/images/${imageId}`);
  },

  /**
   * Reorder images
   */
  reorderImages: async (styleId: string, imageIds: string[]): Promise<StyleImage[]> => {
    const response = await api.post<StyleImagesResponse>(
      `/styles/${styleId}/images/reorder`,
      { imageIds }
    );
    return response.data.data;
  },

  /**
   * Get available image type options
   */
  getImageTypes: async (): Promise<{ value: StyleImageType; label: string }[]> => {
    const response = await api.get<StyleImageTypesResponse>('/styles/images/types');
    return response.data.data;
  },
};

export default styleImageService;
