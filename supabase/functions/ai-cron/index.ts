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
      // Bazaar automation runs once per five-minute cron tick.
      // Keep the batch small and discard response bodies to limit DB load and logs.
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-trading`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ai-worker-token': WORKER_TOKEN },
          body: JSON.stringify({ batch_size: 1 }),
          signal: controller.signal
        })
        await response.body?.cancel()
        if (!response.ok) return json({ ok: false, mode: 'trading', status: response.status }, 502)
        return json({ ok: true, mode: 'trading', batch_size: 1 })
      } finally {
        clearTimeout(timeout)
      }
    }

    // Process 50 accounts every five minutes to stay below Edge Function execution limits.
    // Twenty rotating batches cover all 1,000 AI accounts every 100 minutes.
    const now = new Date()
    if (now.getUTCMinutes() % 5 !== 0) {
      return json({ ok: true, skipped: true, reason: 'outside_five_minute_ai_schedule' })
    }
    const batchIndex = Math.floor(now.getTime() / 300000) % 20
    const batchStart = batchIndex * 50 + 1
    const batchEnd = batchStart + 49
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ai-worker-token': WORKER_TOKEN },
        body: JSON.stringify({ batchStart, batchEnd }),
        signal: controller.signal
      })
      await response.body?.cancel()
      if (!response.ok) return json({ ok: false, batchStart, batchEnd, status: response.status }, 502)
      return json({ ok: true, batchStart, batchEnd })
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    return json({ ok: false, error: 'AI_CRON_FAILED' }, 502)
  }
})
