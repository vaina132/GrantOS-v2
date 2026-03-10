-- Create a storage bucket for temporary grant agreement uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('grant-uploads', 'grant-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to grant-uploads bucket
CREATE POLICY "Authenticated users can upload grant files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'grant-uploads');

-- Allow authenticated users to read their uploaded files
CREATE POLICY "Authenticated users can read grant files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'grant-uploads');

-- Allow authenticated users to delete their uploaded files
CREATE POLICY "Authenticated users can delete grant files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'grant-uploads');
