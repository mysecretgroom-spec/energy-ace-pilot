-- 1. Créer la nouvelle table bouquets avec regie_ids array
CREATE TABLE public.bouquets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  regie_ids UUID[] DEFAULT NULL, -- NULL = global, array = régies spécifiques
  nom_bouquet VARCHAR NOT NULL,
  puissance_kwc NUMERIC NOT NULL,
  prix_recommande NUMERIC NOT NULL,
  prix_max NUMERIC NOT NULL,
  prix_hejja NUMERIC DEFAULT 0,
  commission_fixe NUMERIC DEFAULT 0,
  commission_pct NUMERIC DEFAULT 0,
  description TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Migrer les données de data_prix_bouquets (globaux, regie_ids = NULL)
INSERT INTO public.bouquets (user_id, regie_ids, nom_bouquet, puissance_kwc, prix_recommande, prix_max, prix_hejja, commission_fixe, commission_pct, description, actif, created_at, updated_at)
SELECT user_id, NULL, nom_bouquet, puissance_kwc, prix_recommande, prix_max, COALESCE(prix_hejja, 0), COALESCE(commission_fixe, 0), COALESCE(commission_pct, 0), description, actif, created_at, updated_at
FROM public.data_prix_bouquets;

-- 3. Migrer les données de regies_bouquets (avec regie_id -> regie_ids array)
INSERT INTO public.bouquets (user_id, regie_ids, nom_bouquet, puissance_kwc, prix_recommande, prix_max, prix_hejja, commission_fixe, commission_pct, description, actif, created_at, updated_at)
SELECT user_id, ARRAY[regie_id], nom_bouquet, puissance_kwc, prix_recommande, prix_max, COALESCE(prix_hejja, 0), COALESCE(commission_fixe, 0), COALESCE(commission_pct, 0), description, actif, created_at, updated_at
FROM public.regies_bouquets
WHERE regie_id IS NOT NULL;

-- 4. Enable RLS sur bouquets
ALTER TABLE public.bouquets ENABLE ROW LEVEL SECURITY;

-- 5. Policies RLS pour bouquets (même pattern que data_prix_bouquets)
CREATE POLICY "Admins can manage global bouquets"
ON public.bouquets
FOR ALL
USING (regie_ids IS NULL AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (regie_ids IS NULL AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can read global or own bouquets"
ON public.bouquets
FOR SELECT
USING (regie_ids IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own bouquets"
ON public.bouquets
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own bouquets"
ON public.bouquets
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own bouquets"
ON public.bouquets
FOR DELETE
USING (user_id = auth.uid());

-- 6. Trigger pour updated_at
CREATE TRIGGER update_bouquets_updated_at
BEFORE UPDATE ON public.bouquets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Supprimer les anciennes tables
DROP TABLE IF EXISTS public.regies_bouquets;
DROP TABLE IF EXISTS public.data_prix_bouquets;

-- 8. Supprimer date_pose de ventes (garder uniquement date_installation_reelle)
ALTER TABLE public.ventes DROP COLUMN IF EXISTS date_pose;