(()=>{'use strict';
const SUPABASE_URL='https://iaryuambbuwwzgkbaglv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_tJVks9fur-O2bbVRme9fMA_7pYfHmcV';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=s=>typeof window.toast==='function'?window.toast(s):alert(s);
let client=null, user=null, listings=[], adminListings=[], adminFilter='pending';
function section(){
 const main=$('main');
 if(!main||$('#s-account'))return;
 const s=document.createElement('section');s.className='screen';s.id='s-account';
 s.innerHTML='<button class="back" data-go="home">← Главная</button><div class="eyebrow">Облачный аккаунт</div><h1>Аккаунт</h1><p class="sub">Регистрация позволит сохранить профиль и показывать объявления мастеров в общем каталоге.</p><div class="card"><div id="sbState" class="notice">Подключаем защищённое соединение…</div><form id="sbAuthForm"><div class="field"><label>Имя</label><input name="display_name" maxlength="80" placeholder="Как к тебе обращаться"></div><div class="field"><label>Телефон</label><input name="phone" type="tel" placeholder="+7 7XX XXX XX XX"></div><div class="field"><label>Email</label><input name="email" type="text" inputmode="email" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" data-form-type="other" required placeholder="name@example.com"></div><div class="field"><label>Пароль</label><input name="password" type="password" autocomplete="current-password" minlength="6" required placeholder="Минимум 6 символов"></div><div class="actions"><button class="btn" type="submit" id="sbLogin">Войти</button><button class="btn secondary" type="button" id="sbRegister">Создать аккаунт</button></div></form><div id="sbPending" class="notice" style="display:none;margin-top:12px"><strong>Подтвердите электронную почту</strong><p id="sbPendingText" style="margin:8px 0">Мы отправили письмо со ссылкой для подтверждения. Откройте письмо и перейдите по ссылке, затем вернитесь в приложение и войдите.</p><button class="btn secondary small" type="button" id="sbResend">Отправить письмо повторно</button></div><div id="sbSigned" class="hidden"><p class="tiny" id="sbEmail"></p><button class="btn danger small" id="sbLogout">Выйти из аккаунта</button></div></div><p class="tiny">Не используй пароль от Kaspi или других важных сервисов. Если подтверждение email включено в Supabase, после регистрации проверь почту.</p>';
 main.append(s);
 const nav=$('.nav');const b=document.createElement('button');b.dataset.go='account';b.innerHTML='<span class="ico">☁</span>Аккаунт';nav.insertBefore(b,$('#navRole'));
 const admin=document.createElement('section');admin.className='screen';admin.id='s-cloud-admin';admin.innerHTML='<button class="back" data-go="home">← Главная</button><div class="eyebrow">Управление сервисом</div><h1>Админ-панель</h1><p class="sub">Проверка и публикация объявлений мастеров.</p><div class="statline"><div class="stat"><strong id="admPendingCount">—</strong><span>На проверке</span></div><div class="stat"><strong id="admActiveCount">—</strong><span>Опубликовано</span></div><div class="stat"><strong id="admBlockedCount">—</strong><span>Отклонено</span></div></div><div class="actions" style="margin:12px 0;flex-wrap:wrap"><button class="btn small" data-admin-filter="pending">На проверке</button><button class="btn secondary small" data-admin-filter="active">Опубликовано</button><button class="btn secondary small" data-admin-filter="blocked">Отклонено</button><button class="btn ghost small" id="admRefresh">Обновить</button></div><div id="admNotice" class="notice">Загружаем заявки…</div><div id="admRows" class="list"></div>';
 main.append(admin);
 const ab=document.createElement('button');ab.id='sbAdminNav';ab.dataset.go='cloud-admin';ab.innerHTML='<span class="ico">⚙</span>Админ';ab.style.display='none';nav.insertBefore(ab,$('#navRole'));
 document.head.insertAdjacentHTML('beforeend','<style>#fxAdminButton,#fxAdminNav{display:none!important}</style>');
}
function state(msg,ok=false){const el=$('#sbState');if(el){el.textContent=msg;el.className='notice'+(ok?' success':'')}}
function updateAdminAccess(){
 const yes=!!user&&user.app_metadata?.role==='admin';
 const b=$('#sbAdminNav');if(b)b.style.display=yes?'flex':'none';
 const current=$('#s-cloud-admin');if(!yes&&current?.classList.contains('active')&&window.go)window.go('home');
}
function adminNotice(msg,ok=false){const el=$('#admNotice');if(el){el.textContent=msg;el.className='notice'+(ok?' success':'')}}
function renderAdminRows(){
 const root=$('#admRows');if(!root)return;
 const rows=adminListings.filter(x=>x.status===adminFilter);
 root.innerHTML='';
 if(!rows.length){root.innerHTML='<div class="empty"><h3>Заявок нет</h3><p>В этой категории пока пусто.</p></div>';return}
 rows.forEach(m=>{
  const e=document.createElement('article');e.className='item';
  const services=Array.isArray(m.services)?m.services.join(', '):'';
  const brands=Array.isArray(m.car_brands)?m.car_brands.join(', '):'';
  const date=m.created_at?new Date(m.created_at).toLocaleString('ru-RU'):'';
  const status=m.status==='pending'?'На проверке':m.status==='active'?'Опубликовано':'Отклонено';
  e.innerHTML='<div class="item-top"><div class="avatar">🧰</div><div style="flex:1;min-width:0"><h3>'+esc(m.business_name)+'</h3><div class="tiny">Статус: '+status+' · '+esc(date)+'</div><p class="tiny">📍 '+esc(m.city)+' · '+esc(m.address)+'</p><p class="tiny">☎ '+esc(m.phone)+'</p><p style="font-size:13px;line-height:1.5">'+esc(services)+'</p><p class="tiny">Марки: '+esc(brands||'не указаны')+' · График: '+esc(m.working_hours||'не указан')+'</p><p class="tiny">'+esc(m.description||'')+'</p><p class="tiny">ID владельца: '+esc(m.user_id)+'</p><div class="actions" style="margin-top:12px">'+(m.status!=='active'?'<button class="btn small" data-admin-action="active" data-id="'+esc(m.id)+'">Одобрить и опубликовать</button>':'')+(m.status!=='blocked'?'<button class="btn danger small" data-admin-action="blocked" data-id="'+esc(m.id)+'">Отклонить</button>':'')+(m.status!=='pending'?'<button class="btn secondary small" data-admin-action="pending" data-id="'+esc(m.id)+'">Вернуть на проверку</button>':'')+'</div></div></div>';
  root.append(e);
 });
}
async function loadAdminListings(){
 if(!user||user.app_metadata?.role!=='admin'){adminNotice('Доступ запрещён. Нужна учётная запись администратора.');updateAdminAccess();return}
 adminNotice('Загружаем объявления из Supabase…');
 const {data,error}=await client.from('mechanic_listings').select('id,user_id,business_name,phone,city,address,services,car_brands,working_hours,description,status,created_at').order('created_at',{ascending:false}).limit(200);
 if(error){adminNotice('Не удалось загрузить заявки: '+error.message);return}
 adminListings=data||[];
 $('#admPendingCount').textContent=adminListings.filter(x=>x.status==='pending').length;
 $('#admActiveCount').textContent=adminListings.filter(x=>x.status==='active').length;
 $('#admBlockedCount').textContent=adminListings.filter(x=>x.status==='blocked').length;
 adminNotice('Загружено объявлений: '+adminListings.length,true);renderAdminRows();
}
async function setListingStatus(id,status){
 if(!user||user.app_metadata?.role!=='admin'){say('Недостаточно прав.');return}
 const {error}=await client.from('mechanic_listings').update({status}).eq('id',id);
 if(error){adminNotice('Не удалось изменить статус: '+error.message);return}
 adminNotice(status==='active'?'Объявление опубликовано.':status==='blocked'?'Объявление отклонено.':'Заявка возвращена на проверку.',true);
 await loadAdminListings();await syncListings();
}
function accountView(){
 const form=$('#sbAuthForm'),signed=$('#sbSigned'),pending=$('#sbPending');
 updateAdminAccess();
 if(user){form.classList.add('hidden');signed.classList.remove('hidden');pending.style.display='none';localStorage.removeItem('apkz_pending_email');$('#sbEmail').textContent='Вошёл: '+user.email;state('Аккаунт подключён. Данные синхронизируются с облаком.',true)}
 else{form.classList.remove('hidden');signed.classList.add('hidden');const email=localStorage.getItem('apkz_pending_email');pending.style.display=email?'block':'none';if(email)$('#sbPendingText').textContent='Письмо для '+email+' отправлено. Подтвердите адрес по ссылке из письма, затем вернитесь сюда и войдите. Это напоминание останется на экране, пока вы не войдёте.';state(email?'Ожидается подтверждение почты.':'Войди или создай аккаунт, чтобы включить облачные функции.')}
}
async function saveProfile(){
 if(!user)return;
 const meta=user.user_metadata||{};
 const {error}=await client.from('profiles').upsert({id:user.id,display_name:meta.display_name||'',phone:meta.phone||'',account_role:localStorage.getItem('apkz_role')==='mechanic'?'mechanic':'owner'},{onConflict:'id'});
 if(error)throw error;
}
async function auth(){
 if(!window.supabase?.createClient){state('Не удалось загрузить библиотеку Supabase. Проверь интернет-соединение и перезапусти приложение.');return}
 client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage:window.localStorage}});
 window.autoPomoshnikSupabase=client;
 const {data,error}=await client.auth.getSession();if(error)throw error;user=data.session?.user||null;
 client.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;accountView();updateAdminAccess();if(user){saveProfile().catch(e=>state('Ошибка профиля: '+e.message));syncListings()}});
 accountView();if(user){await saveProfile();await syncListings()}
}
async function register(){
 const f=$('#sbAuthForm'),d=Object.fromEntries(new FormData(f));
 const {data,error}=await client.auth.signUp({email:d.email,password:d.password,options:{data:{display_name:d.display_name||'',phone:d.phone||''}}});
 if(error)throw error;
 if(data.session){user=data.user;await saveProfile();accountView();say('Аккаунт создан. Ты вошёл.')}
 else{localStorage.setItem('apkz_pending_email',d.email);accountView();say('Аккаунт создан. Подтверди email по письму. Напоминание останется на экране.');}
}
async function resendConfirmation(){
 const email=localStorage.getItem('apkz_pending_email')||$('#sbAuthForm').elements.email.value.trim();
 if(!email){say('Сначала введи email.');return}
 const {error}=await client.auth.resend({type:'signup',email});
 if(error)throw error;
 say('Письмо отправлено повторно. Проверь входящие и папку «Спам».');
}
async function login(){
 const d=Object.fromEntries(new FormData($('#sbAuthForm')));
 const {data,error}=await client.auth.signInWithPassword({email:d.email,password:d.password});
 if(error)throw error;user=data.user;await saveProfile();accountView();await syncListings();say('Вход выполнен');
}
async function logout(){const {error}=await client.auth.signOut();if(error)throw error;user=null;accountView();say('Ты вышел из аккаунта')}
function listingCard(m){
 const e=document.createElement('article');e.className='item';
 const services=Array.isArray(m.services)?m.services.join(', '):String(m.services||'');
 e.innerHTML='<div class="item-top"><div class="avatar">🧰</div><div style="flex:1;min-width:0"><h3>'+esc(m.business_name)+'</h3><div class="tiny">📍 '+esc(m.city)+' · '+esc(m.working_hours||'График не указан')+'</div><p style="font-size:13px;line-height:1.5;margin:9px 0">'+esc(services)+'</p><div class="chips">'+(Array.isArray(m.car_brands)?m.car_brands:[]).map(x=>'<span class="chip">'+esc(x)+'</span>').join('')+'</div><div class="tiny">'+esc(m.address)+'</div><div class="actions" style="margin-top:12px"><a class="btn small" href="tel:'+esc(m.phone)+'">☎ Позвонить</a><a class="btn secondary small" href="https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent((m.address||'')+' '+(m.city||''))+'">⌖ Маршрут</a></div></div></div>';
 return e;
}
async function syncListings(){
 if(!client)return;
 const {data,error}=await client.from('mechanic_listings').select('id,business_name,phone,city,address,services,car_brands,working_hours,description').eq('status','active').order('created_at',{ascending:false}).limit(100);
 if(error){state('База пока не готова: '+error.message+' — проверь, выполнен ли schema.sql в Supabase.');return}
 listings=data||[];renderListings();
}
function renderListings(){
 const root=$('#mastersList');if(!root)return;
 root.querySelectorAll('[data-cloud-listing]').forEach(x=>x.remove());
 const q=($('#masterSearch')?.value||'').toLowerCase().trim(),city=$('#cityFilter')?.value||'',svc=$('#serviceFilter')?.value||'';
 const filtered=listings.filter(m=>(!city||m.city===city)&&(!svc||(m.services||[]).join(' ').toLowerCase().includes(svc.toLowerCase()))&&[m.business_name,m.city,m.address,(m.services||[]).join(' '),(m.car_brands||[]).join(' ')].join(' ').toLowerCase().includes(q));
 filtered.forEach(m=>{const card=listingCard(m);card.dataset.cloudListing=m.id;root.append(card)});
}
async function submitListing(e){
 if(e.target.id!=='profileForm')return;
 e.preventDefault();e.stopImmediatePropagation();
 if(!user){say('Сначала войди или создай аккаунт в разделе «Аккаунт».');if(window.go)window.go('account');return}
 const f=e.target,d=Object.fromEntries(new FormData(f));
 if(!f.elements.agree.checked){say('Подтверди согласие на публикацию контактов.');return}
 localStorage.setItem('apkz_profile',JSON.stringify({...d,agree:true,status:'На модерации',requestNote:'Заявка отправлена в облако и ожидает модерации.'}));
 const row={user_id:user.id,business_name:d.name.trim(),phone:d.phone.trim(),city:d.city.trim(),address:d.address.trim(),services:d.services.split(',').map(x=>x.trim()).filter(Boolean),car_brands:(d.brands||'').split(',').map(x=>x.trim()).filter(Boolean),working_hours:d.hours||'',description:d.about||'',status:'pending',is_featured:false};
 const {error}=await client.from('mechanic_listings').upsert(row,{onConflict:'user_id'});
 if(error){say('Не удалось отправить объявление: '+error.message);return}
 say('Заявка отправлена в облако и ожидает модерации.');
}
async function requestListing(e){
 if(e.target.id!=='requestListing')return;
 e.preventDefault();e.stopImmediatePropagation();
 if(!user){say('Для отправки заявки войди в аккаунт.');if(window.go)window.go('account');return}
 const {data,error}=await client.from('mechanic_listings').select('id,status').eq('user_id',user.id).maybeSingle();
 if(error){say('Ошибка базы: '+error.message);return}
 if(!data){say('Сначала заполни профиль мастера и нажми «Сохранить профиль».');return}
 $('#listingStatus').textContent=data.status==='active'?'Опубликовано':'На модерации';
 $('#requestNote').textContent='Заявка отправлена на сервер. Публикация произойдёт после проверки администратором. Оплата пока не подключена.';
 say('Заявка уже в системе. Ожидай модерацию.');
}
async function start(){
 section();
 $('#sbAuthForm').addEventListener('submit',e=>{e.preventDefault();login().catch(x=>say('Ошибка входа: '+x.message))});
 $('#sbRegister').onclick=()=>register().catch(x=>say('Ошибка регистрации: '+x.message));
 $('#sbLogout').onclick=()=>logout().catch(x=>say('Ошибка выхода: '+x.message));
 $('#sbResend').onclick=()=>resendConfirmation().catch(x=>say('Не удалось отправить письмо: '+x.message));
 $('#admRefresh').onclick=()=>loadAdminListings().catch(x=>adminNotice('Ошибка: '+x.message));
 document.addEventListener('click',e=>{
  const filter=e.target.closest('[data-admin-filter]');
  if(filter){adminFilter=filter.dataset.adminFilter;document.querySelectorAll('[data-admin-filter]').forEach(b=>{b.classList.toggle('secondary',b.dataset.adminFilter!==adminFilter)});renderAdminRows();return}
  const action=e.target.closest('[data-admin-action]');
  if(action){const id=action.dataset.id,status=action.dataset.adminAction;action.disabled=true;setListingStatus(id,status).catch(x=>adminNotice('Ошибка: '+x.message));}
  const go=e.target.closest('[data-go="cloud-admin"]');
  if(go){e.preventDefault();if(user?.app_metadata?.role!=='admin'){say('Эта панель доступна только администратору.');return}if(window.go)window.go('cloud-admin');loadAdminListings().catch(x=>adminNotice('Ошибка: '+x.message));}
 });

 document.addEventListener('submit',submitListing,true);
 document.addEventListener('click',requestListing,true);
 ['masterSearch','cityFilter','serviceFilter'].forEach(id=>$('#'+id)?.addEventListener('input',renderListings));
 document.addEventListener('click',e=>{const b=e.target.closest('[data-go="account"]');if(b){e.preventDefault();if(window.go)window.go('account')}});
 try{await auth()}catch(e){state('Ошибка подключения: '+e.message)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();