import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  category: string;
  publisher: string | null;
  year: number | null;
  total_copies: number;
  available_copies: number;
  shelf_location: string | null;
  description: string | null;
  cover_url: string | null;
  created_at: string;
};

export type Member = {
  id: string;
  student_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  year_of_study: number | null;
  status: 'active' | 'suspended';
  created_at: string;
};

export type Loan = {
  id: string;
  book_id: string;
  member_id: string;
  checkout_date: string;
  due_date: string;
  return_date: string | null;
  status: 'on_loan' | 'returned' | 'overdue';
  fine_amount: number;
  created_at: string;
  // joined fields
  book?: Pick<Book, 'id' | 'title' | 'author' | 'isbn'>;
  member?: Pick<Member, 'id' | 'student_id' | 'name' | 'department'>;
};

export type LoanWithRelations = Loan & {
  book: Book;
  member: Member;
};

export const CATEGORIES = [
  'Computer Science',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Literature',
  'History',
  'Engineering',
  'General',
];

export const DEPARTMENTS = [
  'Computer Science',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Business Administration',
];
