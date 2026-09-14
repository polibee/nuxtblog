ALTER TABLE public.navigation_item_translations
  ADD COLUMN IF NOT EXISTS alias varchar(120);
