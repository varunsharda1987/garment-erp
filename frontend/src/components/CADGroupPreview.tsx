/**
 * CADGroupPreview Component
 *
 * Shows a preview of how fabrics will be grouped for CAD planning.
 * Groups are based on: fabric name + finish type + embroidery state
 * Width is determined during CAD Planning stage, not here.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Scissors, Sparkles } from 'lucide-react';

interface FabricEntry {
  id: string;
  componentName: string;
  genericGreigeName: string;
  fabricFinishType: string;
  hasEmbroidery?: boolean;
  embroideryId?: string | null;
  embroideryName?: string | null;
}

interface CADGroupPreviewProps {
  fabrics: FabricEntry[];
}

interface CADGroup {
  key: string;
  fabricName: string;
  finishType: string;
  hasEmbroidery: boolean;
  embroideryName: string | null;
  components: string[];
}

export function CADGroupPreview({ fabrics }: CADGroupPreviewProps) {
  const groups = useMemo(() => {
    const groupMap = new Map<string, CADGroup>();

    fabrics.forEach((fabric) => {
      if (!fabric.genericGreigeName) return;

      // Generate CAD group key based on fabric name + finish type + embroidery
      // hasEmbroidery alone determines if it's embroidered - embroideryId is optional
      const embroideryPart = fabric.hasEmbroidery
        ? fabric.embroideryId
          ? `EMB-${fabric.embroideryId.substring(0, 8)}`
          : 'EMB-PENDING'
        : 'NO_EMB';
      const finishPart = fabric.fabricFinishType || 'RAW';

      // Group by fabric + finish + embroidery (width will be selected in CAD Planning)
      const groupKey = `${fabric.genericGreigeName}-${finishPart}-${embroideryPart}`;

      const existing = groupMap.get(groupKey);
      if (existing) {
        if (!existing.components.includes(fabric.componentName)) {
          existing.components.push(fabric.componentName);
        }
      } else {
        groupMap.set(groupKey, {
          key: groupKey,
          fabricName: fabric.genericGreigeName,
          finishType: finishPart,
          hasEmbroidery: !!fabric.hasEmbroidery,
          embroideryName: fabric.embroideryName || null,
          components: [fabric.componentName],
        });
      }
    });

    return Array.from(groupMap.values());
  }, [fabrics]);

  if (fabrics.length === 0 || !fabrics.some((f) => f.genericGreigeName)) {
    return null;
  }

  return (
    <Card className="bg-muted border-dashed">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Layers className="h-4 w-4 text-info" />
          CAD Groups Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4">
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add fabrics with generic names to see CAD groups</p>
        ) : (
          <div className="space-y-2">
            {groups.map((group, index) => (
              <div key={group.key} className="flex items-center gap-2 p-2 bg-card rounded border text-sm">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-info-muted text-info flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium">{group.fabricName}</span>
                    <Badge variant="outline" className="text-xs">
                      {group.finishType}
                    </Badge>
                    {group.hasEmbroidery && (
                      <Badge className="text-xs bg-accent/10 text-accent hover:bg-accent/10">
                        <Sparkles className="h-3 w-3 mr-1" />
                        {group.embroideryName || 'Embroidered'}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Scissors className="h-3 w-3" />
                    {group.components.join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Fabrics with matching name, finish & embroidery will be grouped for CAD Planning.
        </p>
      </CardContent>
    </Card>
  );
}

export default CADGroupPreview;
