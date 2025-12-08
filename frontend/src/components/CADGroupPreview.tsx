/**
 * CADGroupPreview Component
 *
 * Shows a preview of how fabrics will be grouped for CAD planning.
 * Groups are based on: fabric name + finish type + usable width + embroidery state
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Scissors, Sparkles } from 'lucide-react';

interface FabricEntry {
  id: string;
  componentName: string;
  genericFabricName: string;
  fabricFinishType: string;
  usableWidth?: number | null;
  hasEmbroidery?: boolean;
  embroideryId?: string | null;
  embroideryName?: string | null;
  allowCombinedCutting?: boolean;
}

interface CADGroupPreviewProps {
  fabrics: FabricEntry[];
}

interface CADGroup {
  key: string;
  fabricName: string;
  finishType: string;
  usableWidth: number | null;
  hasEmbroidery: boolean;
  embroideryName: string | null;
  components: string[];
  canCombine: boolean;
}

export function CADGroupPreview({ fabrics }: CADGroupPreviewProps) {
  const groups = useMemo(() => {
    const groupMap = new Map<string, CADGroup>();

    fabrics.forEach((fabric) => {
      if (!fabric.genericFabricName) return;

      // Generate CAD group key
      const embroideryPart = fabric.hasEmbroidery && fabric.embroideryId
        ? `EMB-${fabric.embroideryId.substring(0, 8)}`
        : 'PLAIN';

      const widthPart = fabric.usableWidth ? fabric.usableWidth.toString() : 'UNK';
      const finishPart = fabric.fabricFinishType || 'RAW';

      // If not allowing combined cutting, make it unique per component
      const groupKey = fabric.allowCombinedCutting === false
        ? `${fabric.genericFabricName}-${finishPart}-${widthPart}-${embroideryPart}-${fabric.componentName}`
        : `${fabric.genericFabricName}-${finishPart}-${widthPart}-${embroideryPart}`;

      const existing = groupMap.get(groupKey);
      if (existing) {
        if (!existing.components.includes(fabric.componentName)) {
          existing.components.push(fabric.componentName);
        }
      } else {
        groupMap.set(groupKey, {
          key: groupKey,
          fabricName: fabric.genericFabricName,
          finishType: finishPart,
          usableWidth: fabric.usableWidth || null,
          hasEmbroidery: !!fabric.hasEmbroidery,
          embroideryName: fabric.embroideryName || null,
          components: [fabric.componentName],
          canCombine: fabric.allowCombinedCutting !== false,
        });
      }
    });

    return Array.from(groupMap.values());
  }, [fabrics]);

  if (fabrics.length === 0 || !fabrics.some(f => f.genericFabricName)) {
    return null;
  }

  return (
    <Card className="bg-gray-50 border-dashed">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Layers className="h-4 w-4 text-blue-600" />
          CAD Groups Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4">
        {groups.length === 0 ? (
          <p className="text-sm text-gray-500">
            Add fabrics with generic names to see CAD groups
          </p>
        ) : (
          <div className="space-y-2">
            {groups.map((group, index) => (
              <div
                key={group.key}
                className="flex items-center gap-2 p-2 bg-white rounded border text-sm"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium">{group.fabricName}</span>
                    <Badge variant="outline" className="text-xs">
                      {group.finishType}
                    </Badge>
                    {group.usableWidth && (
                      <Badge variant="secondary" className="text-xs">
                        {group.usableWidth}"
                      </Badge>
                    )}
                    {group.hasEmbroidery && (
                      <Badge className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-100">
                        <Sparkles className="h-3 w-3 mr-1" />
                        {group.embroideryName || 'Embroidered'}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <Scissors className="h-3 w-3" />
                    {group.components.length > 1 && group.canCombine
                      ? `${group.components.join(', ')} (combined cutting possible)`
                      : group.components.join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Fabrics with matching name, finish, width & embroidery can be cut together.
        </p>
      </CardContent>
    </Card>
  );
}

export default CADGroupPreview;
