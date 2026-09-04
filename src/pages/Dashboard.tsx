import { useEffect, useState } from 'react';
import {
  BookOpen,
  Users,
  ArrowRightLeft,
  AlertTriangle,
  TrendingUp,
  Library,
  Clock,
  DollarSign,
} from 'lucide-react';
import { supabase, type LoanWithRelations } from '@/lib/supabase';
import { formatDate, daysFromNow, formatCurrency } from '@/lib/format';
import type { Page } from '@/App';

type Stats = {
  totalBooks: number;
  totalCopies: number;
  availableCopies: number;
  totalMembers: number;
  activeMembers: number;
  activeLoans: number;
  overdueLoans: number;
  totalFines: number;
};

export function Dashboard({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentLoans, setRecentLoans] = useState<LoanWithRelations[]>([]);
  const [overdueLoans, setOverdueLoans] = useState<LoanWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [books, members, loansRes, overdueRes] = await Promise.all([
        supabase.from('books').select('total_copies, available_copies'),
        supabase.from('members').select('status'),
        supabase
          .from('loans')
          .select('*, book:books(*), member:members(*)')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('loans')
          .select('*, book:books(*), member:members(*)')
          .eq('status', 'overdue')
          .order('due_date', { ascending: true }),
      ]);

      const booksData = books.data ?? [];
      const membersData = members.data ?? [];
      const totalCopies = booksData.reduce((s, b) => s + b.total_copies, 0);
      const availableCopies = booksData.reduce((s, b) => s + b.available_copies, 0);

      setStats({
        totalBooks: booksData.length,
        totalCopies,
        availableCopies,
        totalMembers: membersData.length,
        activeMembers: membersData.filter((m) => m.status === 'active').length,
        activeLoans: (loansRes.data ?? []).filter(
          (l) => l.status === 'on_loan' || l.status === 'overdue',
        ).length,
        overdueLoans: overdueRes.data?.length ?? 0,
        totalFines: (overdueRes.data ?? []).reduce((s, l) => {
          const days = Math.abs(daysFromNow(l.due_date));
          return s + days * 0.5;
        }, 0),
      });

      setRecentLoans((loansRes.data ?? []) as LoanWithRelations[]);
      setOverdueLoans((overdueRes.data ?? []) as LoanWithRelations[]);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of your college library at a glance
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label="Total Titles"
          value={stats?.totalBooks ?? 0}
          sub={`${stats?.totalCopies ?? 0} copies in catalog`}
          color="blue"
          onClick={() => onNavigate('books')}
        />
        <StatCard
          icon={Library}
          label="Available Copies"
          value={stats?.availableCopies ?? 0}
          sub={`${stats?.totalCopies && stats.availableCopies
            ? Math.round((stats.availableCopies / stats.totalCopies) * 100)
            : 0}% available now`}
          color="emerald"
          onClick={() => onNavigate('books')}
        />
        <StatCard
          icon={Users}
          label="Members"
          value={stats?.totalMembers ?? 0}
          sub={`${stats?.activeMembers ?? 0} active students`}
          color="amber"
          onClick={() => onNavigate('members')}
        />
        <StatCard
          icon={ArrowRightLeft}
          label="Active Loans"
          value={stats?.activeLoans ?? 0}
          sub={`${stats?.overdueLoans ?? 0} overdue`}
          color="violet"
          onClick={() => onNavigate('loans')}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MiniStat
          icon={AlertTriangle}
          label="Overdue Books"
          value={stats?.overdueLoans ?? 0}
          color="text-red-600 bg-red-50"
        />
        <MiniStat
          icon={DollarSign}
          label="Outstanding Fines"
          value={formatCurrency(stats?.totalFines ?? 0)}
          color="text-amber-600 bg-amber-50"
        />
        <MiniStat
          icon={TrendingUp}
          label="Books on Loan"
          value={`${(stats?.totalCopies ?? 0) - (stats?.availableCopies ?? 0)}`}
          color="text-blue-600 bg-blue-50"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent activity */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Clock className="h-4 w-4 text-slate-400" />
              Recent Activity
            </h2>
            <button
              onClick={() => onNavigate('loans')}
              className="text-sm font-medium text-blue-600 transition hover:text-blue-700"
            >
              View all →
            </button>
          </div>
          {recentLoans.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No loans yet</p>
          ) : (
            <div className="space-y-3">
              {recentLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {loan.book?.title}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {loan.member?.name} · {formatDate(loan.checkout_date)}
                    </p>
                  </div>
                  <LoanStatusBadge status={loan.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue alerts */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Overdue Alerts
            </h2>
            <button
              onClick={() => onNavigate('loans')}
              className="text-sm font-medium text-blue-600 transition hover:text-blue-700"
            >
              View all →
            </button>
          </div>
          {overdueLoans.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircleSafe />
              </div>
              <p className="text-sm text-slate-400">No overdue books — all clear!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overdueLoans.slice(0, 6).map((loan) => {
                const daysLate = Math.abs(daysFromNow(loan.due_date));
                return (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {loan.book?.title}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {loan.member?.name} · Due {formatDate(loan.due_date)}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="text-xs font-semibold text-red-600">
                        {daysLate}d late
                      </p>
                      <p className="text-xs text-red-400">
                        {formatCurrency(daysLate * 0.5)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckCircleSafe() {
  return (
    <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

type ColorKey = 'blue' | 'emerald' | 'amber' | 'violet';

const colorMap: Record<ColorKey, { bg: string; icon: string; ring: string }> = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', ring: 'ring-blue-100' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-100' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', ring: 'ring-amber-100' },
  violet: { bg: 'bg-violet-50', icon: 'text-violet-600', ring: 'ring-violet-100' },
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  onClick,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number | string;
  sub: string;
  color: ColorKey;
  onClick: () => void;
}) {
  const c = colorMap[color];
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-4 ${c.bg} ${c.ring}`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </button>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export function LoanStatusBadge({ status }: { status: 'on_loan' | 'returned' | 'overdue' }) {
  const map = {
    on_loan: { label: 'On Loan', classes: 'bg-blue-50 text-blue-700 ring-blue-200' },
    returned: { label: 'Returned', classes: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    overdue: { label: 'Overdue', classes: 'bg-red-50 text-red-700 ring-red-200' },
  };
  const s = map[status];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${s.classes}`}>
      {s.label}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
