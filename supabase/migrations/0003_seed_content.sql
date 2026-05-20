-- 0003_seed_content.sql
-- Seed metadata for the 3 MVP units and their 12 lessons.
-- Title strings are i18n keys; actual copy lives in content/i18n/*.json.

insert into public.units (id, title_key, order_index, cefr) values
  ('01-me-and-my-world',     'units.01-me-and-my-world.title',     1, 'Pre-A1'),
  ('02-home-and-food',       'units.02-home-and-food.title',       2, 'Pre-A1/A1'),
  ('03-animals-and-actions', 'units.03-animals-and-actions.title', 3, 'A1')
on conflict (id) do nothing;

insert into public.lessons (id, unit_id, title_key, order_index) values
  ('u1.l1', '01-me-and-my-world', 'lessons.u1.l1.title', 1),  -- Greetings
  ('u1.l2', '01-me-and-my-world', 'lessons.u1.l2.title', 2),  -- Family
  ('u1.l3', '01-me-and-my-world', 'lessons.u1.l3.title', 3),  -- Colors
  ('u1.l4', '01-me-and-my-world', 'lessons.u1.l4.title', 4),  -- Numbers

  ('u2.l1', '02-home-and-food', 'lessons.u2.l1.title', 1),    -- Rooms
  ('u2.l2', '02-home-and-food', 'lessons.u2.l2.title', 2),    -- Furniture
  ('u2.l3', '02-home-and-food', 'lessons.u2.l3.title', 3),    -- Food basics
  ('u2.l4', '02-home-and-food', 'lessons.u2.l4.title', 4),    -- Mealtimes

  ('u3.l1', '03-animals-and-actions', 'lessons.u3.l1.title', 1), -- Farm animals
  ('u3.l2', '03-animals-and-actions', 'lessons.u3.l2.title', 2), -- Wild animals
  ('u3.l3', '03-animals-and-actions', 'lessons.u3.l3.title', 3), -- Action verbs
  ('u3.l4', '03-animals-and-actions', 'lessons.u3.l4.title', 4)  -- Sounds & movement
on conflict (id) do nothing;
