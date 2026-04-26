import React, { useEffect, useMemo, useState } from 'react';
import { Search, MoreVertical, Trash2, Shield, Calendar, UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useAuth } from '../../contexts/AuthContext';
import {
  deleteAdminUser,
  getAdminPlatformStats,
  getAdminUsers,
  updateAdminUserRole,
  type AdminPlatformStats,
  type AdminUserItem,
  type AdminUserRole,
} from '../../services/admin.service';

function formatWallet(wallet: string) {
  return `${wallet.slice(0, 10)}...${wallet.slice(-8)}`;
}

function formatUserLabel(user: AdminUserItem) {
  return user.username?.trim() || user.email?.trim() || formatWallet(user.walletAddress);
}

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [stats, setStats] = useState<AdminPlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingWallet, setPendingWallet] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError('');

        const [usersData, statsData] = await Promise.all([
          getAdminUsers({ limit: 200, sort: '-createdAt' }),
          getAdminPlatformStats(),
        ]);

        setUsers(usersData?.docs || []);
        setStats(statsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !normalizedQuery ||
        user.walletAddress.toLowerCase().includes(normalizedQuery) ||
        (user.username || '').toLowerCase().includes(normalizedQuery) ||
        (user.email || '').toLowerCase().includes(normalizedQuery);

      const matchesRole = roleFilter === 'all' ? true : user.role === roleFilter;
      const normalizedStatus = user.isActive === false ? 'inactive' : 'active';
      const matchesStatus =
        statusFilter === 'all' ? true : normalizedStatus === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchQuery, statusFilter, users]);

  const userStats = useMemo(
    () => [
      {
        label: 'Total Users',
        value: String(stats?.users.total ?? users.length),
        icon: Shield,
        color: 'from-blue-500 to-cyan-500',
      },
      {
        label: 'Verifiers',
        value: String(stats?.users.verifiers ?? users.filter((user) => user.role === 'verifier').length),
        icon: UserCheck,
        color: 'from-purple-500 to-pink-500',
      },
      {
        label: 'Admins',
        value: String(stats?.users.admins ?? users.filter((user) => user.role === 'admin').length),
        icon: Shield,
        color: 'from-red-500 to-orange-500',
      },
      {
        label: 'Active Accounts',
        value: String(users.filter((user) => user.isActive !== false).length),
        icon: Calendar,
        color: 'from-green-500 to-emerald-500',
      },
    ],
    [stats, users],
  );

  const handleRoleUpdate = async (walletAddress: string, role: AdminUserRole) => {
    try {
      setPendingWallet(walletAddress);
      const updatedUser = await updateAdminUserRole(walletAddress, role);

      if (!updatedUser) {
        throw new Error('Role update returned no user data');
      }

      setUsers((prev) =>
        prev.map((item) =>
          item.walletAddress === walletAddress ? { ...item, role: updatedUser.role } : item,
        ),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setPendingWallet('');
    }
  };

  const handleDelete = async (targetUser: AdminUserItem) => {
    const isSelf = currentUser?.walletAddress?.toLowerCase() === targetUser.walletAddress.toLowerCase();
    if (isSelf) {
      alert('You should not delete the admin account currently in use.');
      return;
    }

    const confirmed = window.confirm(
      `Delete user ${formatUserLabel(targetUser)} (${targetUser.walletAddress})?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setPendingWallet(targetUser.walletAddress);
      await deleteAdminUser(targetUser.walletAddress);
      setUsers((prev) =>
        prev.filter((user) => user.walletAddress !== targetUser.walletAddress),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setPendingWallet('');
    }
  };

  if (loading) {
    return <div className="text-white">Loading users...</div>;
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
        <p className="text-slate-400">Manage platform users with live admin data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {userStats.map((stat) => (
          <Card key={stat.label} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                type="search"
                placeholder="Search by wallet, name, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="verifier">Verifier</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Users</CardTitle>
          <CardDescription className="text-slate-400">
            {filteredUsers.length} user account(s) currently match your filters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Account</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Wallet Address</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Joined</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isPending = pendingWallet === user.walletAddress;
                  const isSelf =
                    currentUser?.walletAddress?.toLowerCase() === user.walletAddress.toLowerCase();

                  return (
                    <tr key={user._id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-sm text-white font-medium">
                            {user.username || 'Unnamed account'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {user.email || 'No email attached'}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <code className="text-sm text-slate-300 bg-slate-800 px-2 py-1 rounded">
                          {formatWallet(user.walletAddress)}
                        </code>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded capitalize ${
                            user.role === 'admin'
                              ? 'bg-red-500/10 text-red-400'
                              : user.role === 'verifier'
                              ? 'bg-purple-500/10 text-purple-400'
                              : 'bg-blue-500/10 text-blue-400'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded capitalize ${
                            user.isActive === false
                              ? 'bg-slate-500/10 text-slate-300'
                              : 'bg-green-500/10 text-green-400'
                          }`}
                        >
                          {user.isActive === false ? 'inactive' : 'active'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-400">
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString()
                          : 'Unknown'}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-slate-400 hover:text-white"
                              disabled={isPending}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                            {(['user', 'verifier', 'admin'] as AdminUserRole[]).map((role) => (
                              <DropdownMenuItem
                                key={`${user._id}-${role}`}
                                onSelect={() => handleRoleUpdate(user.walletAddress, role)}
                                disabled={user.role === role || isPending || isSelf}
                                className="text-slate-300 hover:bg-slate-700"
                              >
                                Set role: {role}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuItem
                              onSelect={() => handleDelete(user)}
                              disabled={isPending || isSelf}
                              className="text-red-400 hover:bg-slate-700"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="py-8 text-center text-slate-500">
              No users matched the current filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
