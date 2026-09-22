-- Add delete functionality to user management
-- First, let's check if we need to modify the profiles table to make address nullable temporarily
ALTER TABLE public.profiles ALTER COLUMN address DROP NOT NULL;

-- Add a delete policy for admins to delete users
CREATE POLICY "Admins can delete users" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add delete policy for user_roles
CREATE POLICY "Admins can delete user roles" 
ON public.user_roles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));