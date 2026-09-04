/*
# College Library Management System — Schema

## Purpose
A single-tenant library management system for a college. Tracks books in the
catalog, student members, and checkout/return (loan) transactions. There is no
sign-in screen, so the app operates as the `anon` role for its entire lifetime.

## New Tables

1. `books`
   - `id` (uuid, PK)
   - `title` (text, not null)
   - `author` (text, not null)
   - `isbn` (text, unique)
   - `category` (text) — e.g. Computer Science, Literature, Mathematics
   - `publisher` (text)
   - `year` (int) — publication year
   - `total_copies` (int, not null, default 1)
   - `available_copies` (int, not null, default = total_copies) — maintained by triggers
   - `shelf_location` (text) — e.g. "A-12"
   - `description` (text)
   - `cover_url` (text) — optional cover image URL
   - `created_at` (timestamptz)

2. `members`
   - `id` (uuid, PK)
   - `student_id` (text, unique, not null) — college roll number
   - `name` (text, not null)
   - `email` (text)
   - `phone` (text)
   - `department` (text) — e.g. Computer Science, Electrical Eng.
   - `year_of_study` (int) — 1..4
   - `status` (text, default 'active') — 'active' | 'suspended'
   - `created_at` (timestamptz)

3. `loans`
   - `id` (uuid, PK)
   - `book_id` (uuid FK -> books, cascade delete)
   - `member_id` (uuid FK -> members, cascade delete)
   - `checkout_date` (timestamptz, not null, default now())
   - `due_date` (timestamptz, not null)
   - `return_date` (timestamptz, nullable) — null means still on loan
   - `status` (text, default 'on_loan') — 'on_loan' | 'returned' | 'overdue'
   - `fine_amount` (numeric, default 0) — late return fine
   - `created_at` (timestamptz)

## Indexes
   - `idx_loans_book` on loans(book_id)
   - `idx_loans_member` on loans(member_id)
   - `idx_loans_status` on loans(status)
   - `idx_books_category` on books(category)
   - `idx_books_title` on books(title)
   - `idx_members_student_id` on members(student_id)
   - `idx_members_department` on members(department)

## Triggers / Functions
   - `update_book_availability()` — BEFORE INSERT/UPDATE/DELETE on loans trigger.
     Recomputes `books.available_copies` as total_copies minus the count of
     active (return_date IS NULL) loans for that book.
   - `sync_availability` trigger on loans for INSERT, UPDATE, DELETE.
   - `update_loan_status()` — BEFORE UPDATE on loans trigger.
     - Sets status to 'overdue' if return_date still null and now() > due_date.
     - Sets status to 'returned' if return_date is set.
     - Computes fine_amount = $0.50 per day overdue when returned late.
   - `sync_loan_status` trigger on loans for UPDATE.

## Security (RLS)
All three tables are single-tenant (no auth). RLS enabled with anon+authenticated
full CRUD so the anon-key frontend can operate. USING(true) / WITH CHECK(true)
is acceptable here because the data is intentionally shared (no sign-in screen).

## Notes
1. available_copies is maintained automatically by the sync_availability
   trigger whenever loans change — do NOT update it manually from the app.
2. loan status is maintained by the sync_loan_status trigger — set due_date
   and return_date from the app and the trigger derives status + fine.
3. All timestamps are timestamptz.
*/

CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  isbn text UNIQUE,
  category text DEFAULT 'General',
  publisher text,
  year int,
  total_copies int NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
  available_copies int NOT NULL DEFAULT 0 CHECK (available_copies >= 0),
  shelf_location text,
  description text,
  cover_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  department text,
  year_of_study int CHECK (year_of_study >= 1 AND year_of_study <= 5),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  checkout_date timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz NOT NULL,
  return_date timestamptz,
  status text NOT NULL DEFAULT 'on_loan' CHECK (status IN ('on_loan','returned','overdue')),
  fine_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Initialize available_copies = total_copies for rows inserted before triggers exist
UPDATE books SET available_copies = total_copies WHERE available_copies = 0 AND total_copies > 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loans_book ON loans(book_id);
CREATE INDEX IF NOT EXISTS idx_loans_member ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_members_student_id ON members(student_id);
CREATE INDEX IF NOT EXISTS idx_members_department ON members(department);

-- ---------------------------------------------------------------------------
-- Function: recompute available_copies for a given book (or all books)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recompute_book_availability(p_book_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE books
  SET available_copies = total_copies - (
    SELECT count(*) FROM loans
    WHERE loans.book_id = books.id AND loans.return_date IS NULL
  )
  WHERE (p_book_id IS NULL OR books.id = p_book_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: keep available_copies in sync on loan changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_sync_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_book uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    affected_book := OLD.book_id;
  ELSIF (TG_OP = 'INSERT') THEN
    affected_book := NEW.book_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    affected_book := COALESCE(NEW.book_id, OLD.book_id);
  END IF;
  PERFORM recompute_book_availability(affected_book);
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_availability_insert ON loans;
CREATE TRIGGER sync_availability_insert
  AFTER INSERT ON loans
  FOR EACH ROW EXECUTE FUNCTION trg_sync_availability();

DROP TRIGGER IF EXISTS sync_availability_update ON loans;
CREATE TRIGGER sync_availability_update
  AFTER UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION trg_sync_availability();

DROP TRIGGER IF EXISTS sync_availability_delete ON loans;
CREATE TRIGGER sync_availability_delete
  AFTER DELETE ON loans
  FOR EACH ROW EXECUTE FUNCTION trg_sync_availability();

-- ---------------------------------------------------------------------------
-- Trigger: derive loan status + fine from due_date / return_date
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_sync_loan_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  days_late int;
BEGIN
  IF NEW.return_date IS NOT NULL THEN
    NEW.status := 'returned';
    -- fine only if returned after due date
    IF NEW.return_date > NEW.due_date THEN
      days_late := EXTRACT(day FROM (NEW.return_date - NEW.due_date));
      IF days_late < 0 THEN days_late := 0; END IF;
      NEW.fine_amount := (days_late)::numeric * 0.50;
    ELSE
      NEW.fine_amount := 0;
    END IF;
  ELSIF NEW.return_date IS NULL AND now() > NEW.due_date THEN
    NEW.status := 'overdue';
  ELSE
    NEW.status := 'on_loan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_loan_status ON loans;
CREATE TRIGGER sync_loan_status
  BEFORE INSERT OR UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION trg_sync_loan_status();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_books" ON books;
CREATE POLICY "anon_select_books" ON books FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_books" ON books;
CREATE POLICY "anon_insert_books" ON books FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_books" ON books;
CREATE POLICY "anon_update_books" ON books FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_books" ON books;
CREATE POLICY "anon_delete_books" ON books FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_members" ON members;
CREATE POLICY "anon_select_members" ON members FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_members" ON members;
CREATE POLICY "anon_insert_members" ON members FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_members" ON members;
CREATE POLICY "anon_update_members" ON members FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_members" ON members;
CREATE POLICY "anon_delete_members" ON members FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_loans" ON loans;
CREATE POLICY "anon_select_loans" ON loans FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_loans" ON loans;
CREATE POLICY "anon_insert_loans" ON loans FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_loans" ON loans;
CREATE POLICY "anon_update_loans" ON loans FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_loans" ON loans;
CREATE POLICY "anon_delete_loans" ON loans FOR DELETE TO anon, authenticated USING (true);
