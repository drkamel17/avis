export const runtime = 'edge';

async function sendResendEmail(to, subject, type, nom, situation, lien1, lien2, lien3) {
  const apiKey = process.env.RESEND_API_KEY;
  
  console.log('[DEBUG] sendResendEmail - API key presente:', !!apiKey);
  console.log('[DEBUG] sendResendEmail - Destinataire:', to);
  console.log('[DEBUG] sendResendEmail - Sujet:', subject);
  
  if (!apiKey) {
    console.log('[DEBUG] ERREUR: RESEND_API_KEY non configuree dans Vercel');
    return { success: false, message: 'RESEND_API_KEY non configuree' };
  }
  
  const bgColor = type === 'Ordonnance' ? '#ff9800' : '#9C27B0';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${bgColor}; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
        <h2 style="margin: 0;">📩 Nouveau message en attente</h2>
      </div>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;"><strong>Type:</strong> ${type}</p>
        <p style="font-size: 16px;"><strong>Nom:</strong> ${nom}</p>
        ${situation ? `<p style="font-size: 16px;"><strong>Situation:</strong> ${situation}</p>` : ''}
        <p style="margin-top: 20px;">Cliquez sur un des liens ci-dessous pour gerer ce message:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${lien1}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 5px;">🔧 Ordonnances Sur Web</a>
          <br>
          <a href="${lien2}" style="display: inline-block; background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 5px;">🔧 Certificats Medicaux</a>
          ${lien3 ? `<br><a href="${lien3}" style="display: inline-block; background: #00bcd4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 5px;">🔧 Avis Extension</a>` : ''}
        </div>
      </div>
    </div>
  `;
  
  console.log('[DEBUG] Envoi requete vers Resend API...');
  
  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Dr Daoudi Notifications <onboarding@resend.dev>',
        to: to,
        subject: subject,
        html: htmlContent
      })
    });
    
    console.log('[DEBUG] Resend response status:', resendResponse.status);
    
    if (resendResponse.ok) {
      console.log('[DEBUG] Email envoye avec succes!');
      return { success: true };
    } else {
      const errorText = await resendResponse.text();
      console.log('[DEBUG] ERREUR Resend:', errorText);
      return { success: false, message: errorText };
    }
  } catch (error) {
    console.log('[DEBUG] ERREUR exception:', error.message);
    return { success: false, message: error.message };
  }
}

export async function POST(request) {
  console.log('=== COMMENTAIRES POST: Debut ===');
  
  try {
    const body = await request.json();
    const { nom, situation, message, action, password, commentId, nouveauMessage, reponse } = body;
    
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
    const writePassword = process.env.WRITE_PASSWORD;
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ success: false, message: 'Supabase config not set' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    // Ajouter un nouveau commentaire (sans mot de passe = pending)
    if (action === 'add' && nom && message) {
      const commentId = `commentaire_${nom.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
      
      const response = await fetch(`${supabaseUrl}/rest/v1/commentaires`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          id: commentId,
          nom: nom,
          situation: situation || 'Autre',
          message: message,
          status: 'pending',
          created_at: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        const adminEmail = process.env.ADMIN_EMAIL || 'drkamel17@gmail.com';
        console.log('[DEBUG] Envoi email notification a:', adminEmail);
        
        sendResendEmail(
          adminEmail,
          `Nouveau commentaire en attente - ${nom}`,
          'Commentaire',
          nom,
          situation || 'Autre',
          'https://ordonnances-sur-web.vercel.app/admin.html',
          'https://certificats-medicaux.vercel.app/admin.html',
          'https://avis-extension-ord.vercel.app/admin.html'
        ).then(emailResult => {
          console.log('[DEBUG] Resultat email:', emailResult);
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'pending',
          info: 'Votre proposition sera examinée par l\'admin'
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      
      const error = await response.text();
      return new Response(JSON.stringify({ success: false, message: error }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    
    // Confirmer un commentaire (admin)
    if (action === 'confirm' && commentId) {
      if (!password || password !== writePassword) {
        return new Response(JSON.stringify({ success: false, message: 'Mot de passe admin requis' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      
      const response = await fetch(`${supabaseUrl}/rest/v1/commentaires?id=eq.${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ status: 'confirmed' })
      });
      
      return new Response(JSON.stringify({ success: response.ok, message: response.ok ? 'Confirme' : 'Erreur' }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    // Rejeter un commentaire (admin)
    if (action === 'reject' && commentId) {
      if (!password || password !== writePassword) {
        return new Response(JSON.stringify({ success: false, message: 'Mot de passe admin requis' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      
      const response = await fetch(`${supabaseUrl}/rest/v1/commentaires?id=eq.${commentId}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      
      return new Response(JSON.stringify({ success: response.ok, message: response.ok ? 'Rejete' : 'Erreur' }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    // Modifier un commentaire (admin)
    if (action === 'modify' && commentId && nouveauMessage) {
      if (!password || password !== writePassword) {
        return new Response(JSON.stringify({ success: false, message: 'Mot de passe admin requis' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      
      const response = await fetch(`${supabaseUrl}/rest/v1/commentaires?id=eq.${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ message: nouveauMessage })
      });
      
      return new Response(JSON.stringify({ success: response.ok, message: response.ok ? 'Modifie' : 'Erreur' }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    // Répondre à un commentaire (admin)
    if (action === 'reply' && commentId && reponse) {
      if (!password || password !== writePassword) {
        return new Response(JSON.stringify({ success: false, message: 'Mot de passe admin requis' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      
      const response = await fetch(`${supabaseUrl}/rest/v1/commentaires?id=eq.${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ reponse_admin: reponse })
      });
      
      return new Response(JSON.stringify({ success: response.ok, message: response.ok ? 'Reponse ajoutee' : 'Erreur' }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    // Supprimer définitivement un commentaire (admin)
    if (action === 'delete' && commentId) {
      if (!password || password !== writePassword) {
        return new Response(JSON.stringify({ success: false, message: 'Mot de passe admin requis' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      
      const response = await fetch(`${supabaseUrl}/rest/v1/commentaires?id=eq.${commentId}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      
      return new Response(JSON.stringify({ success: response.ok, message: response.ok ? 'Supprime' : 'Erreur' }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    return new Response(JSON.stringify({ success: false, message: 'Action non reconnue' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    
  } catch (error) {
    console.log('=== COMMENTAIRES POST: Erreur ===', error.message);
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function GET(request) {
  console.log('=== COMMENTAIRES GET: Debut ===');
  
  try {
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
    const writePassword = process.env.WRITE_PASSWORD;
    const urlParams = new URL(request.url).searchParams;
    const pending = urlParams.get('pending');
    const verify = urlParams.get('verify');
    const pass = urlParams.get('pass');
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ success: false, message: 'Supabase config not set' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    // API de vérification du mot de passe admin
    if (verify === 'true' && pass) {
      const isValid = (pass === writePassword);
      return new Response(JSON.stringify({ valid: isValid }), { 
        status: isValid ? 200 : 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    // Demander pending (pour admin)
    if (pending === 'true') {
      const response = await fetch(`${supabaseUrl}/rest/v1/commentaires?status=eq.pending&order=created_at.desc`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        return new Response(JSON.stringify({ success: true, pending: result }), { headers: { 'Content-Type': 'application/json' } });
      }
      
      return new Response(JSON.stringify({ success: false, message: 'Erreur' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    
    // Chargement normal (confirmed seulement)
    const response = await fetch(`${supabaseUrl}/rest/v1/commentaires?status=eq.confirmed&order=created_at.desc`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('=== COMMENTAIRES GET: Succes ===', result.length, 'commentaires');
      return new Response(JSON.stringify({ success: true, commentaires: result }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    const error = await response.text();
    return new Response(JSON.stringify({ success: false, message: error }), { status: response.status, headers: { 'Content-Type': 'application/json' } });
    
  } catch (error) {
    console.log('=== COMMENTAIRES GET: Erreur ===', error.message);
    return new Response(JSON.stringify({ success: false, message: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}