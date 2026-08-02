/**
 * Style Gallery Component
 * Displays and manages multiple images for a style with drag-drop reordering
 */

import { useState, useEffect, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, Edit2, GripVertical, X, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { styleImageService } from '@/services/styleImage.service';
import type { StyleImage, StyleImageType } from '@/types/styleImage.types';

interface StyleGalleryProps {
  styleId: string;
  editable?: boolean;
}

// Image type labels for display
const IMAGE_TYPE_LABELS: Record<StyleImageType, string> = {
  MAIN: 'Main',
  SKETCH_FRONT: 'Front Sketch',
  SKETCH_BACK: 'Back Sketch',
  SKETCH_SIDE: 'Side Sketch',
  TECHNICAL_FLAT: 'Technical Flat',
  DETAIL_VIEW: 'Detail View',
  CONSTRUCTION: 'Construction',
  OTHER: 'Other',
};

// Badge colors for image types
const IMAGE_TYPE_COLORS: Record<StyleImageType, string> = {
  MAIN: 'bg-info-muted',
  SKETCH_FRONT: 'bg-success-muted',
  SKETCH_BACK: 'bg-success',
  SKETCH_SIDE: 'bg-success/25',
  TECHNICAL_FLAT: 'bg-accent/100',
  DETAIL_VIEW: 'bg-primary/100',
  CONSTRUCTION: 'bg-destructive/100',
  OTHER: 'bg-muted',
};

// Sortable image item component
function SortableImageItem({
  image,
  editable,
  onEdit,
  onDelete,
}: {
  image: StyleImage;
  editable: boolean;
  onEdit: (image: StyleImage) => void;
  onDelete: (image: StyleImage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const backendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-lg border overflow-hidden bg-card ${isDragging ? 'z-50 shadow-lg' : ''}`}
    >
      {/* Image */}
      <div className="aspect-square relative">
        <img
          src={`${backendUrl}${image.imageUrl}`}
          alt={image.caption || `Style image ${image.sortOrder + 1}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder-image.png';
          }}
        />

        {/* Overlay with actions (visible on hover) */}
        {editable && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button size="sm" variant="secondary" className="h-8 w-8 p-0" onClick={() => onEdit(image)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => onDelete(image)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Drag handle */}
        {editable && (
          <div
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 p-1 bg-card/80 rounded cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Image type badge and caption */}
      <div className="p-2 space-y-1">
        <Badge className={`${IMAGE_TYPE_COLORS[image.imageType]} text-white text-xs`}>
          {IMAGE_TYPE_LABELS[image.imageType]}
        </Badge>
        {image.caption && <p className="text-xs text-muted-foreground truncate">{image.caption}</p>}
      </div>
    </div>
  );
}

export function StyleGallery({ styleId, editable = true }: StyleGalleryProps) {
  const { toast } = useToast();
  const [images, setImages] = useState<StyleImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<StyleImage | null>(null);

  // Form states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadImageType, setUploadImageType] = useState<StyleImageType>('OTHER' as StyleImageType);
  const [uploadCaption, setUploadCaption] = useState('');
  const [editImageType, setEditImageType] = useState<StyleImageType>('OTHER' as StyleImageType);
  const [editCaption, setEditCaption] = useState('');

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load images
  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await styleImageService.getImages(styleId);
      setImages(data);
    } catch (error) {
      console.error('Failed to load images:', error);
      toast({
        title: 'Error',
        description: 'Failed to load images',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [styleId, toast]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  // Handle drag end for reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);

      const newOrder = arrayMove(images, oldIndex, newIndex);
      setImages(newOrder);

      try {
        await styleImageService.reorderImages(
          styleId,
          newOrder.map((img) => img.id)
        );
        toast({
          title: 'Success',
          description: 'Images reordered successfully',
        });
      } catch (error) {
        console.error('Failed to reorder images:', error);
        // Revert on error
        loadImages();
        toast({
          title: 'Error',
          description: 'Failed to reorder images',
          variant: 'destructive',
        });
      }
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!uploadFile) return;

    try {
      setUploading(true);
      await styleImageService.uploadImage(styleId, uploadFile, uploadImageType, uploadCaption || undefined);
      toast({
        title: 'Success',
        description: 'Image uploaded successfully',
      });
      setUploadDialogOpen(false);
      resetUploadForm();
      loadImages();
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  // Reset upload form
  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadPreview(null);
    setUploadImageType('OTHER' as StyleImageType);
    setUploadCaption('');
  };

  // Handle edit
  const handleEdit = (image: StyleImage) => {
    setSelectedImage(image);
    setEditImageType(image.imageType);
    setEditCaption(image.caption || '');
    setEditDialogOpen(true);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!selectedImage) return;

    try {
      await styleImageService.updateImage(styleId, selectedImage.id, {
        imageType: editImageType,
        caption: editCaption || undefined,
      });
      toast({
        title: 'Success',
        description: 'Image updated successfully',
      });
      setEditDialogOpen(false);
      setSelectedImage(null);
      loadImages();
    } catch (error) {
      console.error('Failed to update image:', error);
      toast({
        title: 'Error',
        description: 'Failed to update image',
        variant: 'destructive',
      });
    }
  };

  // Handle delete
  const handleDelete = (image: StyleImage) => {
    setSelectedImage(image);
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!selectedImage) return;

    try {
      await styleImageService.deleteImage(styleId, selectedImage.id);
      toast({
        title: 'Success',
        description: 'Image deleted successfully',
      });
      setDeleteDialogOpen(false);
      setSelectedImage(null);
      loadImages();
    } catch (error) {
      console.error('Failed to delete image:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete image',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Image Gallery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Image Gallery
            <Badge variant="secondary">{images.length}</Badge>
          </CardTitle>
          {editable && (
            <Button onClick={() => setUploadDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Image
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
              <p>No images yet</p>
              {editable && (
                <Button variant="outline" className="mt-2" onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-1" />
                  Upload First Image
                </Button>
              )}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {images.map((image) => (
                    <SortableImageItem
                      key={image.id}
                      image={image}
                      editable={editable}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Image</DialogTitle>
            <DialogDescription>Add a new image to the style gallery</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File input */}
            <div className="space-y-2">
              <Label>Image File</Label>
              {uploadPreview ? (
                <div className="relative">
                  <img src={uploadPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2 h-8 w-8 p-0"
                    onClick={() => {
                      setUploadFile(null);
                      setUploadPreview(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click to select an image</span>
                  </label>
                </div>
              )}
            </div>

            {/* Image type */}
            <div className="space-y-2">
              <Label>Image Type</Label>
              <Select value={uploadImageType} onValueChange={(value) => setUploadImageType(value as StyleImageType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select image type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(IMAGE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <Label>Caption (optional)</Label>
              <Input
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                placeholder="Enter image caption"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false);
                resetUploadForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
            <DialogDescription>Update image type and caption</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image type */}
            <div className="space-y-2">
              <Label>Image Type</Label>
              <Select value={editImageType} onValueChange={(value) => setEditImageType(value as StyleImageType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select image type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(IMAGE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <Label>Caption (optional)</Label>
              <Input
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="Enter image caption"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the image from the gallery.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default StyleGallery;
