const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const WORKER_TOKEN = Deno.env.get('AI_WORKER_TOKEN') ?? ''

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)
  if (!SUPABASE_URL || !WORKER_TOKEN) {
    return json({ ok: false, error: 'worker configuration missing' }, 500)
  }

  try {
    const requestBody = await req.json().catch(() => ({})) as Record<string, unknown>
    if (requestBody.mode === 'trading') {
      // Temporary circuit breaker: database-wide PostgREST 522s and SQL connection
      // timeouts are active. Pause automated market writes until DB health recovers.
      // The auction/bazaar tables and existing listings remain untouched.
      return json({ ok: true, mode: 'trading', paused: true, reason: 'database_timeout_protection' })
    }

    // pg_cron is minute-granularity. Enforce the documented 30-minute cadence;
    // otherwise the same 250-account batch would run every minute.
    const now = new Date()
    if (now.getUTCMinutes() % 30 !== 0) {
      return json({ ok: true, skipped: true, reason: 'outside_30_minute_ai_schedule' })
    }

    const batchIndex = Math.floor(now.getTime() / 1800000) % 4
    const batchStart = batchIndex * 250 + 1
    const batchEnd = batchStart + 249
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-worker-token': WORKER_TOKEN
        },
        body: JSON.stringify({ batchStart, batchEnd }),
        signal: controller.signal
      })
      await response.body?.cancel()
      if (response.status < 200 || response.status >= 300) {
        return json({ ok: false, batchStart, batchEnd, status: response.status }, 502)
      }
      return json({ ok: true, batchStart, batchEnd })
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    return json({ ok: false, error: 'AI_CRON_FAILED' }, 502)
  }
})