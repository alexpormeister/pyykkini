-- Add is_read column to support_chats table
ALTER TABLE public.support_chats 
ADD COLUMN is_read boolean NOT NULL DEFAULT false;

-- Create index for better query performance
CREATE INDEX idx_support_chats_is_read ON public.support_chats(is_read);

COMMENT ON COLUMN public.support_chats.is_read IS 'Indicates if admin has read the chat';