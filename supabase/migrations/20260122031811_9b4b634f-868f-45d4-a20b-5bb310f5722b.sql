-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policy for user_roles: users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS policy: admins can manage all roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add INSERT/UPDATE/DELETE policies for data tables (for admins)

-- data_psh: Allow admin CRUD
CREATE POLICY "Admins can insert data_psh"
ON public.data_psh
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data_psh"
ON public.data_psh
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete data_psh"
ON public.data_psh
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- data_orientation: Allow admin CRUD
CREATE POLICY "Admins can insert data_orientation"
ON public.data_orientation
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data_orientation"
ON public.data_orientation
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete data_orientation"
ON public.data_orientation
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- data_tarifs_revente: Allow admin CRUD
CREATE POLICY "Admins can insert data_tarifs_revente"
ON public.data_tarifs_revente
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data_tarifs_revente"
ON public.data_tarifs_revente
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete data_tarifs_revente"
ON public.data_tarifs_revente
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- data_prix_bouquets: Allow admin CRUD
CREATE POLICY "Admins can insert data_prix_bouquets"
ON public.data_prix_bouquets
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data_prix_bouquets"
ON public.data_prix_bouquets
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete data_prix_bouquets"
ON public.data_prix_bouquets
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- data_commissions: Allow admin CRUD
CREATE POLICY "Admins can insert data_commissions"
ON public.data_commissions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data_commissions"
ON public.data_commissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete data_commissions"
ON public.data_commissions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- data_surcouts: Allow admin CRUD
CREATE POLICY "Admins can insert data_surcouts"
ON public.data_surcouts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update data_surcouts"
ON public.data_surcouts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete data_surcouts"
ON public.data_surcouts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));