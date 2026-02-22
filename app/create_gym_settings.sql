-- Create gym_settings table for global customization
CREATE TABLE IF NOT EXISTS gym_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_color TEXT DEFAULT '#10b981', -- Emerald 500
    secondary_color TEXT DEFAULT '#0E1D21', -- Minddazzle Dark
    accent_color TEXT DEFAULT '#34d399', -- Emerald 400
    font_family TEXT DEFAULT 'Cairo',
    font_scale FLOAT DEFAULT 1.0,
    academy_name TEXT DEFAULT 'Xheni Academy',
    logo_url TEXT,
    gym_address TEXT DEFAULT 'Cairo, Egypt',
    gym_phone TEXT DEFAULT '+20 123 456 7890',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure only one row exists
CREATE UNIQUE INDEX IF NOT EXISTS gym_settings_singleton ON gym_settings ((true));

-- Insert default settings if empty
INSERT INTO gym_settings (primary_color, secondary_color, accent_color, font_family, font_scale)
VALUES ('#10b981', '#0E1D21', '#34d399', 'Cairo', 1.0)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE gym_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read settings
CREATE POLICY "Allow read access to all users"
ON gym_settings FOR SELECT
USING (true);

-- Policy: Only Admins can update settings
-- Note: 'admin' role check depends on your auth setup. 
-- Assuming profiles.role or basic authenticated check + frontend gate for now.
-- Ideally: USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
CREATE POLICY "Allow update access to admins"
ON gym_settings FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE gym_settings;
