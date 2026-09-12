/**
 * AI Insights (Admin)
 *
 * What the assistant could not answer, weak guide matches, thumbs-down answers and guide
 * usage — the list of guides to write or fix next. "Copy as guide request" produces the
 * markdown block the /ai-gaps skill expects.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { BarChart3, BookOpen, Copy, HelpCircle, Loader2, ThumbsDown, ThumbsUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  getAiInsightsSummary,
  getUnansweredQuestions,
  getWeakMatches,
  getNegativeFeedback,
  getGuideUsage,
} from '@/services/ai-insights.service';
import type { UnansweredQuestion, WeakMatch } from '@/types/aiInsights.types';

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString([], { day: 'numeric', month: 'short' }) +
  ', ' +
  new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function StatCard({ label, value, icon: Icon }: { label: string; value: number | undefined; icon: typeof BarChart3 }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="text-2xl font-semibold leading-none">{value ?? '—'}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-12 text-muted-foreground text-sm">{text}</div>;
}

function Loading() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function AIInsights() {
  const [range, setRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 30), to: new Date() });
  const [tab, setTab] = useState('unanswered');
  const [includeData, setIncludeData] = useState(false);

  const params = useMemo(
    () => ({
      from: range?.from ? format(range.from, 'yyyy-MM-dd') : undefined,
      to: range?.to ? format(range.to, 'yyyy-MM-dd') : undefined,
    }),
    [range]
  );

  const summary = useQuery({
    queryKey: ['ai-insights', 'summary', params],
    queryFn: () => getAiInsightsSummary(params),
  });
  const unanswered = useQuery({
    queryKey: ['ai-insights', 'unanswered', params, includeData],
    queryFn: () => getUnansweredQuestions({ ...params, includeData }),
    enabled: tab === 'unanswered',
  });
  const weak = useQuery({
    queryKey: ['ai-insights', 'weak', params],
    queryFn: () => getWeakMatches(params),
    enabled: tab === 'weak',
  });
  const negative = useQuery({
    queryKey: ['ai-insights', 'negative', params],
    queryFn: () => getNegativeFeedback(params),
    enabled: tab === 'negative',
  });
  const usage = useQuery({
    queryKey: ['ai-insights', 'usage', params],
    queryFn: () => getGuideUsage(params),
    enabled: tab === 'usage',
  });

  const copyGuideRequest = async (row: UnansweredQuestion | WeakMatch) => {
    const lines = [
      '### Guide request',
      `- Question: "${row.question}" (asked ${row.count}x, last ${formatDate(row.lastAskedAt)})`,
      `- Page: ${row.samplePageRoute ?? 'unknown'} · Role: ${row.sampleRole ?? 'unknown'}`,
    ];
    if ('guideSlugs' in row && row.guideSlugs.length > 0) {
      lines.push(`- Nearest guide(s): ${row.guideSlugs.join(', ')} (keyword score ${row.topScore})`);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      handleApiSuccess('Copied', 'Paste it into Claude Code and run /ai-gaps');
    } catch (error) {
      handleApiError(error, 'Could not copy');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6" />
          <div>
            <h1 className="text-3xl font-display font-medium text-foreground">AI Insights</h1>
            <p className="text-sm text-muted-foreground">
              What the assistant could not answer, and which guides need work
            </p>
          </div>
        </div>
        <DateRangePicker value={range} onChange={setRange} className="w-72" />
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <StatCard label="Questions asked" value={summary.data?.totalQuestions} icon={HelpCircle} />
        <StatCard label="No guide matched" value={summary.data?.zeroMatch} icon={AlertTriangle} />
        <StatCard label="Weak matches" value={summary.data?.weak} icon={BookOpen} />
        <StatCard label="Thumbs down" value={summary.data?.negativeFeedback} icon={ThumbsDown} />
        <StatCard label="Thumbs up" value={summary.data?.positiveFeedback} icon={ThumbsUp} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="unanswered">Unanswered</TabsTrigger>
          <TabsTrigger value="weak">Weak matches</TabsTrigger>
          <TabsTrigger value="negative">Negative feedback</TabsTrigger>
          <TabsTrigger value="usage">Guide usage</TabsTrigger>
        </TabsList>

        <TabsContent value="unanswered" className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Switch id="include-data" checked={includeData} onCheckedChange={setIncludeData} />
            <Label htmlFor="include-data" className="text-sm text-muted-foreground">
              Include data questions (e.g. "how many orders this month") — these are lookups, not how-tos
            </Label>
          </div>
          <Card>
            <CardContent className="p-0">
              {unanswered.isLoading ? (
                <Loading />
              ) : !unanswered.data || unanswered.data.length === 0 ? (
                <Empty text="Every question in this period matched a guide." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead className="text-right">Asked</TableHead>
                      <TableHead>Last asked</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unanswered.data.map((row) => (
                      <TableRow key={row.question}>
                        <TableCell className="max-w-md">
                          <div className="text-sm">{row.question}</div>
                          {row.dataLookup && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              data lookup
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{row.count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(row.lastAskedAt)}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {row.samplePageRoute ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.sampleRole ?? '—'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => copyGuideRequest(row)}>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy as guide request
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weak" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {weak.isLoading ? (
                <Loading />
              ) : !weak.data || weak.data.length === 0 ? (
                <Empty text="No weak matches — every matched guide scored well." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead className="text-right">Asked</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Nearest guide(s)</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weak.data.map((row) => (
                      <TableRow key={row.question}>
                        <TableCell className="max-w-md text-sm">{row.question}</TableCell>
                        <TableCell className="text-right font-medium">{row.count}</TableCell>
                        <TableCell className="text-right">{row.topScore}</TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-wrap gap-1">
                            {row.guideSlugs.map((slug) => (
                              <Badge key={slug} variant="secondary" className="font-mono text-xs">
                                {slug}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {row.samplePageRoute ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => copyGuideRequest(row)}>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="negative" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {negative.isLoading ? (
                <Loading />
              ) : !negative.data || negative.data.length === 0 ? (
                <Empty text="No thumbs-down feedback in this period." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Guide(s) used</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Page</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {negative.data.map((row) => (
                      <TableRow key={row.messageId}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(row.createdAt)}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="text-sm">{row.question}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{row.answerSnippet}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.guideSlugs.length === 0 ? (
                            <span className="text-muted-foreground">none</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {row.guideSlugs.map((slug) => (
                                <Badge key={slug} variant="secondary" className="font-mono text-xs">
                                  {slug}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{row.issueType ?? '—'}</TableCell>
                        <TableCell className="max-w-xs text-xs text-muted-foreground">{row.comment ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.userRole ?? '—'}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {row.pageRoute ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {usage.isLoading ? (
                <Loading />
              ) : !usage.data || usage.data.length === 0 ? (
                <Empty text="No guide was used to answer a question in this period." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guide</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead className="text-right">Uses</TableHead>
                      <TableHead className="text-right">Helpful</TableHead>
                      <TableHead className="text-right">Not helpful</TableHead>
                      <TableHead className="text-right">Helpful %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.data.map((row) => (
                      <TableRow key={row.slug}>
                        <TableCell>
                          <div className="text-sm">{row.title}</div>
                          <div className="text-xs font-mono text-muted-foreground">{row.slug}</div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{row.route ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium">{row.uses}</TableCell>
                        <TableCell className="text-right">{row.helpful}</TableCell>
                        <TableCell className="text-right">{row.notHelpful}</TableCell>
                        <TableCell className="text-right">
                          {row.ratio === null ? '—' : `${Math.round(row.ratio * 100)}%`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
