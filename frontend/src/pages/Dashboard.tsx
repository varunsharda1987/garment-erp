import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { styleService } from '@/services/style.service';
import type { DashboardSummary } from '@/types/style.types';
import { ProductionStage } from '@/types/style.types';
import { logError } from '@/lib/logger';
import { notify } from '@/lib/notify';
import api from '@/lib/api';

// Sample summary type
interface SampleSummary {
  pendingSamples: number;
  overdueSamples: number;
  awaitingFeedback: number;
  approachingDeadlines: Array<{
    id: string;
    sampleNumber: string;
    sampleType: string;
    requiredDate: string;
    styleCode?: string;
    buyerStyleRef?: string;
    customerName?: string;
  }>;
}

// ── Reusable stage card ────────────────────────────────────────────────────
interface StageCardProps {
  label: string;
  styleCount: number | undefined;
  pieces: number | undefined;
  loading: boolean;
  accentClass: string; // Tailwind border-l color class
  onClick: () => void;
}

function StageCard({ label, styleCount, pieces, loading, accentClass, onClick }: StageCardProps) {
  return (
    <Card
      className={`border-l-4 ${accentClass} cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-px`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardDescription className="text-xs text-muted-foreground">{label}</CardDescription>
        <CardTitle className="text-3xl font-display font-medium text-foreground">
          {loading ? '—' : (styleCount ?? 0)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{loading ? 'Loading…' : `${pieces ?? 0} pieces`}</p>
      </CardContent>
    </Card>
  );
}

// ── Section heading with dot indicator ────────────────────────────────────
interface SectionHeadingProps {
  label: string;
  dotClass: string; // Tailwind bg color class
}

function SectionHeading({ label, dotClass }: SectionHeadingProps) {
  return (
    <h3 className="text-base font-sans font-medium text-foreground mb-3 flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dotClass} flex-shrink-0`} />
      {label}
    </h3>
  );
}

// ── Quick action button ────────────────────────────────────────────────────
interface QuickActionProps {
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}

function QuickAction({ icon, label, description, onClick, disabled }: QuickActionProps) {
  return (
    <Button
      variant="outline"
      className="h-auto py-4 flex-col gap-1 border-border hover:border-primary/40 hover:bg-muted/50 transition-all duration-150 disabled:opacity-40"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="font-sans font-medium text-sm text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </Button>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sampleSummary, setSampleSummary] = useState<SampleSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    fetchSampleSummary();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await styleService.getDashboardSummary();
      setSummary(data);
    } catch (err) {
      logError('Failed to fetch dashboard data:', err);
      // BUG-DASH13-15 fix: notify user on error
      notify.error('Failed to load dashboard data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSampleSummary = async () => {
    try {
      const response = await api.get<{ data: SampleSummary }>('/dashboard/sample-summary');
      setSampleSummary(response.data.data);
    } catch (err) {
      logError('Failed to fetch sample summary:', err);
    }
  };

  const handleCardClick = (stage: ProductionStage) => {
    const stageRoutes: Partial<Record<ProductionStage, string>> = {
      [ProductionStage.ORDER_RECEIVED]: '/orders',
      [ProductionStage.PENDING_COSTING]: '/cost-sheets',
      [ProductionStage.PENDING_GREIGE_ORDER]: '/procurement/requirements?tab=material',
      [ProductionStage.TRIMS_NOT_ORDERED]: '/procurement/requirements?tab=material',
      [ProductionStage.IN_PRINTING]: '/manufacturing/printing',
      [ProductionStage.IN_DYING]: '/manufacturing/dyeing',
      [ProductionStage.IN_EMBROIDERY]: '/job-work-orders?processType=EMBROIDERY',
      [ProductionStage.IN_HANDWORK]: '/procurement/requirements?tab=outsourced',
      [ProductionStage.IN_CUTTING]: '/manufacturing/cutting',
      [ProductionStage.IN_STITCHING]: '/manufacturing/stitching',
      [ProductionStage.IN_FINISHING]: '/manufacturing/finishing',
      [ProductionStage.READY_TO_SHIP]: '/manufacturing/dispatch',
    };
    navigate(stageRoutes[stage] ?? `/styles?stage=${stage}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-1">
      {/* ── Welcome ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="font-display text-display-sm font-medium text-foreground mb-1">Welcome back, {user?.name}</h2>
        <p className="text-sm text-muted-foreground">
          Here's what's happening with your garment manufacturing operations today.
        </p>
      </div>

      {/* ── Pre-Production ──────────────────────────────────────── */}
      <div className="mb-7">
        <SectionHeading label="Pre-Production — Pending Actions" dotClass="bg-primary" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StageCard
            label="Orders Received"
            styleCount={summary?.preProduction.ordersReceived.styleCount}
            pieces={summary?.preProduction.ordersReceived.pieces}
            loading={loading}
            accentClass="border-l-primary"
            onClick={() => handleCardClick(ProductionStage.ORDER_RECEIVED)}
          />
          <StageCard
            label="Pending Costing"
            styleCount={summary?.preProduction.pendingCosting.styleCount}
            pieces={summary?.preProduction.pendingCosting.pieces}
            loading={loading}
            accentClass="border-l-primary"
            onClick={() => handleCardClick(ProductionStage.PENDING_COSTING)}
          />
          <StageCard
            label="Pending Greige Order"
            styleCount={summary?.preProduction.pendingGreige.styleCount}
            pieces={summary?.preProduction.pendingGreige.pieces}
            loading={loading}
            accentClass="border-l-primary"
            onClick={() => handleCardClick(ProductionStage.PENDING_GREIGE_ORDER)}
          />
          <StageCard
            label="Trims Not Ordered"
            styleCount={summary?.preProduction.trimsNotOrdered.styleCount}
            pieces={summary?.preProduction.trimsNotOrdered.pieces}
            loading={loading}
            accentClass="border-l-primary"
            onClick={() => handleCardClick(ProductionStage.TRIMS_NOT_ORDERED)}
          />
        </div>
      </div>

      {/* ── Processing Stages ───────────────────────────────────── */}
      <div className="mb-7">
        <SectionHeading label="Processing Stages" dotClass="bg-accent" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StageCard
            label="In Printing"
            styleCount={summary?.processing.inPrinting.styleCount}
            pieces={summary?.processing.inPrinting.pieces}
            loading={loading}
            accentClass="border-l-accent"
            onClick={() => handleCardClick(ProductionStage.IN_PRINTING)}
          />
          <StageCard
            label="In Dyeing"
            styleCount={summary?.processing.inDying.styleCount}
            pieces={summary?.processing.inDying.pieces}
            loading={loading}
            accentClass="border-l-accent"
            onClick={() => handleCardClick(ProductionStage.IN_DYING)}
          />
          <StageCard
            label="In Embroidery"
            styleCount={summary?.processing.inEmbroidery.styleCount}
            pieces={summary?.processing.inEmbroidery.pieces}
            loading={loading}
            accentClass="border-l-accent"
            onClick={() => handleCardClick(ProductionStage.IN_EMBROIDERY)}
          />
          <StageCard
            label="In Handwork"
            styleCount={summary?.processing.inHandwork.styleCount}
            pieces={summary?.processing.inHandwork.pieces}
            loading={loading}
            accentClass="border-l-accent"
            onClick={() => handleCardClick(ProductionStage.IN_HANDWORK)}
          />
        </div>
      </div>

      {/* ── Production Stages ───────────────────────────────────── */}
      <div className="mb-7">
        <SectionHeading label="Production Stages" dotClass="bg-info" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StageCard
            label="In Cutting"
            styleCount={summary?.production.inCutting.styleCount}
            pieces={summary?.production.inCutting.pieces}
            loading={loading}
            accentClass="border-l-info"
            onClick={() => handleCardClick(ProductionStage.IN_CUTTING)}
          />
          <StageCard
            label="In Stitching"
            styleCount={summary?.production.inStitching.styleCount}
            pieces={summary?.production.inStitching.pieces}
            loading={loading}
            accentClass="border-l-info"
            onClick={() => handleCardClick(ProductionStage.IN_STITCHING)}
          />
          <StageCard
            label="In Finishing"
            styleCount={summary?.production.inFinishing.styleCount}
            pieces={summary?.production.inFinishing.pieces}
            loading={loading}
            accentClass="border-l-info"
            onClick={() => handleCardClick(ProductionStage.IN_FINISHING)}
          />
          <StageCard
            label="Ready to Ship"
            styleCount={summary?.production.readyToShip.styleCount}
            pieces={summary?.production.readyToShip.pieces}
            loading={loading}
            accentClass="border-l-success"
            onClick={() => handleCardClick(ProductionStage.READY_TO_SHIP)}
          />
        </div>
      </div>

      {/* ── Sample Tracking ─────────────────────────────────────── */}
      <div className="mb-7">
        <SectionHeading label="Sample Tracking" dotClass="bg-warning" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className="border-l-4 border-l-warning cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-px"
            onClick={() => navigate('/samples?status=pending')}
          >
            <CardHeader className="pb-2">
              <CardDescription className="text-xs text-muted-foreground">Pending Samples</CardDescription>
              <CardTitle className="text-3xl font-display font-medium text-foreground">
                {sampleSummary?.pendingSamples ?? '—'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Awaiting action</p>
            </CardContent>
          </Card>
          <Card
            className="border-l-4 border-l-destructive cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-px"
            onClick={() => navigate('/samples?status=overdue')}
          >
            <CardHeader className="pb-2">
              <CardDescription className="text-xs text-muted-foreground">Overdue</CardDescription>
              <CardTitle className="text-3xl font-display font-medium text-destructive">
                {sampleSummary?.overdueSamples ?? '—'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Past due date</p>
            </CardContent>
          </Card>
          <Card
            className="border-l-4 border-l-warning cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-px"
            onClick={() => navigate('/samples?status=FEEDBACK_PENDING')}
          >
            <CardHeader className="pb-2">
              <CardDescription className="text-xs text-muted-foreground">Awaiting Feedback</CardDescription>
              <CardTitle className="text-3xl font-display font-medium text-foreground">
                {sampleSummary?.awaitingFeedback ?? '—'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Sent to buyer</p>
            </CardContent>
          </Card>
          <Card
            className="border-l-4 border-l-accent cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-px"
            onClick={() => navigate('/samples')}
          >
            <CardHeader className="pb-2">
              <CardDescription className="text-xs text-muted-foreground">Due This Week</CardDescription>
              <CardTitle className="text-3xl font-display font-medium text-foreground">
                {sampleSummary?.approachingDeadlines?.length ?? '—'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Approaching deadline</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────── */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg font-medium text-foreground">Quick Actions</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Access key modules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <QuickAction icon="👥" label="Users" description="Manage users" onClick={() => navigate('/users')} />
            <QuickAction icon="👔" label="Styles" description="Manage styles" onClick={() => navigate('/styles')} />
            <QuickAction
              icon="🤝"
              label="Customers"
              description="Manage customers"
              onClick={() => navigate('/customers')}
            />
            <QuickAction
              icon="🏢"
              label="Suppliers"
              description="Manage suppliers"
              onClick={() => navigate('/suppliers')}
            />
            <QuickAction
              icon="📦"
              label="Materials"
              description="All materials"
              onClick={() => navigate('/materials')}
            />
            <QuickAction icon="📋" label="Orders" description="Manage orders" onClick={() => navigate('/orders')} />
            <QuickAction icon="📊" label="BOM" description="Bill of Materials" onClick={() => navigate('/order-bom')} />
            <QuickAction
              icon="💰"
              label="Cost Sheets"
              description="Style costing"
              onClick={() => navigate('/cost-sheets')}
            />
            <QuickAction
              icon="💼"
              label="Finance"
              description="Chart of Accounts"
              onClick={() => navigate('/chart-of-accounts')}
            />
            <QuickAction
              icon="📦"
              label="Inventory"
              description="Stock & Warehouses"
              onClick={() => navigate('/inventory/dashboard')}
            />
            <QuickAction
              icon="🏭"
              label="Work Orders"
              description="Production tracking"
              onClick={() => navigate('/production/work-orders')}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
