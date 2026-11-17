-- Starter genres (Phase 3). Admins can add, rename or remove genres later.
insert into public.genres (slug, name) values
  ('action', 'Action'),
  ('adventure', 'Adventure'),
  ('comedy', 'Comedy'),
  ('drama', 'Drama'),
  ('fantasy', 'Fantasy'),
  ('horror', 'Horror'),
  ('martial-arts', 'Martial Arts'),
  ('mystery', 'Mystery'),
  ('reincarnation', 'Reincarnation'),
  ('romance', 'Romance'),
  ('school', 'School'),
  ('sci-fi', 'Sci-Fi'),
  ('slice-of-life', 'Slice of Life'),
  ('thriller', 'Thriller')
on conflict (slug) do nothing;
