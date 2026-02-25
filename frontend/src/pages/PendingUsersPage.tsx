import { useState, useEffect, type ReactNode } from 'react';
import { userService } from '@/services/user.service';
import type { User } from '@/types/user.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { UserCheck, UserX, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function PendingUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject'>('approve');
  const [userToModify, setUserToModify] = useState<{ id: string; name: string } | null>(null);
  const [, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await userService.getPendingUsers();
      setUsers(response.data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load pending users', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveClick = (id: string, name: string) => {
    setUserToModify({ id, name });
    setDialogAction('approve');
    setDialogOpen(true);
  };

  const handleRejectClick = (id: string, name: string) => {
    setUserToModify({ id, name });
    setDialogAction('reject');
    setDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!userToModify) return;

    try {
      setIsProcessing(true);
      if (dialogAction === 'approve') {
        await userService.approveUser(userToModify.id);
        handleApiSuccess('User Approved', `${userToModify.name} has been approved and can now log in.`);
      } else {
        await userService.rejectUser(userToModify.id);
        handleApiSuccess('User Rejected', `${userToModify.name}'s registration has been rejected.`);
      }
      fetchPendingUsers();
    } catch (err: unknown) {
      handleApiError(err, `Failed to ${dialogAction} user`);
    } finally {
      setIsProcessing(false);
      setUserToModify(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'destructive';
      case 'PRODUCTION_MANAGER':
      case 'MERCHANDISER':
        return 'warning';
      default:
        return 'info';
    }
  };

  const formatRoleName = (role: string) => {
    return role.replace(/_/g, ' ');
  };

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (user) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {user.firstName} {user.lastName}
          </div>
          {user.phone && (
            <div className="text-xs text-gray-500">{user.phone}</div>
          )}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (user) => (
        <div className="text-sm text-gray-700">{user.email}</div>
      ),
    },
    {
      key: 'role',
      header: 'Requested Role',
      render: (user) => (
        <StatusBadge
          status={formatRoleName(user.role)}
          variant={getRoleBadgeVariant(user.role)}
        />
      ),
    },
    {
      key: 'createdAt',
      header: 'Registered',
      render: (user) => (
        <div className="text-sm text-gray-500">
          {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : '-'}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (user) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="default"
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={(e) => {
              e.stopPropagation();
              handleApproveClick(user.id, `${user.firstName} ${user.lastName}`);
            }}
          >
            <UserCheck className="h-4 w-4 mr-1" />
            Approve
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleRejectClick(user.id, `${user.firstName} ${user.lastName}`);
            }}
          >
            <UserX className="h-4 w-4 mr-1" />
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <CardTitle>Pending User Approvals</CardTitle>
                <CardDescription>
                  Review and approve new user registrations ({users.length} pending)
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={users}
            columns={columns}
            keyExtractor={(user) => user.id}
            loading={isLoading}
            error={error}
            emptyState={{
              icon: <UserCheck className="h-16 w-16 text-green-500" />,
              title: 'No pending approvals',
              description: 'All user registrations have been processed. New requests will appear here.',
            }}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogAction === 'approve' ? 'Approve User' : 'Reject User'}
        description={
          dialogAction === 'approve'
            ? `Are you sure you want to approve ${userToModify?.name}? They will be able to log in with the "${userToModify ? formatRoleName(users.find(u => u.id === userToModify.id)?.role || '') : ''}" role.`
            : `Are you sure you want to reject ${userToModify?.name}? Their registration will be permanently deleted.`
        }
        confirmText={dialogAction === 'approve' ? 'Approve User' : 'Reject User'}
        cancelText="Cancel"
        onConfirm={confirmAction}
        variant={dialogAction === 'reject' ? 'destructive' : 'default'}
      />
    </div>
  );
}
