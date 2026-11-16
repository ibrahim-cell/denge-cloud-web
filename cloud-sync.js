/* Denge Cloud — dependency-free Supabase Auth + PostgREST client.
 * Local-first: app writes stay in localStorage; authenticated writes queue
 * and sync through an RLS-protected, revisioned RPC when online.
 */
(function () {
  'use strict';

  const cfg = window.DENGE_CLOUD_CONFIG || {};
  const URL = String(cfg.url || '').replace(/\/$/, '');
  const KEY = String(cfg.publishableKey || '');
  const AUTH_KEY = 'denge-cloud-session-v1';
  const ACTIVE_USER_KEY = 'denge-cloud-active-user-v1';
  const BASE_PREFIX = 'denge-cloud-base-v1:';
  const LOCAL_PREFIX = 'denge-cloud-local-v1:';
  const PENDING_PREFIX = 'denge-cloud-pending-v1:';
  const configured = /^https:\/\//i.test(URL) && KEY.length > 10;

  let session = readJson(AUTH_KEY, null);
  let baseSnapshot = null;
  let baseRevision = 0;
  let pushTimer = null;
  let pollTimer = null;
  let syncing = false;
  let initialized = false;
  let suppressLocal = false;
  let currentUserId = session && session.user ? session.user.id : null;

  const status = {
    configured,
    userEmail: session && session.user ? session.user.email || '' : '',
    userId: currentUserId,
    state: configured ? (navigator.onLine ? 'signedOut' : 'offline') : 'notConfigured',
    message: configured ? 'Bulut hesabına giriş yapılmadı.' : 'Supabase bağlantı ayarı bekleniyor.',
    lastSyncAt: '',
    pending: false,
    online: navigator.onLine
  };

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { setStatus('error', 'Cihaz depolama alanı dolu olabilir. Yedek alıp alan açın.'); return false; }
  }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function same(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; }
  }
  function setStatus(state, message) {
    status.state = state;
    status.message = message;
    status.online = navigator.onLine;
    status.userEmail = session && session.user ? session.user.email || '' : '';
    status.userId = session && session.user ? session.user.id : null;
    notify();
  }
  function notify() {
    try { if (typeof window.__dengeCloudStateChanged === 'function') window.__dengeCloudStateChanged(getStatus()); }
    catch (_) { /* UI notifications must never interrupt bookkeeping. */ }
  }
  function getStatus() {
    return Object.assign({}, status, {
      configured,
      online: navigator.onLine,
      userEmail: session && session.user ? session.user.email || '' : '',
      userId: session && session.user ? session.user.id : null
    });
  }
  function cleanPayload(source) {
    const out = clone(source || {});
    if (out.settings) {
      // Security PIN hashes and device photos remain local to each device.
      delete out.settings.pin;
      delete out.settings.security;
      delete out.settings.profilePhoto;
    }
    delete out.migration;
    return out;
  }
  function hasMeaningfulLocal(d) {
    if (!d) return false;
    if ((d.transactions || []).length || (d.debts || []).length || (d.goals || []).length || (d.recurring || []).length) return true;
    if (Object.keys(d.budgets || {}).length) return true;
    if ((d.accounts || []).some(a => !['Nakit', 'Banka', 'Kredi Kartı'].includes(a.name) || Number(a.openingBalance || 0) !== 0)) return true;
    const defaults = ['Maaş|Ek Gelir|Yatırım|Freelance|Diğer', 'Market|Fatura|Ulaşım|Yemek|Alışveriş|Eğlence|Sağlık|Diğer'];
    const cats = d.categories || {};
    return (cats.income || []).join('|') !== defaults[0] || (cats.expense || []).join('|') !== defaults[1] || !!(d.settings && d.settings.profileName);
  }
  function getBridge() { return window.__dengeCloudBridge || null; }
  function currentLocal() {
    const b = getBridge();
    return cleanPayload(b && typeof b.getData === 'function' ? b.getData() : {});
  }
  function applyLocal(payload, preserveDeviceSettings, deviceSettings) {
    const b = getBridge();
    if (!b || typeof b.setData !== 'function') throw new Error('Denge veri köprüsü henüz hazır değil.');
    suppressLocal = true;
    try { b.setData(clone(payload), { preserveDeviceSettings: preserveDeviceSettings !== false, deviceSettings: deviceSettings || null }); }
    finally { suppressLocal = false; }
  }
  function baseKey(uid) { return BASE_PREFIX + uid; }
  function localKey(uid) { return LOCAL_PREFIX + uid; }
  function pendingKey(uid) { return PENDING_PREFIX + uid; }
  function loadBase(uid) {
    const saved = readJson(baseKey(uid), null);
    if (saved && Number.isFinite(Number(saved.revision)) && saved.payload) {
      baseRevision = Number(saved.revision);
      baseSnapshot = clone(saved.payload);
      return true;
    }
    baseRevision = 0;
    baseSnapshot = null;
    return false;
  }
  function saveBase(uid, revision, payload) {
    baseRevision = Number(revision || 0);
    baseSnapshot = clone(payload || {});
    writeJson(baseKey(uid), { revision: baseRevision, payload: baseSnapshot });
  }
  function authHeaders(extra) {
    const headers = Object.assign({ apikey: KEY, 'Content-Type': 'application/json' }, extra || {});
    if (session && session.access_token) headers.Authorization = 'Bearer ' + session.access_token;
    return headers;
  }
  async function parseResponse(response) {
    const bodyText = await response.text();
    let body = null;
    if (bodyText) { try { body = JSON.parse(bodyText); } catch (_) { body = { message: bodyText }; } }
    if (!response.ok) {
      const message = body && (body.msg || body.message || body.error_description || body.error) || ('İstek başarısız (' + response.status + ').');
      const err = new Error(String(message));
      err.status = response.status;
      err.body = body;
      throw err;
    }
    return body;
  }
  async function authRequest(path, body, bearer) {
    const headers = { apikey: KEY, 'Content-Type': 'application/json' };
    if (bearer) headers.Authorization = 'Bearer ' + bearer;
    const res = await fetch(URL + '/auth/v1/' + path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
    return parseResponse(res);
  }
  function persistSession(next) {
    session = next || null;
    if (session) writeJson(AUTH_KEY, session);
    else { try { localStorage.removeItem(AUTH_KEY); } catch (_) {} }
    currentUserId = session && session.user ? session.user.id : null;
    status.userId = currentUserId;
    status.userEmail = session && session.user ? session.user.email || '' : '';
  }
  async function refreshSession() {
    if (!session || !session.refresh_token) return null;
    const expiry = Number(session.expires_at || 0) * 1000;
    if (expiry && expiry - Date.now() > 90000) return session;
    const result = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
    const next = Object.assign({}, result, { user: result.user || session.user });
    if (!next.expires_at && next.expires_in) next.expires_at = Math.floor(Date.now() / 1000) + Number(next.expires_in);
    persistSession(next);
    return session;
  }
  async function apiFetch(path, options, retry) {
    if (!configured) throw new Error('Önce cloud-config.js dosyasına Supabase ayarları girilmeli.');
    await refreshSession();
    const opts = Object.assign({ method: 'GET' }, options || {});
    opts.headers = authHeaders(opts.headers || {});
    const response = await fetch(URL + path, opts);
    if (response.status === 401 && !retry && session && session.refresh_token) {
      const result = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
      const next = Object.assign({}, result, { user: result.user || session.user });
      if (!next.expires_at && next.expires_in) next.expires_at = Math.floor(Date.now() / 1000) + Number(next.expires_in);
      persistSession(next);
      return apiFetch(path, options, true);
    }
    return parseResponse(response);
  }

  // Three-way merge: preserve changes made on either device; deletions are
  // respected when the other device has not edited the same record.
  function mergeValue(base, local, remote) {
    if (same(local, base)) return clone(remote);
    if (same(remote, base)) return clone(local);
    if (same(local, remote)) return clone(local);

    if (Array.isArray(local) && Array.isArray(remote)) {
      if (local.every(v => v == null || typeof v !== 'object') && remote.every(v => v == null || typeof v !== 'object')) {
        const b = Array.isArray(base) ? base : [];
        const bs = new Set(b.map(String));
        const ls = new Set(local.map(String));
        const rs = new Set(remote.map(String));
        const removed = new Set([...bs].filter(v => !ls.has(v) || !rs.has(v)));
        const added = [...remote, ...local].filter(v => !bs.has(String(v)) && !removed.has(String(v)));
        const kept = [...remote, ...local, ...b].filter(v => bs.has(String(v)) && !removed.has(String(v)));
        const all = [...kept, ...added];
        return all.filter((v, i) => all.findIndex(x => String(x) === String(v)) === i);
      }
      const idArray = arr => arr.every(v => v && typeof v === 'object' && v.id !== undefined);
      if (idArray(local) && idArray(remote) && (!base || Array.isArray(base))) {
        const bArr = Array.isArray(base) ? base : [];
        const bm = new Map(bArr.map(v => [String(v.id), v]));
        const lm = new Map(local.map(v => [String(v.id), v]));
        const rm = new Map(remote.map(v => [String(v.id), v]));
        const ids = [...new Set([...remote.map(v => String(v.id)), ...local.map(v => String(v.id)), ...bArr.map(v => String(v.id))])];
        const merged = [];
        for (const id of ids) {
          const b = bm.get(id), l = lm.get(id), r = rm.get(id);
          if (b) {
            if (!l && !r) continue;
            if (!l) { if (!same(r, b)) merged.push(clone(r)); continue; }
            if (!r) { if (!same(l, b)) merged.push(clone(l)); continue; }
            merged.push(mergeValue(b, l, r));
          } else if (l && r) merged.push(mergeValue({}, l, r));
          else merged.push(clone(l || r));
        }
        return merged;
      }
      // Unknown array shape: retain both distinct entries without duplication.
      return [...clone(remote), ...clone(local).filter(v => !remote.some(r => same(r, v)))];
    }
    if (local && remote && typeof local === 'object' && typeof remote === 'object' && !Array.isArray(local) && !Array.isArray(remote)) {
      const bObj = base && typeof base === 'object' && !Array.isArray(base) ? base : {};
      const out = {};
      const keys = new Set([...Object.keys(bObj), ...Object.keys(local), ...Object.keys(remote)]);
      for (const key of keys) {
        const hasL = Object.prototype.hasOwnProperty.call(local, key);
        const hasR = Object.prototype.hasOwnProperty.call(remote, key);
        const hasB = Object.prototype.hasOwnProperty.call(bObj, key);
        if (!hasL && !hasR) continue;
        if (!hasL) {
          if (hasB && same(remote[key], bObj[key])) continue;
          out[key] = clone(remote[key]);
          continue;
        }
        if (!hasR) {
          if (hasB && same(local[key], bObj[key])) continue;
          out[key] = clone(local[key]);
          continue;
        }
        out[key] = mergeValue(hasB ? bObj[key] : undefined, local[key], remote[key]);
      }
      return out;
    }
    // Simultaneous edits to the exact same scalar field: local value wins.
    return clone(local);
  }

  async function fetchRemoteRow() {
    const uid = session && session.user && session.user.id;
    if (!uid) throw new Error('Oturum bulunamadı.');
    const q = '/rest/v1/denge_cloud_state?select=revision,payload,updated_at&user_id=eq.' + encodeURIComponent(uid) + '&limit=1';
    const rows = await apiFetch(q, { method: 'GET', headers: { Accept: 'application/json' } });
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }
  async function rpcSave(payload) {
    return apiFetch('/rest/v1/rpc/denge_sync_state', {
      method: 'POST', body: JSON.stringify({ p_base_revision: baseRevision, p_payload: payload })
    });
  }
  function deviceOnlySettings() {
    const b = getBridge();
    const full = b && typeof b.getData === 'function' ? b.getData() : {};
    const settings = full && full.settings ? full.settings : {};
    return {
      security: !!settings.security,
      pin: settings.pin || '',
      profilePhoto: settings.profilePhoto || ''
    };
  }
  function readUserLocal(uid) {
    const saved = readJson(localKey(uid), null);
    if (!saved) return null;
    // Support caches written by the earlier 1.1.0 preview as plain payloads.
    if (saved.payload && typeof saved.payload === 'object') {
      return { payload: saved.payload, deviceSettings: saved.deviceSettings || null };
    }
    return { payload: saved, deviceSettings: null };
  }
  function saveUserLocal(uid) {
    if (!uid) return;
    writeJson(localKey(uid), {
      payload: currentLocal(),
      deviceSettings: deviceOnlySettings(),
      savedAt: new Date().toISOString()
    });
  }
  function switchLocalUser(nextUid) {
    const previousUid = localStorage.getItem(ACTIVE_USER_KEY);
    if (previousUid !== nextUid) {
      if (previousUid) saveUserLocal(previousUid);
      const target = readUserLocal(nextUid);
      const b = getBridge();
      const fallback = b && typeof b.defaultData === 'function' ? b.defaultData() : {};
      // On the first account login, preserve the user's pre-login local data
      // when no per-user cache exists. After a sign-out, restore that user's
      // device cache rather than leaking the previous account's records.
      if (target) applyLocal(target.payload, false, target.deviceSettings);
      else if (previousUid) applyLocal(fallback, false);
    }
    localStorage.setItem(ACTIVE_USER_KEY, nextUid);
  }
  function storePending(uid, payload) {
    writeJson(pendingKey(uid), { payload: clone(payload), savedAt: new Date().toISOString() });
    status.pending = true;
  }
  function clearPending(uid) {
    try { localStorage.removeItem(pendingKey(uid)); } catch (_) {}
    status.pending = false;
  }
  function schedulePush() {
    if (!session || !session.user || !navigator.onLine || !configured || suppressLocal) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushLatest().catch(handleSyncError), 850);
  }
  async function pushLatest() {
    if (syncing || !session || !session.user || !navigator.onLine || !configured) return;
    syncing = true;
    const uid = session.user.id;
    try {
      setStatus('syncing', 'Değişiklikler buluta gönderiliyor…');
      let attempts = 0;
      while (attempts < 4) {
        attempts++;
        const local = currentLocal();
        const result = await rpcSave(local);
        if (result && (result.status === 'saved' || result.status === 'inserted')) {
          saveBase(uid, Number(result.revision || 0), result.payload || local);
          const newest = currentLocal();
          if (same(newest, local)) {
            clearPending(uid);
            status.lastSyncAt = new Date().toISOString();
            saveUserLocal(uid);
            setStatus('synced', 'Tüm veriler eşitlendi.');
            startPolling();
            return;
          }
          storePending(uid, newest);
          continue;
        }
        if (result && result.status === 'conflict') {
          const remote = result.payload || {};
          const merged = mergeValue(baseSnapshot || {}, local, remote);
          saveBase(uid, Number(result.revision || 0), remote);
          applyLocal(merged, true);
          storePending(uid, merged);
          continue;
        }
        throw new Error((result && result.message) || 'Bulut eşitlemesi tamamlanamadı.');
      }
      setStatus('queued', 'Değişiklikler sırada; eşitleme yeniden denenecek.');
      setTimeout(() => schedulePush(), 2500);
    } finally {
      syncing = false;
    }
  }
  function handleSyncError(error) {
    status.pending = !!(session && session.user);
    setStatus(navigator.onLine ? 'queued' : 'offline', navigator.onLine
      ? ('Eşitleme beklemede: ' + (error && error.message ? error.message : 'Bağlantı hatası'))
      : 'Çevrimdışısın. Kayıtlar cihazda saklandı; bağlantı gelince eşitlenecek.');
  }
  async function bootstrapAccount() {
    if (!session || !session.user || !navigator.onLine) {
      setStatus('offline', 'Çevrimdışısın. Kayıtlar cihazda saklanıyor.');
      return;
    }
    const uid = session.user.id;
    switchLocalUser(uid);
    loadBase(uid);
    setStatus('syncing', 'Bulut hesabındaki veriler kontrol ediliyor…');
    try {
      const row = await fetchRemoteRow();
      const local = currentLocal();
      if (!row) {
        baseRevision = 0;
        baseSnapshot = {};
        storePending(uid, local);
        await pushLatest();
        return;
      }
      const remote = cleanPayload(row.payload || {});
      const hasBase = baseSnapshot && baseRevision > 0;
      let merged;
      if (hasBase) merged = mergeValue(baseSnapshot, local, remote);
      else if (hasMeaningfulLocal(local)) merged = mergeValue({}, local, remote);
      else merged = clone(remote);
      saveBase(uid, Number(row.revision || 0), remote);
      applyLocal(merged, true);
      saveUserLocal(uid);
      if (!same(merged, remote)) {
        storePending(uid, merged);
        await pushLatest();
      } else {
        clearPending(uid);
        status.lastSyncAt = row.updated_at || new Date().toISOString();
        setStatus('synced', 'Bulut verileri yüklendi ve eşitlendi.');
        startPolling();
      }
    } catch (error) { handleSyncError(error); }
  }
  async function pollRemote() {
    if (syncing || !session || !session.user || !navigator.onLine || !configured) return;
    try {
      await refreshSession();
      const row = await fetchRemoteRow();
      if (!row || Number(row.revision || 0) <= baseRevision) return;
      const uid = session.user.id;
      const local = currentLocal();
      const remote = cleanPayload(row.payload || {});
      const merged = mergeValue(baseSnapshot || {}, local, remote);
      saveBase(uid, Number(row.revision || 0), remote);
      applyLocal(merged, true);
      saveUserLocal(uid);
      if (!same(merged, remote)) {
        storePending(uid, merged);
        schedulePush();
      } else {
        clearPending(uid);
        status.lastSyncAt = row.updated_at || new Date().toISOString();
        setStatus('synced', 'Diğer cihazdaki değişiklikler alındı.');
      }
    } catch (error) { handleSyncError(error); }
  }
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    if (session && session.user) pollTimer = setInterval(pollRemote, 12000);
  }
  async function activateSession(next) {
    if (!next || !next.access_token || !next.user || !next.user.id) throw new Error('Sunucudan geçerli oturum alınamadı.');
    if (!next.expires_at && next.expires_in) next.expires_at = Math.floor(Date.now() / 1000) + Number(next.expires_in);
    persistSession(next);
    await bootstrapAccount();
  }
  async function signIn(email, password) {
    if (!configured) throw new Error('Bulut bağlantısı henüz yapılandırılmadı.');
    if (!navigator.onLine) throw new Error('Giriş yapmak için internet bağlantısı gerekiyor.');
    const result = await authRequest('token?grant_type=password', { email: String(email).trim(), password: String(password) });
    await activateSession(result);
    return getStatus();
  }
  async function signUp(email, password) {
    if (!configured) throw new Error('Bulut bağlantısı henüz yapılandırılmadı.');
    if (!navigator.onLine) throw new Error('Hesap oluşturmak için internet bağlantısı gerekiyor.');
    if (String(password).length < 8) throw new Error('Şifre en az 8 karakter olmalı.');
    const result = await authRequest('signup', { email: String(email).trim(), password: String(password) });
    if (result && result.access_token && result.user) {
      await activateSession(result);
      return { confirmationRequired: false, status: getStatus() };
    }
    setStatus('confirmation', 'Doğrulama e-postası gönderildiyse önce e-postanı onayla, ardından giriş yap.');
    return { confirmationRequired: true, status: getStatus() };
  }
  async function signOut() {
    const uid = session && session.user ? session.user.id : null;
    if (uid) {
      saveUserLocal(uid);
      try {
        const b = getBridge();
        if (b && typeof b.defaultData === 'function') applyLocal(b.defaultData(), false);
      } catch (_) { /* Keep the current local view if reset is unavailable. */ }
    }
    try {
      if (session && session.access_token && configured && navigator.onLine) {
        await authRequest('logout', {}, session.access_token);
      }
    } catch (_) { /* Local sign-out must still work when the network is unavailable. */ }
    persistSession(null);
    try { localStorage.removeItem(ACTIVE_USER_KEY); } catch (_) {}
    if (pollTimer) clearInterval(pollTimer);
    if (pushTimer) clearTimeout(pushTimer);
    setStatus('signedOut', 'Oturum kapatıldı. Bu cihazdaki verilerin korundu.');
  }
  async function syncNow() {
    if (!session || !session.user) throw new Error('Önce Denge Cloud hesabına giriş yap.');
    if (!navigator.onLine) throw new Error('Şu anda çevrimdışısın. Bağlantı gelince otomatik eşitlenecek.');
    await pushLatest();
    await pollRemote();
    return getStatus();
  }
  function localSave(data) {
    if (suppressLocal || !session || !session.user) return;
    const uid = session.user.id;
    const payload = cleanPayload(data);
    storePending(uid, payload);
    setStatus(navigator.onLine ? 'queued' : 'offline', navigator.onLine
      ? 'Kaydedildi; buluta gönderilmek üzere sırada.'
      : 'Çevrimdışısın. Kayıt cihazda; bağlantı gelince eşitlenecek.');
    schedulePush();
  }
  async function init() {
    if (initialized) return;
    initialized = true;
    if (!configured) { setStatus('notConfigured', 'Supabase ayarları girildiğinde e-posta hesabı ve bulut eşitlemesi açılacak.'); return; }
    if (!session) { setStatus(navigator.onLine ? 'signedOut' : 'offline', 'E-posta ve şifre ile giriş yaparak cihazlarını eşitle.'); return; }
    try {
      await refreshSession();
      await bootstrapAccount();
      startPolling();
    } catch (error) {
      if (error && (error.status === 400 || error.status === 401)) {
        persistSession(null);
        setStatus('signedOut', 'Oturum süresi doldu. Tekrar giriş yap.');
      } else handleSyncError(error);
    }
  }

  window.addEventListener('online', function () {
    status.online = true;
    if (session && session.user) { setStatus('syncing', 'Bağlantı geri geldi; eşitleme başlıyor.'); schedulePush(); pollRemote(); }
    else setStatus('signedOut', 'İnternet bağlantısı hazır.');
  });
  window.addEventListener('offline', function () {
    status.online = false;
    setStatus('offline', 'Çevrimdışısın. Veriler cihazda güvenle saklanıyor.');
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && session && session.user && navigator.onLine) pollRemote();
  });

  window.DengeCloud = {
    init,
    signIn,
    signUp,
    signOut,
    syncNow,
    localSave,
    getStatus,
    isConfigured: () => configured
  };
})();
