// supabase/functions/process-scheduled-push/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date().toISOString()
    console.log('[process-push] checking at:', now)

    // Busca notificações pendentes cujo horário já passou
    const { data: due, error: fetchErr } = await sb
      .from('scheduled_notifications')
      .select('*')
      .lte('fire_at', now)
      .eq('sent', false)
      .limit(50)

    if (fetchErr) {
      console.error('[process-push] fetch error:', fetchErr.message)
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: corsHeaders })
    }

    console.log('[process-push] found:', due?.length ?? 0, 'due notifications')

    if (!due?.length) {
      return new Response(JSON.stringify({ processed: 0, message: 'nothing due' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const results = []

    for (const n of due) {
      console.log('[process-push] sending:', n.task_name, 'for user:', n.user_id)

      try {
        const res = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              user_id: n.user_id,
              title: `⏰ ${n.task_name}`,
              body: n.task_body || '',
              tag: n.task_id,
            })
          }
        )

        const responseText = await res.text()
        console.log('[process-push] send-push response:', res.status, responseText)

        // Marca como enviada só se send-push retornou 200
        if (res.status === 200) {
          await sb.from('scheduled_notifications')
            .update({ sent: true })
            .eq('id', n.id)
          results.push({ id: n.id, task: n.task_name, status: 'sent', response: responseText })
        } else {
          results.push({ id: n.id, task: n.task_name, status: 'failed', code: res.status, response: responseText })
        }
      } catch (e: any) {
        console.error('[process-push] fetch error for', n.task_name, ':', e.message)
        results.push({ id: n.id, task: n.task_name, status: 'error', error: e.message })
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e: any) {
    console.error('[process-push] fatal error:', e.message)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
