(() => {
  const today = () => { const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
  const dateObj = s => new Date(`${s}T12:00:00`);
  const fmt = (s, opts = {day:'numeric', month:'long', year:'numeric'}) => s ? new Intl.DateTimeFormat('pt-BR', opts).format(dateObj(s)) : '';
  const defaults = {people:['Atendente 1','Atendente 2'],absenceStart:'',entries:[],notes:[],links:[],reminders:[]};
  let data = {...defaults};
  let supabase, currentUser, currentProfile, channel;
  let selected = today(), filter = 'todos', toastTimer;
  const $ = id => document.getElementById(id);
  const THEME_KEY = 'felini-organiza-theme';
  const updateThemeButtons = () => {
    const dark=document.documentElement.dataset.theme==='dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(button=>{button.textContent=dark?'☀':'☾';button.setAttribute('aria-label',dark?'Ativar tema claro':'Ativar tema escuro');button.title=dark?'Ativar tema claro':'Ativar tema escuro';});
    const themeMeta=document.querySelector('meta[name="theme-color"]');if(themeMeta)themeMeta.content=dark?'#0b1220':'#f5f7f4';
  };
  document.querySelectorAll('[data-theme-toggle]').forEach(button=>button.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem(THEME_KEY,next);}catch{}updateThemeButtons();}));
  updateThemeButtons();
  const saveEntry = async item => { const {error}=await supabase.from('entries').upsert({id:item.id,description:item.description,client:item.client||'',service_date:item.date,owner_name:item.owner,priority:item.priority,status:item.status,note:item.note||'',created_by:currentUser.id,updated_at:item.updated||new Date().toISOString()}); if(error)throw error; };
  const loadData = async () => {
    const [profile, entries, notes, settings, links, reminders] = await Promise.all([
      supabase.from('team_members').select('display_name').eq('user_id',currentUser.id).maybeSingle(),
      supabase.from('entries').select('*').order('updated_at',{ascending:false}),
      supabase.from('handoff_notes').select('*').order('created_at',{ascending:false}),
      supabase.from('app_settings').select('*').eq('id',1).maybeSingle(),
      supabase.from('useful_links').select('*').order('title'),
      supabase.from('reminders').select('*').order('title')
    ]);
    if(profile.error||entries.error||notes.error||settings.error||links.error||reminders.error) throw profile.error||entries.error||notes.error||settings.error||links.error||reminders.error;
    if(!profile.data) throw new Error('Esta conta ainda não foi liberada para a equipe. Peça ao administrador para cadastrá-la.');
    currentProfile=profile.data; data.people=[settings.data?.morning_attendant||'Atendente 1',settings.data?.full_day_attendant||'Atendente 2']; data.absenceStart=settings.data?.absence_start||'';
    data.entries=(entries.data||[]).map(x=>({id:x.id,description:x.description,client:x.client,date:x.service_date,owner:x.owner_name,priority:x.priority,status:x.status,note:x.note,created:x.created_at,updated:x.updated_at}));
    data.notes=(notes.data||[]).map(x=>({id:x.id,date:x.service_date,text:x.message,owner:x.owner_name,created:x.created_at}));
    data.links=(links.data||[]).map(x=>({id:x.id,title:x.title,url:x.url,note:x.note,created:x.created_at}));
    data.reminders=(reminders.data||[]).map(x=>({id:x.id,title:x.title,frequency:x.frequency,day:x.day_of_month,completed:x.last_completed_on,active:x.active}));
    $('auth-screen').hidden=true; document.querySelector('.app-shell').hidden=false; render();
  };
  const connect = async () => {
    const cfg=window.APP_CONFIG||{};
    if(!cfg.supabaseUrl||cfg.supabaseUrl.includes('COLE_')||!cfg.supabaseKey||cfg.supabaseKey.includes('COLE_')) { $('auth-screen').hidden=false; $('auth-title').textContent='Conecte o banco de dados'; $('auth-copy').textContent='Configure a URL e a chave pública do projeto para ativar o acesso compartilhado.'; $('login-form').hidden=true; return; }
    if(!window.supabase){$('auth-screen').hidden=false;$('auth-error').textContent='Não foi possível carregar o serviço de banco. Verifique a conexão com a internet.';return;}
    supabase=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey);
    const {data:{session}}=await supabase.auth.getSession();
    if(session){currentUser=session.user;try{await loadData();subscribe();}catch(e){showAuthError(e.message);await supabase.auth.signOut();}return;}
    $('auth-screen').hidden=false; document.querySelector('.app-shell').hidden=true;
  };
  const showAuthError = msg => { $('auth-screen').hidden=false;document.querySelector('.app-shell').hidden=true;$('auth-error').textContent=msg; };
  const subscribe = () => {
    if(channel) supabase.removeChannel(channel);
    channel=supabase.channel('rotina-shared').on('postgres_changes',{event:'*',schema:'public',table:'entries'},()=>loadData().catch(e=>toast(e.message))).on('postgres_changes',{event:'*',schema:'public',table:'handoff_notes'},()=>loadData().catch(e=>toast(e.message))).on('postgres_changes',{event:'*',schema:'public',table:'app_settings'},()=>loadData().catch(e=>toast(e.message))).on('postgres_changes',{event:'*',schema:'public',table:'useful_links'},()=>loadData().catch(e=>toast(e.message))).on('postgres_changes',{event:'*',schema:'public',table:'reminders'},()=>loadData().catch(e=>toast(e.message))).subscribe();
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeHttpUrl = value => { try { const url=new URL(value); return ['http:','https:'].includes(url.protocol)?url.href:''; } catch { return ''; } };
  const toast = text => { const el=$('toast'); el.textContent=text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2400); };
  const personFor = s => {
    if (!data.absenceStart || !s) return {name:data.people[1], absent:false, first:false};
    const diff=Math.round((dateObj(s)-dateObj(data.absenceStart))/86400000);
    if (diff < 0) return {name:data.people[1],absent:false,first:false};
    const pos=((diff%15)+15)%15, absent=pos<3;
    return {name:absent?data.people[0]:data.people[1],absent,first:absent&&pos===0};
  };
  const personInitial = name => (name || '?').trim().charAt(0).toUpperCase();
  function render() {
    $('selected-date').value=selected;
    $('weekday').textContent=new Intl.DateTimeFormat('pt-BR',{weekday:'long'}).format(dateObj(selected)).toUpperCase();
    $('today-tag').hidden=selected!==today();
    $('handoff-date').textContent=fmt(selected,{weekday:'long',day:'numeric',month:'long'});
    $('person-one-name').textContent=data.people[0]; $('person-two-name').textContent=data.people[1];
    $('user-avatar').textContent=personInitial(currentProfile?.display_name||personFor(selected).name);
    const duty=personFor(selected);
    $('stat-lead').textContent=duty.name;
    $('stat-shift').textContent=duty.absent?'Cobertura da manhã · ausência programada':'Atendimento da manhã e da tarde';
    $('person-two-state').className=`person-state ${duty.absent?'off-duty':'on-duty'}`;
    $('person-two-state').textContent=duty.absent?'◌':'●';
    $('schedule-badge').textContent=duty.absent?'Cobertura de ausência':'Dia regular';
    $('schedule-footnote').textContent=duty.absent?`${data.people[0]} cobre o atendimento da manhã; ${data.people[1]} está ausente.`:'A escala é informativa e pode ser ajustada em Configurações.';
    const entries=data.entries.filter(x=>x.date===selected).sort((a,b)=>(a.status==='concluido')-(b.status==='concluido')||(a.priority==='alta'?-1:0));
    $('stat-total').textContent=entries.length; $('stat-open').textContent=entries.filter(x=>x.status!=='concluido').length; $('stat-done').textContent=entries.filter(x=>x.status==='concluido').length;
    $('stat-total-caption').textContent=entries.length===1?'1 registro neste dia':`${entries.length} registros neste dia`;
    $('side-open').textContent=data.entries.filter(x=>x.status!=='concluido').length;
    const shown=entries.filter(x=>filter==='todos'||(filter==='abertos'?x.status!=='concluido':x.status==='concluido'));
    $('filter-toggle').innerHTML=`${filter==='todos'?'Todos':filter==='abertos'?'Em andamento':'Concluídos'} <span>⌄</span>`;
    $('task-list').innerHTML=shown.map(x=>`<article class="task-row ${x.status==='concluido'?'is-done':''}"><input class="task-check" type="checkbox" aria-label="Marcar como concluído" data-toggle="${x.id}" ${x.status==='concluido'?'checked':''}><div><div class="task-description" data-edit="${x.id}">${esc(x.description)}</div><div class="task-meta">${x.client?`<span class="client-tag">${esc(x.client)}</span><span>·</span>`:''}<span>${esc(x.owner)}</span><span>·</span><span class="priority priority-${x.priority}">${x.priority==='alta'?'Alta':x.priority==='baixa'?'Baixa':'Normal'}</span>${x.note?`<span>·</span><span title="${esc(x.note)}">✎ Tem observação</span>`:''}</div></div><div><span class="status-pill ${x.status==='concluido'?'done':''}">${x.status==='concluido'?'Concluído':'Em andamento'}</span><div class="task-actions"><button class="small-icon-button" title="Editar" data-edit="${x.id}">✎</button><button class="small-icon-button" title="Excluir" data-delete="${x.id}">×</button></div></div></article>`).join('');
    $('empty-state').style.display=entries.length?'none':'block'; $('task-list').style.display=entries.length?'block':'none';
    const notes=data.notes.filter(x=>x.date===selected).sort((a,b)=>b.created.localeCompare(a.created));
    $('handoff-list').innerHTML=notes.length?notes.map(n=>`<article class="handoff-item"><p>${esc(n.text)}</p><small>${esc(n.owner)} · ${new Date(n.created).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></article>`).join(''):'<div class="handoff-empty">Nenhum recado para este dia.</div>';
    const activity=[...data.entries.map(x=>({kind:'entry',date:x.date,time:x.updated||x.created,text:x.description,owner:x.owner,status:x.status})),...data.notes.map(x=>({kind:'note',date:x.date,time:x.created,text:x.text,owner:x.owner,status:''}))].sort((a,b)=>b.time.localeCompare(a.time)).slice(0,5);
    $('recent-list').innerHTML=activity.length?activity.map(a=>`<div class="recent-row"><span class="recent-mark">${a.kind==='note'?'↗':'✓'}</span><div class="recent-copy"><strong>${a.kind==='note'?'Observação de turno':'Atendimento'}:</strong> ${esc(a.text)}<small>${fmt(a.date,{day:'numeric',month:'short'})} · ${esc(a.owner)} ${a.status==='concluido'?'· concluído':''}</small></div><span class="recent-time">${new Date(a.time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span></div>`).join(''):'<div class="recent-empty">Os registros mais recentes aparecerão aqui.</div>';
    renderFeatures();
  }
  const reminderDue = r => r.active && (r.frequency==='daily' || Number(r.day)===new Date().getDate());
  const reminderDone = r => r.completed===today();
  function renderFeatures(){
    if(!$('useful-links-list'))return;
    $('useful-links-list').innerHTML=data.links.map(x=>{const url=safeHttpUrl(x.url);return `<article class="useful-link-row"><span class="feature-icon">↗</span><div class="feature-copy">${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a>`:`<strong>${esc(x.title)}</strong>`}<small>${esc(x.note||x.url)}</small></div><div class="feature-actions"><button class="small-icon-button" data-link-edit="${x.id}" title="Editar">✎</button><button class="small-icon-button" data-link-delete="${x.id}" title="Excluir">×</button></div></article>`}).join('');
    $('links-empty').hidden=!!data.links.length;
    $('reminders-list').innerHTML=data.reminders.map(r=>{const due=reminderDue(r),done=reminderDone(r);return `<article class="reminder-row ${done?'is-done':''}"><input type="checkbox" aria-label="Marcar lembrete como feito hoje" data-reminder-check="${r.id}" ${done?'checked':''} ${!due?'disabled':''}><div class="feature-copy"><strong>${esc(r.title)}</strong><small>${r.frequency==='daily'?'Todos os dias':`Todo dia ${r.day} de cada mês`}</small></div><span class="reminder-badge ${!due?'upcoming':done?'complete':'due'}">${!due?'Próximo dia '+r.day:done?'Feito hoje':'Pendente hoje'}</span><div class="feature-actions"><button class="small-icon-button" data-reminder-edit="${r.id}" title="Editar">✎</button><button class="small-icon-button" data-reminder-delete="${r.id}" title="Excluir">×</button></div></article>`}).join('');
    $('reminders-empty').hidden=!!data.reminders.length;
    $('side-reminders').textContent=data.reminders.filter(r=>reminderDue(r)&&!reminderDone(r)).length;
  }
  function fillOwners() { ['entry-owner','note-owner'].forEach(id=>$(id).innerHTML=data.people.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')); }
  function openEntry(entry) {
    $('entry-form').reset(); $('entry-id').value=entry?.id||''; $('entry-date').value=entry?.date||selected;
    $('entry-title').textContent=entry?'Editar atendimento':'Adicionar atendimento'; fillOwners();
    if(entry){$('entry-description').value=entry.description;$('entry-client').value=entry.client||'';$('entry-owner').value=entry.owner;$('entry-priority').value=entry.priority;$('entry-status').value=entry.status;$('entry-note').value=entry.note||'';}
    $('entry-dialog').showModal(); $('entry-description').focus();
  }
  function closeDialogs() { document.querySelectorAll('dialog[open]').forEach(d=>d.close()); }
  $('new-entry').onclick=()=>openEntry(); $('empty-new').onclick=()=>openEntry();
  $('prev-day').onclick=()=>{selected=new Date(dateObj(selected).getTime()-86400000).toISOString().slice(0,10);render();};
  $('next-day').onclick=()=>{selected=new Date(dateObj(selected).getTime()+86400000).toISOString().slice(0,10);render();};
  $('go-today').onclick=()=>{selected=today();render();}; $('selected-date').onchange=e=>{selected=e.target.value||today();render();};
  $('filter-toggle').onclick=()=>{filter=filter==='todos'?'abertos':filter==='abertos'?'concluidos':'todos';render();};
  $('task-list').onclick=e=>{const edit=e.target.closest('[data-edit]'), del=e.target.closest('[data-delete]'); if(edit){const x=data.entries.find(i=>i.id===edit.dataset.edit);if(x)openEntry(x);} if(del){const id=del.dataset.delete;supabase.from('entries').delete().eq('id',id).then(({error})=>{if(error)return toast(error.message);data.entries=data.entries.filter(i=>i.id!==id);render();toast('Registro excluído.');});}};
  $('task-list').onchange=e=>{if(e.target.matches('[data-toggle]')){const x=data.entries.find(i=>i.id===e.target.dataset.toggle);if(x){const prior=x.status;x.status=e.target.checked?'concluido':'aberto';x.updated=new Date().toISOString();saveEntry(x).then(()=>{render();toast(x.status==='concluido'?'Atendimento concluído.':'Atendimento reaberto.');}).catch(err=>{x.status=prior;render();toast(err.message);});}}};
  $('entry-form').onsubmit=e=>{e.preventDefault();const id=$('entry-id').value, old=data.entries.find(x=>x.id===id); const item={id:id||crypto.randomUUID(),description:$('entry-description').value.trim(),client:$('entry-client').value.trim(),date:$('entry-date').value,owner:$('entry-owner').value,priority:$('entry-priority').value,status:$('entry-status').value,note:$('entry-note').value.trim(),created:old?.created||new Date().toISOString(),updated:new Date().toISOString()};saveEntry(item).then(()=>{if(old)Object.assign(old,item);else data.entries.unshift(item);selected=item.date;closeDialogs();render();toast(old?'Registro atualizado.':'Atendimento salvo.');}).catch(err=>toast(err.message));};
  $('add-note').onclick=()=>{ $('note-form').reset();fillOwners();$('note-dialog').showModal(); };
  $('note-form').onsubmit=e=>{e.preventDefault();const item={id:crypto.randomUUID(),date:selected,text:$('note-text').value.trim(),owner:$('note-owner').value,created:new Date().toISOString()};supabase.from('handoff_notes').insert({id:item.id,service_date:item.date,message:item.text,owner_name:item.owner,created_by:currentUser.id}).then(({error})=>{if(error)return toast(error.message);data.notes.unshift(item);closeDialogs();render();toast('Observação adicionada à passagem de turno.');});};
  $('open-settings').onclick=()=>{$('setting-one').value=data.people[0];$('setting-two').value=data.people[1];$('setting-absence').value=data.absenceStart;$('settings-dialog').showModal();};
  $('settings-form').onsubmit=e=>{e.preventDefault();const people=[$('setting-one').value.trim()||'Atendente 1',$('setting-two').value.trim()||'Atendente 2'],absence=$('setting-absence').value;supabase.from('app_settings').update({morning_attendant:people[0],full_day_attendant:people[1],absence_start:absence||null,updated_by:currentUser.id,updated_at:new Date().toISOString()}).eq('id',1).then(({error})=>{if(error)return toast(error.message);data.people=people;data.absenceStart=absence;closeDialogs();render();toast('Equipe e escala atualizadas.');});};
  $('data-info').onclick=()=>$('info-dialog').showModal();
  function switchView(id,hash){document.querySelectorAll('.app-view').forEach(v=>v.hidden=v.id!==id);document.querySelectorAll('[data-view-link]').forEach(a=>a.classList.toggle('active',a.dataset.viewLink===id&&(!hash||a.getAttribute('href')===hash)));if(hash==='#pendencias'||hash==='#historico')setTimeout(()=>$((hash==='#pendencias'?'pendencias':'historico')).scrollIntoView({behavior:'smooth'}),20);else window.scrollTo({top:0,behavior:'smooth'});}
  document.querySelectorAll('[data-view-link]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();switchView(a.dataset.viewLink,a.getAttribute('href'));}));
  function openLink(item){$('link-form').reset();$('link-id').value=item?.id||'';$('link-title').textContent=item?'Editar link útil':'Adicionar link útil';if(item){$('link-name').value=item.title;$('link-url').value=item.url;$('link-note').value=item.note||'';} $('link-dialog').showModal();$('link-name').focus();}
  $('new-link').onclick=()=>openLink();$('empty-new-link').onclick=()=>openLink();
  $('link-form').onsubmit=e=>{e.preventDefault();const id=$('link-id').value||crypto.randomUUID(),old=data.links.find(x=>x.id===id),item={id,title:$('link-name').value.trim(),url:$('link-url').value.trim(),note:$('link-note').value.trim()};if(!safeHttpUrl(item.url))return toast('Use um endereço de site começando com https:// ou http://.');supabase.from('useful_links').upsert({id,title:item.title,url:item.url,note:item.note,created_by:currentUser.id,updated_at:new Date().toISOString()}).then(({error})=>{if(error)return toast(error.message);if(old)Object.assign(old,item);else data.links.push(item);data.links.sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));closeDialogs();renderFeatures();toast(old?'Link atualizado.':'Link salvo para a equipe.');});};
  $('useful-links-list').onclick=e=>{const edit=e.target.closest('[data-link-edit]'),del=e.target.closest('[data-link-delete]');if(edit){const item=data.links.find(x=>x.id===edit.dataset.linkEdit);if(item)openLink(item);}if(del){const id=del.dataset.linkDelete;supabase.from('useful_links').delete().eq('id',id).then(({error})=>{if(error)return toast(error.message);data.links=data.links.filter(x=>x.id!==id);renderFeatures();toast('Link excluído.');});}};
  function openReminder(item){$('reminder-form').reset();$('reminder-id').value=item?.id||'';$('reminder-title').textContent=item?'Editar lembrete':'Novo lembrete';$('reminder-name').value=item?.title||'';$('reminder-frequency').value=item?.frequency||'daily';$('reminder-day').value=item?.day||25;$('reminder-day-wrap').hidden=$('reminder-frequency').value!=='monthly';$('reminder-dialog').showModal();$('reminder-name').focus();}
  $('new-reminder').onclick=()=>openReminder();$('empty-new-reminder').onclick=()=>openReminder();$('reminder-frequency').onchange=e=>{$('reminder-day-wrap').hidden=e.target.value!=='monthly';};
  $('reminder-form').onsubmit=e=>{e.preventDefault();const id=$('reminder-id').value||crypto.randomUUID(),old=data.reminders.find(x=>x.id===id),frequency=$('reminder-frequency').value,item={id,title:$('reminder-name').value.trim(),frequency,day:frequency==='monthly'?Number($('reminder-day').value):null,completed:old?.completed||null,active:true};supabase.from('reminders').upsert({id,title:item.title,frequency,day_of_month:item.day,last_completed_on:item.completed,active:true,created_by:currentUser.id,updated_at:new Date().toISOString()}).then(({error})=>{if(error)return toast(error.message);if(old)Object.assign(old,item);else data.reminders.push(item);data.reminders.sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));closeDialogs();renderFeatures();toast(old?'Lembrete atualizado.':'Lembrete salvo.');});};
  $('reminders-list').onclick=e=>{const edit=e.target.closest('[data-reminder-edit]'),del=e.target.closest('[data-reminder-delete]');if(edit){const item=data.reminders.find(x=>x.id===edit.dataset.reminderEdit);if(item)openReminder(item);}if(del){const id=del.dataset.reminderDelete;supabase.from('reminders').delete().eq('id',id).then(({error})=>{if(error)return toast(error.message);data.reminders=data.reminders.filter(x=>x.id!==id);renderFeatures();toast('Lembrete excluído.');});}};
  $('reminders-list').onchange=e=>{if(!e.target.matches('[data-reminder-check]'))return;const item=data.reminders.find(x=>x.id===e.target.dataset.reminderCheck);if(!item)return;const prior=item.completed;item.completed=e.target.checked?today():null;supabase.from('reminders').update({last_completed_on:item.completed,updated_at:new Date().toISOString()}).eq('id',item.id).then(({error})=>{if(error){item.completed=prior;toast(error.message);}else toast(item.completed?'Lembrete concluído por hoje.':'Lembrete reaberto.');renderFeatures();});};
  $('show-history').onclick=()=>{selected=today();filter='todos';render();$('historico').scrollIntoView({behavior:'smooth'});};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
  $('login-form').onsubmit=async e=>{e.preventDefault();$('auth-error').textContent='';$('login-button').disabled=true;const {error}=await supabase.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});$('login-button').disabled=false;if(error){$('auth-error').textContent='Não foi possível entrar. Confira seu e-mail e senha.';return;}const {data:{user}}=await supabase.auth.getUser();currentUser=user;try{await loadData();subscribe();}catch(err){showAuthError(err.message);await supabase.auth.signOut();}};
  $('user-avatar').onclick=async()=>{if(confirm('Deseja sair da sua conta?')){if(channel)await supabase.removeChannel(channel);await supabase.auth.signOut();currentUser=null;currentProfile=null;document.querySelector('.app-shell').hidden=true;$('login-form').reset();$('auth-error').textContent='';$('login-form').hidden=false;$('auth-title').textContent='Entre na sua conta';$('auth-copy').textContent='Use seu e-mail e senha para abrir o painel compartilhado.';$('auth-screen').hidden=false;}};
  connect();
})();
