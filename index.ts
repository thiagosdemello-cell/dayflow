// supabase/functions/process-scheduled-push/index.ts
// Chamado pelo pg_cron a cada minuto via SQL:
// SELECT cron.schedule('push-cron','* * * * *','SELECT net.http_post(...)');
// Deploy: supabase functions deploy process-scheduled-push

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async () => {
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Busca notificações prontas para enviar (fire_at <= agora, não enviadas)
  const { data: due } = await sb
    .from('scheduled_notifications')
    .select('*')
    .lte('fire_at', new Date().toISOString())
    .eq('sent', false)
    .limit(50);

  if(!due?.length) return new Response('nothing due', { status:200 });

  const results = [];
  for(const n of due){
    // Chama a edge function send-push
    const res = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push`,
      {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          user_id: n.user_id,
          title: `⏰ ${n.task_name}`,
          body: n.task_body,
          tag: n.task_id,
        })
      }
    );

    // Marca como enviada
    await sb.from('scheduled_notifications')
      .update({ sent: true })
      .eq('id', n.id);

    results.push({ id: n.id, status: res.status });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers:{ 'Content-Type':'application/json' }
  });
});
