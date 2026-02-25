/**
 * Mood Board List Page
 * Grid view of all mood boards with filtering
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Plus,
  Search,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Calendar,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { moodBoardService } from '@/services/moodBoard.service';
import type { MoodBoard, MoodBoardStatus } from '@/types/moodBoard.types';
import { formatDistanceToNow } from 'date-fns';

// Status badge colors
const STATUS_COLORS: Record<MoodBoardStatus, string> = {
  DRAFT: 'bg-gray-500',
  ACTIVE: 'bg-green-500',
  ARCHIVED: 'bg-orange-500',
};

// Mood board card component
function MoodBoardCard({
  moodBoard,
  onDelete,
}: {
  moodBoard: MoodBoard;
  onDelete: (moodBoard: MoodBoard) => void;
}) {
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

  // Get first image item as cover
  const coverImage = moodBoard.items.find(
    (item) => item.itemType === 'IMAGE' && item.imageUrl
  );

  return (
    <Card className="group relative overflow-hidden hover:shadow-lg transition-shadow">
      {/* Cover Image / Placeholder */}
      <div
        className="aspect-video relative bg-gray-100 cursor-pointer"
        onClick={() => navigate(`/mood-boards/${moodBoard.id}`)}
      >
        {coverImage?.imageUrl ? (
          <img
            src={`${backendUrl}${coverImage.imageUrl}`}
            alt={moodBoard.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <LayoutGrid className="h-12 w-12 text-gray-300" />
          </div>
        )}

        {/* Item count badge */}
        <Badge className="absolute bottom-2 left-2 bg-black/60 text-white">
          {moodBoard.items.length} items
        </Badge>

        {/* Status badge */}
        <Badge
          className={`absolute top-2 right-2 ${STATUS_COLORS[moodBoard.status]} text-white`}
        >
          {moodBoard.status}
        </Badge>

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/mood-boards/${moodBoard.id}`);
            }}
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(moodBoard);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info */}
      <CardContent className="p-4">
        <h3 className="font-semibold truncate">{moodBoard.name}</h3>
        {moodBoard.description && (
          <p className="text-sm text-gray-500 truncate">{moodBoard.description}</p>
        )}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          {moodBoard.season && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {moodBoard.season.name}
            </span>
          )}
          <span>
            {formatDistanceToNow(new Date(moodBoard.updatedAt), { addSuffix: true })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function MoodBoardList() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [moodBoards, setMoodBoards] = useState<MoodBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<MoodBoard | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Load mood boards
  const loadMoodBoards = useCallback(async () => {
    try {
      setLoading(true);
      const filters: Record<string, string> = {};
      if (search) filters.search = search;
      if (statusFilter !== 'all') filters.status = statusFilter;

      const { moodBoards: data } = await moodBoardService.getAll(filters);
      setMoodBoards(data);
    } catch (error) {
      console.error('Failed to load mood boards:', error);
      toast({
        title: 'Error',
        description: 'Failed to load mood boards',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, toast]);

  useEffect(() => {
    loadMoodBoards();
  }, [loadMoodBoards]);

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await moodBoardService.delete(deleteTarget.id);
      toast({
        title: 'Success',
        description: 'Mood board deleted',
      });
      setDeleteTarget(null);
      loadMoodBoards();
    } catch (error) {
      console.error('Failed to delete mood board:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete mood board',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-6 w-6" />
            Mood Boards
          </h1>
          <p className="text-gray-500">Collect inspiration for your designs</p>
        </div>
        <Button onClick={() => navigate('/mood-boards/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Mood Board
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search mood boards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-[4/3]" />
          ))}
        </div>
      ) : moodBoards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <LayoutGrid className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">No mood boards yet</p>
            <p className="text-sm text-gray-400 mb-4">
              Create your first mood board to start collecting inspiration
            </p>
            <Button onClick={() => navigate('/mood-boards/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Mood Board
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {moodBoards.map((moodBoard) => (
            <MoodBoardCard
              key={moodBoard.id}
              moodBoard={moodBoard}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mood Board?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}" and all its items.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default MoodBoardList;
