/**
 * @file pages/RbacAdminPage.tsx
 * @description RBAC 角色权限 & 用户管理页面
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Users, Plus, Trash2, Edit2, X, Save, RefreshCw,
  Loader2, ChevronLeft, ChevronRight, Search, Crown,
} from 'lucide-react';
import {
  fetchRoles, createRole, updateRole, deleteRole, seedRoles,
  fetchUsers, updateUserRole, updateUserQuota,
  type RoleConfig, type UserAdmin,
} from '../api';

// ─── 角色管理 Tab ────────────────────────────────────────────────────────────

const RESOURCE_OPTIONS = ['agents', 'knowledge', 'chat', 'pipelines', 'skills', 'mcp', 'settings', 'users', 'vibe'];
const ACTION_OPTIONS = ['read', 'create', 'update', 'delete', 'execute', 'admin'];

const RolesTab = () => {
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ key: '', name: '', description: '', permissions: [{ resource: 'agents', actions: ['read'] }] });

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRoles();
      setRoles(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const handleSeed = async () => {
    try {
      await seedRoles();
      setMsg('✅ 内置角色初始化完成');
      await loadRoles();
    } catch { setMsg('❌ 初始化失败'); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.key || !form.name) return;
    try {
      await createRole({ key: form.key, name: form.name, description: form.description, permissions: form.permissions });
      setShowCreate(false);
      setForm({ key: '', name: '', description: '', permissions: [{ resource: 'agents', actions: ['read'] }] });
      await loadRoles();
    } catch { setMsg('❌ 创建失败'); }
  };

  const handleDelete = async (key: string) => {
    if (!confirm('确认删除此角色？')) return;
    try {
      await deleteRole(key);
      await loadRoles();
    } catch { setMsg('❌ 删除失败'); }
  };

  const handleUpdatePermission = async (role: RoleConfig, resource: string, action: string, checked: boolean) => {
    const newPerms = role.permissions.map((p) => {
      if (p.resource !== resource) return p;
      return { ...p, actions: checked ? [...p.actions, action] : p.actions.filter((a) => a !== action) };
    });
    // 如果 resource 不存在，添加
    if (!newPerms.find((p) => p.resource === resource)) {
      newPerms.push({ resource, actions: checked ? [action] : [] });
    }
    try {
      await updateRole(role.key, { permissions: newPerms });
      await loadRoles();
    } catch { setMsg('❌ 更新失败'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn-primary text-xs" onClick={() => setShowCreate(true)} aria-label="新建角色" tabIndex={0}>
          <Plus className="w-3.5 h-3.5" /> 新建角色
        </button>
        <button className="btn-secondary text-xs" onClick={handleSeed} aria-label="初始化内置角色" tabIndex={0}>
          <RefreshCw className="w-3.5 h-3.5" /> 初始化内置角色
        </button>
        {msg && <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">{msg}</span>}
      </div>

      {/* 创建弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">新建角色</h3>
              <button className="btn-ghost p-1" onClick={() => setShowCreate(false)} aria-label="关闭" tabIndex={0}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">角色 Key *</label>
                <input className="input" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="custom_editor" required aria-label="角色Key" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">角色名称 *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="编辑者" required aria-label="角色名称" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">描述</label>
                <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} aria-label="描述" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1 justify-center text-sm">创建</button>
                <button type="button" className="btn-secondary text-sm" onClick={() => setShowCreate(false)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 角色列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中...</div>
      ) : roles.length === 0 ? (
        <div className="text-center py-12 text-slate-400">暂无角色，请先初始化内置角色</div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.key} className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <Crown className={`w-4 h-4 ${role.isBuiltin ? 'text-amber-500' : 'text-slate-400'}`} />
                <span className="font-semibold text-slate-800 text-sm">{role.name}</span>
                <span className="text-xs text-slate-400 font-mono">{role.key}</span>
                {role.isBuiltin && <span className="badge bg-amber-50 text-amber-600 text-[10px]">内置</span>}
                {!role.isBuiltin && (
                  <button className="ml-auto p-1 text-slate-400 hover:text-red-500" onClick={() => handleDelete(role.key)} aria-label="删除角色" tabIndex={0}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {role.description && <p className="text-xs text-slate-500 mb-3">{role.description}</p>}
              {/* 权限矩阵 */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-1.5 px-2 text-slate-400 font-medium">资源</th>
                      {ACTION_OPTIONS.map((a) => (
                        <th key={a} className="text-center py-1.5 px-1.5 text-slate-400 font-medium">{a}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RESOURCE_OPTIONS.map((res) => {
                      const perm = role.permissions.find((p) => p.resource === res);
                      return (
                        <tr key={res} className="border-b border-slate-50">
                          <td className="py-1.5 px-2 text-slate-600">{res}</td>
                          {ACTION_OPTIONS.map((act) => (
                            <td key={act} className="text-center py-1.5 px-1.5">
                              <input
                                type="checkbox"
                                checked={perm?.actions.includes(act) ?? false}
                                onChange={(e) => handleUpdatePermission(role, res, act, e.target.checked)}
                                className="rounded accent-sky-500 w-3.5 h-3.5"
                                aria-label={`${res} ${act}`}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── 用户管理 Tab ────────────────────────────────────────────────────────────

const UsersTab = () => {
  const [users, setUsers] = useState<UserAdmin[]>([]);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editingQuota, setEditingQuota] = useState<{ id: string; value: number } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesData] = await Promise.all([
        fetchUsers({ page, limit: 20, search: search || undefined }),
        fetchRoles(),
      ]);
      setUsers(usersRes.data);
      setTotal(usersRes.pagination.total);
      setRoles(rolesData);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateUserRole(userId, role);
      await loadData();
    } catch { /* ignore */ }
  };

  const handleQuotaSave = async () => {
    if (!editingQuota) return;
    try {
      await updateUserQuota(editingQuota.id, editingQuota.value);
      setEditingQuota(null);
      await loadData();
    } catch { /* ignore */ }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      {/* 搜索 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="搜索用户名或邮箱..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            aria-label="搜索用户"
          />
        </div>
        <span className="text-xs text-slate-400">共 {total} 个用户</span>
      </div>

      {/* 用户列表 */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">用户</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">邮箱</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">角色</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">Token 配额</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold">最后登录</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400">暂无用户数据</td></tr>
              ) : users.map((user) => (
                <tr key={user._id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-600">
                        {user.username[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm text-slate-700 font-medium">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
                      value={user.role}
                      onChange={(e) => handleRoleChange(user._id, e.target.value)}
                      aria-label="选择角色"
                    >
                      {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {editingQuota?.id === user._id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          className="w-20 text-xs border border-slate-200 rounded px-2 py-1"
                          value={editingQuota.value}
                          onChange={(e) => setEditingQuota({ ...editingQuota, value: parseInt(e.target.value) || 0 })}
                          aria-label="Token配额"
                        />
                        <button className="p-1 text-emerald-500" onClick={handleQuotaSave} aria-label="保存" tabIndex={0}><Save className="w-3 h-3" /></button>
                        <button className="p-1 text-slate-400" onClick={() => setEditingQuota(null)} aria-label="取消" tabIndex={0}><X className="w-3 h-3" /></button>
                      </div>
                    ) : (
                      <button
                        className="text-xs text-slate-500 hover:text-sky-500 cursor-pointer"
                        onClick={() => setEditingQuota({ id: user._id, value: user.dailyTokenQuota })}
                        aria-label="编辑配额"
                        tabIndex={0}
                      >
                        {user.dailyTokenQuota.toLocaleString()} / 日
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-400">第 {page} / {totalPages} 页</span>
            <div className="flex gap-2">
              <button className="btn-ghost text-xs px-2 py-1" disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="上一页" tabIndex={0}><ChevronLeft className="w-4 h-4" /></button>
              <button className="btn-ghost text-xs px-2 py-1" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="下一页" tabIndex={0}><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 主页面 ──────────────────────────────────────────────────────────────────

type TabKey = 'roles' | 'users';

const RbacAdminPage = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('roles');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="w-6 h-6 text-violet-600" />
          权限管理
        </h1>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {([['roles', '角色管理', Shield], ['users', '用户管理', Users]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab(key)}
              aria-label={label}
              tabIndex={0}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'roles' && <RolesTab />}
      {activeTab === 'users' && <UsersTab />}
    </div>
  );
};

export default RbacAdminPage;
