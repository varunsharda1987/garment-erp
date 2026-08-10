// Tax & GST hub — static directory of the tax/compliance pages.
// Cards are filtered by the same permission keys as the route guards, so a
// role never sees a card it cannot open.
import { useNavigate } from 'react-router-dom';
import { Hash, Calculator, FileText, FileMinus, FilePlus, ExternalLink, Landmark } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionKey } from '@/config/permissions.config';

interface TaxTool {
  title: string;
  description: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: PermissionKey;
}

const TAX_TOOLS: TaxTool[] = [
  {
    title: 'GST Reports',
    description: 'GSTR-1 and GSTR-3B summaries for filing',
    route: '/gst-reports',
    icon: Landmark,
  },
  {
    title: 'HSN/SAC Codes',
    description: 'HSN and SAC code master with GST rates',
    route: '/hsn-sac-masters',
    icon: Hash,
  },
  {
    title: 'Tax Masters',
    description: 'Tax rates and configurations',
    route: '/tax-masters',
    icon: Calculator,
    permission: 'financialMasters',
  },
  {
    title: 'Credit Notes',
    description: 'Customer returns and invoice adjustments',
    route: '/credit-notes',
    icon: FileMinus,
    permission: 'creditDebitNotes',
  },
  {
    title: 'Debit Notes',
    description: 'Supplier returns and purchase adjustments',
    route: '/debit-notes',
    icon: FilePlus,
    permission: 'creditDebitNotes',
  },
  {
    title: 'TDS Tracking',
    description: 'Tax deducted at source records',
    route: '/tds',
    icon: FileText,
    permission: 'financialMasters',
  },
  {
    title: 'TCS Tracking',
    description: 'Tax collected at source records',
    route: '/tcs',
    icon: FileText,
    permission: 'financialMasters',
  },
];

export default function TaxCompliancePage() {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const visibleTools = TAX_TOOLS.filter((tool) => !tool.permission || can(tool.permission));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-display font-medium text-foreground">Tax & GST</h1>
        <p className="text-muted-foreground mt-1">GST filing, tax masters, and TDS/TCS tracking</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card
              key={tool.route}
              className="group cursor-pointer border-2 hover:border-primary transition-all"
              onClick={() => navigate(tool.route)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium group-hover:text-primary transition-colors">{tool.title}</div>
                      <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
