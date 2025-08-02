-- Add profile_image column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN profile_image integer DEFAULT 1;

-- Add check constraint to ensure valid profile image IDs
ALTER TABLE public.profiles 
ADD CONSTRAINT profile_image_check 
CHECK (profile_image BETWEEN 1 AND 5);