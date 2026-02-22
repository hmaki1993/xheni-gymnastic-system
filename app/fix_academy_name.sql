-- FIX ACADEMY NAME TYPO
-- Updates the gym name from "XHENI GYMNASTIC" to "XHENI GYMNASTICS"

UPDATE public.gym_settings
SET gym_name = 'XHENI GYMNASTICS';

-- If you prefer the full name "XHENI GYMNASTICS ACADEMY", uncomment the line below:
-- UPDATE public.gym_settings SET gym_name = 'XHENI GYMNASTICS ACADEMY';
