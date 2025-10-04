-- Replace 'YOUR_USER_EMAIL' with the email of the user you want to make admin
UPDATE public.users
SET role = 'admin'
WHERE email = 'YOUR_USER_EMAIL';

-- Verify the change
SELECT id, email, role
FROM public.users
WHERE email = 'YOUR_USER_EMAIL';
