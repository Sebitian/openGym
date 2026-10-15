/* No hosted accounts. A 401 sends the web boot to the sign-in screen,
   where guest mode can load the Supabase sessions. */
export function GET() {
  return Response.json({ error: 'not signed in' }, { status: 401 });
}
