ALTER TABLE public.catalog_items ADD COLUMN IF NOT EXISTS sort_order integer;

-- مقداردهی اولیه بر اساس همون ترتیب الفبایی فعلی، به تفکیک هر بخش
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY department_id ORDER BY name) AS rn
  FROM public.catalog_items
)
UPDATE public.catalog_items c
SET sort_order = ranked.rn
FROM ranked
WHERE c.id = ranked.id;

ALTER TABLE public.catalog_items ALTER COLUMN sort_order SET NOT NULL;
ALTER TABLE public.catalog_items ALTER COLUMN sort_order SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS catalog_items_department_sort_idx
  ON public.catalog_items (department_id, sort_order);
