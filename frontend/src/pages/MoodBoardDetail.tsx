/**
 * Mood Board Detail Page
 * Free-form canvas editor for mood boards
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LayoutGrid, ArrowLeft, Upload, Type, Palette, Trash2, Settings, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { moodBoardService } from '@/services/moodBoard.service';
import { MoodBoardCanvas } from '@/components/MoodBoardCanvas';
import type { MoodBoard, MoodBoardItem, MoodBoardStatus } from '@/types/moodBoard.types';

// Preset colors for quick selection
const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#f43f5e',
  '#000000',
  '#374151',
  '#6b7280',
  '#9ca3af',
  '#ffffff',
];

export function MoodBoardDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNew = id === 'new' || !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [moodBoard, setMoodBoard] = useState<MoodBoard | null>(null);
  const [items, setItems] = useState<MoodBoardItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [, setHasChanges] = useState(false);

  // Form state for new/edit
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<MoodBoardStatus>('DRAFT');

  // Dialog states
  const [settingsOpen, setSettingsOpen] = useState(isNew);
  const [addTextOpen, setAddTextOpen] = useState(false);
  const [addColorOpen, setAddColorOpen] = useState(false);
  const [textTitle, setTextTitle] = useState('');
  const [textCaption, setTextCaption] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  // Load mood board
  const loadMoodBoard = useCallback(async () => {
    if (isNew) return;

    try {
      setLoading(true);
      const data = await moodBoardService.getById(id!);
      setMoodBoard(data);
      setItems(data.items);
      setName(data.name);
      setDescription(data.description || '');
      setStatus(data.status);
    } catch (error) {
      console.error('Failed to load mood board:', error);
      toast({
        title: 'Error',
        description: 'Failed to load mood board',
        variant: 'destructive',
      });
      navigate('/mood-boards');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, navigate, toast]);

  useEffect(() => {
    loadMoodBoard();
  }, [loadMoodBoard]);

  // Create new mood board
  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const created = await moodBoardService.create({
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      });
      setMoodBoard(created);
      setItems(created.items);
      setSettingsOpen(false);
      toast({
        title: 'Success',
        description: 'Mood board created',
      });
      // Update URL without full navigation
      window.history.replaceState(null, '', `/mood-boards/${created.id}`);
    } catch (error) {
      console.error('Failed to create mood board:', error);
      toast({
        title: 'Error',
        description: 'Failed to create mood board',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Update mood board settings
  const handleUpdateSettings = async () => {
    if (!moodBoard) return;

    try {
      setSaving(true);
      await moodBoardService.update(moodBoard.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      });
      setSettingsOpen(false);
      toast({
        title: 'Success',
        description: 'Settings saved',
      });
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !moodBoard) return;

    try {
      const newItem = await moodBoardService.addItem(moodBoard.id, file, {
        itemType: 'IMAGE',
        positionX: 100 + Math.random() * 200,
        positionY: 100 + Math.random() * 200,
        width: 200,
        height: 200,
      });
      setItems((prev) => [...prev, newItem]);
      setSelectedItemId(newItem.id);
      setHasChanges(true);
      toast({
        title: 'Success',
        description: 'Image added',
      });
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive',
      });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Add text item
  const handleAddText = async () => {
    if (!moodBoard || !textTitle.trim()) return;

    try {
      const newItem = await moodBoardService.addTextItem(
        moodBoard.id,
        textTitle.trim(),
        textCaption.trim() || undefined,
        100 + Math.random() * 200,
        100 + Math.random() * 200
      );
      setItems((prev) => [...prev, newItem]);
      setSelectedItemId(newItem.id);
      setAddTextOpen(false);
      setTextTitle('');
      setTextCaption('');
      setHasChanges(true);
      toast({
        title: 'Success',
        description: 'Text added',
      });
    } catch (error) {
      console.error('Failed to add text:', error);
      toast({
        title: 'Error',
        description: 'Failed to add text',
        variant: 'destructive',
      });
    }
  };

  // Add color item
  const handleAddColor = async () => {
    if (!moodBoard) return;

    try {
      const newItem = await moodBoardService.addColorItem(
        moodBoard.id,
        selectedColor,
        undefined,
        100 + Math.random() * 200,
        100 + Math.random() * 200
      );
      setItems((prev) => [...prev, newItem]);
      setSelectedItemId(newItem.id);
      setAddColorOpen(false);
      setHasChanges(true);
      toast({
        title: 'Success',
        description: 'Color swatch added',
      });
    } catch (error) {
      console.error('Failed to add color:', error);
      toast({
        title: 'Error',
        description: 'Failed to add color',
        variant: 'destructive',
      });
    }
  };

  // Update item position/size
  const handleItemUpdate = async (itemId: string, updates: Record<string, unknown>) => {
    if (!moodBoard) return;

    // Update local state immediately
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
    setHasChanges(true);

    // Debounced save to server (simplified - just save immediately for now)
    try {
      await moodBoardService.updateItem(moodBoard.id, itemId, updates);
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  // Delete item
  const handleItemDelete = async (itemId: string) => {
    if (!moodBoard) return;

    try {
      await moodBoardService.deleteItem(moodBoard.id, itemId);
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setSelectedItemId(null);
      toast({
        title: 'Success',
        description: 'Item deleted',
      });
    } catch (error) {
      console.error('Failed to delete item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
    }
  };

  // Bring to front / send to back
  const handleBringToFront = async () => {
    if (!moodBoard || !selectedItemId) return;

    const maxZ = Math.max(...items.map((i) => i.zIndex), 0);
    await handleItemUpdate(selectedItemId, { zIndex: maxZ + 1 });
  };

  const handleSendToBack = async () => {
    if (!moodBoard || !selectedItemId) return;

    const minZ = Math.min(...items.map((i) => i.zIndex), 0);
    await handleItemUpdate(selectedItemId, { zIndex: minZ - 1 });
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Skeleton className="h-16 w-16 rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/mood-boards')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-gray-600" />
            <span className="font-semibold">{moodBoard ? moodBoard.name : 'New Mood Board'}</span>
            {moodBoard && <Badge variant="secondary">{moodBoard.status}</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Toolbar */}
        <div className="w-16 border-r bg-gray-50 flex flex-col items-center py-4 gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

          <Button
            variant="ghost"
            size="sm"
            className="w-12 h-12 flex flex-col items-center justify-center"
            onClick={() => fileInputRef.current?.click()}
            disabled={!moodBoard}
            title="Add Image"
          >
            <Upload className="h-5 w-5" />
            <span className="text-[10px] mt-1">Image</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-12 h-12 flex flex-col items-center justify-center"
            onClick={() => setAddTextOpen(true)}
            disabled={!moodBoard}
            title="Add Text"
          >
            <Type className="h-5 w-5" />
            <span className="text-[10px] mt-1">Text</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="w-12 h-12 flex flex-col items-center justify-center"
            onClick={() => setAddColorOpen(true)}
            disabled={!moodBoard}
            title="Add Color"
          >
            <Palette className="h-5 w-5" />
            <span className="text-[10px] mt-1">Color</span>
          </Button>

          <div className="flex-1" />

          {selectedItemId && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="w-12 h-12 flex flex-col items-center justify-center"
                onClick={handleBringToFront}
                title="Bring to Front"
              >
                <ChevronUp className="h-5 w-5" />
                <span className="text-[10px] mt-1">Front</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="w-12 h-12 flex flex-col items-center justify-center"
                onClick={handleSendToBack}
                title="Send to Back"
              >
                <ChevronDown className="h-5 w-5" />
                <span className="text-[10px] mt-1">Back</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="w-12 h-12 flex flex-col items-center justify-center text-red-500"
                onClick={() => handleItemDelete(selectedItemId)}
                title="Delete"
              >
                <Trash2 className="h-5 w-5" />
                <span className="text-[10px] mt-1">Delete</span>
              </Button>
            </>
          )}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-hidden">
          {moodBoard ? (
            <MoodBoardCanvas
              items={items}
              canvasWidth={moodBoard.canvasWidth}
              canvasHeight={moodBoard.canvasHeight}
              editable={true}
              onItemUpdate={handleItemUpdate}
              onItemDelete={handleItemDelete}
              selectedItemId={selectedItemId}
              onItemSelect={setSelectedItemId}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <LayoutGrid className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p>Create a mood board to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? 'Create Mood Board' : 'Mood Board Settings'}</DialogTitle>
            <DialogDescription>
              {isNew ? 'Give your mood board a name to get started' : 'Update mood board settings'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Spring 2026 Collection"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this mood board..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as MoodBoardStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            {!isNew && (
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
            )}
            <Button onClick={isNew ? handleCreate : handleUpdateSettings} disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Text Dialog */}
      <Dialog open={addTextOpen} onOpenChange={setAddTextOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Text</DialogTitle>
            <DialogDescription>Add a text note to your mood board</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="e.g., Color Palette Notes"
              />
            </div>

            <div className="space-y-2">
              <Label>Caption</Label>
              <Textarea
                value={textCaption}
                onChange={(e) => setTextCaption(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTextOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddText} disabled={!textTitle.trim()}>
              Add Text
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Color Dialog */}
      <Dialog open={addColorOpen} onOpenChange={setAddColorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Color Swatch</DialogTitle>
            <DialogDescription>Select a color for your mood board</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-lg border-2 border-gray-200"
                  style={{ backgroundColor: selectedColor }}
                />
                <Input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  placeholder="#000000"
                  className="w-24"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preset Colors</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-lg border-2 ${
                      selectedColor === color ? 'border-blue-500' : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSelectedColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddColorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddColor}>Add Color</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MoodBoardDetail;
