export const runtime = 'edge';

const TABLE = 'ordonnances';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function restHeaders(key, preferMinimal = false) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`
  };
  if (preferMinimal) {
    headers['Prefer'] = 'return=minimal';
  }
  return headers;
}

export async function POST(request) {
  console.log('=== ORDONNANCES POST: Debut ===');

  try {
    const body = await request.json();
    const { action, password, pendingKey, pendingId, titre, nouveauxMedicaments } = body;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const writePassword = process.env.WRITE_PASSWORD;

    if (!supabaseUrl || !supabaseKey) {
      return json({ success: false, message: 'Supabase config not set' }, 400);
    }

    const id = pendingKey || pendingId;

    // Toutes les actions ci-dessous sont reservees a l'admin
    if (!password || password !== writePassword) {
      return json({ success: false, message: 'Mot de passe admin requis' }, 401);
    }

    // Confirmer une ordonnance en attente
    if (action === 'confirm' && id) {
      const response = await fetch(`${supabaseUrl}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: restHeaders(supabaseKey, true),
        body: JSON.stringify({ status: 'confirmed', updated_at: new Date().toISOString() })
      });

      return json({ success: response.ok, message: response.ok ? 'Confirme' : 'Erreur' });
    }

    // Rejeter une ordonnance en attente
    if (action === 'reject' && id) {
      const response = await fetch(`${supabaseUrl}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: restHeaders(supabaseKey)
      });

      return json({ success: response.ok, message: response.ok ? 'Rejete' : 'Erreur' });
    }

    // Modifier les medicaments d'un titre d'ordonnance
    if (action === 'modify' && id && titre && Array.isArray(nouveauxMedicaments)) {
      const current = await fetch(`${supabaseUrl}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&select=id,data`, {
        method: 'GET',
        headers: restHeaders(supabaseKey)
      });

      if (!current.ok) {
        return json({ success: false, message: 'Ordonnance introuvable' }, 404);
      }

      const rows = await current.json();
      if (!rows.length) {
        return json({ success: false, message: 'Ordonnance introuvable' }, 404);
      }

      const data = rows[0].data || {};
      data[titre] = nouveauxMedicaments;

      const response = await fetch(`${supabaseUrl}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: restHeaders(supabaseKey, true),
        body: JSON.stringify({ data, updated_at: new Date().toISOString() })
      });

      return json({ success: response.ok, message: response.ok ? 'Modifie' : 'Erreur' });
    }

    return json({ success: false, message: 'Action non reconnue' }, 400);

  } catch (error) {
    console.log('=== ORDONNANCES POST: Erreur ===', error.message);
    return json({ success: false, message: error.message }, 500);
  }
}

export async function GET(request) {
  console.log('=== ORDONNANCES GET: Debut ===');

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const writePassword = process.env.WRITE_PASSWORD;
    const urlParams = new URL(request.url).searchParams;
    const pending = urlParams.get('pending');
    const verify = urlParams.get('verify');
    const pass = urlParams.get('pass');

    if (!supabaseUrl || !supabaseKey) {
      return json({ success: false, message: 'Supabase config not set' }, 400);
    }

    // API de verification du mot de passe admin
    if (verify === 'true' && pass) {
      const isValid = (pass === writePassword);
      return json({ valid: isValid }, isValid ? 200 : 401);
    }

    // Ordonnances en attente (admin)
    if (pending === 'true') {
      const response = await fetch(`${supabaseUrl}/rest/v1/${TABLE}?status=eq.pending&order=updated_at.desc`, {
        method: 'GET',
        headers: restHeaders(supabaseKey)
      });

      if (response.ok) {
        const result = await response.json();
        return json({ success: true, users: result });
      }

      return json({ success: false, message: 'Erreur' }, 500);
    }

    return json({ success: false, message: 'Action non reconnue' }, 400);

  } catch (error) {
    console.log('=== ORDONNANCES GET: Erreur ===', error.message);
    return json({ success: false, message: error.message }, 500);
  }
}
