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
    // Run one 250-account batch every 30 minutes to preserve log quota until reset.
    // Rotate by the same 30-minute interval as pg_cron so all four batches are covered.
    const batchIndex = Math.floor(Date.now() / 1800000) % 4
    const batchStart = batchIndex * 250 + 1
    const batchEnd = batchStart + 249

    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ai-worker-token': WORKER_TOKEN
      },
      body: JSON.stringify({ batchStart, batchEnd })
    })

    const body = await response.text()
    if (response.status < 200 || response.status >= 300) {
      console.error('ai-worker batch failure:', JSON.stringify({ batchStart, batchEnd, status: response.status, text: body }))
      return json({ ok: false, batchStart, batchEnd, status: response.status, text: body }, 502)
    }

    // Run a bounded AI-to-AI trade batch after the player-simulation batch.
    // Trading failures are reported separately and do not invalidate the completed worker batch.
    const tradeResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-trading`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ai-worker-token': WORKER_TOKEN
      },
      body: JSON.stringify({ batch_size: 20 })
    })
    const tradingBody = await tradeResponse.text()
    return json({
      ok: true,
      batchStart,
      batchEnd,
      worker: body,
      trading: { ok: tradeResponse.status >= 200 && tradeResponse.status < 300, status: tradeResponse.status, body: tradingBody }
    })
  } catch (e) {
    console.error('ai-cron worker fetch failed:', e)
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 502)
  }
})