import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  Database,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageStatusFlow from './StageStatusFlow';
import type { ProcessStage } from '@/types/processGuide.types';

interface ProcessStageCardProps {
  stage: ProcessStage;
  isExpanded: boolean;
  onToggle: () => void;
}

const categoryColors = {
  'pre-production': {
    bg: 'bg-gradient-to-r from-info-muted0 to-primary',
    badge: 'bg-info-muted text-info border-info/30',
    border: 'border-info/20',
  },
  'order-management': {
    bg: 'bg-gradient-to-r from-success to-emerald-600',
    badge: 'bg-success-muted text-success border-success/25',
    border: 'border-success/20',
  },
  production: {
    bg: 'bg-gradient-to-r from-orange-500 to-warning',
    badge: 'bg-orange-100 text-primary border-orange-300',
    border: 'border-orange-200',
  },
  fulfillment: {
    bg: 'bg-gradient-to-r from-accent/50 to-violet-600',
    badge: 'bg-accent/10 text-accent border-accent/25',
    border: 'border-accent/20',
  },
};

export default function ProcessStageCard({ stage, isExpanded, onToggle }: ProcessStageCardProps) {
  const colors = categoryColors[stage.category];

  return (
    <Card className={`border-2 ${colors.border} hover:shadow-lg transition-shadow`}>
      <CardHeader className="cursor-pointer hover:bg-muted" onClick={onToggle}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {/* Stage Number */}
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-lg ${colors.bg} text-white flex items-center justify-center font-bold text-lg`}
            >
              {stage.order}
            </div>

            {/* Stage Title and Description */}
            <div className="flex-1 min-w-0">
              <CardTitle className="flex items-center gap-3 mb-2">
                <span className="flex items-center gap-2">
                  {stage.icon}
                  {stage.title}
                </span>
                <Badge variant="outline" className={`${colors.badge} border text-xs`}>
                  {stage.category.replace('-', ' ')}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{stage.description}</p>
            </div>
          </div>

          {/* Expand/Collapse Button */}
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6 pt-0">
          {/* Purpose */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Purpose</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{stage.purpose}</p>
          </div>

          {/* Prerequisites */}
          {stage.prerequisites.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Prerequisites</h4>
              <ul className="space-y-2">
                {stage.prerequisites.map((prereq, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    {prereq.required ? (
                      <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                    )}
                    <span className="text-muted-foreground">
                      {prereq.condition}
                      {prereq.required && <span className="text-destructive font-medium ml-1">(Required)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key Actions / Pages */}
          {stage.pages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Key Actions</h4>
              <div className="flex flex-wrap gap-2">
                {stage.pages.map((page, index) => (
                  <Link
                    key={index}
                    to={page.path}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 hover:bg-primary/10 border border-primary/20 text-sm text-primary hover:text-primary transition-colors"
                  >
                    {page.icon}
                    <span>{page.title}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Status Flow */}
          {stage.statusFlow.length > 0 && <StageStatusFlow statusFlow={stage.statusFlow} />}

          {/* Database Models */}
          {stage.databaseModels.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Database className="h-4 w-4" />
                Database Models
              </h4>
              <div className="flex flex-wrap gap-2">
                {stage.databaseModels.map((model, index) => (
                  <Badge key={index} variant="secondary" className="font-mono text-xs">
                    {model}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Key Fields */}
          {stage.keyFields && stage.keyFields.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Key Fields</h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {stage.keyFields.map((field, index) => (
                  <li key={index} className="text-sm text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                    {field}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tips */}
          {stage.tips && stage.tips.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Tips
              </h4>
              <ul className="space-y-2">
                {stage.tips.map((tip, index) => (
                  <li
                    key={index}
                    className="text-sm text-muted-foreground pl-6 relative before:content-['•'] before:absolute before:left-2 before:text-yellow-500"
                  >
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gates / Blockers */}
          {stage.gates && stage.gates.length > 0 && (
            <div className="bg-destructive/10 border-2 border-destructive/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-destructive flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4" />
                Critical Gate
              </h4>
              <ul className="space-y-1">
                {stage.gates.map((gate, index) => (
                  <li key={index} className="text-sm text-destructive font-medium">
                    {gate}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
