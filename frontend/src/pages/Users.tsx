import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { userService } from '@/services/user.service';
import type { User } from '@/types/user.types';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Users as UsersIcon, Clock } from 'lucide-react';

// Local type definition to avoid import issues
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function Users() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'activate' | 'deactivate' | 'delete'>('deactivate');
  const [userToModify, setUserToModify] = useState<{ id: string; name: string } | null>(null);

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'ADMIN';

  // Reset page when landing on the page
  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery('');
  }, [location.pathname]);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, pageSize, searchQuery]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await userService.getAllUsers(currentPage, pageSize, searchQuery || undefined);
      setUsers(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalUsers(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load users', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateClick = (id: string, name: string) => {
    setUserToModify({ id, name });
    setDialogAction('deactivate');
    setDialogOpen(true);
  };

  const handleActivateClick = (id: string, name: string) => {
    setUserToModify({ id, name });
    setDialogAction('activate');
    setDialogOpen(true);
  };

  const handleDeleteClick = (id: string, name: string) => {
    setUserToModify({ id, name });
    setDialogAction('delete');
    setDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!userToModify) return;

    try {
      if (dialogAction === 'deactivate') {
        await userService.deleteUser(userToModify.id);
        handleApiSuccess('User deactivated', `${userToModify.name} has been successfully deactivated.`);
      } else if (dialogAction === 'activate') {
        await userService.updateUser(userToModify.id, { isActive: true });
        handleApiSuccess('User activated', `${userToModify.name} has been successfully activated.`);
      } else if (dialogAction === 'delete') {
        await userService.permanentDeleteUser(userToModify.id);
        handleApiSuccess('User deleted', `${userToModify.name} has been permanently deleted.`);
      }
      fetchUsers();
    } catch (err: unknown) {
      handleApiError(err, `Failed to ${dialogAction} user`);
    } finally {
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

  // Define columns for DataTable
  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (user) => (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {user.firstName} {user.lastName}
          </div>
          {user.phone && <div className="text-xs text-gray-500">{user.phone}</div>}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (user) => <div className="text-sm text-gray-700">{user.email}</div>,
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => <StatusBadge status={formatRoleName(user.role)} variant={getRoleBadgeVariant(user.role)} />,
    },
    {
      key: 'department',
      header: 'Department',
      render: (user) => <div className="text-sm text-gray-700">{user.department || '-'}</div>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) => (
        <StatusBadge
          status={user.isActive ? 'Active' : 'Inactive'}
          variant={user.isActive ? 'success' : 'destructive'}
        />
      ),
    },
  ];

  // Add actions column only for admin users
  if (isAdmin) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (user) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/users/edit/${user.id}`);
            }}
          >
            Edit
          </Button>
          {user.id !== currentUser?.id && (
            <>
              {user.isActive ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeactivateClick(user.id, `${user.firstName} ${user.lastName}`);
                  }}
                >
                  Deactivate
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActivateClick(user.id, `${user.firstName} ${user.lastName}`);
                    }}
                    className="text-green-600 hover:text-green-700 border-green-300 hover:bg-green-50"
                  >
                    Activate
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(user.id, `${user.firstName} ${user.lastName}`);
                    }}
                  >
                    Delete
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      ),
    });
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage users and their roles ({totalUsers} total users)</CardDescription>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate('/users/pending')}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Pending Approvals
                </Button>
                <Button onClick={() => navigate('/users/new')}>+ Add User</Button>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="mt-4">
            <SearchInput placeholder="Search users by name or email..." value={searchQuery} onChange={setSearchQuery} />
          </div>
        </CardHeader>
        <CardContent>
          {/* DataTable Component */}
          <DataTable
            data={users}
            columns={columns}
            keyExtractor={(user) => user.id}
            loading={isLoading}
            error={error}
            emptyState={{
              icon: <UsersIcon className="h-16 w-16" />,
              title: 'No users found',
              description: searchQuery
                ? 'Try adjusting your search criteria'
                : 'Get started by creating your first user',
              actionLabel: isAdmin ? 'Create First User' : undefined,
              onAction: isAdmin ? () => navigate('/users/new') : undefined,
            }}
            pagination={{
              currentPage,
              totalPages,
              pageSize,
              totalItems: totalUsers,
              onPageChange: setCurrentPage,
              onPageSizeChange: setPageSize,
            }}
            onRowClick={(user) => (isAdmin ? navigate(`/users/edit/${user.id}`) : undefined)}
          />
        </CardContent>
      </Card>

      {/* Activate/Deactivate/Delete Confirmation Dialog */}
      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={
          dialogAction === 'activate'
            ? 'Activate User'
            : dialogAction === 'deactivate'
              ? 'Deactivate User'
              : 'Delete User Permanently'
        }
        description={
          dialogAction === 'activate'
            ? `Are you sure you want to activate ${userToModify?.name}? They will regain access to the system.`
            : dialogAction === 'deactivate'
              ? `Are you sure you want to deactivate ${userToModify?.name}? They will lose access to the system.`
              : `Are you sure you want to permanently delete ${userToModify?.name}? This action cannot be undone and all user data will be lost.`
        }
        confirmText={
          dialogAction === 'activate'
            ? 'Activate User'
            : dialogAction === 'deactivate'
              ? 'Deactivate User'
              : 'Delete Permanently'
        }
        cancelText="Cancel"
        onConfirm={confirmAction}
        variant={dialogAction === 'activate' ? 'default' : 'destructive'}
      />
    </div>
  );
}
