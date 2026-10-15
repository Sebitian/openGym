/* Public login flags for the hosted guest site. Passkeys and the
   filesystem server stay off; "Continue without account" stays on. */
export function GET() {
  return Response.json(
    { invite_only: false, allow_guest: true },
    { headers: { 'cache-control': 'no-store' } },
  );
}
