function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)

  // Emergency circuit breaker: the database is timing out across unrelated
  // REST endpoints. Stop all scheduled AI work until database health is verified.
  // This function performs no database writes and does not alter player data.
  return json({
    ok: true,
    paused: true,
    reason: 'database_timeout_protection',
    message: 'Scheduled AI work is temporarily paused while database connectivity is unhealthy.'
  })
})
