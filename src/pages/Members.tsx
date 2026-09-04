import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Users,
  Mail,
  Phone,
  GraduationCap,
  Building2,
} from 'lucide-react';
import { supabase, type Member, DEPARTMENTS } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';

type MemberForm = Omit<Member, 'id' | 'created_at'>;

const emptyForm: MemberForm = {
  student_id: '',
  name: '',
  email: '',
  phone: '',
  department: 'Computer Science',
  year_of_study: 1,
  status: 'active',
};

export function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const { toasts, dismiss, showToast } = useToast();

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      showToast.error('Failed to load members');
    } else {
      setMembers(data as Member[]);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.student_id.toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q);
      const matchesDept = deptFilter === 'all' || m.department === deptFilter;
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [members, search, deptFilter, statusFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (m: Member) => {
    setEditing(m);
    setForm({
      student_id: m.student_id,
      name: m.name,
      email: m.email ?? '',
      phone: m.phone ?? '',
      department: m.department ?? 'Computer Science',
      year_of_study: m.year_of_study ?? 1,
      status: m.status,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.student_id.trim()) {
      showToast.warning('Name and Student ID are required');
      return;
    }
    setSaving(true);
    const payload = {
      student_id: form.student_id.trim(),
      name: form.name.trim(),
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
      department: form.department,
      year_of_study: form.year_of_study,
      status: form.status,
    };

    if (editing) {
      const { error } = await supabase.from('members').update(payload).eq('id', editing.id);
      if (error) {
        showToast.error(
          error.message.includes('duplicate')
            ? 'A member with that Student ID already exists'
            : 'Failed to update member',
        );
      } else {
        showToast.success(`${payload.name} updated`);
        setShowForm(false);
        loadMembers();
      }
    } else {
      const { error } = await supabase.from('members').insert(payload);
      if (error) {
        showToast.error(
          error.message.includes('duplicate')
            ? 'A member with that Student ID already exists'
            : 'Failed to add member',
        );
      } else {
        showToast.success(`${payload.name} added as a member`);
        setShowForm(false);
        loadMembers();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('members').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast.error('Failed to delete member');
    } else {
      showToast.success(`${deleteTarget.name} removed`);
      setDeleteTarget(null);
      loadMembers();
    }
  };

  const departments = useMemo(() => {
    const set = new Set(members.map((m) => m.department).filter((d): d is string => Boolean(d)));
    return ['all', ...Array.from(set).sort()];
  }, [members]);

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Members</h1>
          <p className="mt-1 text-sm text-slate-500">
            {members.length} registered · {members.filter((m) => m.status === 'active').length} active
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Add Member
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, student ID, or email…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d === 'all' ? 'All Departments' : d}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16">
          <Users className="h-12 w-12 text-slate-300" />
          <p className="mt-4 text-sm font-medium text-slate-500">No members found</p>
          <p className="mt-1 text-xs text-slate-400">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                  <th className="px-5 py-3 font-semibold text-slate-600">Member</th>
                  <th className="px-5 py-3 font-semibold text-slate-600">Student ID</th>
                  <th className="hidden px-5 py-3 font-semibold text-slate-600 md:table-cell">Department</th>
                  <th className="hidden px-5 py-3 font-semibold text-slate-600 lg:table-cell">Contact</th>
                  <th className="hidden px-5 py-3 font-semibold text-slate-600 sm:table-cell">Joined</th>
                  <th className="px-5 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-5 py-3 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((m) => (
                  <tr key={m.id} className="transition hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-bold text-white">
                          {m.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{m.name}</p>
                          <p className="truncate text-xs text-slate-400">
                            Year {m.year_of_study}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">
                        {m.student_id}
                      </span>
                    </td>
                    <td className="hidden px-5 py-3 text-slate-600 md:table-cell">
                      {m.department ?? '—'}
                    </td>
                    <td className="hidden px-5 py-3 lg:table-cell">
                      <div className="space-y-0.5">
                        {m.email && (
                          <p className="flex items-center gap-1 text-xs text-slate-500">
                            <Mail className="h-3 w-3" /> {m.email}
                          </p>
                        )}
                        {m.phone && (
                          <p className="flex items-center gap-1 text-xs text-slate-400">
                            <Phone className="h-3 w-3" /> {m.phone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-5 py-3 text-xs text-slate-500 sm:table-cell">
                      {formatDate(m.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(m)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(m)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Member' : 'Add New Member'}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full Name" required>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              placeholder="Aarav Sharma"
            />
          </Field>
          <Field label="Student ID" required>
            <input
              value={form.student_id}
              onChange={(e) => setForm({ ...form, student_id: e.target.value })}
              className={inputClass}
              placeholder="CS2021001"
              disabled={!!editing}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
              placeholder="aarav@college.edu"
            />
          </Field>
          <Field label="Phone">
            <input
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputClass}
              placeholder="555-0101"
            />
          </Field>
          <Field label="Department">
            <select
              value={form.department ?? ''}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className={inputClass}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Year of Study">
            <select
              value={form.year_of_study ?? 1}
              onChange={(e) => setForm({ ...form, year_of_study: parseInt(e.target.value) })}
              className={inputClass}
            >
              {[1, 2, 3, 4, 5].map((y) => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          </Field>
          <Field label="Status" className="sm:col-span-2">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="status"
                  checked={form.status === 'active'}
                  onChange={() => setForm({ ...form, status: 'active' })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Active</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="status"
                  checked={form.status === 'suspended'}
                  onChange={() => setForm({ ...form, status: 'suspended' })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Suspended</span>
              </label>
            </div>
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setShowForm(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : editing ? 'Update Member' : 'Add Member'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Member"
        message={`Are you sure you want to remove "${deleteTarget?.name}"? This will also delete all their loan history.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: 'active' | 'suspended' }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        status === 'active'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-red-50 text-red-600'
      }`}
    >
      {status === 'active' ? 'Active' : 'Suspended'}
    </span>
  );
}
