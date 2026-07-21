CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  priority TEXT NOT NULL DEFAULT 'med' CHECK (priority IN ('low', 'med', 'high')),
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('study', 'work', 'fitness', 'personal', 'finance', 'travel', 'meeting', 'health', 'goal', 'other')),
  reminder TIMESTAMPTZ,
  recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  color TEXT,
  notes TEXT,
  created_by TEXT NOT NULL DEFAULT 'manual' CHECK (created_by IN ('ai', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own calendar events"
  ON public.calendar_events
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX calendar_events_user_id_date_idx ON public.calendar_events (user_id, date);
CREATE INDEX calendar_events_user_id_completed_idx ON public.calendar_events (user_id, completed);
CREATE TRIGGER set_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
