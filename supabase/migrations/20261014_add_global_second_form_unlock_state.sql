ALTER TABLE public.world_operator_state
  ADD COLUMN IF NOT EXISTS second_form_unlocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS second_form_unlock_character text,
  ADD COLUMN IF NOT EXISTS second_form_unlock_form_name text,
  ADD COLUMN IF NOT EXISTS second_form_unlock_message text,
  ADD COLUMN IF NOT EXISTS second_form_unlock_updated_at timestamptz;

COMMENT ON COLUMN public.world_operator_state.second_form_unlocks IS 'Globally unlocked second forms and their release announcements.';
COMMENT ON COLUMN public.world_operator_state.second_form_unlock_updated_at IS 'Timestamp used by clients to show the latest second-form release popup once.';
