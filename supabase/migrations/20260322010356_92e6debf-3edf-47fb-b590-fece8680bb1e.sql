-- Create public bucket for videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('videos', 'videos', true, 524288000, ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/avi', 'video/mkv', 'video/mov'])
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload videos to their own folder
CREATE POLICY "Users can upload videos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Authenticated users can update their own videos
CREATE POLICY "Users can update own videos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Authenticated users can delete their own videos
CREATE POLICY "Users can delete own videos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Anyone can view videos (public bucket)
CREATE POLICY "Anyone can view videos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'videos');