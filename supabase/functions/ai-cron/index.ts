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
      // pg_cron runs at minute granularity. Start two bounded market passes 30s apart.
      // Do not return or log the verbose trade payloads.
      const runMarketPass = () => fetch(`${SUPABASE_URL}/functions/v1/ai-trading`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ai-worker-token': WORKER_TOKEN },
        body: JSON.stringify({ batch_size: 3 })
      })
      const firstPass = runMarketPass()
      await new Promise(resolve => setTimeout(resolve, 30000))
      const secondPass = runMarketPass()
      const [first, second] = await Promise.all([firstPass, secondPass])
      await Promise.all([first.body?.cancel(), second.body?.cancel()])
      if (!first.ok || !second.ok) return json({ ok: false, mode: 'trading', first_status: first.status, second_status: second.status }, 502)
      return json({ ok: true, mode: 'trading', passes: 2 })
    }
    // Player simulation and progression remain on the existing 30-minute schedule.
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
      return json({ ok: false, batchStart, batchEnd, status: response.status }, 502)
    }

    // AI market activity is handled by a separate five-minute cron job.
    return json({ ok: true, batchStart, batchEnd })
  } catch (e) {
    return json({ ok: false, error: 'AI_CRON_FAILED' }, 502)
  }
})