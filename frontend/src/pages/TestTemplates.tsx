import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Edit, CheckCircle, XCircle, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { testTemplatesService } from '@/services/testing.service';
import type { TestTemplate, TestTemplateType } from '@/types/testing.types';
import { handleApiError } from '@/lib/api-error-handler';
import { notify } from '@/lib/notify';

export default function TestTemplates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [templateType, setTemplateType] = useState<TestTemplateType | 'all'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, templateType]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const result = await testTemplatesService.getAll({
        page,
        limit: pageSize,
        search: search || undefined,
        templateType: templateType === 'all' ? undefined : templateType,
      });
      setTemplates(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      handleApiError(error, 'Failed to load test templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const getTemplateTypeBadge = (type: TestTemplateType) => {
    if (type === 'FPT') {
      return <Badge className="bg-info-muted text-info border-info/30">FPT - Fabric</Badge>;
    }
    return <Badge className="bg-accent/10 text-accent border-accent/25">GPT - Garment</Badge>;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-info mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading test templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-medium text-foreground flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            Test Templates
          </h1>
          <p className="text-muted-foreground mt-1">Define test parameters and tolerance ranges for buyers</p>
        </div>
        <Button onClick={() => navigate('/test-templates/new')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by template code or name..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={templateType}
            onValueChange={(value) => {
              setTemplateType(value as TestTemplateType | 'all');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Template Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="FPT">FPT (Fabric)</SelectItem>
              <SelectItem value="GPT">GPT (Garment)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Templates List */}
      {templates.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Test Templates Found</h3>
          <p className="text-muted-foreground mb-4">Create your first test template</p>
          <Button onClick={() => navigate('/test-templates/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">{template.templateName}</h3>
                    {getTemplateTypeBadge(template.templateType)}
                    {template.isActive ? (
                      <Badge className="bg-success-muted text-success border-success/25">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-mono mb-4">{template.templateCode}</p>

                  {template.description && <p className="text-sm text-muted-foreground mb-4">{template.description}</p>}

                  {/* Required Parameters */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Required Parameters:</p>
                    <div className="flex flex-wrap gap-2">
                      {template.requiredParams.map((param, idx) => (
                        <Badge key={idx} variant="outline" className="bg-destructive/10 text-destructive">
                          {param}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Optional Parameters */}
                  {template.optionalParams && template.optionalParams.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Optional Parameters:</p>
                      <div className="flex flex-wrap gap-2">
                        {template.optionalParams.map((param, idx) => (
                          <Badge key={idx} variant="outline" className="bg-muted text-muted-foreground">
                            {param}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tolerance Ranges */}
                  {template.toleranceRanges && Object.keys(template.toleranceRanges).length > 0 && (
                    <div className="mt-4 p-3 bg-info-muted rounded-lg">
                      <p className="text-xs font-semibold text-foreground mb-2">Tolerance Ranges:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        {Object.entries(template.toleranceRanges).map(
                          ([key, range]) =>
                            range && (
                              <div key={key} className="text-xs">
                                <span className="text-muted-foreground capitalize">{key}:</span>
                                <span className="ml-1 font-medium text-foreground">
                                  {range.min !== undefined && `${range.min}`}
                                  {range.min !== undefined && range.max !== undefined && ' - '}
                                  {range.max !== undefined && `${range.max}`}
                                  {range.unit && ` ${range.unit}`}
                                </span>
                              </div>
                            )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Testing Standards */}
                  {template.testingStandards && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      <span className="font-semibold">Standards:</span> {template.testingStandards}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      notify.info('Coming soon', { description: 'Edit template feature is not yet available.' })
                    }
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      notify.info('Coming soon', { description: 'View template detail is not yet available.' })
                    }
                  >
                    View
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
