import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { getCompanyProfiles, setDefaultCompanyProfile } from '@/services/companyProfile.service';
import { COMPANY_PROFILE_QUERY_KEY } from '@/hooks/useCompanyProfile';
import type { CompanyProfile } from '@/types/companyProfile.types';
import { ArrowLeft, Loader2, Plus, Pencil, Star } from 'lucide-react';

export default function CompanyProfiles() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [promoting, setPromoting] = useState<CompanyProfile | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['company-profiles'],
    queryFn: getCompanyProfiles,
  });

  const makeDefault = useMutation({
    mutationFn: (id: string) => setDefaultCompanyProfile(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['company-profiles'] });
      queryClient.invalidateQueries({ queryKey: COMPANY_PROFILE_QUERY_KEY });
      handleApiSuccess('Default entity changed', `${updated.name} will be used on new documents.`);
      setPromoting(null);
    },
    onError: (error) => {
      handleApiError(error, 'Could not change the default entity');
      setPromoting(null);
    },
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Settings
          </Button>
          <h1 className="text-3xl font-display font-medium text-foreground">Company profile</h1>
          <p className="text-muted-foreground mt-1">
            The legal entities you invoice as. The default entity supplies the letterhead, GSTIN and state code for
            every document.
          </p>
        </div>
        <Button className="mt-10" onClick={() => navigate('/settings/company/new')}>
          <Plus className="h-4 w-4 mr-1" /> Add entity
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No company entity configured.</p>
              <p className="text-sm mt-1">Documents cannot render a letterhead until one exists.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Udyam / MSME</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id} className={p.isDefault ? 'bg-muted/30' : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        {p.isDefault && <Badge>Default</Badge>}
                        {!p.isActive && <Badge variant="outline">Archived</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {p.city}
                        {p.pincode ? ` ${p.pincode}` : ''}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{p.gstin}</TableCell>
                    <TableCell>
                      {p.stateName} <span className="text-muted-foreground">({p.stateCode})</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.msmeNumber || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!p.isDefault && p.isActive && (
                          <Button variant="outline" size="sm" onClick={() => setPromoting(p)}>
                            <Star className="h-4 w-4 mr-1" /> Make default
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/settings/company/${p.id}`)}>
                          <Pencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(promoting)} onOpenChange={(open) => !open && setPromoting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make this the default entity?</AlertDialogTitle>
            <AlertDialogDescription>
              Every new invoice, purchase order, challan and letterhead will be issued as{' '}
              <strong>{promoting?.name}</strong> under GSTIN <strong>{promoting?.gstin}</strong>. Its state code (
              {promoting?.stateCode}) will also decide CGST/SGST versus IGST. Documents already issued are unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={makeDefault.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={makeDefault.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (promoting) makeDefault.mutate(promoting.id);
              }}
            >
              {makeDefault.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Make default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
