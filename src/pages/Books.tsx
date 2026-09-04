import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  BookOpen,
  Edit3,
  Trash2,
  Library,
  MapPin,
  Calendar,
  User,
  Filter,
} from 'lucide-react';
import { supabase, type Book, CATEGORIES } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';

type BookForm = Omit<Book, 'id' | 'created_at' | 'available_copies'>;

const emptyForm: BookForm = {
  title: '',
  author: '',
  isbn: '',
  category: 'General',
  publisher: '',
  year: new Date().getFullYear(),
  total_copies: 1,
  shelf_location: '',
  description: '',
  cover_url: '',
};

export function Books() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form, setForm] = useState<BookForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const { toasts, dismiss, showToast } = useToast();

  const loadBooks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('title', { ascending: true });
    if (error) {
      showToast.error('Failed to load books');
    } else {
      setBooks(data as Book[]);
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const filtered = useMemo(() => {
    return books.filter((b) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.isbn ?? '').toLowerCase().includes(q);
      const matchesCat = categoryFilter === 'all' || b.category === categoryFilter;
      const matchesAvail =
        availabilityFilter === 'all' ||
        (availabilityFilter === 'available' && b.available_copies > 0) ||
        (availabilityFilter === 'out' && b.available_copies === 0);
      return matchesSearch && matchesCat && matchesAvail;
    });
  }, [books, search, categoryFilter, availabilityFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (book: Book) => {
    setEditing(book);
    setForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn ?? '',
      category: book.category,
      publisher: book.publisher ?? '',
      year: book.year ?? new Date().getFullYear(),
      total_copies: book.total_copies,
      shelf_location: book.shelf_location ?? '',
      description: book.description ?? '',
      cover_url: book.cover_url ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.author.trim()) {
      showToast.warning('Title and author are required');
      return;
    }
    if (form.total_copies < 1) {
      showToast.warning('Total copies must be at least 1');
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      isbn: form.isbn?.trim() || null,
      category: form.category,
      publisher: form.publisher?.trim() || null,
      year: form.year || null,
      total_copies: form.total_copies,
      shelf_location: form.shelf_location?.trim() || null,
      description: form.description?.trim() || null,
      cover_url: form.cover_url?.trim() || null,
    };

    if (editing) {
      const { error } = await supabase
        .from('books')
        .update({
          ...payload,
          available_copies: Math.min(
            payload.total_copies,
            editing.available_copies + (payload.total_copies - editing.total_copies),
          ),
        })
        .eq('id', editing.id);
      if (error) {
        showToast.error(error.message.includes('duplicate') ? 'A book with that ISBN already exists' : 'Failed to update book');
      } else {
        showToast.success(`"${payload.title}" updated`);
        setShowForm(false);
        loadBooks();
      }
    } else {
      const { data, error } = await supabase
        .from('books')
        .insert({ ...payload, available_copies: payload.total_copies })
        .select()
        .single();
      if (error) {
        showToast.error(error.message.includes('duplicate') ? 'A book with that ISBN already exists' : 'Failed to add book');
      } else {
        showToast.success(`"${payload.title}" added to catalog`);
        setShowForm(false);
        loadBooks();
      }
      void data;
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('books').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast.error('Failed to delete book');
    } else {
      showToast.success(`"${deleteTarget.title}" removed`);
      setDeleteTarget(null);
      loadBooks();
    }
  };

  const categories = useMemo(() => {
    const set = new Set(books.map((b) => b.category));
    return ['all', ...Array.from(set).sort()];
  }, [books]);

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Book Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">
            {books.length} titles · {books.reduce((s, b) => s + b.total_copies, 0)} total copies
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Add Book
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
            placeholder="Search by title, author, or ISBN…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-8 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All Availability</option>
            <option value="available">Available</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16">
          <Library className="h-12 w-12 text-slate-300" />
          <p className="mt-4 text-sm font-medium text-slate-500">No books found</p>
          <p className="mt-1 text-xs text-slate-400">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onEdit={() => openEdit(book)}
              onDelete={() => setDeleteTarget(book)}
              onDetail={() => setDetailBook(book)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Book' : 'Add New Book'}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
              placeholder="Introduction to Algorithms"
            />
          </Field>
          <Field label="Author" required>
            <input
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              className={inputClass}
              placeholder="Cormen, Leiserson"
            />
          </Field>
          <Field label="ISBN">
            <input
              value={form.isbn ?? ''}
              onChange={(e) => setForm({ ...form, isbn: e.target.value })}
              className={inputClass}
              placeholder="9780262033848"
            />
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Publisher">
            <input
              value={form.publisher ?? ''}
              onChange={(e) => setForm({ ...form, publisher: e.target.value })}
              className={inputClass}
              placeholder="MIT Press"
            />
          </Field>
          <Field label="Publication Year">
            <input
              type="number"
              value={form.year ?? ''}
              onChange={(e) => setForm({ ...form, year: e.target.value ? parseInt(e.target.value) : null })}
              className={inputClass}
              placeholder="2009"
            />
          </Field>
          <Field label="Total Copies">
            <input
              type="number"
              min={1}
              value={form.total_copies}
              onChange={(e) => setForm({ ...form, total_copies: parseInt(e.target.value) || 1 })}
              className={inputClass}
            />
          </Field>
          <Field label="Shelf Location" className="sm:col-span-2">
            <input
              value={form.shelf_location ?? ''}
              onChange={(e) => setForm({ ...form, shelf_location: e.target.value })}
              className={inputClass}
              placeholder="A-12"
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={`${inputClass} min-h-[80px] resize-y`}
              placeholder="Brief description of the book…"
            />
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
            {saving ? 'Saving…' : editing ? 'Update Book' : 'Add Book'}
          </button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailBook} onClose={() => setDetailBook(null)} title="Book Details" size="md">
        {detailBook && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 ring-1 ring-blue-200">
                <BookOpen className="h-8 w-8 text-blue-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900">{detailBook.title}</h3>
                <p className="text-sm text-slate-500">by {detailBook.author}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag>{detailBook.category}</Tag>
                  {detailBook.isbn && <Tag>ISBN: {detailBook.isbn}</Tag>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
              <DetailItem icon={Library} label="Total Copies" value={`${detailBook.total_copies}`} />
              <DetailItem icon={BookOpen} label="Available" value={`${detailBook.available_copies}`} />
              <DetailItem icon={MapPin} label="Shelf" value={detailBook.shelf_location ?? '—'} />
              <DetailItem icon={Calendar} label="Year" value={detailBook.year ? `${detailBook.year}` : '—'} />
              <DetailItem icon={User} label="Publisher" value={detailBook.publisher ?? '—'} />
            </div>
            {detailBook.description && (
              <p className="text-sm leading-relaxed text-slate-600">{detailBook.description}</p>
            )}
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Book"
        message={`Are you sure you want to remove "${deleteTarget?.title}" from the catalog? This will also delete all loan records for this book.`}
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

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      {children}
    </span>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-400" />
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function BookCard({
  book,
  onEdit,
  onDelete,
  onDetail,
}: {
  book: Book;
  onEdit: () => void;
  onDelete: () => void;
  onDetail: () => void;
}) {
  const available = book.available_copies > 0;
  return (
    <div className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <button onClick={onDetail} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 ring-1 ring-blue-200">
            <BookOpen className="h-6 w-6 text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-700">
              {book.title}
            </h3>
            <p className="truncate text-xs text-slate-500">{book.author}</p>
          </div>
        </button>
        <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-auto space-y-2">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {book.category}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              available
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {book.available_copies}/{book.total_copies} avail
          </span>
        </div>
        {book.shelf_location && (
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <MapPin className="h-3 w-3" /> Shelf {book.shelf_location}
          </p>
        )}
      </div>
    </div>
  );
}
