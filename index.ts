// supabase/functions/send-push/index.ts
// Envia Web Push via biblioteca webpush do npm (mais simples e confiável)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, title, body, tag } = await req.json()
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'missing params' }), { status: 400, headers: corsHeaders })
    }

    const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:thiagosdemello@gmail.com'

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: subs, error } = await sb
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id)

    if (error) throw error
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'no subscriptions' }), { headers: corsHeaders })
    }

    const payload = JSON.stringify({
      title,
      body:  body || '',
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      tag:   tag || 'dayflow',
      data:  { url: '/' }
    })

    const results = []
    for (const sub of subs) {
      try {
        const subscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }
        await webpush.sendNotification(subscription, payload)
        results.push({ ok: true, endpoint: sub.endpoint.slice(-20) })
      } catch (e: any) {
        // Remove subscription expirada
        if (e.statusCode === 410 || e.statusCode === 404) {
          await sb.from('push_subscriptions').delete().eq('id', sub.id)
        }
        results.push({ ok: false, error: e.message, endpoint: sub.endpoint.slice(-20) })
      }
    }

    return new Response(
      JSON.stringify({ sent: results.filter(r => r.ok).length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
