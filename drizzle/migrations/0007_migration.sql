DROP POLICY IF EXISTS "alert sounds public read" ON storage.objects;
CREATE POLICY "alert sounds team read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'alert-sounds' AND public.is_team_member(auth.uid()));