import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { userService } from '@/services/user.service';
import type { User } from '@/types/user.types';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Users() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const limit = 10;

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'ADMIN';

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userService.getAllUsers(page, limit, searchQuery);
      setUsers(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset to page 1 and clear search when first landing on the page
    setPage(1);
    setSearchQuery('');
  }, [location.pathname]);

  useEffect(() => {
    fetchUsers();
  }, [page, searchQuery]);

  // Handle search with debounce
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1); // Reset to first page when searching
  };

  // Handle deactivate user
  const handleDeactivate = async (id: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to deactivate ${userName}?`)) {
      return;
    }

    try {
      await userService.deleteUser(id);
      fetchUsers(); // Refresh list
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to deactivate user');
    }
  };

  // Handle activate user
  const handleActivate = async (id: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to activate ${userName}?`)) {
      return;
    }

    try {
      // Update user with isActive = true
      await userService.updateUser(id, { isActive: true });
      fetchUsers(); // Refresh list
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to activate user');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage users and their roles ({total} total users)
                </CardDescription>
              </div>
              {isAdmin && (
                <Button onClick={() => navigate('/users/new')}>
                  + Add User
                </Button>
              )}
            </div>

            {/* Search Bar */}
            <div className="mt-4">
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="text-center py-8 text-gray-500">
                Loading users...
              </div>
            )}

            {error && (
              <div className="text-center py-8 text-red-500">
                {error}
              </div>
            )}

            {!loading && !error && users.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No users found
              </div>
            )}

            {!loading && !error && users.length > 0 && (
              <div>
                {/* Users Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Role</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Department</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                        {isAdmin && (
                          <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            {user.phone && (
                              <div className="text-sm text-gray-500">{user.phone}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-700">{user.email}</td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {user.department || '-'}
                          </td>
                          <td className="py-3 px-4">
                            {user.isActive ? (
                              <span className="inline-flex items-center">
                                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                <span className="text-sm text-green-700">Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center">
                                <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                                <span className="text-sm text-red-700">Inactive</span>
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/users/edit/${user.id}`)}
                                >
                                  Edit
                                </Button>
                                {user.id !== currentUser?.id && (
                                  <>
                                    {user.isActive ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleDeactivate(user.id, `${user.firstName} ${user.lastName}`)
                                        }
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        Deactivate
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleActivate(user.id, `${user.firstName} ${user.lastName}`)
                                        }
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                      >
                                        Activate
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
                    <div className="text-sm text-gray-600">
                      Page {page} of {totalPages} ({total} total users)
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* First Page */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        title="First page"
                      >
                        ««
                      </Button>

                      {/* Previous */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        « Previous
                      </Button>

                      {/* Page Numbers */}
                      <div className="flex space-x-1">
                        {(() => {
                          const pages = [];
                          const maxVisible = 5;
                          let start = Math.max(1, page - Math.floor(maxVisible / 2));
                          let end = Math.min(totalPages, start + maxVisible - 1);

                          if (end - start < maxVisible - 1) {
                            start = Math.max(1, end - maxVisible + 1);
                          }

                          for (let i = start; i <= end; i++) {
                            pages.push(
                              <Button
                                key={i}
                                variant={i === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPage(i)}
                                className={i === page ? "font-bold" : ""}
                              >
                                {i}
                              </Button>
                            );
                          }
                          return pages;
                        })()}
                      </div>

                      {/* Next */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page === totalPages}
                      >
                        Next »
                      </Button>

                      {/* Last Page */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        title="Last page"
                      >
                        »»
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
