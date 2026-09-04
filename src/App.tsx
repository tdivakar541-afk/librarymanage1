import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ArrowRightLeft,
  Library,
  Menu,
  X,
} from 'lucide-react';
import { Dashboard } from '@/pages/Dashboard';
import { Books } from '@/pages/Books';
import { Members } from '@/pages/Members';
import { Loans } from '@/pages/Loans';

export type Page = 'dashboard' | 'books' | 'members' | 'loans';

const navItems: { key: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'books', label: 'Books', icon: BookOpen },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'loans', label: 'Loans', icon: ArrowRightLeft },
];

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [page]);

  const navigate = (p: Page) => setPage(p);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <SidebarContent page={page} navigate={navigate} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-slate-200 bg-white">
            <SidebarContent page={page} navigate={navigate} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-sm font-semibold capitalize text-slate-800">
                {navItems.find((n) => n.key === page)?.label}
              </h2>
              <p className="hidden text-xs text-slate-400 sm:block">
                College Library Management System
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 sm:flex">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-slate-600">System Online</span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold text-white">
              LB
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
            {page === 'books' && <Books />}
            {page === 'members' && <Members />}
            {page === 'loans' && <Loans />}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  page,
  navigate,
}: {
  page: Page;
  navigate: (p: Page) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-sm">
          <Library className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-slate-900">LibManage</h1>
          <p className="truncate text-xs text-slate-400">College Library System</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = page === item.key;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon
                className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-slate-400'}`}
              />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 px-5 py-4">
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-slate-50 p-3 ring-1 ring-slate-200/60">
          <p className="text-xs font-semibold text-slate-700">Quick Tip</p>
          <p className="mt-1 text-xs text-slate-500">
            Late returns are automatically fined $0.50/day.
          </p>
        </div>
      </div>
    </>
  );
}

export default App;
