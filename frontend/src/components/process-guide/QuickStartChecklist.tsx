import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, CheckCircle2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { masterDataItems } from '@/config/processStages';

export default function QuickStartChecklist() {
  const [isExpanded, setIsExpanded] = useState(false);

  const phaseOrder: Array<'foundation' | 'business' | 'masters' | 'quality' | 'finance'> = [
    'foundation',
    'business',
    'masters',
    'quality',
    'finance',
  ];

  const phaseLabels = {
    foundation: 'Foundation Setup',
    business: 'Business Entities',
    masters: 'Master Data',
    quality: 'Quality & Testing',
    finance: 'Financial Setup',
  };

  const phaseColors = {
    foundation: 'bg-blue-100 text-blue-700 border-blue-200',
    business: 'bg-green-100 text-green-700 border-green-200',
    masters: 'bg-purple-100 text-purple-700 border-purple-200',
    quality: 'bg-orange-100 text-orange-700 border-orange-200',
    finance: 'bg-pink-100 text-pink-700 border-pink-200',
  };

  const groupedItems = phaseOrder.map((phase) => ({
    phase,
    label: phaseLabels[phase],
    color: phaseColors[phase],
    items: masterDataItems.filter((item) => item.phase === phase).sort((a, b) => a.priority - b.priority),
  }));

  return (
    <Card className="border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-indigo-900">
              <CheckCircle2 className="h-5 w-5" />
              Quick Start Checklist
            </CardTitle>
            <CardDescription>Set up essential master data before creating styles</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100"
          >
            {isExpanded ? (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Hide Checklist
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4 mr-1" />
                View Checklist
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {groupedItems.map(({ phase, label, color, items }) => (
            <div key={phase} className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium border ${color}`}>
                  Phase {phaseOrder.indexOf(phase) + 1}
                </span>
                {label}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    to={item.path}
                    className="group flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                  >
                    <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-700">
                          {item.title}
                        </span>
                        <ExternalLink className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-indigo-200">
            <p className="text-sm text-indigo-700 font-medium">
              Complete these steps before creating your first style to ensure smooth workflow.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
