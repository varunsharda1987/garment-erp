/**
 * Design Dashboard Page
 * Central hub for designers with stats, recent work, and team activity
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Palette,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  ExternalLink,
  Clock,
  Layers,
  TrendingUp,
  Archive,
  FileX,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { designerDashboardService } from '@/services/designerDashboard.service';
import type { DashboardData, RecentStyle, TeamActivity } from '@/types/designerDashboard.types';
import { formatDistanceToNow } from 'date-fns';
import { formatStyleCodeWithRef } from '@/utils/style-ref-format';

// Get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Generate color from string (for avatar)
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-destructive/100',
    'bg-info-muted',
    'bg-success-muted',
    'bg-accent/100',
    'bg-primary/100',
    'bg-pink-500',
    'bg-teal-500',
    'bg-primary/50',
  ];
  return colors[Math.abs(hash) % colors.length];
}

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-muted',
  ACTIVE: 'bg-success-muted',
  DISCONTINUED: 'bg-warning-muted',
  ARCHIVED: 'bg-destructive/100',
};

// Recent style card component
function RecentStyleCard({ style }: { style: RecentStyle }) {
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/styles/${style.id}`)}>
      <div className="aspect-square relative bg-muted rounded-t-lg overflow-hidden">
        {style.imageUrl ? (
          <img
            src={`${backendUrl}${style.imageUrl}`}
            alt={style.styleName}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder-style.png';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-gray-300" />
          </div>
        )}
        <Badge className={`absolute top-2 right-2 ${STATUS_COLORS[style.status] || 'bg-muted'} text-white text-xs`}>
          {style.status}
        </Badge>
      </div>
      <CardContent className="p-3">
        <p className="font-medium text-sm truncate">{style.styleCode}</p>
        {style.buyerStyleRef && (
          <p className="text-xs text-muted-foreground truncate">Buyer Ref: {style.buyerStyleRef}</p>
        )}
        <p className="text-xs text-muted-foreground truncate">{style.styleName}</p>
        {style.season && <p className="text-xs text-muted-foreground mt-1">{style.season}</p>}
      </CardContent>
    </Card>
  );
}

// Activity item component
function ActivityItem({ activity }: { activity: TeamActivity }) {
  const navigate = useNavigate();
  const userName = `${activity.user.firstName} ${activity.user.lastName}`.trim() || 'Unknown';
  const avatarColor = stringToColor(userName);

  return (
    <div className="flex gap-3 py-2">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className={`${avatarColor} text-white text-xs`}>{getInitials(userName)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{userName}</span> <span className="text-muted-foreground">commented on</span>
          {activity.style && (
            <Button
              variant="link"
              className="h-auto p-0 text-sm font-medium ml-1"
              onClick={() => navigate(`/styles/${activity.style!.id}`)}
            >
              {formatStyleCodeWithRef(activity.style.styleCode, activity.style.buyerStyleRef)}
            </Button>
          )}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2">{activity.comment}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

export function DesignDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const dashboardData = await designerDashboardService.getDashboard();
      setData(dashboardData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // toast is stable at runtime, removing to prevent infinite re-renders

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <FileX className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Failed to load dashboard</p>
            <Button onClick={loadDashboard} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { stats, recentStyles, activity, stylesBySeason } = data;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-medium flex items-center gap-2">
            <Palette className="h-6 w-6" />
            Design Hub
          </h1>
          <p className="text-muted-foreground">Your creative workspace</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/mood-boards')}>
            <LayoutGrid className="h-4 w-4 mr-2" />
            Mood Boards
          </Button>
          <Button onClick={() => navigate('/styles/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Style
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-info-muted">
              <Layers className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalStyles}</p>
              <p className="text-sm text-muted-foreground">Total Styles</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.byStatus.DRAFT}</p>
              <p className="text-sm text-muted-foreground">Drafts</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-success-muted">
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.byStatus.ACTIVE}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-orange-100">
              <Archive className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.byStatus.ARCHIVED}</p>
              <p className="text-sm text-muted-foreground">Archived</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Styles */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Styles
              </CardTitle>
              <CardDescription>Your latest work</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/styles')}>
              View All
              <ExternalLink className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentStyles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
                <p>No styles yet</p>
                <Button variant="outline" className="mt-2" onClick={() => navigate('/styles/new')}>
                  Create Your First Style
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {recentStyles.map((style) => (
                  <RecentStyleCard key={style.id} style={style} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity & Quick Actions */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/styles/new')}>
                <Plus className="h-4 w-4 mr-2" />
                New Style
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/mood-boards/new')}>
                <LayoutGrid className="h-4 w-4 mr-2" />
                New Mood Board
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/catalogue-generator')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Catalogue
              </Button>
            </CardContent>
          </Card>

          {/* Team Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-5 w-5" />
                Team Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No recent activity</p>
                </div>
              ) : (
                <div className="divide-y">
                  {activity.slice(0, 5).map((item) => (
                    <ActivityItem key={item.id} activity={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Styles by Season */}
          {stylesBySeason.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Styles by Season</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stylesBySeason.slice(0, 5).map((season) => (
                  <div key={season.season} className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{season.season}</p>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-info rounded-full"
                          style={{
                            width: `${stats.totalStyles > 0 ? Math.min((season.count / stats.totalStyles) * 100, 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{season.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default DesignDashboard;
