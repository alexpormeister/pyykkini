CREATE POLICY "Authenticated can read laundry uploads" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'laundry-uploads');
CREATE POLICY "Authenticated can insert laundry uploads" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'laundry-uploads');