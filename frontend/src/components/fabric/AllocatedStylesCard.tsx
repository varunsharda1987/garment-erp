/**
 * AllocatedStylesCard Component
 * Displays the styles, components, and pattern parts that a fabric is allocated to.
 * Can be used in both read-only mode (FabricDetail) and editable mode (FabricForm).
 */

import { Shirt, Layers, Puzzle, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { FabricStyleAllocation } from '@/types/fabric-greige.types';
import { formatStyleCodeWithRef } from '@/utils/style-ref-format';

interface AllocatedStylesCardProps {
  allocations: FabricStyleAllocation[];
  onRemove?: (allocationId: string) => void;
  editable?: boolean;
  isLoading?: boolean;
}

export default function AllocatedStylesCard({
  allocations,
  onRemove,
  editable = false,
  isLoading = false,
}: AllocatedStylesCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shirt className="h-5 w-5" />
            Allocated Styles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-muted-foreground">Loading allocations...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allocations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shirt className="h-5 w-5" />
            Allocated Styles
          </CardTitle>
          <CardDescription>This fabric is not allocated to any styles yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 bg-muted rounded-lg border-2 border-dashed border-border">
            <Shirt className="h-10 w-10 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-muted-foreground">
              {editable ? 'Click "Allocate to Style" to assign this fabric to a style.' : 'No style allocations found.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group allocations by style
  const groupedByStyle = allocations.reduce(
    (acc, allocation) => {
      const styleId = allocation.component?.style?.id || 'unknown';
      if (!acc[styleId]) {
        acc[styleId] = {
          style: allocation.component?.style,
          allocations: [],
        };
      }
      acc[styleId].allocations.push(allocation);
      return acc;
    },
    {} as Record<string, { style: FabricStyleAllocation['component']['style']; allocations: FabricStyleAllocation[] }>
  );

  const styleGroups = Object.values(groupedByStyle);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shirt className="h-5 w-5" />
          Allocated Styles
          <Badge variant="secondary" className="ml-2">
            {allocations.length} allocation{allocations.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
        <CardDescription>Styles and components using this fabric</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {styleGroups.map((group, groupIndex) => (
            <AccordionItem key={group.style?.id || groupIndex} value={group.style?.id || String(groupIndex)}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <Shirt className="h-4 w-4 text-info" />
                  <div>
                    <div className="font-medium">
                      {group.style?.styleCode
                        ? formatStyleCodeWithRef(group.style.styleCode, group.style.buyerStyleRef)
                        : 'Unknown Style'}
                      {!group.style?.isActive && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground font-normal">{group.style?.styleName || ''}</div>
                  </div>
                  <Badge variant="outline" className="ml-auto mr-2">
                    {group.allocations.length} component{group.allocations.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-7 space-y-3">
                  {group.allocations.map((allocation) => (
                    <div
                      key={allocation.id}
                      className="border rounded-lg p-3 bg-muted hover:bg-muted transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          <Layers className="h-4 w-4 text-success mt-0.5" />
                          <div>
                            <div className="font-medium text-sm">
                              {allocation.component?.componentName || 'Unknown Component'}
                              {allocation.component?.componentCode && (
                                <span className="text-muted-foreground ml-1">
                                  ({allocation.component.componentCode})
                                </span>
                              )}
                            </div>

                            {/* Pattern Parts */}
                            {allocation.patternParts.length > 0 && (
                              <div className="mt-2">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                  <Puzzle className="h-3 w-3" />
                                  Pattern Parts:
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {allocation.patternParts.map((part) => (
                                    <Badge key={part.id} variant="secondary" className="text-xs">
                                      {part.patternPart?.name || 'Unknown'}
                                      {part.quantity > 1 && ` ×${part.quantity}`}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Notes */}
                            {allocation.notes && (
                              <p className="text-xs text-muted-foreground mt-2 italic">Note: {allocation.notes}</p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {group.style?.id && (
                            <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                              <Link to={`/styles/${group.style.id}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          )}

                          {editable && onRemove && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Allocation</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove this fabric allocation from{' '}
                                    <strong>
                                      {formatStyleCodeWithRef(group.style?.styleCode || '', group.style?.buyerStyleRef)}
                                    </strong>{' '}
                                    - {allocation.component?.componentName}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => onRemove(allocation.id)}
                                    className="bg-destructive hover:bg-destructive"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
