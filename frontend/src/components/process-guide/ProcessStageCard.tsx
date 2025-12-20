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
    bg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    badge: 'bg-blue-100 text-blue-700 border-blue-300',
    border: 'border-blue-200',
  },
  'order-management': {
    bg: 'bg-gradient-to-r from-green-500 to-emerald-600',
    badge: 'bg-green-100 text-green-700 border-green-300',
    border: 'border-green-200',
  },
  production: {
    bg: 'bg-gradient-to-r from-orange-500 to-amber-600',
    badge: 'bg-orange-100 text-orange-700 border-orange-300',
    border: 'border-orange-200',
  },
  fulfillment: {
    bg: 'bg-gradient-to-r from-purple-500 to-violet-600',
    badge: 'bg-purple-100 text-purple-700 border-purple-300',
    border: 'border-purple-200',
  },
};

export default function ProcessStageCard({
  stage,
  isExpanded,
  onToggle,
}: ProcessStageCardProps) {
  const colors = categoryColors[stage.category];

  return (
    <Card className={`border-2 ${colors.border} hover:shadow-lg transition-shadow`}>
      <CardHeader
        className="cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
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
                <Badge
                  variant="outline"
                  className={`${colors.badge} border text-xs`}
                >
                  {stage.category.replace('-', ' ')}
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-600">{stage.description}</p>
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
            {isExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6 pt-0">
          {/* Purpose */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Purpose</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              {stage.purpose}
            </p>
          </div>

          {/* Prerequisites */}
          {stage.prerequisites.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">
                Prerequisites
              </h4>
              <ul className="space-y-2">
                {stage.prerequisites.map((prereq, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    {prereq.required ? (
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    )}
                    <span className="text-gray-600">
                      {prereq.condition}
                      {prereq.required && (
                        <span className="text-red-600 font-medium ml-1">
                          (Required)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key Actions / Pages */}
          {stage.pages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">
                Key Actions
              </h4>
              <div className="flex flex-wrap gap-2">
                {stage.pages.map((page, index) => (
                  <Link
                    key={index}
                    to={page.path}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-sm text-indigo-700 hover:text-indigo-900 transition-colors"
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
          {stage.statusFlow.length > 0 && (
            <StageStatusFlow statusFlow={stage.statusFlow} />
          )}

          {/* Database Models */}
          {stage.databaseModels.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Database Models
              </h4>
              <div className="flex flex-wrap gap-2">
                {stage.databaseModels.map((model, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="font-mono text-xs"
                  >
                    {model}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Key Fields */}
          {stage.keyFields && stage.keyFields.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">
                Key Fields
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {stage.keyFields.map((field, index) => (
                  <li
                    key={index}
                    className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded"
                  >
                    {field}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tips */}
          {stage.tips && stage.tips.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Tips
              </h4>
              <ul className="space-y-2">
                {stage.tips.map((tip, index) => (
                  <li
                    key={index}
                    className="text-sm text-gray-600 pl-6 relative before:content-['•'] before:absolute before:left-2 before:text-yellow-500"
                  >
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gates / Blockers */}
          {stage.gates && stage.gates.length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4" />
                Critical Gate
              </h4>
              <ul className="space-y-1">
                {stage.gates.map((gate, index) => (
                  <li key={index} className="text-sm text-red-600 font-medium">
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
