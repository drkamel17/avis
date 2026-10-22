-- Policies RLS - cle anon (role: anon) utilisee par les fonctions Vercel (api/avis.js, api/commentaires.js)
-- A executer dans : Supabase Dashboard > SQL Editor > New query > Run
-- Idempotent : peut etre rejoue sans erreur.

-- ---------------------------------------------------------------------------
-- Table avis
-- ---------------------------------------------------------------------------

-- Lecture : necessaire pour la liste publique (status = confirmed) ET pour la
-- liste "pending" de l'admin (GET /api/avis?pending=true).
drop policy if exists "avis_select_anon" on public.avis;
create policy "avis_select_anon" on public.avis
  for select to anon, authenticated
  using (true);

-- Insertion : reservee aux avis en attente (le code envoie toujours status = 'pending').
drop policy if exists "avis_insert_anon" on public.avis;
create policy "avis_insert_anon" on public.avis
  for insert to anon, authenticated
  with check (status = 'pending');

-- Mise a jour : confirm / reject / modification du message / reponse admin.
drop policy if exists "avis_update_anon" on public.avis;
create policy "avis_update_anon" on public.avis
  for update to anon, authenticated
  using (status in ('pending', 'confirmed', 'rejected'))
  with check (status in ('pending', 'confirmed', 'rejected'));

-- Suppression : action admin "delete".
drop policy if exists "avis_delete_anon" on public.avis;
create policy "avis_delete_anon" on public.avis
  for delete to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Table commentaires
-- ---------------------------------------------------------------------------

drop policy if exists "commentaires_select_anon" on public.commentaires;
create policy "commentaires_select_anon" on public.commentaires
  for select to anon, authenticated
  using (true);

drop policy if exists "commentaires_insert_anon" on public.commentaires;
create policy "commentaires_insert_anon" on public.commentaires
  for insert to anon, authenticated
  with check (status = 'pending');

drop policy if exists "commentaires_update_anon" on public.commentaires;
create policy "commentaires_update_anon" on public.commentaires
  for update to anon, authenticated
  using (status in ('pending', 'confirmed', 'rejected'))
  with check (status in ('pending', 'confirmed', 'rejected'));

drop policy if exists "commentaires_delete_anon" on public.commentaires;
create policy "commentaires_delete_anon" on public.commentaires
  for delete to anon, authenticated
  using (true);
