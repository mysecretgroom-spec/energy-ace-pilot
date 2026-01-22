-- Create table for compteur types (triphasé/monophasé)
CREATE TABLE public.data_compteurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_compteur varchar NOT NULL UNIQUE,
  montant numeric NOT NULL DEFAULT 0,
  description text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_compteurs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read data_compteurs" 
  ON public.data_compteurs FOR SELECT 
  USING (true);

CREATE POLICY "Admins can insert data_compteurs" 
  ON public.data_compteurs FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data_compteurs" 
  ON public.data_compteurs FOR UPDATE 
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete data_compteurs" 
  ON public.data_compteurs FOR DELETE 
  USING (has_role(auth.uid(), 'admin'));

-- Insert default data from spreadsheet
INSERT INTO public.data_compteurs (type_compteur, montant, description) VALUES
('TRIPHASÉ', 500, 'Installation triphasée - surcoût'),
('MONOPHASÉ', 0, 'Installation monophasée standard');

-- Create table for calibres de disjoncteur
CREATE TABLE public.data_calibres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calibre_amperes integer NOT NULL UNIQUE,
  puissance_kva numeric NOT NULL,
  intensite_max_a integer NOT NULL,
  usage_typique text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_calibres ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read data_calibres" 
  ON public.data_calibres FOR SELECT 
  USING (true);

CREATE POLICY "Admins can insert data_calibres" 
  ON public.data_calibres FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data_calibres" 
  ON public.data_calibres FOR UPDATE 
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete data_calibres" 
  ON public.data_calibres FOR DELETE 
  USING (has_role(auth.uid(), 'admin'));

-- Insert default data from spreadsheet
INSERT INTO public.data_calibres (calibre_amperes, puissance_kva, intensite_max_a, usage_typique) VALUES
(15, 3, 15, 'Très petit logement, studio, local technique'),
(30, 6, 30, 'Appartement ou petite maison sans chauffage électrique'),
(45, 9, 45, 'Maison standard avec électroménager, chauffe-eau, etc.'),
(60, 12, 60, 'Maison avec chauffage électrique ou pompe à chaleur'),
(75, 15, 75, 'Grande maison, équipements puissants (piscine, clim, etc.)'),
(90, 18, 90, 'Très grande habitation ou petit local professionnel'),
(120, 24, 120, 'Installation importante ou semi-professionnelle');