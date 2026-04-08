// MaterialCategorySelector - Modal to select material category before creation
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Scissors, Shirt, Zap, Tag, Box, Layers, Sparkles } from 'lucide-react';

interface MaterialCategorySelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CategoryOption {
  id: string;
  name: string;
  description: string;
  route: string;
  icon: React.ReactNode;
  color: string;
}

const MaterialCategorySelector: React.FC<MaterialCategorySelectorProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();

  // Define category options with their respective routes
  const categories: CategoryOption[] = [
    {
      id: 'greige',
      name: 'Greige Fabric',
      description: 'Unfinished/raw fabric',
      route: '/greige/new',
      icon: <Layers className="h-6 w-6" />,
      color: 'bg-muted hover:bg-gray-200 border-border',
    },
    {
      id: 'fabric',
      name: 'Finished Fabric',
      description: 'Finished/processed fabric',
      route: '/fabric/new',
      icon: <Shirt className="h-6 w-6" />,
      color: 'bg-info-muted hover:bg-info/15 border-info/30',
    },
    {
      id: 'lace',
      name: 'Lace',
      description: 'Decorative lace materials',
      route: '/materials/lace/new',
      icon: <Sparkles className="h-6 w-6" />,
      color: 'bg-pink-100 hover:bg-pink-200 border-pink-300',
    },
    {
      id: 'button',
      name: 'Buttons',
      description: 'Button materials',
      route: '/materials/button/new',
      icon: <Package className="h-6 w-6" />,
      color: 'bg-accent/10 hover:bg-accent/15 border-accent/25',
    },
    {
      id: 'thread',
      name: 'Threads',
      description: 'Sewing thread materials',
      route: '/materials/thread/new',
      icon: <Scissors className="h-6 w-6" />,
      color: 'bg-success-muted hover:bg-success/15 border-success/25',
    },
    {
      id: 'zipper',
      name: 'Zippers',
      description: 'Zipper materials',
      route: '/materials/zipper/new',
      icon: <Zap className="h-6 w-6" />,
      color: 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300',
    },
    {
      id: 'elastic',
      name: 'Elastic',
      description: 'Elastic materials',
      route: '/materials/elastic/new',
      icon: <Zap className="h-6 w-6" />,
      color: 'bg-orange-100 hover:bg-orange-200 border-orange-300',
    },
    {
      id: 'label',
      name: 'Labels',
      description: 'Label materials',
      route: '/materials/label/new',
      icon: <Tag className="h-6 w-6" />,
      color: 'bg-primary/10 hover:bg-primary/15 border-primary/30',
    },
    {
      id: 'packaging',
      name: 'Packaging',
      description: 'Packaging materials',
      route: '/materials/packaging/new',
      icon: <Box className="h-6 w-6" />,
      color: 'bg-teal-100 hover:bg-teal-200 border-teal-300',
    },
    {
      id: 'general',
      name: 'General Material',
      description: 'Other materials',
      route: '/materials/new',
      icon: <Package className="h-6 w-6" />,
      color: 'bg-muted hover:bg-gray-200 border-border',
    },
  ];

  const handleCategorySelect = (route: string) => {
    onOpenChange(false);
    navigate(route);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Material Category</DialogTitle>
          <DialogDescription>Choose the type of material you want to create</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategorySelect(category.route)}
              className={`flex flex-col items-center p-4 rounded-lg border-2 transition-colors ${category.color}`}
            >
              <div className="mb-2 text-foreground">{category.icon}</div>
              <div className="text-sm font-medium text-foreground mb-1">{category.name}</div>
              <div className="text-xs text-muted-foreground text-center">{category.description}</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialCategorySelector;
