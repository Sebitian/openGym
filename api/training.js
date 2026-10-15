/* Vercel guest route. The long-lived filesystem server is not deployed;
   this reads Supabase the same way GET /api/training does locally. */
import { supabaseTraining } from './supabase-training.js';

export async function GET() {
  try {
    const training = await supabaseTraining();
    if (!training) {
      return Response.json({ workouts: [], customEx: [], bodyweight: [] });
    }
    return Response.json({
      workouts: training.workouts,
      customEx: training.customEx,
      bodyweight: training.bodyweight,
      plan: training.plan,
      maxes: training.plan?.maxes || [],
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    console.error('supabase training', err);
    return Response.json({ error: 'supabase unavailable' }, { status: 502 });
  }
}
