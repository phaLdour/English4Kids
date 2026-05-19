/**
 * Supabase row types for the E4K MVP schema.
 *
 * Hand-written to match the SQL migrations (since we can't run
 * `supabase gen types` in this environment). Keep in sync with
 * /supabase/migrations.
 */

export interface Profile {
  id: string;
  role: 'parent' | 'anonymous';
  display_name: string | null;
  locale: string;
  is_anonymous: boolean;
  upgraded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Child {
  id: string;
  parent_id: string;
  nickname: string;
  avatar_key: string | null;
  age_band: '6-8' | '9-12';
  birth_year: number | null;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  title_key: string;
  order_index: number;
  cefr: string;
}

export interface Lesson {
  id: string;
  unit_id: string;
  title_key: string;
  order_index: number;
}

export interface Progress {
  id: string;
  child_id: string;
  lesson_id: string;
  status: 'locked' | 'in_progress' | 'completed' | 'mastered';
  stars: number;
  best_score: number | null;
  attempts_count: number;
  last_attempt_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VocabState {
  id: string;
  child_id: string;
  word_key: string;
  box: 1 | 2 | 3 | 4 | 5;
  consecutive_correct: number;
  last_result: 'correct' | 'incorrect' | null;
  last_seen_at: string | null;
  due_at: string;
  created_at: string;
  updated_at: string;
}

export interface PronunciationAttempt {
  id: string;
  child_id: string;
  word_key: string;
  score: number;
  band: 'great' | 'good' | 'try-again';
  recognized_text: string | null;
  engine: 'web-speech' | 'whisper-wasm';
  attempted_at: string;
}

export interface AuditEvent {
  id: number;
  actor_id: string | null;
  child_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}

export interface SyncOutboxRow {
  id: string;
  child_id: string;
  client_op_id: string;
  op_type: string;
  op_payload: Record<string, unknown>;
  applied_at: string | null;
  created_at: string;
}
