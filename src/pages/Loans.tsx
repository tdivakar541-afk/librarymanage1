import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  ArrowRightLeft,
  BookOpen,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  RotateCcw,
} from 'lucide-react';
import { supabase, type Book, type Member, type LoanWithRelations } from '@/lib/supabase';
import { formatDate, formatCurrency, daysFromNow, dateInputToISO } from '@/lib/format';
import { LoanStatusBadge } from '@/pages/Dashboard';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';

type Tab = 'active' | 'overdue' | 'returned' | 'all';

export function Loans() {
  const [loans, setLoans] = useState<LoanWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [returnTarget, setReturnTarget] = useState<LoanWithRelations | null>(null);
  const { toasts, dismiss, showToast } = useToast();

  // checkout form state
  const [books, setBooks] = useState<Book[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selBook, setSelBook] = useState('');
  const [selMember, setSelMember] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [checkoutSaving, setCheckoutSaving] = useState(false);

  const loadLoans = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('loans')
      .select('*, book:books(*), member:members(*)')
      .order('checkout_date', { ascending: false });
    if (error) {
      showToast.error('Failed to load loans');
    } else {
      setLoans(data as LoanWithRelations[]);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  const openCheckout = async () => {
    const [booksRes, membersRes] = await Promise.all([
      supabase.from('books').select('*').gt('available_copies', 0).order('title'),
      supabase.from('members').select('*').eq('status', 'active').order('name'),
    ]);
    setBooks(booksRes.data as Book[]);
    setMembers(membersRes.data as Member[]);
    setSelBook('');
    setSelMember('');
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 14);
    setDueDate(defaultDue.toISOString().split('T')[0]);
    setShowCheckout(true);
  };

  const handleCheckout = async () => {
    if (!selBook || !selMember || !dueDate) {
      showToast.warning('Please select a book, member, and due date');
      return;
    }
    setCheckoutSaving(true);
    const { error } = await supabase.from('loans').insert({
      book_id: selBook,
      member_id: selMember,
      checkout_date: new Date().toISOString(),
      due_date: dateInputToISO(dueDate),
      return_date: null,
    });
    if (error) {
      showToast.error('Failed to checkout book');
    } else {
      showToast.success('Book checked out successfully');
      setShowCheckout(false);
      loadLoans();
    }
    setCheckoutSaving(false);
  };

  const handleReturn = async () => {
    if (!returnTarget) return;
    const { error } = await supabase
      .from('loans')
      .update({ return_date: new Date().toISOString() })
      .eq('id', returnTarget.id);
    if (error) {
      showToast.error('Failed to return book');
    } else {
      const daysLate = Math.abs(daysFromNow(returnTarget.due_date));
      if (returnTarget.status === 'overdue' || daysLate < 0) {
        showToast.success(`Book returned — fine: ${formatCurrency(Math.abs(daysLate) * 0.5)}`);
      } else {
        showToast.success('Book returned on time');
      }
      setReturnTarget(null);
      loadLoans();
    }
  };

  const filtered = useMemo(() => {
    return loans.filter((l) => {
      const matchesTab =
        tab === 'all' ||
        (tab === 'active' && (l.status === 'on_loan' || l.status === 'overdue')) ||
        (tab === 'overdue' && l.status === 'overdue') ||
        (tab === 'returned' && l.status === 'returned');
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        l.book?.title.toLowerCase().includes(q) ||
        l.member?.name.toLowerCase().includes(q) ||
        l.member?.student_id.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [loans, tab, search]);

  const counts = useMemo(() => {
    return {
      active: loans.filter((l) => l.status === 'on_loan' || l.status === 'overdue').length,
      overdue: loans.filter((l) => l.status === 'overdue').length,
      returned: loans.filter((l) => l.status === 'returned').length,
      all: loans.length,
    };
  }, [loans]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'overdue', label: 'Overdue', count: counts.overdue },
    { key: 'returned', label: 'Returned', count: counts.returned },
    { key: 'all', label: 'All History', count: counts.all },
  ];

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Loans</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage book checkouts and returns
          </p>
        </div>
        <button
          onClick={openCheckout}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Checkout Book
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                tab === t.key ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by book title, member name, or student ID…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16">
          <ArrowRightLeft className="h-12 w-12 text-slate-300" />
          <p className="mt-4 text-sm font-medium text-slate-500">No loans found</p>
          <p className="mt-1 text-xs text-slate-400">
            {tab === 'active' ? 'No active loans right now' : 'Try a different tab or search'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((loan) => (
            <LoanRow
              key={loan.id}
              loan={loan}
              onReturn={() => setReturnTarget(loan)}
            />
          ))}
        </div>
      )}

      {/* Checkout Modal */}
      <Modal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        title="Checkout Book"
        size="md"
      >
        <div className="space-y-4">
          {books.length === 0 ? (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
              No books are currently available for checkout. All copies are on loan.
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
              No active members found. Add a member first.
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Book
                </label>
                <select
                  value={selBook}
                  onChange={(e) => setSelBook(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a book…</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} — {b.author} ({b.available_copies} available)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Member
                </label>
                <select
                  value={selMember}
                  onChange={(e) => setSelMember(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a member…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.student_id}) — {m.department}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-400">Default: 14 days from today</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Late returns incur a fine of $0.50 per day overdue.
                </p>
              </div>
            </>
          )}
        </div>
        {books.length > 0 && members.length > 0 && (
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setShowCheckout(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleCheckout}
              disabled={checkoutSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {checkoutSaving ? 'Checking out…' : 'Checkout'}
            </button>
          </div>
        )}
      </Modal>

      {/* Return Confirm */}
      <ConfirmDialog
        open={!!returnTarget}
        onClose={() => setReturnTarget(null)}
        onConfirm={handleReturn}
        title="Return Book"
        danger={false}
        confirmLabel="Confirm Return"
        message={`Mark "${returnTarget?.book?.title}" as returned by ${returnTarget?.member?.name}?`}
      >
        {returnTarget && returnTarget.status === 'overdue' && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            <p className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4" />
              A fine of {formatCurrency(Math.abs(daysFromNow(returnTarget.due_date)) * 0.5)} will be
              applied for late return.
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';

function LoanRow({
  loan,
  onReturn,
}: {
  loan: LoanWithRelations;
  onReturn: () => void;
}) {
  const daysLeft = daysFromNow(loan.due_date);
  const isOverdue = loan.status === 'overdue';
  const isActive = loan.status === 'on_loan' || loan.status === 'overdue';

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 transition sm:flex-row sm:items-center sm:justify-between ${
        isOverdue
          ? 'border-red-200 bg-red-50/40'
          : loan.status === 'returned'
            ? 'border-slate-200 bg-white'
            : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            isOverdue ? 'bg-red-100' : 'bg-blue-50'
          }`}
        >
          {isOverdue ? (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          ) : loan.status === 'returned' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <BookOpen className="h-5 w-5 text-blue-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {loan.book?.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {loan.member?.name} ({loan.member?.student_id})
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Out: {formatDate(loan.checkout_date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Due: {formatDate(loan.due_date)}
            </span>
          </div>
          {loan.status === 'returned' && loan.return_date && (
            <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
              Returned on {formatDate(loan.return_date)}
              {loan.fine_amount > 0 && (
                <span className="text-amber-600">· Fine: {formatCurrency(loan.fine_amount)}</span>
              )}
            </p>
          )}
          {isActive && (
            <p
              className={`mt-1 text-xs font-medium ${
                isOverdue ? 'text-red-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-slate-500'
              }`}
            >
              {isOverdue
                ? `${Math.abs(daysLeft)} days overdue`
                : daysLeft === 0
                  ? 'Due today'
                  : `${daysLeft} days remaining`}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:shrink-0">
        <LoanStatusBadge status={loan.status} />
        {isActive && (
          <button
            onClick={onReturn}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Return
          </button>
        )}
      </div>
    </div>
  );
}
