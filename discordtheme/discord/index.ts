const DC_ORDER_KEY = 'dc_guild_order_v2';
const DC_STYLE_ID = 'dc-discord-theme-style-v2';
const DC_TOOLTIP_ID = 'dc-tooltip';
function log(...a) { console.info('[dc-theme]', ...a); }
function warn(...a) { console.warn('[dc-theme]', ...a); }
function getCtx() {
    try {
        return window.SillyTavern?.getContext?.() || window.SillyTavern || {};
    }
    catch {
        return {};
    }
}
function getCurrentCharacterName() {
    try {
        if (typeof getCurrentCharacterId === 'function') {
            const id = getCurrentCharacterId();
            if (id) {
                const names = getCharacterNames();
                const ids = getCharacterIds();
                const idx = ids.indexOf(id);
                if (idx >= 0)
                    return names[idx];
            }
        }
    }
    catch { }
    try {
        const ctx = getCtx();
        return ctx?.characters?.[ctx?.characterId]?.data?.name || ctx?.name2 || null;
    }
    catch {
        return null;
    }
}
function getCurrentCharacterIdSafe() {
    try {
        if (typeof getCurrentCharacterId === 'function')
            return getCurrentCharacterId();
    }
    catch { }
    try {
        const ctx = getCtx();
        return ctx?.characterId || ctx?.this_chid || null;
    }
    catch {
        return null;
    }
}
function getThumb(type, file) {
    try {
        if (SillyTavern?.getThumbnailUrl)
            return SillyTavern.getThumbnailUrl(type, file);
    }
    catch { }
    try {
        if (window.getThumbnailUrl)
            return window.getThumbnailUrl(type, file);
    }
    catch { }
    return `thumbnail?type=${type}&file=${encodeURIComponent(file)}`;
}
function hasHelper(name) { try {
    return typeof window[name] === 'function';
}
catch {
    return false;
} }
async function safeGetCharacter(name) {
    if (hasHelper('getCharacter')) {
        try {
            return await window.getCharacter(name);
        }
        catch (e) {
            warn('getCharacter helper failed', e);
        }
    }
    const ctx = getCtx();
    const ch = ctx?.characters?.find((c) => c?.data?.name === name || c?.name === name);
    if (ch) {
        return { avatar: ch.avatar, data: ch.data || ch, ...ch, description: ch.data?.description || ch.description || '', first_mes: ch.data?.first_mes || ch.first_mes || '' };
    }
    throw new Error('角色未找到: ' + name);
}
async function safeUpdateCharacter(name, updater) {
    if (hasHelper('updateCharacterWith')) {
        try {
            return await window.safeUpdateCharacter(name, updater);
        }
        catch (e) {
            warn('updateCharacterWith helper failed', e);
        }
    }
    const ctx = getCtx();
    const idx = ctx?.characters?.findIndex((c) => c?.data?.name === name);
    if (idx >= 0) {
        let ch = ctx.characters[idx];
        let copy = JSON.parse(JSON.stringify(ch));
        let updated = await updater(copy);
        if (updated)
            copy = updated;
        ctx.characters[idx] = copy;
        try {
            const headers = getCtx().getRequestHeaders() || { 'Content-Type': 'application/json' };
            const res = await fetch('/api/characters/edit', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar_url: ch.avatar, data: copy.data || copy }) });
            if (!res.ok)
                throw new Error('save failed ' + res.status);
        }
        catch (e) {
            warn('fallback save failed', e);
            try {
                SillyTavern?.saveSettingsDebounced?.();
            }
            catch { }
        }
        return copy;
    }
    throw new Error('更新失败，未找到角色');
}
async function safeGetWorldbook(name) {
    if (hasHelper('getWorldbook')) {
        try {
            return await window.safeGetWorldbook(name);
        }
        catch (e) {
            warn(e);
        }
    }
    try {
        const data = await getCtx().loadWorldInfo?.(name);
        if (data) {
            const entries = data.entries ? Object.values(data.entries).map((e) => ({ uid: e.uid ?? e.id, name: e.comment || e.key?.join(',') || '未命名', enabled: !e.disable, strategy: { type: e.constant ? 'constant' : 'selective', keys: e.key || [], keys_secondary: { logic: 'and_any', keys: e.keysecondary || [] }, scan_depth: e.scanDepth || 1 }, content: e.content, probability: 100 })) : [];
            return entries;
        }
    }
    catch (e) {
        warn(e);
    }
    return [];
}
function safeGetCharWorldbookNames(name) {
    if (hasHelper('safeGetCharWorldbookNames')) {
        try {
            return window.safeGetCharWorldbookNames(name);
        }
        catch (e) { }
    }
    try {
        const ctx = getCtx();
        const ch = ctx?.characters?.find((c) => c?.data?.name === name);
        const primary = ch?.data?.character_book?.name || null;
        return { primary, additional: [] };
    }
    catch {
        return { primary: null, additional: [] };
    }
}
function safeGetGlobalWorldbookNames() {
    if (hasHelper('safeGetGlobalWorldbookNames')) {
        try {
            return window.safeGetGlobalWorldbookNames();
        }
        catch (e) { }
    }
    try {
        return SillyTavern?.getContext?.()?.worldInfoSettings?.world_info || [];
    }
    catch {
        return [];
    }
}
function safeGetWorldbookNames() {
    if (hasHelper('getWorldbookNames')) {
        try {
            return window.getWorldbookNames();
        }
        catch (e) { }
    }
    try {
        return Object.keys(SillyTavern?.worldInfoCache || {});
    }
    catch {
        return [];
    }
}
async function safeCreateWorldbookEntries(book, entries) {
    if (hasHelper('safeCreateWorldbookEntries')) {
        try {
            return await window.safeCreateWorldbookEntries(book, entries);
        }
        catch (e) {
            warn(e);
        }
    }
    try {
        const data = await getCtx().loadWorldInfo?.(book);
        if (data) {
            entries.forEach((en) => {
                const uid = Date.now() + Math.floor(Math.random() * 1000);
                data.entries[uid] = { uid, key: [en.name], content: en.content, disable: !en.enabled, constant: false, selective: true, keysecondary: [], scanDepth: null, position: 0, order: 100, role: 0, depth: 4, extra: {} };
            });
            await getCtx().saveWorldInfo?.(book, data);
            return { worldbook: Object.values(data.entries) };
        }
    }
    catch (e) {
        warn(e);
    }
    throw new Error('创建世界书条目失败');
}
async function safeUpdateWorldbookWith(book, updater) {
    if (hasHelper('safeUpdateWorldbookWith')) {
        try {
            return await window.safeUpdateWorldbookWith(book, updater);
        }
        catch (e) {
            warn(e);
        }
    }
    const entries = await safeGetWorldbook(book);
    const updated = await updater(entries);
    try {
        const data = await getCtx().loadWorldInfo?.(book);
        if (data) {
            data.entries = {};
            updated.forEach((e, i) => { data.entries[e.uid || i] = { uid: e.uid || i, key: e.strategy?.keys || [e.name], content: e.content, disable: !e.enabled, constant: e.strategy?.type === 'constant', selective: true, position: 0, order: e.order || i }; });
            await getCtx().saveWorldInfo?.(book, data);
        }
        return updated;
    }
    catch (e) {
        warn(e);
        return updated;
    }
}
function safeGetPersonaNames() {
    if (hasHelper('getPersonaNames')) {
        try {
            return window.safeGetPersonaNames();
        }
        catch (e) { }
    }
    return [];
}
function safeGetCurrentPersonaName() {
    if (hasHelper('getCurrentPersonaName')) {
        try {
            return window.safeGetCurrentPersonaName();
        }
        catch (e) { }
    }
    try {
        return getCtx()?.name1 || null;
    }
    catch {
        return null;
    }
}
function getUserName() {
    const ctx = getCtx();
    return ctx?.name1 || document.querySelector('#your_name')?.value || (typeof getCurrentPersonaName === 'function' ? safeGetCurrentPersonaName()() : null) || '玩家';
}
function getUserAvatar() {
    try {
        if (typeof getPersonaAvatarPath === 'function') {
            const p = getPersonaAvatarPath('current');
            if (p)
                return p;
        }
    }
    catch { }
    const img = document.querySelector('#user_avatar_block img, #persona_avatar_block img, .user_avatar img');
    if (img?.src)
        return img.src;
    const ctx = getCtx();
    if (ctx?.userAvatar)
        return ctx.userAvatar;
    return './img/ai2.png';
}
function escapeHtml(s) { return _.escape(String(s ?? '')); }
// ---------- CSS ----------
function injectStyle() {
    $(`#${DC_STYLE_ID}`).remove();
    const css = `
:root{
  --dc-guild:#1e1f22; --dc-sidebar:#2b2d31; --dc-chat:#313338; --dc-input:#383a40;
  --dc-hover:#35373c; --dc-active:#404249; --dc-text:#f2f3f5; --dc-muted:#949ba4;
  --dc-sub:#b5bac1; --dc-blue:#5865f2; --dc-blue-hover:#4752c4; --dc-sep:#232428; --dc-line:#3f4147;
  --dc-green:#23a559; --dc-red:#ed4245; --dc-yellow:#fee75c;
}
body.dc-discord-enabled{background:var(--dc-chat)!important;margin:0!important;overflow:hidden!important}
body.dc-discord-enabled #bg1,body.dc-discord-enabled #bg_custom{filter:brightness(0.78)}

/* hidden originals but keep accessible for logic */
body.dc-discord-enabled #top-bar{display:none!important}
body.dc-discord-enabled #sheldheader{display:none!important}
body.dc-discord-enabled #right-nav-panel{display:none!important}

/* root */
#dc-root{display:flex;flex-direction:row;height:100vh;height:100dvh;width:100vw;overflow:hidden;font-family:"gg sans","Noto Sans",Whitney,"Helvetica Neue",Helvetica,Arial,"PingFang SC","Noto Sans SC",sans-serif;background:var(--dc-chat);position:relative;z-index:10}
/* guild bar */
#dc-guild-bar{width:72px;min-width:72px/* live test */;background:var(--dc-guild);display:flex;flex-direction:column;align-items:center;padding:12px 0 80px 0;gap:8px;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;flex-shrink:0}
#dc-guild-bar::-webkit-scrollbar{width:0}
.dc-guild-item{width:48px;height:48px;border-radius:16px;background:#313338;overflow:hidden;cursor:pointer;position:relative;flex-shrink:0;transition: border-radius .15s, background .15s;box-shadow:none;display:flex;align-items:center;justify-content:center}
.dc-guild-item:hover{border-radius:12px;background:var(--dc-active)}
.dc-guild-item.active{border-radius:12px;background:var(--dc-active)}
.dc-guild-item.active img{border-radius:12px}
.dc-guild-item img{width:100%;height:100%;object-fit:cover;border-radius:16px;transition:border-radius .15s;display:block}
.dc-guild-item:hover img{border-radius:12px}
.dc-guild-pill{position:absolute;left:-8px;top:50%;transform:translateY(-50%);width:8px;height:0;background:white;border-radius:0 4px 4px 0;transition:height .15s, width .15s}
.dc-guild-item:hover .dc-guild-pill{height:20px;width:4px}
    /* Discord头像/guild动画：加号旋转、未读数红点、hover上浮 */
    .dc-guild-add{transition:border-radius .2s ease, transform .2s ease}
    .dc-guild-add:hover{transform:rotate(90deg);border-radius:30%!important}
    .dc-guild-item img{transition:transform .2s ease}
    .dc-guild-item:hover img{transform:scale(1.05)}
    .dc-guild-item.active img, .dc-guild-item:hover img{border-radius:16px}
    .dc-unread-badge{position:absolute;top:0;right:0;background:var(--dc-red);color:#fff;border:2px solid var(--dc-guild);border-radius:50%;min-width:16px;height:16px;font-size:10px;display:flex;align-items:center;justify-content:center;padding:0 3px;box-sizing:border-box}
.dc-guild-item.active .dc-guild-pill{height:40px!important;width:4px!important}
.dc-guild-sep{width:32px;height:2px;background:#35363c;border-radius:1px;margin:4px 0}
.dc-guild-item.has-unread::before{content:"";position:absolute;left:-4px;top:50%;transform:translateY(-50%);width:8px;height:8px;background:white;border-radius:50%}
.dc-guild-add{width:48px;height:48px;border-radius:16px;background:#313338;display:flex;align-items:center;justify-content:center;color:var(--dc-green);font-size:20px;cursor:pointer;transition:.15s}
.dc-guild-add:hover{border-radius:12px;background:var(--dc-green);color:white}
/* tooltip */
#dc-tooltip{position:fixed;left:0;top:0;background:#111214;color:#f2f3f5;padding:6px 10px;border-radius:4px;font-size:13px;font-weight:600;pointer-events:none;z-index:99999;white-space:nowrap;opacity:0;transform:translateX(6px);transition:opacity .12s, transform .12s;box-shadow:0 8px 16px rgba(0,0,0,.35)}
#dc-tooltip.show{opacity:1;transform:translateX(0)}
#dc-tooltip::before{content:"";position:absolute;left:-6px;top:50%;transform:translateY(-50%);border:6px solid transparent;border-right-color:#111214}

/* sidebar */
#dc-sidebar{width:var(--dc-sidebar-w,240px);min-width:240px;max-width:420px;background:var(--dc-sidebar);display:flex;flex-direction:column;flex-shrink:0;border-right:1px solid #1f2124;position:relative;overflow:hidden}
#dc-resizer{width:4px;cursor:col-resize;flex-shrink:0;background:transparent;position:relative;z-index:15;margin-left:-2px}
#dc-resizer:hover,#dc-resizer.dragging{background:#5865f2;opacity:0.6}
#dc-sidebar-header{height:48px;padding:0 12px 0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1f2124;box-shadow:0 1px 0 #1f2124,0 1px 2px rgba(0,0,0,.2);cursor:pointer;flex-shrink:0;user-select:none}
#dc-char-name{color:var(--dc-text);font-weight:700;font-size:15px;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dc-char-name i{font-size:11px;color:var(--dc-muted);transition:transform .15s}
#dc-sidebar-header.open i{transform:rotate(180deg)}
/* P2 dropdown - server menu style */
#dc-char-dropdown{position:absolute;top:56px;left:8px;right:8px;background:#111214;border:1px solid #232428;border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:0;z-index:50;box-shadow:0 8px 16px rgba(0,0,0,.4);transform-origin:top center;transition:transform .15s, opacity .15s}
#dc-char-dropdown.hidden{opacity:0;pointer-events:none;transform:scale(0.97)}
#dc-char-dropdown:not(.hidden){opacity:1;transform:scale(1)}
#dc-dropdown-group{padding:6px 0}
#dc-dropdown-group + #dc-dropdown-group{border-top:1px solid #3f4147;margin-top:2px;padding-top:8px}
.dc-dd-item{display:flex;align-items:center;gap:10px;padding:0 10px;height:40px;border-radius:4px;color:#dbdee1;font-size:14px;font-weight:500;cursor:pointer;user-select:none;justify-content:space-between}
.dc-dd-item:hover{background:var(--dc-blue);color:white}
.dc-dd-item:hover .dc-dd-icon{color:white}
.dc-dd-item.alt-hover:hover{background:#35373c;color:white}
.dc-dd-icon{width:16px;text-align:center;color:#b5bac1;font-size:14px}
.dc-dd-arrow{color:#b5bac1;font-size:12px;margin-left:auto}
.dc-dd-item.danger{color:#ed4245}
.dc-dd-item.danger .dc-dd-icon{color:#ed4245}
.dc-dd-item.danger:hover{background:#ed4245;color:white}
.dc-dd-item.danger:hover .dc-dd-icon{color:white}
.dc-dd-sep{height:1px;background:#3f4147;margin:4px 0}
.dc-dd-token{padding:8px 10px;color:#949ba4;font-size:12px;display:flex;justify-content:space-between}
#dc-banner{height:136px;margin:0;background:#1e1f22;position:relative;overflow:hidden;flex-shrink:0}
#dc-banner img{width:100%;height:100%;object-fit:cover;display:block}
#dc-banner::after{content:"";position:absolute;inset:0;background:linear-gradient(transparent 45%, rgba(0,0,0,.55))}
/* vertical toolbar inside sidebar (moved top-bar) */
#dc-toolbar-vertical{padding:8px 8px 4px 8px;display:flex;flex-direction:column;gap:2px;flex-shrink:0;border-bottom:1px solid #232428;margin-bottom:4px}
#dc-toolbar-vertical:empty{display:none}
.dc-toolbar-label{color:#949ba4;font-size:11px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;padding:8px 8px 4px 8px}
.dc-vtool{padding:6px 8px;border-radius:4px;color:#949ba4;font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px;cursor:pointer}
.dc-vtool:hover{background:var(--dc-hover);color:#dbdee1}
.dc-vtool.active{background:var(--dc-active);color:white}
.dc-vtool i{width:18px;text-align:center;font-size:14px}
/* channels */
#dc-channels-header{padding:12px 8px 4px 16px;color:var(--dc-muted);font-size:12px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;display:flex;align-items:center;gap:4px;flex-shrink:0}
#dc-create-temp{margin:8px 8px 6px 8px;padding:8px 10px;background:rgba(151,151,159,0.12);color:#f2f3f5;border:1px solid rgba(255,255,255,0.04);border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;justify-content:center;transition:.15s}
#dc-create-temp:hover{background:rgba(151,151,159,0.18);border-color:rgba(255,255,255,0.08)}
#dc-channel-list{flex:1;overflow-y:auto;padding:0 8px 88px 8px;display:flex;flex-direction:column;gap:1px;scrollbar-width:thin;scrollbar-color:#1a1b1e transparent}
#dc-channel-list::-webkit-scrollbar{width:6px}
#dc-channel-list::-webkit-scrollbar-thumb{background:#1a1b1e;border-radius:4px}
.dc-category{color:#949ba4;font-size:11px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;padding:10px 6px 2px 6px;display:flex;align-items:center;gap:4px}
.dc-channel{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:4px;color:#949ba4;font-size:14px;cursor:pointer;font-weight:500;user-select:none;position:relative}
.dc-channel:hover{background:var(--dc-hover);color:#dbdee1}
.dc-channel.active{background:var(--dc-active);color:white}
.dc-channel .dc-hash{font-size:15px;font-weight:400;color:#80848e}
.dc-channel.active .dc-hash{color:white}
.dc-channel-actions{margin-left:auto;display:flex;gap:4px;opacity:0}
.dc-channel:hover .dc-channel-actions{opacity:1}
.dc-channel-actions i{width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:3px;font-size:11px}
.dc-channel-actions i:hover{background:#2b2d31}
/* chat main */
#dc-chat-main{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--dc-chat);position:relative}
#dc-top-toolbar-custom{height:48px;min-height:48px;background:var(--dc-chat);border-bottom:1px solid #1f2124;display:flex;align-items:center;justify-content:space-between;padding:0 16px;gap:8px;box-shadow:0 1px 0 #1f2124;flex-shrink:0}
#dc-current-channel{display:flex;align-items:center;gap:8px;color:var(--dc-text);font-weight:700;font-size:15px}
#dc-current-channel .dc-hash{color:#80848e;font-size:18px}
#dc-top-actions{display:flex;align-items:center;gap:4px;margin-left:auto}
.dc-top-icon{width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:var(--dc-muted);font-size:15px;cursor:pointer;border-radius:4px}
.dc-top-icon:hover{background:var(--dc-hover);color:#dbdee1}
#dc-top-search{width:220px;height:24px;background:#1e1f22;border:1px solid #232428;border-radius:4px;display:flex;align-items:center;padding:0 6px;gap:6px;color:#949ba4;font-size:13px;cursor:text; position:relative}
#dc-top-search input{flex:1;background:transparent;border:none;color:#dbdee1;font-size:13px;outline:none}
#dc-top-search:hover{border-color:#3f4147}
#dc-top-search.regex-error{border-color:#ed4245!important; box-shadow:0 0 0 1px #ed4245}
#dc-top-search.regex-active{border-color:#5865f2!important}
.mes.regex-hidden{opacity:0.25; filter:grayscale(0.5)}
.mes.regex-match{outline:1px solid rgba(88,101,242,0.3); background:#2e3035!important}
#dc-chat-container{flex:1;overflow-y:auto;overflow-x:hidden;padding:12px 0 8px 0;scrollbar-width:thin;scrollbar-color:#1a1b1e transparent;display:flex;flex-direction:column}
#dc-chat-container::-webkit-scrollbar{width:8px}
#dc-chat-container::-webkit-scrollbar-thumb{background:#1a1b1e;border-radius:4px}
#dc-chat-container #chat{display:flex!important;flex-direction:column;gap:2px;max-width:100%;margin:0;padding:0;background:transparent!important;box-shadow:none!important;width:100%!important}
#dc-chat-container #chat .mes{display:flex;gap:12px;padding:6px 16px 6px 72px;position:relative;background:transparent!important;border:none!important;border-radius:0!important;margin:0!important;max-width:100%!important;transition:background .08s}
#dc-chat-container #chat .mes:hover{background:#2e3035!important}
#dc-chat-container #chat .mes .avatar, #dc-chat-container #chat .mes .mesAvatarWrapper, #dc-chat-container #chat .mes .avatar img{width:40px!important;height:40px!important;border-radius:50%!important;position:absolute!important;left:16px!important;top:6px!important;margin:0!important}
#dc-chat-container #chat .mes .mes_block,#dc-chat-container #chat .mes .mes_text{flex:1;min-width:0;background:transparent!important;color:#dbdee1!important;font-size:15px;line-height:1.375;padding:0!important}
#dc-chat-container #chat .mes .ch_name,#dc-chat-container #chat .mes .name{color:var(--dc-text)!important;font-weight:550!important;font-size:15.5px!important;margin:0 8px 2px 0!important;display:inline-flex!important;align-items:center;gap:8px}
#dc-chat-container #chat .mes .mes_text{color:#dbdee1!important}
#dc-chat-container #chat .mes .mes_text p{margin:4px 0}
#dc-chat-container #chat .mes .timestamp,#dc-chat-container #chat .mes .mes_timestamp{color:var(--dc-muted)!important;font-size:11px!important;font-weight:400!important;opacity:1!important}
#dc-chat-container #chat .mes_bookmark,#dc-chat-container #chat .mes_buttons{opacity:0;transition:.15s;background:#313338;border:1px solid #404249;border-radius:6px;box-shadow:0 4px 8px rgba(0,0,0,.2)}
#dc-chat-container #chat .mes:hover .mes_buttons{opacity:1}
#dc-input-wrap{padding:8px 16px 16px 16px;background:var(--dc-chat);flex-shrink:0}
#dc-input-wrap #form_sheld{margin:0!important;background:var(--dc-input)!important;border-radius:8px!important;border:1px solid #404249!important;padding:4px 8px!important;display:flex!important;flex-direction:column!important;width:100%!important;max-width:100%!important;box-shadow:none!important;position:relative!important;left:auto!important;right:auto!important;bottom:auto!important}
#dc-input-wrap #send_form{background:transparent!important;border:none!important;display:flex!important;align-items:center!important;gap:8px!important;padding:4px 0!important}
#dc-input-wrap #send_textarea{flex:1;background:transparent!important;border:none!important;color:#dbdee1!important;min-height:44px!important;max-height:50vh!important;padding:10px 8px!important;resize:none!important;font-size:15px!important;line-height:1.35!important}
#dc-input-wrap #send_textarea::placeholder{color:#6d758d!important}
#dc-input-wrap #options_button{width:32px;height:32px;background:#b5bac1;color:#313338;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
#dc-input-wrap #options_button:hover{background:#dbdee1}
#dc-input-wrap #stscript_continue,#dc-input-wrap #stscript_pause,#dc-input-wrap #stscript_stop,#dc-input-wrap #mes_impersonate,#dc-input-wrap #mes_continue{display:none!important}
#dc-input-wrap #send_but{display:flex!important;color:#949ba4}
#dc-input-wrap #send_but:hover{color:#dbdee1}
.dc-input-icons{display:flex;align-items:center;gap:6px;margin-left:auto}
.dc-input-icons i{width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:#b5bac1;cursor:pointer;border-radius:4px;font-size:16px}
.dc-input-icons i:hover{color:#dbdee1;background:#35373c}
#dc-user-float{position:fixed;left:0;bottom:0;width:312px;height:52px;background:#232428;display:flex;align-items:center;gap:8px;padding:0 8px;border-top:1px solid #3f4147;border-right:1px solid #3f4147;z-index:50;box-sizing:border-box}
#dc-guild-bar{padding-bottom:68px !important}
#dc-sidebar{padding-bottom:68px !important}
#dc-input-wrap{padding:0 8px !important; background:var(--dc-chat)!important; height:52px !important; min-height:52px !important; max-height:52px !important; display:flex!important; align-items:center!important; gap:8px!important; border-top:1px solid #3f4147!important; box-sizing:border-box}
body.dc-discord-enabled #dc-home-panel:not([style*="display: none"]) ~ #dc-input-wrap, body.dc-discord-enabled #dc-home-panel[style*="flex"] ~ #dc-input-wrap{display:none!important}
body.dc-discord-enabled #dc-chat-container[style*="display: none"] ~ #dc-input-wrap{display:none!important}
body.dc-discord-enabled:not(.chat-visible) #dc-input-wrap{display:none!important}
#dc-input-wrap #form_sheld, #dc-input-wrap #send_form, #dc-input-wrap form{height:44px !important;min-height:44px !important;max-height:44px !important;background:#383a40 !important;border:none !important;border-radius:8px !important;box-shadow:none !important; flex:1 !important; display:flex !important; align-items:center !important; gap:4px !important; padding:0 8px !important}

#dc-user-float img{width:32px;height:32px;border-radius:50%;object-fit:cover;background:#313338;flex-shrink:0}
#dc-user-name{flex:1;color:var(--dc-text);font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dc-user-status{width:10px;height:10px;background:#23a559;border-radius:50%;position:absolute;right:-1px;bottom:-1px;border:2px solid #232428}
#dc-avatar-wrap{position:relative;flex-shrink:0}
#dc-user-gear{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:4px;color:var(--dc-muted);cursor:pointer}
#dc-user-gear:hover{background:#35373c;color:#dbdee1}
/* user modal */
#dc-user-modal.hidden, #dc-char-modal.hidden, #dc-worldbook-modal.hidden, #dc-context-menu.hidden{display:none!important}
#dc-user-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center}
#dc-modal-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(2px)}
#dc-user-panel{position:relative;width:min(1000px,94vw);height:min(680px,86vh);background:#313338;border-radius:8px;overflow:hidden;display:flex;box-shadow:0 12px 32px rgba(0,0,0,.5)}
#dc-user-left{width:240px;min-width:240px;background:#2b2d31;padding:16px;display:flex;flex-direction:column;gap:8px;overflow-y:auto}
#dc-user-left img{width:80px;height:80px;border-radius:50%;object-fit:cover;background:#313338;display:block;margin:0 auto}
#dc-user-left-name{color:white;font-weight:700;font-size:16px;text-align:center}
#dc-user-left-status{color:#949ba4;font-size:12px;text-align:center;margin-top:-4px}
.dc-tab-btn{padding:8px 10px;border-radius:4px;color:#949ba4;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:8px}
.dc-tab-btn:hover{background:#35373c;color:#dbdee1}
.dc-tab-btn.active{background:#404249;color:white}
#dc-user-right{flex:1;overflow-y:auto;padding:20px;background:#313338}
#dc-user-right h2{color:white;font-size:20px;font-weight:700;margin:0 0 8px 0}
#dc-user-right p.desc{color:#b5bac1;font-size:14px;margin:0 0 16px 0}
.dc-field{margin:14px 0}
.dc-field label{color:#b5bac1;font-size:12px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;display:block;margin-bottom:6px}
.dc-input, .dc-textarea, .dc-select{width:100%;background:#1e1f22;border:none;border-radius:3px;color:#dbdee1;font-size:15px;padding:10px 12px;outline:none;box-sizing:border-box}
.dc-textarea{min-height:120px;resize:vertical;line-height:1.4}
.dc-input:focus, .dc-textarea:focus{box-shadow:0 0 0 2px rgba(88,101,242,.6)}
.dc-btn-primary{background:#5865f2;color:white;border:none;border-radius:3px;padding:10px 16px;font-weight:600;cursor:pointer}
.dc-btn-primary:hover{background:#4752c4}
.dc-btn-secondary{background:#4e5058;color:white;border:none;border-radius:3px;padding:8px 12px;cursor:pointer}
.dc-btn-secondary:hover{background:#6d6f78}
.dc-btn-danger{background:#ed4245;color:white;border:none;border-radius:3px;padding:8px 12px}
.dc-divider{height:1px;background:#3f4147;margin:16px 0}
/* char modal P4 */
#dc-char-modal{position:fixed;inset:0;z-index:9998;display:flex;flex-direction:column;background:#313338}
#dc-char-modal-top{height:48px;display:flex;align-items:center;justify-content:flex-end;padding:0 16px;border-bottom:1px solid #1f2124;background:#313338;flex-shrink:0}
#dc-char-close{width:32px;height:32px;border-radius:50%;background:#4e5058;color:#dbdee1;display:flex;align-items:center;justify-content:center;cursor:pointer;border:none}
#dc-char-close:hover{background:#6d6f78}
#dc-char-body{flex:1;display:flex;overflow:hidden}
#dc-char-left{width:230px;min-width:230px;background:#2b2d31;padding:16px 8px;overflow-y:auto;display:flex;flex-direction:column;gap:4px}
.dc-nav-title{color:#949ba4;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:16px 8px 4px 8px}
.dc-nav-item{padding:8px 10px;border-radius:4px;color:#949ba4;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:8px}
.dc-nav-item:hover{background:#35373c;color:#dbdee1}
.dc-nav-item.active{background:#404249;color:white}
#dc-char-right{flex:1;overflow-y:auto;padding:24px 32px;background:#313338}
#dc-char-right-inner{max-width:740px}
#dc-char-right h2{color:white;font-size:20px;font-weight:800;margin:0 0 6px 0}
#dc-char-right p.desc{color:#b5bac1;font-size:14px;margin:0 0 20px 0}
.dc-accordion{border-top:1px solid #3f4147}
.dc-acc-head{display:flex;align-items:center;justify-content:space-between;padding:16px 0;color:#f2f3f5;font-weight:600;cursor:pointer;user-select:none}
.dc-acc-head span.sub{color:#b5bac1;font-weight:400;font-size:13px}
.dc-acc-body{display:none;padding:0 0 16px 0}
.dc-acc-body.open{display:block;animation:dcFade .15s ease}
@keyframes dcFade{from{opacity:0}to{opacity:1}}
.dc-preview-card{position:absolute;right:24px;top:84px;width:280px;background:#232428;border-radius:8px;overflow:hidden;box-shadow:0 8px 16px rgba(0,0,0,.3);border:1px solid #1f2124}
.dc-preview-card img{width:100%;height:180px;object-fit:cover;display:block}
.dc-preview-card .info{padding:12px}
.dc-preview-card .info b{color:white}
.dc-preview-card .info p{color:#b5bac1;font-size:13px;margin:6px 0 0 0}
.dc-save-bar{position:sticky;bottom:-24px;margin:24px -32px -24px -32px;background:#2b2d31;border-top:1px solid #1f2124;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.dc-save-bar span{color:#b5bac1;font-size:13px}
/* worldbook */
.dc-wb-entry{padding:12px;border:1px solid #3f4147;border-radius:6px;background:#2b2d31;margin:8px 0}
.dc-wb-entry-head{display:flex;align-items:center;gap:8px;color:white;font-weight:600}
.dc-wb-entry-head small{color:#949ba4;font-weight:400}
.dc-wb-content{color:#b5bac1;font-size:13px;margin:6px 0;white-space:pre-wrap;word-break:break-word}
.dc-wb-keys{color:#949ba4;font-size:11px;margin-top:4px}
.dc-pill{display:inline-block;background:#404249;color:#dbdee1;border-radius:999px;padding:2px 8px;font-size:11px;margin:2px}
/* context menu */
#dc-context-menu{position:fixed;z-index:9999;background:#111214;border:1px solid #232428;border-radius:6px;padding:6px;min-width:180px;box-shadow:0 8px 16px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:2px}
#dc-context-menu button{background:transparent;border:none;color:#dbdee1;text-align:left;padding:8px 10px;border-radius:4px;cursor:pointer;font-size:13px}
#dc-context-menu button:hover{background:#35373c}
#dc-context-menu button.danger{color:#ed4245}
/* select character page cleanup */
body.dc-discord-enabled #rm_print_characters_block .character_select:has(.ch_name){display:flex!important}
body.dc-discord-enabled .dc-hidden-emoji{display:none!important}
/* hide stray ST panels & overlapping QR bar */
body.dc-discord-enabled #floatingPrompt, body.dc-discord-enabled #cfgConfig, body.dc-discord-enabled #logprobsViewer{position:fixed!important;left:-9999px!important;top:-9999px!important;opacity:0!important;pointer-events:none!important}
body.dc-discord-enabled #qr--bar, body.dc-discord-enabled #qr--popoutTrigger, body.dc-discord-enabled .qr--buttons{display:none!important}
body.dc-discord-enabled #file_form, body.dc-discord-enabled .file_attached, body.dc-discord-enabled .file_size, body.dc-discord-enabled .file_name{display:none!important}
body.dc-discord-enabled #file_form_input, body.dc-discord-enabled #embed_file_input{display:none!important}
body.dc-discord-enabled #send_form .flex-container.flexGap5{display:none!important}
body.dc-discord-enabled #dc-input-wrap #send_form{flex-wrap:nowrap!important; gap:8px!important}
body.dc-discord-enabled #dc-input-wrap #send_form > *:not(#send_textarea):not(#send_but):not(#options_button):not(.dc-input-icons):not(#nonQRFormItems):not(#file_form){display:none!important}
body.dc-discord-enabled #nonQRFormItems{display:flex!important; align-items:center; gap:8px; flex:1}
body.dc-discord-enabled #send_textarea{flex:1!important; min-width:0!important}
/* scrollbar */
*{scrollbar-width:thin;scrollbar-color:#1a1b1e transparent}

/* === Chat message Discord spec === */
#dc-chat-container #chat .mes{flex-direction:row !important;justify-content:flex-start !important;align-items:flex-start !important;position:relative}
#dc-chat-container #chat .mes.is_user{flex-direction:row !important;justify-content:flex-start !important}
#dc-chat-container #chat .mes .avatar{order:0 !important;flex-shrink:0 !important}
#dc-chat-container #chat .mes .mes_block{order:1 !important;flex:1;min-width:0}
#dc-chat-container #chat .mes .name_text_wrapper{display:flex;align-items:baseline;gap:6px;margin-bottom:2px;flex-wrap:wrap}
#dc-chat-container #chat .mes .name_text{font-size:15px;font-weight:500;line-height:1.375;cursor:pointer}
#dc-chat-container #chat .mes:not(.is_user) .name_text{color:#f2f3f5}
#dc-chat-container #chat .mes.is_user .name_text{color:#e8eaed}
#dc-chat-container #chat .mes .timestamp{font-size:11px !important;color:#72767d !important;font-weight:400 !important;margin-left:4px}
#dc-chat-container #chat .mes .mes_text{font-size:15px;line-height:1.375;color:#dcddde;word-wrap:break-word}
#dc-chat-container #chat .mes.continue .avatar{visibility:hidden !important}
#dc-chat-container #chat .mes.continue .name_text_wrapper{display:none !important}
.discord-name-tag{display:inline-flex;align-items:center;margin-left:6px;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:500;vertical-align:middle;line-height:1.4;cursor:default;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;transition:background .1s,color .1s}
.discord-name-tag.char-tag{background:rgba(88,101,242,0.15);color:#949ba4;border:1px solid rgba(88,101,242,0.2)}
.discord-name-tag.char-tag:hover{background:rgba(88,101,242,0.25);color:#c9cdfb}
.discord-name-tag.user-tag{background:rgba(35,165,90,0.15);color:#949ba4;border:1px solid rgba(35,165,90,0.2)}
.discord-name-tag.user-tag:hover{background:rgba(35,165,90,0.25);color:#a3d9b5}
.dc-date-separator{display:flex;align-items:center;gap:12px;margin:16px 16px 8px 16px;color:#949ba4;font-size:12px;font-weight:600}
.dc-date-separator::before,.dc-date-separator::after{content:"";flex:1;height:1px;background:#3f4147}
.mes_buttons_discord{position:absolute;top:-14px;right:16px;display:none;background:#313338;border-radius:8px;box-shadow:0 8px 16px rgba(0,0,0,0.24);padding:2px;gap:0;align-items:center;z-index:5;border:1px solid #3f4147;overflow:hidden}
.mes:hover .mes_buttons_discord{display:flex}
.mes_btn_discord{width:32px;height:32px;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#b5bac1;font-size:14px;transition:background .1s,color .1s;flex-shrink:0}
.mes_btn_discord:hover{background:#2b2d31;color:#dbdee1}
.mes_btn_discord.btn-delete:hover{background:rgba(237,66,69,0.15);color:#ed4245}
.mes-reactions{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.reaction-pill{display:inline-flex;align-items:center;gap:4px;background:#2b2d31;border:1px solid #3f4147;border-radius:8px;padding:4px 8px;cursor:pointer;font-size:13px;color:#dbdee1;transition:background .1s}
.reaction-pill.self-reacted{background:rgba(88,101,242,0.3);border-color:#5865f2}
.reaction-pill:hover{background:#35373c}
.emoji-picker-discord{position:absolute;width:440px;max-height:420px;background:#2b2d31;border-radius:8px;box-shadow:0 8px 16px rgba(0,0,0,0.4);display:flex;flex-direction:column;overflow:hidden;z-index:200;border:1px solid #1e1f22}
.emoji-picker-search{padding:8px;border-bottom:1px solid #3f4147}
.emoji-picker-search input{width:100%;background:#1e1f22;border:none;border-radius:4px;padding:6px 10px;color:#f2f3f5;font-size:14px;outline:none}
.emoji-grid{display:grid;grid-template-columns:repeat(9,1fr);gap:2px;padding:8px;overflow-y:auto}
.emoji-item{width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:22px;border-radius:4px;cursor:pointer}
.emoji-item:hover{background:#35373c}
.emoji-picker-footer{padding:6px 12px;background:#232428;font-size:12px;color:#72767d;border-top:1px solid #3f4147}


/* bottom input redesign P1 style */
#dc-plus-btn{width:32px;height:32px;border-radius:50%;background:transparent;color:#b5bac1;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:20px;flex-shrink:0;transition:background .1s,color .1s}
#dc-plus-btn:hover{background:#35373c;color:#f2f3f5}
.discord-input-box{flex:1;background:#383a40;border-radius:8px;height:44px;display:flex;align-items:center;padding:0 8px;gap:4px}
.discord-input-box textarea, .discord-input-box input{flex:1;background:transparent;border:none;outline:none;color:#f2f3f5;font-size:15px;line-height:1.375;resize:none;padding:0 4px;font-family:inherit}
.discord-input-box textarea::placeholder{color:#6d6f78}
.discord-send-btn{width:36px;height:36px;border-radius:8px;background:#5865f2;display:flex;align-items:center;justify-content:center;cursor:pointer;color:white;font-size:18px;flex-shrink:0;transition:background .1s}
.discord-send-btn:hover{background:#4752c4}
.discord-send-btn:active{background:#3c45a5}
.discord-extra-btn{width:36px;height:36px;border-radius:8px;background:#2b2d31;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#b5bac1;font-size:16px;flex-shrink:0;transition:background .1s,color .1s}
.discord-extra-btn:hover{background:#35373c;color:#f2f3f5}
.input-divider{width:1px;height:24px;background:#3f4147;margin:0 4px;flex-shrink:0}
#dc-plus-menu, .discord-extra-menu{position:absolute;bottom:60px;left:8px;background:#111214;border-radius:8px;padding:6px;box-shadow:0 8px 16px rgba(0,0,0,0.5);display:flex;flex-direction:column;gap:2px;z-index:100;min-width:220px}
.discord-extra-menu{left:auto;right:8px}
.dc-plus-item{display:flex;align-items:center;gap:10px;padding:0 12px;height:40px;border-radius:4px;color:#dbdee1;font-size:14px;font-weight:500;cursor:pointer}
.dc-plus-item:hover{background:#5865f2;color:white}
.dc-plus-item:hover .dc-plus-icon{color:white}
.dc-plus-icon{width:20px;text-align:center;color:#b5bac1;font-size:16px;flex-shrink:0}
.dc-plus-sep{height:1px;background:#3f4147;margin:4px 0}
#discord-user-panel{position:fixed;bottom:0;left:0;width:312px;height:52px;background:#232428;display:flex;align-items:center;padding:0 8px;gap:8px;z-index:50;border-top:1px solid #3f4147;box-sizing:border-box}
#user-panel-avatar{width:32px;height:32px;border-radius:50%;flex-shrink:0;position:relative;cursor:pointer}
#user-panel-avatar::after{content:'';position:absolute;bottom:0;right:0;width:10px;height:10px;background:#23a55a;border-radius:50%;border:2px solid #232428}
#user-panel-info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:1px}
#user-panel-name{font-size:14px;font-weight:600;color:#f2f3f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2}
#user-panel-status{font-size:11px;color:#949ba4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2}
.user-panel-icon-btn{width:28px;height:28px;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#b5bac1;font-size:16px;flex-shrink:0;transition:background .1s,color .1s}
.user-panel-icon-btn:hover{background:#35373c;color:#f2f3f5}
body.dc-discord-enabled .dc-input-icons{display:none!important}

@media(max-width:900px){#dc-sidebar{width:200px!important;min-width:200px}#dc-guild-bar{width:60px;min-width:60px}.dc-guild-item,.dc-guild-add{width:40px;height:40px}#dc-char-left{width:200px;min-width:200px}.dc-preview-card{display:none}}
#dc-drawer-host{position:absolute;inset:0;pointer-events:none;z-index:15;display:flex;justify-content:center;align-items:flex-start;padding-top:56px}
#dc-drawer-host .drawer-content{pointer-events:auto;width:min(760px,92%);max-height:calc(100% - 24px);background:var(--dc-chat)!important;color:var(--dc-text)!important;border:1px solid #2b2d31!important;border-radius:8px!important;box-shadow:0 12px 32px rgba(0,0,0,0.5)!important;padding:16px;overflow-y:auto}
#dc-drawer-host .drawer-content .text_pole, #dc-drawer-host .drawer-content input, #dc-drawer-host .drawer-content select, #dc-drawer-host .drawer-content textarea{background:#2b2d31!important;color:#dbdee1!important;border:1px solid #3f4147!important}
#dc-drawer-host .drawer-content .inline-drawer-header{background:#2b2d31!important;color:#f2f3f5!important;border-radius:4px}
.dc-drawer-overlay{display:none!important}
body.dc-discord-enabled .drawer-content[style*="position: fixed"]{display:none!important}
    /* ===== 统一面板UI（Discord风格）===== */
    #dc-drawer-host .drawer-content, #dc-regex-panel, #dc-group-panel, #dc-import-panel{
        font-family:var(--dc-font,'gg sans','Noto Sans',system-ui,sans-serif)!important;
        background:var(--dc-chat)!important;color:var(--dc-text)!important;
        border:1px solid #2b2d31!important;border-radius:8px!important;
        box-shadow:0 12px 32px rgba(0,0,0,0.5)!important;padding:16px;box-sizing:border-box;
    }
    #dc-drawer-host button, #dc-regex-panel button, #dc-group-panel button{
        border:none;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:13px;font-weight:500;
        background:#2b2d31;color:#dbdee1;transition:background .1s,color .1s;
    }
    #dc-drawer-host button:hover, #dc-regex-panel button:hover{background:#35373c;color:#fff}
    #dc-drawer-host .inline-drawer-header{background:#232428!important;color:#f2f3f5!important;border-radius:4px;padding:8px 10px}
    #dc-drawer-host h3, #dc-drawer-host h4{color:#f2f3f5}
    #dc-drawer-host .dc-ext-group-title{border-bottom:1px solid #3f4147;padding-bottom:6px}
    #dc-drawer-host label{color:#b5bac1}
`;
    const style = document.createElement('style');
    style.id = DC_STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
}
// ---------- Layout ----------
function ensureRoot() {
    if ($('#dc-root').length)
        return;
    $('body').addClass('dc-discord-enabled');
    const rootHtml = `
<div id="dc-root">
  <nav id="dc-guild-bar"></nav>
  <aside id="dc-sidebar">
    <div id="dc-sidebar-header"><span id="dc-char-name">选择角色 <i class="fa-solid fa-chevron-down"></i></span></div>
    <div id="dc-char-dropdown" class="hidden"></div>
    <div id="dc-banner"><img id="dc-banner-img" src="" alt="" style="display:none"></div>
    <div id="dc-toolbar-vertical"></div>
    <button id="dc-create-temp">＋ 创建临时聊天</button>
    <div id="dc-channels-header"><span>文字频道</span><span id="dc-add-channel" style="margin-left:auto; cursor:pointer; font-size:14px">＋</span></div>
    <div id="dc-channel-list"></div>
    <div id="dc-resizer"></div>
    <div id="dc-user-float">
      <div id="dc-avatar-wrap" style="position:relative;flex-shrink:0"><img id="dc-user-avatar" src="./img/ai2.png" style="width:32px;height:32px;border-radius:50%;object-fit:cover;background:#313338" /><span id="dc-user-status" style="width:10px;height:10px;background:#23a55a;border-radius:50%;position:absolute;right:-1px;bottom:-1px;border:2px solid #232428"></span></div>
      <div id="user-panel-info" style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:1px"><div id="dc-user-name" style="font-size:14px;font-weight:600;color:#f2f3f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2">玩家</div><div id="user-panel-status" style="font-size:11px;color:#949ba4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2">在线</div></div>
      <div style="display:flex;gap:2px"><i class="user-panel-icon-btn fa-solid fa-microphone" title="麦克风"></i><i class="user-panel-icon-btn fa-solid fa-headphones" title="耳机"></i><i id="dc-user-gear" class="user-panel-icon-btn fa-solid fa-gear" title="用户设置"></i></div>
    </div>
  </aside>
  <main id="dc-chat-main">
    <div id="dc-top-toolbar-custom">
      <div id="dc-current-channel"><span class="dc-hash">#</span><span id="dc-current-channel-name">一般</span></div>
      <div id="dc-top-actions"></div>
      <div id="dc-top-return" title="返回" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#b5bac1;font-size:14px;border-radius:4px;flex-shrink:0"><i class="fa-solid fa-arrow-left"></i></div>
      <div id="dc-top-search"><input id="dc-regex-input" placeholder="搜索" style="flex:1;background:transparent;border:none;color:#dbdee1;font-size:13px;outline:none" /><i class="fa-solid fa-magnifying-glass" style="font-size:11px;cursor:pointer" title="正则搜索"></i><i class="fa-solid fa-xmark" id="dc-regex-clear" style="font-size:11px;cursor:pointer;display:none" title="清除"></i></div>
    </div>
    <div id="dc-chat-container"></div>
    <div id="dc-input-wrap"></div>
  </main>
</div>
<div id="dc-tooltip"></div>
<div id="dc-context-menu" class="hidden"></div>
<div id="dc-user-modal" class="hidden"><div id="dc-modal-backdrop" data-close="user"></div><div id="dc-user-panel"><div id="dc-user-left"></div><div id="dc-user-right"></div></div></div>
<div id="dc-char-modal" class="hidden">
  <div id="dc-char-modal-top"><button id="dc-char-close" title="关闭 ESC">✕</button></div>
  <div id="dc-char-body"><div id="dc-char-left"></div><div id="dc-char-right"><div id="dc-char-right-inner"></div></div></div>
</div>
`;
    $('body').prepend(rootHtml);
    setTimeout(()=>{ const $uf=$('#dc-user-float'); if($uf.length && !$uf.parent().is('#dc-root')) $('#dc-root').append($uf); }, 200);
    // move chat + form (handle both legacy and new ST structures)
    const $chat = $('#chat');
    if ($chat.length)
        $('#dc-chat-container').append($chat);
    const $form = $('#form_sheld');
    if ($form.length)
        $('#dc-input-wrap').append($form);
    const $sheld = $('#sheld');
    if ($sheld.length) {
        // New ST uses #sheld as container; move its content (excluding header) to input wrap
        const $sendForm = $sheld.find('#send_form, form').first();
        if ($sendForm.length) {
            $('#dc-input-wrap').append($sendForm);
            $sendForm.css({ position: 'relative', left: 'auto', right: 'auto', bottom: 'auto', top: 'auto', width: '100%', maxWidth: '100%', margin: '0', padding: '0' });
        }
        else {
            // Fallback: move all children except header
            const $children = $sheld.children().not('#sheldheader');
            if ($children.length)
                $('#dc-input-wrap').append($children);
            else
                $('#dc-input-wrap').append($sheld.contents());
        }
        // Ensure sheld itself is hidden but not blocking
        $sheld.css({ position: 'absolute', left: '-9999px', top: '-9999px', width: '0', height: '0', overflow: 'hidden', opacity: '0', pointerEvents: 'none' });
        // Also ensure send_textarea if exists is inside input wrap
        const $ta = $('#send_textarea, #user_input, textarea[name="message"]');
        if ($ta.length && !$ta.closest('#dc-input-wrap').length)
            $('#dc-input-wrap').append($ta.closest('form, div'));
    }
    // Ensure any remaining send area is visible
    $('#dc-input-wrap').css({ display: 'block', minHeight: '60px' });
    $('#dc-input-wrap #send_form, #dc-input-wrap form').css({ display: 'flex', width: '100%' });
    // discord visual only: add right-side deco icons if missing
    if (!$('#dc-input-wrap .dc-input-icons').length) {
        const deco = $('<div class="dc-input-icons"><i class="fa-solid fa-gift" title="gift"></i><i class="fa-solid fa-face-smile" title="gif"></i><i class="fa-solid fa-note-sticky" title="sticker"></i><i class="fa-regular fa-face-smile" title="emoji"></i><i class="fa-solid fa-border-all" title="apps"></i></div>');
        $('#dc-input-wrap #send_form, #dc-input-wrap form').first().append(deco);
    }
    // ensure placeholder text matches discord
    try{ $('#send_textarea').attr('placeholder','Message #general'); }catch{}
    // move top-settings-holder drawers icons into vertical + top actions
    buildToolbarFromExisting();
    // tooltip element
    // close handlers
    $('#dc-modal-backdrop').on('click', closeUserModal);
    $('#dc-char-close').on('click', closeCharModal);
    $(document).on('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCharModal();
            closeUserModal();
            hideContextMenu();
            $('#dc-char-dropdown').addClass('hidden');
            $('#dc-sidebar-header').removeClass('open');
            const $host=$('#dc-drawer-host');
            const $rp=$('#dc-regex-panel'); if($rp.length){ const $inner=$rp.find('.inline-drawer').first(); const $rc=$('#regex_container'); if($rc.length && $inner.length){ $rc.append($inner.removeAttr('style')); } $rp.remove(); }
            $host.find('#regex_container').each((_,el)=>{ const $r=$(el); $r.removeAttr('style'); $r.find('.inline-drawer').removeAttr('style'); $r.find('.inline-drawer-content').removeAttr('style'); const home=$('#extensions_settings2'); if(home.length) home.append($r); });
            $host.children().hide(); (window as any)._dcCurrentD=null; (window as any)._dcCurrentTrigger=null; $('.dc-vtool.active,.dc-top-icon.active').removeClass('active');
        }
    });
    $(document).on('click', (e) => {
        if (!$(e.target).closest('#dc-sidebar-header, #dc-char-dropdown').length) {
            $('#dc-char-dropdown').addClass('hidden');
            $('#dc-sidebar-header').removeClass('open');
        }
        if (!$(e.target).closest('#dc-context-menu, .dc-channel').length)
            hideContextMenu();
    });
    // 搜索框固定为“正则”，点击弹出酒馆原生正则弹窗
    const initRegexSearch = () => {
        const $wrap = $('#dc-top-search');
        const $input = $('#dc-regex-input');
        if (!$wrap.length) return;
        // 固定显示“正则”
        if ($input.length) {
            $input.val('正则');
            $input.attr('readonly', 'readonly');
            $input.css({cursor:'pointer'});
        } else {
            $wrap.html('<input id="dc-regex-input" value="正则" readonly style="flex:1;background:transparent;border:none;color:#dbdee1;font-size:13px;outline:none;cursor:pointer" /><i class="fa-solid fa-magnifying-glass" style="font-size:11px;cursor:pointer" title="正则搜索"></i>');
        }
        const openRegexPopup = () => {
            // 正则=内置扩展 #regex_container（位于 #extensions_settings2）
            const $regexExt = $('#regex_container');
            const moveRegexToZone3 = () => {
                const $host = ensureDrawerHost();
                // 清空3区已显示的其他抽屉，避免叠加
                $host.children().each((_,el)=>{
                    const $c = $(el);
                    const owner = $c.data('dc-owner');
                    if (owner) $(owner).append($c);
                });
                $host.children().detach();
                (window as any)._dcCurrentD = null; (window as any)._dcCurrentTrigger = null;
                $('.dc-vtool.active, .dc-top-icon.active').removeClass('active');
                // 使用独立包裹容器承载正则面板，避免 display:contents 问题
                const $inner = $regexExt.find('.inline-drawer').first();
                let $panel = $('#dc-regex-panel');
                if (!$panel.length) {
                    $panel = $('<div id="dc-regex-panel"></div>');
                    $host.append($panel);
                }
                if ($inner.length) $panel.empty().append($inner);
                $panel.css({
                    position:'absolute', inset:'48px 16px 16px 16px', width:'auto', maxWidth:'760px', margin:'0 auto',
                    height:'calc(100% - 64px)', overflowY:'auto', zIndex:'20', background:'var(--dc-chat)',
                    border:'1px solid #2b2d31', borderRadius:'8px', boxShadow:'0 8px 24px rgba(0,0,0,0.4)',
                    display:'block', color:'var(--dc-text)', padding:'16px', boxSizing:'border-box'
                }).show();
                $panel.find('input, select, textarea, .text_pole').css({background:'#2b2d31', color:'#dbdee1', borderColor:'#3f4147'});
                $panel.find('.inline-drawer-header').css({background:'#2b2d31', color:'#f2f3f5', borderRadius:'4px'});
                $panel.find('.inline-drawer-content').css({display:'block', maxHeight:'none'});
            };
            if ($regexExt.length) {
                // 展开正则扩展的内部抽屉
                const $toggle = $regexExt.find('.inline-drawer-toggle, .inline-drawer-header').first();
                if ($toggle.length) $toggle.trigger('click');
                // 若扩展所在抽屉未打开，先打开扩展抽屉
                const $extDrawer = $('#top-settings-holder .drawer').filter((_,el)=> $(el).text().includes('扩展程序')).first();
                if ($extDrawer.length) {
                    const $content = $extDrawer.find('.drawer-content').first();
                    if ($content.length && !$content.is(':visible')) {
                        $extDrawer.find('.drawer-icon').first().trigger('click');
                    }
                }
                setTimeout(moveRegexToZone3, 350);
                return;
            }
            // 回退：扩展抽屉中的正则抽屉
            const $regexDrawer = $('#top-settings-holder .drawer').filter((_,el)=>{
                const txt = $(el).text();
                return txt.includes('正则') || txt.toLowerCase().includes('regex');
            }).first();
            if ($regexDrawer.length) {
                $regexDrawer.find('.drawer-icon').first().trigger('click');
                showDrawerInZone3($regexDrawer, $wrap);
                return;
            }
            // 最后回退：打开扩展程序抽屉并定位正则
            const $extDrawer2 = $('#top-settings-holder .drawer').filter((_,el)=> $(el).text().includes('扩展程序')).first();
            if ($extDrawer2.length) {
                $extDrawer2.find('.drawer-icon').first().trigger('click');
                showDrawerInZone3($extDrawer2, $wrap);
                setTimeout(()=>{ $('#regex_container .inline-drawer-toggle').first().trigger('click'); }, 400);
                return;
            }
            toastr.info('正则扩展');
        };
        $wrap.off('click').on('click', openRegexPopup);
        $wrap.find('.fa-magnifying-glass').off('click').on('click', (e)=>{ e.stopPropagation(); openRegexPopup(); });
        // 确保点击输入框也弹出
        $wrap.find('#dc-regex-input').off('click').on('click', (e)=>{ e.stopPropagation(); openRegexPopup(); });
        // 保留原正则过滤逻辑作为回退（当用户输入自定义正则时）
        const $fallbackInput = $('#dc-regex-input');
        $fallbackInput.on('input', ()=>{
            const raw = ($fallbackInput.val() as string) || '';
            if (raw==='正则' || !raw.trim()) { $('#chat .mes').removeClass('regex-hidden regex-match'); $wrap.removeClass('regex-error regex-active'); return; }
            try {
                const re = new RegExp(raw, 'i');
                $wrap.removeClass('regex-error').addClass('regex-active');
                $('#chat .mes').each((_,el)=>{
                    const $m=$(el);
                    const txt=$m.find('.mes_text').text()||$m.text();
                    const match=re.test(txt);
                    $m.toggleClass('regex-hidden', !match);
                    $m.toggleClass('regex-match', match);
                });
            } catch { $wrap.addClass('regex-error'); }
        });
    };
    setTimeout(initRegexSearch, 800);
    // 返回按钮：有3区面板则关闭面板，否则回主页
    $('#dc-top-return').off('click').on('click', ()=>{
        const $host = $('#dc-drawer-host');
        const hasOpen = $host.children(':visible').length > 0 || $host.children().length > 0;
        if (hasOpen) {
            $host.children().hide(); $host.children().detach();
            (window as any)._dcCurrentD=null; (window as any)._dcCurrentTrigger=null;
            $('.dc-vtool.active, .dc-top-icon.active').removeClass('active');
        } else {
            $('.dc-guild-item[data-home]').trigger('click');
        }
    });
    // 确保好友面板初始化（首页无角色时也创建面板）
    const ensureHomeInit = () => {
        if (!$('#dc-home-panel').length) {
            $('#dc-chat-main').append('<div id="dc-home-panel" style="display:none; flex:1; overflow-y:auto; background:var(--dc-chat)"></div>');
        }
        if (window.__dcHome && $('#dc-home-panel').css('display') === 'none') {
            renderChannels();
        }
    };
    setTimeout(ensureHomeInit, 1200);
    if (typeof window.__dcHome !== 'boolean') window.__dcHome = true;
    setTimeout(() => { if (!getCurrentCharacterName()) { $(document).on('click', '.dc-guild-item[data-home]', ()=> renderChannels()); } }, 1500);
    // + 按钮与输入栏重构 P1风格 - 动态收纳所有非原生按钮，移除悬浮球，A/B替换为扩展应用
    const initInputBar = () => {
        const $wrap = $('#dc-input-wrap');
        if (!$wrap.length || $('#dc-plus-btn').length) return;
        $wrap.css({ display:'flex', alignItems:'center', gap:'8px' });
        // 合并原生输入区与自建输入区：让 #form_sheld 占据全宽
        const $sheld = $wrap.find('#form_sheld');
        if ($sheld.length) {
            $sheld.css({ flex:'1', minWidth:'0', width:'auto' });
            $sheld.find('#send_form').css({ height:'44px', minHeight:'44px', maxHeight:'44px' });
            $sheld.find('#send_textarea').css({ minHeight:'44px', padding:'12px 8px' });
        }
        const $plus = $('<div id="dc-plus-btn" title="更多操作">+</div>');
        $wrap.prepend($plus);
        // 动态构建 + 菜单：除上传外，自动收纳所有QR脚本按钮
        const buildPlusMenu = () => {
            let $menu = $('#dc-plus-menu');
            if (!$menu.length) {
                $menu = $('<div id="dc-plus-menu" style="display:none"></div>');
                $('#dc-chat-main').append($menu);
            }
            $menu.empty();
            $menu.append('<div class="dc-plus-item" data-act="upload"><span class="dc-plus-icon">📤</span> 上传文件</div><div class="dc-plus-sep"></div>');
            // 收集所有非原生 QR 按钮
            const seen = new Set();
            $('#qr--bar .qr--button, .qr--buttons .qr--button, #send_form .qr--button').each((_, el)=>{
                const $el = $(el);
                const txt = ($el.text().trim() || $el.attr('title') || '').trim();
                if (!txt || seen.has(txt)) return;
                // 过滤原生上传已单独处理
                if (txt.includes('上传')) return;
                seen.add(txt);
                const icon = txt.length<=2 ? txt : '•';
                const $item = $(`<div class="dc-plus-item" data-qr="1"><span class="dc-plus-icon">${icon}</span> ${txt}</div>`);
                $item.on('click', ()=>{ (el as HTMLElement).click(); $menu.hide(); });
                $menu.append($item);
            });
            // 若无QR按钮，回退到基础格式化项
            if (seen.size===0) {
                const fallback = [
                    {icon:'**', txt:'加粗文本', act:'**加粗文本**'},
                    {icon:'""', txt:'引用文本', act:'""'},
                    {icon:'{}', txt:'插入变量', act:'{{}}'},
                    {icon:'「」', txt:'插入日文括号', act:'「」'},
                    {icon:'『』', txt:'插入书名号', act:'『』'},
                    {icon:'()', txt:'插入括号', act:'()'},
                    {icon:'✏️', txt:'插入 {{user}}', act:'{{user}}'},
                    {icon:'🎭', txt:'插入 {{char}}', act:'{{char}}'},
                ];
                fallback.forEach(f=>{
                    const $it = $(`<div class="dc-plus-item" data-act="${f.act}"><span class="dc-plus-icon">${f.icon}</span> ${f.txt}</div>`);
                    $it.on('click', ()=>{ const ta=document.querySelector('#send_textarea') as HTMLTextAreaElement; if(ta){ const s=ta.selectionStart||0; const e=ta.selectionEnd||0; ta.value=ta.value.slice(0,s)+f.act+ta.value.slice(e); ta.selectionStart=ta.selectionEnd=s+f.act.length; ta.focus(); ta.dispatchEvent(new Event('input',{bubbles:true})); } $menu.hide(); });
                    $menu.append($it);
                });
            }
        };
        buildPlusMenu();
        const insertAtCursor = (txt:string) => {
            const ta = document.querySelector('#send_textarea') as HTMLTextAreaElement;
            if (!ta) return;
            const start = ta.selectionStart || 0;
            const end = ta.selectionEnd || 0;
            const val = ta.value;
            ta.value = val.slice(0, start) + txt + val.slice(end);
            ta.selectionStart = ta.selectionEnd = start + txt.length;
            ta.focus();
            ta.dispatchEvent(new Event('input', {bubbles:true}));
        };
        $plus.on('click', (e) => {
            e.stopPropagation();
            buildPlusMenu();
            const $menu = $('#dc-plus-menu');
            $menu.toggle();
            $menu.css({ left: '8px', right: 'auto' });
            $('.discord-extra-menu').hide();
        });
        $('#dc-plus-menu').on('click', '.dc-plus-item[data-act="upload"]', ()=>{ $('#file_form_input').trigger('click'); $('#dc-plus-menu').hide(); });
        $(document).on('click', (e) => { if (!$(e.target).closest('#dc-plus-btn, #dc-plus-menu').length) $('#dc-plus-menu').hide(); });
        // 右侧发送与扩展按钮：用扩展应用及其左侧圆形按钮替换 A/B
        // 删除蓝色发送按钮，使用原生发送按钮，并将输入区域合并
        $wrap.find('.discord-send-btn').remove();
        let $sendBtn;
        if (!$sendBtn.length) {
            $sendBtn = $('<div class="discord-send-btn" title="发送">↑</div>');
            $wrap.append($sendBtn);
            $sendBtn.on('click', () => $('#send_but').trigger('click'));
        }
        // 已删除左下角扩展应用，按要求不显示 A/B，改为将 + 后的可添加按键优先出现在输入框左侧
        // 隐藏之前的 A/B
        $wrap.find('.discord-extra-btn').remove();
        $('.discord-extra-menu').remove();
        // 将额外的可添加按键优先显示在发送左侧（左下角）
        const extraBtns: HTMLElement[] = [];
        // 收集所有 QR/脚本按钮，即使被隐藏也收纳（除上传）
        $('#qr--bar .qr--button, .qr--buttons .qr--button, #send_form .qr--button, #nonQRFormItems .menu_button').each((_,el)=>{
            const $el=$(el);
            const txt = ($el.text().trim() || $el.attr('title') || '').trim();
            if (!txt || txt.includes('上传')) return;
            if ($el.is('#send_but, #options_button')) return;
            // 去重
            if (extraBtns.some(b=> (b as HTMLElement).innerText===txt)) return;
            extraBtns.push(el as HTMLElement);
        });
        const $sendBtnRef = $wrap.find('.discord-send-btn');
        // 最多显示2个在发送左侧
        extraBtns.slice(0,2).forEach((orig)=>{
            const $clone = $(orig).clone().empty().addClass('discord-extra-btn').css({width:'36px',height:'36px',borderRadius:'8px',background:'#2b2d31',display:'flex',alignItems:'center',justifyContent:'center', flexShrink:'0'});
            const html = $(orig).html() || $(orig).text().slice(0,2) || '•';
            $clone.html(html);
            $clone.attr('title', $(orig).attr('title')||$(orig).text().trim());
            $clone.on('click', (e)=>{ e.stopPropagation(); (orig as HTMLElement).click(); });
            if ($sendBtnRef.length) $sendBtnRef.before($clone);
            else $wrap.append($clone);
        });

        $('.dc-input-icons').hide();
        // 隐藏 FileSize 相关
        $('#file_form .file_attached, #file_form .file_size, #file_form .file_name').hide();
    };
    setTimeout(initInputBar, 900);
    setTimeout(initInputBar, 2500);
    // 用户面板状态在线绿点与图标交互
    // 麦克风→TTS内置扩展（未运行时红色关闭态），耳机→Quick Replies
    function findTtsDrawer() {
        return $('#top-settings-holder .drawer').filter((_,el)=> {
            const t=$(el).text();
            return t.includes('TTS') || t.includes('tts') || t.includes('语音合成');
        }).first();
    }
    function findQrDrawer() {
        return $('#top-settings-holder .drawer').filter((_,el)=> {
            const t=$(el).text();
            return t.includes('快速回复') || t.includes('Quick Replies') || t.includes('Quick');
        }).first();
    }
    const setMicState = () => {
        const $mic = $('.user-panel-icon-btn.fa-microphone');
        const ttsDrawer = findTtsDrawer();
        const running = ttsDrawer.length > 0 && ttsDrawer.find('.drawer-content').is(':visible');
        if (running) { $mic.css('color', '#23a55a'); $mic.removeClass('muted').attr('title','TTS：运行中'); }
        else { $mic.css('color', '#ed4245'); $mic.addClass('muted').attr('title','TTS：未运行（点击打开）'); }
    };
    setMicState();
    setInterval(setMicState, 3000);
    $(document).on('click', '.user-panel-icon-btn.fa-microphone', function(e){
        e.stopPropagation();
        const tts = findTtsDrawer();
        if (!tts.length) { toastr.info('未找到TTS扩展'); return; }
        const wasOpen = $('.dc-vtool[data-drawer*="TTS"]').hasClass('active') || tts.find('.drawer-content').is(':visible');
        if (wasOpen) { $('#dc-drawer-host').children().hide(); tts.find('.drawer-content').hide(); (window as any)._dcCurrentD=null; (window as any)._dcCurrentTrigger=null; $('.dc-vtool.active,.dc-top-icon.active').removeClass('active'); toastr.info('TTS已关闭'); }
        else {
            tts.find('.drawer-icon').first().trigger('click');
            const $v = $(`<div class="dc-vtool" style="display:none"><i class="fa-solid fa-volume-high"></i><span>TTS</span></div>`);
            showDrawerInZone3(tts, $v);
        }
        setTimeout(setMicState, 300);
    });
    $(document).on('click', '.user-panel-icon-btn.fa-headphones', function(e){
        e.stopPropagation();
        const qr = findQrDrawer();
        if (!qr.length) { toastr.info('未找到Quick Replies扩展'); return; }
        qr.find('.drawer-icon').first().trigger('click');
        const $v = $(`<div class="dc-vtool" style="display:none"><i class="fa-solid fa-bolt"></i><span>快速回复</span></div>`);
        if (qr.find('.drawer-content').is(':visible')) { $('#dc-drawer-host').children().hide(); qr.find('.drawer-content').hide(); }
        else showDrawerInZone3(qr, $v);
    });
}
function ensureDrawerHost() {
    if ($('#dc-drawer-host').length) return $('#dc-drawer-host');
    const $host = $('<div id="dc-drawer-host"></div>');
    $('#dc-chat-main').css('position','relative');
    $('#dc-chat-main').append($host);
    return $host;
}
function showDrawerInZone3($d, $trigger) {
    const $host = ensureDrawerHost();
    if ($host.find('#regex_container').length) { $host.children().hide().detach(); (window as any)._dcCurrentD=null; }
    let $content = $d.find('.drawer-content').first();
    if (!$content.length) $content = $host.children().filter((_,el)=> $(el).data('dc-owner')=== $d[0]);
    if (!$content.length) return;
    const isSame = $trigger.hasClass('active') && (window as any)._dcCurrentD === $d[0];
    $host.children().hide().each((_,el)=>{ const $c=$(el); const owner=$c.data('dc-owner'); if(owner) $(owner).append($c); });
    $('.dc-vtool.active, .dc-top-icon.active').removeClass('active');
    if (isSame) {
        $content.hide();
        (window as any)._dcCurrentD=null; (window as any)._dcCurrentTrigger=null;
        return;
    }
    (window as any)._dcCurrentD=$d[0]; (window as any)._dcCurrentTrigger=$trigger[0];
    $content.data('dc-owner', $d[0]);
    $content.css({ position: 'absolute', inset: '48px 16px 16px 16px', width: 'auto', maxWidth: '760px', margin: '0 auto', maxHeight: 'none', height: 'calc(100% - 64px)', overflowY: 'auto', zIndex: '20', background: 'var(--dc-chat)', border: '1px solid #2b2d31', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'block', color: 'var(--dc-text)' });
    $host.append($content).show();
    $trigger.addClass('active');
    $content.find('.inline-drawer-content, .flex-container, .text_pole, select, input').css({ background: '#2b2d31', color: '#dbdee1', borderColor: '#3f4147' });
    const close = (ev) => {
        if ($(ev.target).closest($content).length || $(ev.target).closest($trigger).length) return;
        $content.hide(); (window as any)._dcCurrentD=null; (window as any)._dcCurrentTrigger=null;
        $trigger.removeClass('active');
        $(document).off('click', close);
    };
    setTimeout(()=> $(document).on('click', close), 50);
    $content.find('.fa-circle-xmark, .floating_panel_close, [data-close]').off('click.dc').on('click.dc', ()=> { $content.hide(); (window as any)._dcCurrentD=null; (window as any)._dcCurrentTrigger=null; $trigger.removeClass('active'); $(document).off('click', close); });
}
function buildToolbarFromExisting() {
    const $holder = $('#top-settings-holder');
    if (!$holder.length)
        return;
    const $vertical = $('#dc-toolbar-vertical');
    const $topActions = $('#dc-top-actions');
    const $search = $('#dc-top-search');
    $vertical.empty();
    $topActions.empty();
    $holder.css({ position: 'fixed', left: '-9999px', top: '0', opacity: '0', pointerEvents: 'none', width: '0', height: '0', overflow: 'hidden' });
    const allowTopKeywords = ['世界书', 'API', '连接'];
    const denyVerticalKeywords = ['世界书', 'API', '连接', '用户设置', '用户设定管理', 'Persona', '人设', '角色管理'];
    $holder.find('.drawer').each((_, el) => {
        const $d = $(el);
        const $icon = $d.find('.drawer-icon').first();
        const title = ($icon.attr('title') || $icon.attr('data-i18n') || $d.find('.drawer-header').text().trim() || '设置').trim();
        const fa = $icon.attr('class')?.match(/fa-[a-z-]+/g)?.join(' ') || 'fa-solid fa-gear';
        const isTopAllowed = allowTopKeywords.some(k => title.includes(k));
        const isVerticalDenied = denyVerticalKeywords.some(k => title.includes(k));
        if (isTopAllowed) {
            const $t = $(`<div class="dc-top-icon" title="${escapeHtml(title)}"><i class="${fa}"></i></div>`);
            $t.on('click', () => {
                $icon.trigger('click');
                showDrawerInZone3($d, $t);
            });
            $topActions.append($t);
        }
        if ($search.length && !$search.closest('#dc-top-toolbar-custom').length) $('#dc-top-toolbar-custom').append($search);
        if (isVerticalDenied)
            return;
        const $v = $(`<div class="dc-vtool" data-drawer="${escapeHtml(title)}"><i class="${fa}"></i><span>${escapeHtml(title)}</span></div>`);
        $v.on('click', () => {
            $icon.trigger('click');
            showDrawerInZone3($d, $v);
        });
        $vertical.append($v);
    });
    // 确保 AI响应配置 在 AI回复格式化 上方
    const $vTools = $vertical.children('.dc-vtool');
    const $aiResp = $vTools.filter((_,el)=> $(el).text().includes('AI响应配置') || $(el).text().includes('AI 响应配置'));
    const $aiFormat = $vTools.filter((_,el)=> $(el).text().includes('AI回复格式化') || $(el).text().includes('AI 回复格式化'));
    if ($aiResp.length && $aiFormat.length) {
        $aiResp.insertBefore($aiFormat);
    }
    // 扩展页面拆分内置与已安装（#extensions_settings=内置，#extensions_settings2=已安装）
    const $extDrawer = $('#top-settings-holder .drawer').filter((_,el)=> $(el).text().includes('扩展程序')).first();
    if ($extDrawer.length) {
        const $content = $extDrawer.find('.drawer-content').first();
        if ($content.length && !$content.find('.dc-ext-group-title').length) {
            const $s1 = $content.find('#extensions_settings');
            const $s2 = $content.find('#extensions_settings2');
            if ($s2.length && !$s2.prev('.dc-ext-group-title').length) {
                $s2.before('<h4 class="dc-ext-group-title" style="color:#f2f3f5; margin:16px 0 8px 0; font-size:1em; border-bottom:1px solid #3f4147; padding-bottom:6px">已安装的扩展程序</h4>');
            }
            if ($s1.length && !$s1.prev('.dc-ext-group-title').length) {
                $s1.before('<h4 class="dc-ext-group-title" style="color:#f2f3f5; margin:16px 0 8px 0; font-size:1em; border-bottom:1px solid #3f4147; padding-bottom:6px">内置扩展程序</h4>');
            }
        }
    }
    // 面板互斥：任何抽屉打开时清空其他已只有一个面板（修复叠加悬浮）
    if (!$('#dc-regex-panel').length && $('#dc-drawer-host').children(':visible').length > 1) {
        const keep = $('#dc-drawer-host').children(':visible').last();
        $('#dc-drawer-host').children(':visible').not(keep).hide().detach();
    }
    if ((window as any)._dcObserverSetup) return;
    (window as any)._dcObserverSetup = true;
    const obs = new MutationObserver(_.debounce(() => { buildToolbarFromExisting(); }, 500));
    if ($holder[0])
        obs.observe($holder[0], { childList: true, subtree: true });
}
// ---------- Header / Banner ----------
function updateHeader() {
    const rawName = getCurrentCharacterName();
    const isHome = window.__dcHome || !rawName;
    const name = isHome ? '主页' : (rawName || '主页');
    $('#dc-char-name').html(`${escapeHtml(name)} <i class="fa-solid fa-chevron-down"></i>`);
    $('#dc-current-channel-name').text($('#dc-channel-list .dc-channel.active').text().replace('#', '').trim() || name || '一般');
    const id = getCurrentCharacterIdSafe();
    let avatarFile = '';
    try {
        const ctx = getCtx();
        const ch = ctx?.characters?.[ctx?.characterId];
        avatarFile = ch?.avatar || '';
    }
    catch { }
    if (!avatarFile && id) {
        try {
            avatarFile = id;
        }
        catch { }
    }
    const $img = $('#dc-banner-img');
    const $banner = $('#dc-banner');
    if (isHome) {
        $banner.hide();
        $img.hide();
    }
    else {
        $banner.show();
        if (avatarFile) {
            $img.attr('src', getThumb('avatar', avatarFile)).show();
        }
        else {
            $img.hide();
        }
    }
    // temp button only on home, and home panel visibility + input box only on chat
    if (isHome) {
        $('#dc-create-temp').show();
        $('#dc-home-panel').show();
        $('#dc-chat-container').hide();
        $('#dc-chat-container #chat').hide();
        $('#dc-input-wrap').hide();
    }
    else {
        $('#dc-create-temp').hide();
        $('#dc-home-panel').hide();
        $('#dc-chat-container').show();
        $('#dc-chat-container #chat').show();
        $('#dc-input-wrap').show();
        $('body').addClass('chat-visible');
    }
    if (isHome) $('body').removeClass('chat-visible');
    // hide ampersand for home? ensure channel header still
    updateUserBar();
}
function updateUserBar() {
    const name = getUserName();
    const av = getUserAvatar();
    $('#dc-user-name').text(name);
    $('#dc-user-avatar').attr('src', av);
}
// ---------- Guild bar ----------
function getAllCharacters() {
    let chars = [];
    try {
        const names = typeof getCharacterNames === 'function' ? getCharacterNames()() : [];
        const ids = typeof getCharacterIds === 'function' ? getCharacterIds()() : [];
        if (names?.length) {
            const ctx = getCtx();
            chars = names.map((n, i) => { const c = ctx?.characters?.find((x) => x?.data?.name === n) || {}; return { name: n, avatar: ids[i] || c.avatar || '', raw: c, id: ids[i] }; });
        }
    }
    catch { }
    if (!chars.length) {
        try {
            const ctx = getCtx();
            if (ctx?.characters?.length)
                chars = ctx.characters.map((c) => ({ name: c?.data?.name || c?.name, avatar: c?.avatar, raw: c, id: c?.avatar }));
        }
        catch { }
    }
    if (!chars.length) {
        const dom = Array.from(document.querySelectorAll('#rm_print_characters_block .character_select')).map((el) => ({ name: el.querySelector('.ch_name')?.textContent?.trim() || '', avatar: el.querySelector('img')?.getAttribute('src') || '', raw: { data: { name: el.querySelector('.ch_name')?.textContent?.trim() || '' } }, id: '' }));
        if (dom.length)
            chars = dom;
    }
    return chars;
}

(window as any).openCharacterCard = function(name:string){
    try {
        // 尝试通过 guild 项触发
        const $g = $(`.dc-guild-item[data-char="${name}"]`);
        if ($g.length) { $g.trigger('click'); return; }
        // 尝试通过 ST 原生选择
        const chars = getAllCharacters();
        const found = chars.find(c=>c.name===name);
        if (found) {
            // 触发角色选择
            const idx = chars.indexOf(found);
            try { (window as any).selectCharacter?.(idx); } catch {}
            try { $(`#rm_print_characters_block .character_select`).eq(idx).trigger('click'); } catch {}
            // 打开角色卡弹窗
            $('#dc-char-modal').removeClass('hidden');
            try { $(".character_select").each((_,el)=>{ if($(el).find('.ch_name').text().trim()===name) $(el).trigger('click'); }); } catch{}
            updateHeader();
        } else {
            toastr.info('未找到角色: '+name);
        }
    } catch(e){ console.warn(e); }
}

function renderGuildBar() {
    const $bar = $('#dc-guild-bar');
    if (!$bar.length)
        return;
    const chars = getAllCharacters();
    let order = [];
    try {
        order = JSON.parse(localStorage.getItem(DC_ORDER_KEY) || '[]');
    }
    catch { }
    const nameToChar = new Map(chars.map((c) => [c.name, c]));
    let sorted;
    if (order.length) {
        sorted = order.map(n => nameToChar.get(n)).filter(Boolean);
        const missing = chars.filter(c => !order.includes(c.name));
        sorted = [...missing.reverse(), ...sorted];
    }
    else
        sorted = [...chars].reverse();
    $bar.empty();
    $bar.append(`<div class="dc-guild-item" data-home="1" title="主页"><div class="dc-guild-pill"></div><div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#313338;color:white"><i class="fa-solid fa-house"></i></div></div><div class="dc-guild-sep"></div>`);
    // Home click: force home state (no character)
    $bar.find('[data-home]').on('click', () => {
        window.__dcHome = true;
        $('.dc-guild-item').removeClass('active');
        $bar.find('[data-home]').addClass('active');
        updateHeader();
        renderChannels();
        // Optionally clear chat view to home welcome
        // Discord @me 风格主页：显示好友/添加好友
        // 确保 home 面板存在且独立于 #chat，避免悬浮
        if (!$('#dc-home-panel').length) {
            $('#dc-chat-main').append('<div id="dc-home-panel" style="display:none; flex:1; overflow-y:auto; background:var(--dc-chat)"></div>');
        }
        const $homePanel = $('#dc-home-panel');
        const $chat = $('#dc-chat-container');
        const $innerChat = $('#dc-chat-container #chat');
        // 切换显示：home 时显示 homePanel，隐藏 chat 容器；非 home 时相反，避免文字悬浮
        if (window.__dcHome) {
            $innerChat.hide();
            $chat.hide();
            $homePanel.show();
            $homePanel.css({display:'flex', flexDirection:'column'});
            $homePanel.html(`
<div style="padding:0; display:flex; flex-direction:column; gap:0; color:#b5bac1; width:100%; box-sizing:border-box; min-height:100%">
  <div style="display:flex; align-items:center; gap:12px; border-bottom:1px solid #1f2124; padding:12px 16px; background:#313338; flex-shrink:0">
    <h2 style="color:white; margin:0; font-size:16px; font-weight:700">好友</h2>
    <div style="width:1px; height:24px; background:#3f4147"></div>
    <button id="dc-add-friend-tab" style="background:#5865f2; color:white; border:none; border-radius:4px; padding:6px 12px; cursor:pointer; font-size:14px; font-weight:500">添加好友</button>
    <button id="dc-create-group-tab" style="background:#2b2d31; color:#b5bac1; border:none; border-radius:4px; padding:6px 12px; cursor:pointer; font-size:14px">创建群组私信</button>
  </div>
  <div style="padding:16px; display:flex; flex-direction:column; gap:16px; flex:1; overflow-y:auto">
    <div style="background:#2b2d31; border-radius:8px; padding:20px; border:1px solid #3f4147">
      <h3 style="color:white; margin:0 0 12px 0; font-size:16px; font-weight:600">添加好友</h3>
      <div style="display:flex; gap:8px; align-items:center">
        <input id="dc-add-friend-url" placeholder="输入URL" style="flex:1; background:#1e1f22; border:1px solid #3f4147; border-radius:4px; padding:10px 12px; color:#dbdee1; font-size:14px; outline:none" />
        <button id="dc-add-friend-btn" style="background:#5865f2; color:white; border:none; border-radius:4px; padding:10px 16px; cursor:pointer; font-weight:500; white-space:nowrap">添加角色卡</button>
      </div>
    </div>
    <div style="background:#2b2d31; border-radius:8px; padding:16px; border:1px solid #3f4147">
      <h4 style="color:white; margin:0 0 8px 0; font-size:14px; font-weight:600">其他方式导入</h4>
      <p style="color:#949ba4; font-size:13px; margin:0 0 12px 0">没有要添加的好友？尝试其他导入方式。</p>
      <button id="dc-import-local" style="background:#2b2d31; border:1px solid #3f4147; color:#dbdee1; border-radius:4px; padding:8px 16px; cursor:pointer; display:flex; align-items:center; gap:8px"><span>🖼️</span> 拉取本地图片导入角色卡</button>
      <input type="file" id="dc-local-file" accept="image/png,image/jpeg,image/webp" style="display:none" />
    </div>
  </div>
</div>`);
        } else {
            $homePanel.hide();
            $chat.show();
            $innerChat.show();
            $chat.css({display:'flex'});
        }
        // 绑定添加好友/群聊功能
        setTimeout(()=>{
            $('#dc-add-friend-btn').off('click').on('click', async ()=>{
                const url = ($('#dc-add-friend-url').val() as string)?.trim();
                if (!url) { toastr.warning('请输入URL'); return; }
                try {
                    // 尝试通过酒馆导入
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const file = new File([blob], 'character.png', {type: blob.type});
                    const form = new FormData();
                    form.append('avatar', file);
                    const importRes = await fetch('/api/characters/import', {method:'POST', body: form});
                    if (importRes.ok) {
                        const data = await importRes.json();
                        toastr.success('已导入角色卡');
                        // 跳转到角色卡
                        const name = data.file_name?.replace('.png','') || url.split('/').pop() || '新角色';
                        setTimeout(()=> openCharacterCard(name), 500);
                    } else {
                        toastr.error('导入失败');
                    }
                } catch(e){ toastr.error('导入失败: '+e); }
            });
            $('#dc-import-local').off('click').on('click', ()=> $('#dc-local-file').trigger('click'));
            $('#dc-local-file').off('change').on('change', async (e)=>{
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const form = new FormData();
                form.append('avatar', file);
                try {
                    const res = await fetch('/api/characters/import', {method:'POST', body: form});
                    if (res.ok) {
                        const data = await res.json();
                        toastr.success('已导入');
                        const name = data.file_name?.replace('.png','') || file.name.replace('.png','');
                        setTimeout(()=> openCharacterCard(name), 500);
                    } else toastr.error('导入失败');
                } catch(e){ toastr.error('导入失败'); }
            });
            $('#dc-create-group-tab').off('click').on('click', ()=>{
                // 直接触发酒馆原生“创建新群聊”按钮（角色管理页顶部工具栏 #rm_button_group_chats）
                const nativeGroup = document.querySelector('#rm_button_group_chats') as HTMLElement;
                if (nativeGroup) {
                    nativeGroup.click();
                    // 将弹出的群聊管理页移动到3区
                    setTimeout(()=>{
                        const $groupPanel = $('#rm_group_chats_block, #rm_group_chats_popup');
                        if ($groupPanel.length) {
                            const $host = ensureDrawerHost();
                            $groupPanel.css({position:'absolute', inset:'48px 16px 16px 16px', width:'auto', maxWidth:'760px', margin:'0 auto', height:'calc(100% - 64px)', overflowY:'auto', zIndex:'20', background:'var(--dc-chat)', border:'1px solid #2b2d31', borderRadius:'8px', boxShadow:'0 8px 24px rgba(0,0,0,0.4)', display:'block', color:'var(--dc-text)'});
                            $host.append($groupPanel);
                            $groupPanel.find('input, select, textarea').css({background:'#2b2d31', color:'#dbdee1', borderColor:'#3f4147'});
                        }
                    }, 300);
                    return;
                }
                // 次要回退：查找创建群组相关按钮
                const fallbackSelectors = ['[title="创建新群聊"]', '[title="创建群组"]', '.rm_button_group_chats'];
                for (const sel of fallbackSelectors) {
                    const el = document.querySelector(sel) as HTMLElement;
                    if (el) { el.click(); return; }
                }
                toastr.info('创建新群聊');
            });
        }, 300);

        $('#dc-current-channel-name').text('主页');
    }).on('mouseenter', (e) => {
        const tip = $('#dc-tooltip');
        tip.text('主页').addClass('show');
        const r = e.currentTarget.getBoundingClientRect();
        tip.css({ left: (r.right + 10) + 'px', top: (r.top + r.height / 2 - tip.outerHeight() / 2) + 'px' });
    }).on('mouseleave', () => $('#dc-tooltip').removeClass('show'));
    const curName = window.__dcHome ? null : getCurrentCharacterName();
    sorted.forEach((ch) => {
        const name = ch.name || '未知';
        const avatar = ch.avatar || ch.raw?.avatar || '';
        const thumb = avatar && (avatar.startsWith('http') || avatar.startsWith('data:')) ? avatar : (avatar ? getThumb('avatar', avatar) : './img/ai2.png');
        const active = name === curName ? ' active' : '';
        const el = $(`<div class="dc-guild-item${active}" data-char="${escapeHtml(name)}" title="${escapeHtml(name)}"><div class="dc-guild-pill"></div><img src="${thumb}" alt="${escapeHtml(name)}" loading="lazy"></div>`);
        // tooltip
        el.on('mouseenter', (e) => {
            const tip = $('#dc-tooltip');
            tip.text(name).addClass('show');
            const r = el[0].getBoundingClientRect();
            tip.css({ left: (r.right + 10) + 'px', top: (r.top + r.height / 2 - tip.outerHeight() / 2) + 'px' });
        }).on('mouseleave', () => $('#dc-tooltip').removeClass('show'))
            // click
            .on('click', async () => {
            window.__dcHome = false;
        $('#dc-home-panel').hide(); $('#dc-chat-container').show(); $('#dc-chat-container #chat').show();
            try {
                // find index
                let idx = -1;
                try {
                    const names = getCharacterNames();
                    idx = names.indexOf(name);
                }
                catch { }
                if (idx >= 0 && SillyTavern?.selectCharacterById)
                    await SillyTavern.selectCharacterById(idx);
                else {
                    // fallback DOM click
                    const nodes = document.querySelectorAll('#rm_print_characters_block .character_select');
                    for (const n of Array.from(nodes)) {
                        if (n.textContent?.includes(name)) {
                            n.click();
                            break;
                        }
                    }
                    if (typeof window.selectCharacterById === 'function')
                        await window.selectCharacterById(idx);
                }
            }
            catch (e) {
                warn(e);
            }
            setTimeout(() => { updateHeader(); renderGuildBar(); renderChannels(); buildDropdown(); }, 400);
        });
        // drag support via jqueryui sortable already handles; also long-press custom
        $bar.append(el);
    });
    $bar.append(`<div class="dc-guild-add" title="导入角色"><i class="fa-solid fa-plus"></i></div>`);
    $bar.find('.dc-guild-add').on('click', () => document.querySelector('.external_import_button')?.click());
    // sortable with 500ms delay per spec (dragstart delay)
    try {
        const $jqBar = $bar;
        if ($jqBar.sortable) {
            if ($jqBar.data('ui-sortable'))
                $jqBar.sortable('destroy');
            $jqBar.sortable({
                items: '.dc-guild-item[data-char]',
                axis: 'y',
                delay: 500,
                distance: 6,
                tolerance: 'pointer',
                placeholder: 'dc-guild-item',
                start: (_, ui) => { ui.placeholder.css({ visibility: 'visible', background: '#2b2d31', border: '2px dashed #5865f2' }); },
                stop: () => {
                    const newOrder = $bar.find('.dc-guild-item[data-char]').map((_, el) => el.getAttribute('data-char')).get();
                    localStorage.setItem(DC_ORDER_KEY, JSON.stringify(newOrder));
                }
            });
        }
    }
    catch (e) {
        warn('sortable', e);
    }
}
// ---------- Chat channels ----------
async function fetchChatFilesForCurrent() {
    const ctx = getCtx();
    const curName = getCurrentCharacterName();
    let avatarFile = '';
    try {
        const chIdx = ctx?.characters?.findIndex((c) => c?.data?.name === curName);
        if (chIdx >= 0)
            avatarFile = ctx.characters[chIdx]?.avatar;
    }
    catch { }
    // Try helper getChatHistoryBrief if existed (some TH versions)
    try {
        const fn = window.getChatHistoryBrief;
        if (typeof fn === 'function') {
            const r = await fn(curName);
            if (Array.isArray(r) && r.length)
                return r.map((x) => x.file_name || x.fileName || x.name).filter(Boolean);
        }
    }
    catch { }
    // Try SillyTavern API
    try {
        const headers = getCtx().getRequestHeaders() || { 'Content-Type': 'application/json' };
        // ST endpoint: /api/characters/chats — inspect via fetch attempt
        const res = await fetch('/api/characters/chats', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar_url: avatarFile }) });
        if (res.ok) {
            const data = await res.json(); // data may be { chats: [] } or []
            if (Array.isArray(data))
                return data.map((x) => x.file_name || x.fileName || x).filter(Boolean);
            if (data?.chats && Array.isArray(data.chats))
                return data.chats.map((x) => x.file_name || x.fileName || x).filter(Boolean);
        }
    }
    catch (e) { /* ignore */ }
    // Try alternative endpoint /api/chats/get ?
    try {
        const res2 = await fetch('/api/chats/search', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(getCtx().getRequestHeaders() || {}) }, body: JSON.stringify({ avatar_url: avatarFile, search: '' }) });
        if (res2.ok) {
            const d = await res2.json();
            if (Array.isArray(d?.chats))
                return d.chats.map((x) => x.file_name || x.fileName);
        }
    }
    catch { }
    // Fallback DOM scrape from SillyTavern's chat history drawer: open it programmatically to populate
    try {
        // Try to locate existing chat list in DOM under #select_chat_block or similar hidden panel
        const candidates = [
            '#select_chat_block .chat_history_item',
            '#select_chat_popup .PastChat_history_item',
            '.select_chat_block .chat-item',
            '[data-file_name]',
            '.chat_file_name'
        ];
        for (const sel of candidates) {
            const els = document.querySelectorAll(sel);
            if (els.length) {
                const files = Array.from(els).map((el) => el.getAttribute('data-file') || el.getAttribute('file_name') || el.textContent?.trim()).filter(Boolean);
                if (files.length)
                    return files.map(f => f.endsWith('.jsonl') ? f : f + '.jsonl');
            }
        }
        // Last resort: chatMetadata keys
        const meta = ctx?.chatMetadata || {};
        // chatId is current file
        const curChat = ctx?.chatId || ctx?.currentChatId || SillyTavern?.chatId;
        if (curChat)
            return [curChat];
    }
    catch { }
    return [];
}
async function renderChannels() {
    const $list = $('#dc-channel-list');
    if (!$list.length)
        return;
    $list.empty();
    // Ensure temp chat button is pinned already
    const files = await fetchChatFilesForCurrent();
    const ctx = getCtx();
    const curChatId = ctx?.chatId || ctx?.chatMetadata?.chatId || SillyTavern?.chatId || '';
    const isHomeNow = window.__dcHome || !getCurrentCharacterName();
    // Build list; if empty show placeholder (no voice per spec)
    if (isHomeNow) {
        $list.append(`<div class="dc-channel ${$('#dc-current-channel-name').text()==='好友'?'active':''}" data-home-nav="friends"><span style="margin-right:8px">👥</span> 好友</div>`);
        $list.append(`<div class="dc-category" style="display:flex; justify-content:space-between; align-items:center">私信 <span style="cursor:pointer">+</span></div>`);
        // 私信显示最近的聊天：从“显示最近的聊天”按钮处获取
        let recentChats: any[] = [];
        try {
            const btn = document.querySelector('[title="显示最近的聊天"], [data-i18n*="recent"]') as HTMLElement;
            if (btn) btn.click();
            // 尝试从 ST 最近聊天列表获取
            const recentEls = Array.from(document.querySelectorAll('#recent_chats .recent_chat, .recent-chat, #chat_history .chat-item'));
            if (recentEls.length) {
                recentEls.slice(0, 20).forEach((el: HTMLElement)=>{
                    const name = el.textContent?.trim().slice(0,20) || '未知';
                    const av = el.querySelector('img')?.getAttribute('src') || './img/ai2.png';
                    const item = $(`<div class="dc-channel" data-recent="${name}" style="display:flex; align-items:center; gap:8px"><img src="${av}" style="width:32px;height:32px;border-radius:50%;object-fit:cover" /><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</span></div>`);
                    item.on('click', ()=>{ (el as HTMLElement).click(); });
                    $list.append(item);
                });
            } else {
                // 回退：使用 getRecentChats API
                const ctx = (window as any).SillyTavern?.getContext?.();
                const chats = ctx?.recentChats || ctx?.chatHistory || [];
                (chats as any[]).slice(0,20).forEach((c:any)=>{
                    const name = c.name || c.file_name || '未知';
                    const el = $(`<div class="dc-channel" data-recent="${name}" style="display:flex; align-items:center; gap:8px"><span style="width:32px;height:32px;border-radius:50%;background:#5865f2;display:flex;align-items:center;justify-content:center;color:white">💬</span><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</span></div>`);
                    el.on('click', ()=>{ try{ openCharacterCard(name.split(' - ')[0]); }catch{} });
                    $list.append(el);
                });
                if (!(chats as any[]).length) {
                    $list.append(`<div style="padding:12px; color:#949ba4; font-size:13px">暂无最近聊天</div>`);
                }
            }
        } catch(e){
            $list.append(`<div style="padding:12px; color:#949ba4; font-size:13px">暂无最近聊天</div>`);
        }
        $('#dc-current-channel-name').text('好友');
        $list.find('[data-home-nav]').on('click', function(){ $list.find('.dc-channel').removeClass('active'); $(this).addClass('active'); $('#dc-current-channel-name').text($(this).text().trim()); });
        bindNewTemp();
        return;
    }
    if (!files.length) {
        $list.append(`<div class="dc-category">文字频道</div>`);
        $list.append(`<div class="dc-channel active"><span class="dc-hash">#</span><span>一般</span></div>`);
        $('#dc-current-channel-name').text('一般');
        bindNewTemp();
        return;
    }
    $list.append(`<div class="dc-category">文字频道</div>`);
    // Sort: latest first — assume files already latest first; we keep order, but highlight current
    files.forEach((file, idx) => {
        const base = file.replace('.jsonl', '');
        const display = base.length > 20 ? base.slice(0, 20) + '…' : base;
        const isActive = file === curChatId || (idx === 0 && !curChatId);
        const el = $(`<div class="dc-channel ${isActive ? 'active' : ''}" data-file="${escapeHtml(file)}"><span class="dc-hash">#</span><span>${escapeHtml(display)}</span><span class="dc-channel-actions"><i class="fa-solid fa-pen" title="重命名"></i><i class="fa-solid fa-trash" title="删除"></i></span></div>`);
        el.on('click', async (e) => {
            if ($(e.target).is('i'))
                return;
            // 点击聊天记录跳转到角色卡页面
            const baseName = file.split(' - ')[0] || base;
            const charName = baseName.replace('.jsonl','').trim();
            if (charName) {
                openCharacterCard(charName);
                $list.find('.dc-channel').removeClass('active');
                el.addClass('active');
                $('#dc-current-channel-name').text(display);
                return;
            }
            $list.find('.dc-channel').removeClass('active');
            el.addClass('active');
            $('#dc-current-channel-name').text(display);
            await openChatFile(file);
        });
        // rename/delete actions
        el.find('.fa-pen').on('click', async (e) => {
            e.stopPropagation();
            const newName = prompt('重命名聊天文件', base);
            if (!newName || newName === base)
                return;
            try {
                if (SillyTavern?.renameChat)
                    await SillyTavern.renameChat(file, newName.endsWith('.jsonl') ? newName : newName + '.jsonl');
                else
                    await triggerSlash(`/renamechat old="${file}" new="${newName}"`);
                renderChannels();
            }
            catch (err) {
                toastr.error(String(err));
            }
        });
        el.find('.fa-trash').on('click', async (e) => {
            e.stopPropagation();
            if (!confirm(`删除聊天 "${display}" ?`))
                return;
            try {
                // deletion via API or slash
                await triggerSlash(`/delchat file="${file}"`);
                renderChannels();
            }
            catch (err) {
                toastr.error(String(err));
            }
        });
        // right click
        el.on('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, [
                { label: '重命名', action: () => el.find('.fa-pen').trigger('click') },
                { label: '导出', action: async () => { try {
                        await triggerSlash(`/exportchat file="${file}"`);
                    }
                    catch { } } },
                { label: '删除', danger: true, action: () => el.find('.fa-trash').trigger('click') },
            ]);
        });
        $list.append(el);
    });
    // No voice channel per spec; only text channels list all chats
    if (isHomeNow) {
        $list.append(`<button id="dc-new-channel" class="dc-vtool" style="margin:8px 0"><i class="fa-solid fa-plus"></i><span>新建聊天</span></button>`);
        $('#dc-new-channel').on('click', () => createNewChat());
    }
    $('#dc-current-channel-name').text($list.find('.dc-channel.active span').eq(1).text() || files[0]?.replace('.jsonl', '') || (isHomeNow ? '主页' : '一般'));
    bindNewTemp();
}
async function openChatFile(file) {
    try {
        if (SillyTavern?.openCharacterChat) {
            await SillyTavern.openCharacterChat(file);
            return;
        }
        if (SillyTavern?.openGroupChat) { /* not group */ }
        await triggerSlash(`/chat-open file="${file}"`);
    }
    catch (e) {
        warn('openChat', e);
        toastr.info('切换聊天: ' + file);
    }
    // Also attempt direct select via ST's function
    try {
        const ctx = getCtx();
        if (ctx?.characters && window.selectCharacterById) { /* already */ }
    }
    catch { }
    setTimeout(() => renderChannels(), 300);
}
async function createNewChat() {
    try {
        if (window.triggerSlash)
            await window.triggerSlash('/newchat');
        else if (document.querySelector('#option_start_new_chat'))
            document.querySelector('#option_start_new_chat')?.click();
        else if (SillyTavern?.clearChat)
            await SillyTavern.clearChat();
    }
    catch (e) {
        warn(e);
    }
    setTimeout(() => renderChannels(), 600);
}
function bindNewTemp() {
    $('#dc-create-temp').off('click').on('click', createNewChat);
    $('#dc-add-channel').off('click').on('click', createNewChat);
}
async function triggerSlash(cmd) {
    try {
        if (window.triggerSlash)
            return await window.triggerSlash(cmd);
        if (SillyTavern?.SlashCommandParser)
            return await SillyTavern.SlashCommandParser.parse(cmd);
    }
    catch (e) {
        warn('slash', e);
    }
    // fallback via DOM injector
    try {
        const el = document.querySelector('#send_textarea');
        if (el) {
            el.value = cmd;
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        }
    }
    catch { }
}
// ---------- Dropdown P2 ----------
function buildDropdown() {
    const $dd = $('#dc-char-dropdown');
    if (!$dd.length)
        return;
    const cur = getCurrentCharacterName() || '未选择';
    // Compute tokens for current char later async
    $dd.empty();
    const rows = [
        { icon: 'fa-solid fa-image', label: '角色头像 & 基本信息', key: 'avatar', arrow: true },
        { sep: true },
        { icon: 'fa-solid fa-file-lines', label: '角色描述', key: 'desc', arrow: true },
        { icon: 'fa-solid fa-comment', label: '开场白 & 候补开场白', key: 'greeting', arrow: true },
        { icon: 'fa-solid fa-note-sticky', label: '创作者的注释', key: 'creator', arrow: true },
        { icon: 'fa-solid fa-book', label: '角色世界书', key: 'lore', arrow: true },
        { sep: true },
        { icon: 'fa-solid fa-gear', label: '高级定义', key: 'advanced', arrow: true },
        { icon: 'fa-solid fa-tags', label: '标签管理', key: 'tags', arrow: true },
        { icon: 'fa-solid fa-link', label: '外部媒体', key: 'media', arrow: true },
        { sep: true },
    ];
    rows.forEach(r => {
        if (r.sep) {
            $dd.append(`<div class="dc-dd-sep"></div>`);
            return;
        }
        const el = $(`<div class="dc-dd-item" data-key="${r.key}"><span style="display:flex;align-items:center;gap:10px"><i class="dc-dd-icon ${r.icon}"></i><span>${r.label}</span></span><span class="dc-dd-arrow">${r.arrow ? '›' : ''}</span></div>`);
        el.on('click', () => { $('#dc-char-dropdown').addClass('hidden'); $('#dc-sidebar-header').removeClass('open'); openCharModal(r.key); });
        $dd.append(el);
    });
    $dd.append(`<div class="dc-dd-token"><span>Token 统计</span><span id="dc-token-count">计算中…</span></div>`);
    // fav/quick
    $dd.append(`<div class="dc-dd-item alt-hover" data-key="fav"><span style="display:flex;align-items:center;gap:10px"><i class="dc-dd-icon fa-solid fa-star"></i><span>收藏 / 快速切换</span></span><span class="dc-dd-arrow"></span></div>`);
    $dd.find('[data-key="fav"]').on('click', async () => {
        $('#dc-char-dropdown').addClass('hidden');
        // toggle fav
        const name = getCurrentCharacterName();
        if (!name)
            return;
        try {
            const ch = await safeGetCharacter(name);
            const curFav = ch.fav || ch.extensions?.fav || false;
            await safeUpdateCharacter(name, (c) => { c.extensions = c.extensions || {}; c.extensions.fav = !curFav; c.fav = !curFav; return c; });
            toastr.success(curFav ? '已取消收藏' : '已收藏');
        }
        catch (e) {
            warn(e);
        }
    });
    // compute tokens async
    setTimeout(async () => {
        try {
            const txt = await getCurrentCharTokens();
            $('#dc-token-count').text(txt);
        }
        catch {
            $('#dc-token-count').text('—');
        }
    }, 300);
}
// ---------- Char Modal P4 ----------
let currentCharModalTab = 'avatar';
function openCharModal(tab) {
    currentCharModalTab = tab;
    $('#dc-char-modal').removeClass('hidden');
    renderCharModal();
}
function closeCharModal() { $('#dc-char-modal').addClass('hidden'); }
function renderCharModal() {
    const charName = getCurrentCharacterName() || '未选择角色';
    const $left = $('#dc-char-left');
    $left.empty();
    const $rightInner = $('#dc-char-right-inner');
    $rightInner.empty();
    // left nav structure
    const groups = [
        { title: charName, items: [{ key: 'avatar', label: '角色头像 & 基本信息' }, { key: 'desc', label: '角色描述' }, { key: 'greeting', label: '开场白设置' }] },
        { title: '内容设定', items: [{ key: 'creator', label: '创作者的注释' }, { key: 'lore', label: '角色世界书' }, { key: 'tags', label: '标签管理' }] },
        { title: '高级选项', items: [{ key: 'advanced', label: '高级定义' }, { key: 'prompts', label: '提示词覆盖' }, { key: 'meta', label: '创作者的元数据' }, { key: 'media', label: '外部媒体链接' }] },
        { title: '数据', items: [{ key: 'tokens', label: 'Token 统计' }, { key: 'fav', label: '收藏与热键' }] },
    ];
    groups.forEach(g => {
        $left.append(`<div class="dc-nav-title">${escapeHtml(g.title)}</div>`);
        g.items.forEach(it => {
            const active = it.key === currentCharModalTab ? ' active' : '';
            const el = $(`<div class="dc-nav-item${active}" data-tab="${it.key}">${escapeHtml(it.label)}</div>`);
            el.on('click', () => { currentCharModalTab = it.key; renderCharModal(); });
            $left.append(el);
        });
    });
    // right content
    loadCharPanel($rightInner, currentCharModalTab);
}
async function loadCharPanel($wrap, tab) {
    const name = getCurrentCharacterName();
    if (!name) {
        $wrap.html(`<h2>未选择角色</h2><p class="desc">请先在左侧选择一个角色</p>`);
        return;
    }
    let ch = null;
    try {
        ch = await safeGetCharacter(name);
    }
    catch (e) {
        $wrap.html(`<p style="color:#ed4245">读取失败: ${escapeHtml(String(e))}</p>`);
        return;
    }
    // common preview card
    const avatarFile = ch.avatar || ch?.data?.avatar || '';
    const thumb = avatarFile ? getThumb('avatar', String(avatarFile)) : './img/ai2.png';
    // We'll position preview absolutely via CSS maybe, but add inside wrap
    if (['avatar', 'desc', 'greeting'].includes(tab)) {
        // preview card
        const preview = $(`<div class="dc-preview-card"><img src="${thumb}"/><div class="info"><b>${escapeHtml(ch?.data?.name || name)}</b><p>${escapeHtml((ch?.data?.description || '').slice(0, 120))}</p></div></div>`);
        $wrap.css('position', 'relative');
        // Append later
        setTimeout(() => $wrap.append(preview), 50);
    }
    if (tab === 'avatar') {
        $wrap.html(`
      <h2>角色资料</h2><p class="desc">管理头像、名称与基础信息</p>
      <div style="display:flex;gap:16px;align-items:center"><img src="${thumb}" style="width:96px;height:96px;border-radius:12px;object-fit:cover"/><div>
        <div class="dc-field"><label>角色名</label><input class="dc-input" id="dc-edit-name" value="${escapeHtml(ch?.data?.name || name)}"/></div>
        <input type="file" id="dc-avatar-upload" accept="image/*" style="margin-top:8px"/>
      </div></div>
      <div class="dc-field"><label>Token 数</label><div id="dc-avatar-token" style="color:#b5bac1">计算中…</div></div>
      <div class="dc-divider"></div>
      <div style="display:flex;gap:8px"><button class="dc-btn-primary" id="dc-save-avatar">保存更改</button><button class="dc-btn-secondary" id="dc-reset-avatar">重置</button></div>
    `);
        (async () => { try {
            const t = await getTokenCountAsync(ch?.data?.description || '');
            $('#dc-avatar-token').text('描述 Token: ' + t);
        }
        catch { } })();
        $('#dc-save-avatar').on('click', async () => {
            const newName = $('#dc-edit-name').val().trim();
            const fileInput = document.getElementById('dc-avatar-upload');
            try {
                if (fileInput?.files?.[0]) {
                    const blob = fileInput.files[0];
                    const updated = await safeUpdateCharacter(name, async (c) => { c.avatar = blob; if (newName && newName !== name)
                        c.data.name = newName; return c; });
                    toastr.success('头像已更新');
                }
                else if (newName && newName !== name) {
                    await safeUpdateCharacter(name, (c) => { c.data.name = newName; return c; });
                    toastr.success('名称已更新');
                }
                renderGuildBar();
                updateHeader();
                renderCharModal();
            }
            catch (e) {
                toastr.error(String(e));
            }
        });
    }
    else if (tab === 'desc') {
        $wrap.html(`
      <h2>角色描述</h2><p class="desc">定义角色的核心设定，支持大文本编辑</p>
      <div class="dc-field"><label>角色描述</label><textarea class="dc-textarea" id="dc-edit-desc" style="min-height:240px">${escapeHtml(ch?.data?.description || ch?.description || '')}</textarea><div style="color:#949ba4;font-size:11px;margin-top:4px">Token: <span id="dc-desc-token">—</span></div></div>
      <div class="dc-save-bar"><span>有未保存的更改？点击保存</span><div style="display:flex;gap:8px"><button class="dc-btn-secondary" id="dc-desc-reset">重置</button><button class="dc-btn-primary" id="dc-desc-save">保存更改</button></div></div>
    `);
        const updateTok = async () => { try {
            const v = $('#dc-edit-desc').val();
            const t = await SillyTavern.getTokenCountAsync(v);
            $('#dc-desc-token').text(String(t));
        }
        catch { } };
        $('#dc-edit-desc').on('input', _.debounce(updateTok, 300));
        updateTok();
        $('#dc-desc-save').on('click', async () => { try {
            const v = $('#dc-edit-desc').val();
            await safeUpdateCharacter(name, (c) => { c.data.description = v; c.description = v; return c; });
            toastr.success('已保存');
        }
        catch (e) {
            toastr.error(String(e));
        } });
        $('#dc-desc-reset').on('click', () => $('#dc-edit-desc').val(ch?.data?.description || ''));
    }
    else if (tab === 'greeting') {
        const first = ch?.data?.first_mes || ch?.first_mes || '';
        const alts = ch?.data?.alternate_greetings || [];
        $wrap.html(`
      <h2>开场白</h2><p class="desc">主开场白与候补开场白列表</p>
      <div class="dc-field"><label>主开场白</label><textarea class="dc-textarea" id="dc-first">${escapeHtml(first)}</textarea></div>
      <div class="dc-field"><label>候补开场白 (${alts.length})</label><div id="dc-alt-list"></div><button class="dc-btn-secondary" id="dc-add-alt">＋ 添加候补</button></div>
      <div class="dc-save-bar"><span></span><div style="display:flex;gap:8px"><button class="dc-btn-primary" id="dc-greet-save">保存更改</button></div></div>
    `);
        const $altList = $('#dc-alt-list');
        alts.forEach((g, i) => {
            const row = $(`<div style="display:flex;gap:8px;margin:6px 0"><textarea class="dc-textarea" data-idx="${i}" style="flex:1;min-height:80px">${escapeHtml(g)}</textarea><button class="dc-btn-danger" data-del="${i}">删除</button></div>`);
            row.find('[data-del]').on('click', () => row.remove());
            $altList.append(row);
        });
        $('#dc-add-alt').on('click', () => {
            const row = $(`<div style="display:flex;gap:8px;margin:6px 0"><textarea class="dc-textarea" style="flex:1;min-height:80px" placeholder="新的候补开场白"></textarea><button class="dc-btn-danger">删除</button></div>`);
            row.find('button').on('click', () => row.remove());
            $altList.append(row);
        });
        $('#dc-greet-save').on('click', async () => {
            const main = $('#dc-first').val();
            const altsNew = $altList.find('textarea').map((_, el) => $(el).val()).get().filter((s) => s.trim().length > 0);
            try {
                await safeUpdateCharacter(name, (c) => { c.data.first_mes = main; c.first_mes = main; c.data.alternate_greetings = altsNew; return c; });
                toastr.success('开场白已保存');
            }
            catch (e) {
                toastr.error(String(e));
            }
        });
    }
    else if (tab === 'creator') {
        $wrap.html(`
      <h2>创作者注释</h2><p class="desc">仅创作者可见的备注，不会发送给 AI</p>
      <div class="dc-field"><label>Creator Notes</label><textarea class="dc-textarea" id="dc-creator-notes" style="min-height:160px">${escapeHtml(ch?.data?.creator_notes || ch?.creator_notes || '')}</textarea></div>
      <button class="dc-btn-primary" id="dc-creator-save">保存</button>
    `);
        $('#dc-creator-save').on('click', async () => { const v = $('#dc-creator-notes').val(); try {
            await safeUpdateCharacter(name, (c) => { c.data.creator_notes = v; c.creator_notes = v; return c; });
            toastr.success('已保存');
        }
        catch (e) {
            toastr.error(String(e));
        } });
    }
    else if (tab === 'lore') {
        $wrap.html(`<h2>角色世界书</h2><p class="desc">显示该角色绑定的主要世界书内容，来自酒馆本体存储</p><div id="dc-lore-info" style="color:#b5bac1;font-size:13px;margin:8px 0">加载中…</div><div id="dc-lore-list"></div><div style="margin-top:12px;display:flex;gap:8px"><button class="dc-btn-primary" id="dc-lore-new">＋ 新建条目</button><button class="dc-btn-secondary" id="dc-lore-manage">打开世界书编辑器</button></div>`);
        loadLorePanel();
    }
    else if (tab === 'tags') {
        const tags = ch?.data?.tags || ch?.tags || [];
        $wrap.html(`
      <h2>标签</h2><p class="desc">为角色添加标签，便于筛选</p>
      <div class="dc-field"><label>当前标签</label><div id="dc-tags-wrap" style="display:flex;flex-wrap:wrap;gap:6px">${tags.map(t => `<span class="dc-pill">${escapeHtml(t)} <i class="fa-solid fa-xmark" style="cursor:pointer" data-tag="${escapeHtml(t)}"></i></span>`).join('') || '<span style="color:#949ba4">暂无标签</span>'}</div></div>
      <div class="dc-field"><label>添加标签</label><div style="display:flex;gap:8px"><input class="dc-input" id="dc-tag-input" placeholder="输入标签后回车"/><button class="dc-btn-secondary" id="dc-tag-add">添加</button></div></div>
      <button class="dc-btn-primary" id="dc-tag-save">保存标签</button>
    `);
        let curTags = [...tags];
        const refresh = () => { $('#dc-tags-wrap').html(curTags.map(t => `<span class="dc-pill">${escapeHtml(t)} <i class="fa-solid fa-xmark" data-tag="${escapeHtml(t)}" style="cursor:pointer"></i></span>`).join('') || '<span style="color:#949ba4">暂无标签</span>'); $('#dc-tags-wrap [data-tag]').on('click', function () { const tag = $(this).attr('data-tag'); curTags = curTags.filter(x => x !== tag); refresh(); }); };
        refresh();
        $('#dc-tag-add').on('click', () => { const v = $('#dc-tag-input').val().trim(); if (!v)
            return; if (!curTags.includes(v))
            curTags.push(v); $('#dc-tag-input').val(''); refresh(); });
        $('#dc-tag-input').on('keydown', (e) => { if (e.key === 'Enter') {
            e.preventDefault();
            $('#dc-tag-add').trigger('click');
        } });
        $('#dc-tag-save').on('click', async () => { try {
            await safeUpdateCharacter(name, (c) => { c.data.tags = curTags; c.tags = curTags; return c; });
            toastr.success('标签已保存');
        }
        catch (e) {
            toastr.error(String(e));
        } });
    }
    else if (tab === 'advanced' || tab === 'prompts' || tab === 'meta' || tab === 'media') {
        await renderAdvancedPanel($wrap, ch, tab);
    }
    else if (tab === 'tokens') {
        $wrap.html(`<h2>Token 统计</h2><p class="desc">各字段 Token 分布</p><div id="dc-token-detail" style="color:#b5bac1">统计中…</div>`);
        try {
            const fields = {
                '角色描述': ch?.data?.description || '',
                '人格': ch?.data?.personality || '',
                '情景': ch?.data?.scenario || '',
                '开场白': ch?.data?.first_mes || '',
                '示例消息': ch?.data?.mes_example || '',
                '创作者注释': ch?.data?.creator_notes || '',
            };
            let total = 0;
            let html = '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">';
            for (const [k, v] of Object.entries(fields)) {
                const t = await SillyTavern.getTokenCountAsync(v);
                total += t;
                html += `<div style="display:flex;justify-content:space-between;background:#2b2d31;padding:8px 10px;border-radius:4px"><span>${k}</span><b>${t}</b></div>`;
            }
            html += `</div><div style="margin-top:12px;color:white;font-weight:700">总计: ${total} Tokens</div>`;
            $('#dc-token-detail').html(html);
        }
        catch (e) {
            $('#dc-token-detail').text('统计失败: ' + String(e));
        }
    }
    else if (tab === 'fav') {
        const isFav = !!(ch?.data?.extensions?.fav || ch.fav);
        $wrap.html(`
      <h2>收藏与热键</h2><p class="desc">快速切换与收藏</p>
      <div style="display:flex;gap:12px;align-items:center;margin:16px 0"><button class="dc-btn-primary" id="dc-toggle-fav">${isFav ? '★ 已收藏' : '☆ 收藏角色'}</button><span style="color:#b5bac1">收藏后会置顶显示</span></div>
    `);
        $('#dc-toggle-fav').on('click', async () => { try {
            await safeUpdateCharacter(name, (c) => { c.extensions = c.extensions || {}; c.extensions.fav = !isFav; c.fav = !isFav; return c; });
            toastr.success('已切换');
            renderCharModal();
        }
        catch (e) {
            toastr.error(String(e));
        } });
    }
}
async function renderAdvancedPanel($wrap, ch, tab) {
    const personality = ch?.data?.personality || '';
    const scenario = ch?.data?.scenario || '';
    const mesExample = ch?.data?.mes_example || '';
    const systemPrompt = ch?.data?.system_prompt || '';
    const postHistory = ch?.data?.post_history_instructions || '';
    const creator = ch?.data?.creator || '';
    const charVersion = ch?.data?.character_version || '';
    const extensions = ch?.data?.extensions || {};
    if (tab === 'advanced') {
        $wrap.html(`
      <h2>高级定义</h2><p class="desc">角色设定摘要、情景等高级字段</p>
      <div class="dc-accordion">
        <div class="dc-acc-head" data-acc="prompt_over">提示词覆盖 <span class="sub">用于聊天补全和格式指引模式</span> <span style="color:#b5bac1">▼</span></div>
        <div class="dc-acc-body" id="dc-acc-prompt_over">
          <div class="dc-field"><label>System Prompt</label><textarea class="dc-textarea" id="dc-system-prompt">${escapeHtml(systemPrompt)}</textarea></div>
          <div class="dc-field"><label>Post History Instructions</label><textarea class="dc-textarea" id="dc-post-history">${escapeHtml(postHistory)}</textarea></div>
        </div>
      </div>
      <div class="dc-accordion">
        <div class="dc-acc-head" data-acc="creator_meta2">创作者的元数据 <span class="sub">不与AI提示词一起发送</span> <span style="color:#b5bac1">▼</span></div>
        <div class="dc-acc-body" id="dc-acc-creator_meta2">
          <div class="dc-field"><label>Creator</label><input class="dc-input" id="dc-creator" value="${escapeHtml(creator)}"/></div>
          <div class="dc-field"><label>Character Version</label><input class="dc-input" id="dc-version" value="${escapeHtml(charVersion)}"/></div>
        </div>
      </div>
      <div class="dc-field"><label>角色设定摘要 <span title="personality">?</span></label><textarea class="dc-textarea" id="dc-personality">${escapeHtml(personality)}</textarea><div style="color:#949ba4;font-size:11px">Token: <span id="dc-pers-tok">—</span></div></div>
      <div class="dc-field"><label>情景 <span title="scenario">?</span></label><textarea class="dc-textarea" id="dc-scenario">${escapeHtml(scenario)}</textarea></div>
      <div class="dc-field"><label>示例消息</label><textarea class="dc-textarea" id="dc-mes-example" style="min-height:160px">${escapeHtml(mesExample)}</textarea></div>
      <button class="dc-btn-primary" id="dc-advanced-save">保存更改</button>
    `);
        $wrap.find('[data-acc]').on('click', function () { const id = $(this).attr('data-acc'); $(`#dc-acc-${id}`).toggleClass('open'); });
        $('#dc-advanced-save').on('click', async () => {
            const upd = {
                personality: $('#dc-personality').val(),
                scenario: $('#dc-scenario').val(),
                mes_example: $('#dc-mes-example').val(),
                system_prompt: $('#dc-system-prompt').val(),
                post_history_instructions: $('#dc-post-history').val(),
                creator: $('#dc-creator').val(),
                character_version: $('#dc-version').val(),
            };
            try {
                await safeUpdateCharacter(getCurrentCharacterName(), (c) => { c.data.personality = upd.personality; c.data.scenario = upd.scenario; c.data.mes_example = upd.mes_example; c.data.system_prompt = upd.system_prompt; c.data.post_history_instructions = upd.post_history_instructions; c.data.creator = upd.creator; c.data.character_version = upd.character_version; return c; });
                toastr.success('高级定义已保存');
            }
            catch (e) {
                toastr.error(String(e));
            }
        });
    }
    else if (tab === 'prompts') {
        $wrap.html(`<h2>提示词覆盖</h2><p class="desc">扩展提示词相关设置</p>
      <div class="dc-field"><label>System Prompt</label><textarea class="dc-textarea" id="dc-sys2">${escapeHtml(systemPrompt)}</textarea></div>
      <button class="dc-btn-primary" id="dc-save-prompt">保存</button>
    `);
        $('#dc-save-prompt').on('click', async () => { const v = $('#dc-sys2').val(); try {
            await safeUpdateCharacter(getCurrentCharacterName(), (c) => { c.data.system_prompt = v; return c; });
            toastr.success('已保存');
        }
        catch (e) {
            toastr.error(String(e));
        } });
    }
    else if (tab === 'meta') {
        $wrap.html(`<h2>创作者的元数据</h2><p class="desc">创建者、版本等</p>
      <div class="dc-field"><label>Creator</label><input class="dc-input" id="dc-creator2" value="${escapeHtml(creator)}"/></div>
      <div class="dc-field"><label>Version</label><input class="dc-input" id="dc-ver2" value="${escapeHtml(charVersion)}"/></div>
      <div class="dc-field"><label>Extensions Raw (JSON)</label><textarea class="dc-textarea" style="min-height:140px" id="dc-ext">${escapeHtml(JSON.stringify(extensions, null, 2))}</textarea></div>
      <button class="dc-btn-primary" id="dc-meta-save">保存</button>
    `);
        $('#dc-meta-save').on('click', async () => { try {
            const creatorV = $('#dc-creator2').val();
            const verV = $('#dc-ver2').val();
            await safeUpdateCharacter(getCurrentCharacterName(), (c) => { c.data.creator = creatorV; c.data.character_version = verV; return c; });
            toastr.success('已保存');
        }
        catch (e) {
            toastr.error(String(e));
        } });
    }
    else if (tab === 'media') {
        $wrap.html(`<h2>外部媒体</h2><p class="desc">外部媒体链接（占位）</p><div style="color:#949ba4">当前角色无外部媒体配置，可在扩展中添加。</div>`);
    }
}
async function getCurrentCharTokens() {
    const name = getCurrentCharacterName();
    if (!name)
        return '—';
    try {
        const ch = await safeGetCharacter(name);
        const txt = (ch?.data?.description || '') + (ch?.data?.personality || '') + (ch?.data?.scenario || '');
        const t = await SillyTavern.getTokenCountAsync(txt);
        return String(t);
    }
    catch {
        return '—';
    }
}
// ---------- Worldbook ----------
async function loadLorePanel() {
    const $info = $('#dc-lore-info');
    const $list = $('#dc-lore-list');
    if (!$info.length)
        return;
    const name = getCurrentCharacterName();
    if (!name) {
        $info.text('未选择角色');
        return;
    }
    try {
        const charLore = typeof safeGetCharWorldbookNames === 'function' ? safeGetCharWorldbookNames(name) : { primary: null, additional: [] };
        // Fallback via SillyTavern context
        let primary = charLore?.primary || null;
        let additional = charLore?.additional || [];
        // also try ctx
        try {
            const ctx = getCtx();
            const idx = ctx?.characters?.findIndex((c) => c?.data?.name === name);
            if (idx >= 0) {
                const c = ctx.characters[idx];
                primary = c?.data?.character_book?.name || primary;
            }
        }
        catch { }
        const globals = typeof safeGetGlobalWorldbookNames === 'function' ? safeGetGlobalWorldbookNames() : [];
        const allBooks = Array.from(new Set([primary, ...additional, ...globals].filter(Boolean)));
        if (primary)
            $info.html(`主要世界书: <b style="color:white">${escapeHtml(primary)}</b> ${additional.length ? ` | 附加: ${additional.map(escapeHtml).join(', ')}` : ''} ${globals.length ? ` | 全局: ${globals.map(escapeHtml).join(', ')}` : ''}`);
        else if (allBooks.length)
            $info.html(`世界书: ${allBooks.map(escapeHtml).join(', ')}`);
        else {
            $info.text('该角色未绑定世界书，显示全局可用世界书');
            const names = typeof getWorldbookNames === 'function' ? getWorldbookNames() : [];
            if (names?.length)
                $info.append(`<div style="margin-top:6px">${names.slice(0, 8).map((n) => `<span class="dc-pill">${escapeHtml(n)}</span>`).join(' ')}</div>`);
        }
        $list.empty();
        if (!allBooks.length) {
            $list.html('<div style="color:#949ba4;padding:12px">暂无世界书条目</div>');
            return;
        }
        for (const bookName of allBooks) {
            try {
                const entries = await safeGetWorldbook(bookName);
                $list.append(`<div style="color:#f2f3f5;font-weight:700;margin:12px 0 4px 0;border-top:1px solid #3f4147;padding-top:8px">📚 ${escapeHtml(bookName)} (${entries.length} 条)</div>`);
                if (!entries.length)
                    $list.append('<div style="color:#949ba4;font-size:13px">（空）</div>');
                entries.forEach((e) => {
                    const keys = [...(e.strategy?.keys || []), ...(e.strategy?.keys_secondary?.keys || [])].join(', ');
                    const enabled = e.enabled ? '🟢' : '⚪';
                    const row = $(`
            <div class="dc-wb-entry">
              <div class="dc-wb-entry-head">${enabled} ${escapeHtml(e.name || '未命名')} <small>#${e.uid}</small> <span style="margin-left:auto;color:#949ba4;font-size:11px">${escapeHtml(e.strategy?.type || '')}</span></div>
              <div class="dc-wb-content">${escapeHtml((e.content || '').slice(0, 260))}${(e.content || '').length > 260 ? '…' : ''}</div>
              ${keys ? `<div class="dc-wb-keys">关键词: ${escapeHtml(keys.slice(0, 120))}</div>` : ''}
              <div style="margin-top:6px;display:flex;gap:6px"><button class="dc-btn-secondary" data-edit="${e.uid}" style="padding:4px 8px;font-size:12px">编辑</button><button class="dc-btn-secondary" data-toggle="${e.uid}" style="padding:4px 8px;font-size:12px">${e.enabled ? '禁用' : '启用'}</button></div>
            </div>
          `);
                    row.find(`[data-edit]`).on('click', async () => {
                        const newContent = prompt(`编辑条目 "${e.name}" 的内容`, e.content);
                        if (newContent === null)
                            return;
                        try {
                            await safeUpdateWorldbookWith(bookName, (w) => w.map((x) => x.uid === e.uid ? { ...x, content: newContent } : x));
                            toastr.success('已更新');
                            loadLorePanel();
                        }
                        catch (err) {
                            toastr.error(String(err));
                        }
                    });
                    row.find(`[data-toggle]`).on('click', async () => {
                        try {
                            await safeUpdateWorldbookWith(bookName, (w) => w.map((x) => x.uid === e.uid ? { ...x, enabled: !x.enabled } : x));
                            loadLorePanel();
                        }
                        catch (err) {
                            toastr.error(String(err));
                        }
                    });
                    $list.append(row);
                });
            }
            catch (err) {
                $list.append(`<div style="color:#ed4245">加载 ${escapeHtml(bookName)} 失败: ${escapeHtml(String(err))}</div>`);
            }
        }
        $('#dc-lore-new').off('click').on('click', async () => {
            if (!allBooks[0]) {
                toastr.error('请先绑定世界书');
                return;
            }
            const target = allBooks[0];
            const nameIn = prompt('新条目标题');
            if (nameIn === null)
                return;
            const contentIn = prompt('条目内容') || '';
            try {
                await safeCreateWorldbookEntries(target, [{ name: nameIn, content: contentIn, enabled: true }]);
                toastr.success('已创建');
                loadLorePanel();
            }
            catch (err) {
                toastr.error(String(err));
            }
        });
        $('#dc-lore-manage').off('click').on('click', () => {
            // Try to open ST's world info drawer
            document.querySelector('#WIButton, #WIDrawerIcon, [data-drawer="WI"]')?.click();
            // Also attempt to trigger via SillyTavern API
            try {
                window.SillyTavern?.reloadWorldInfoEditor?.(allBooks[0]);
            }
            catch { }
        });
    }
    catch (e) {
        $info.text('加载失败: ' + String(e));
    }
}
// ---------- User modal ----------
let userModalTab = 'profile';
function openUserModal() {
    const $left = $('#dc-user-left');
    const $right = $('#dc-user-right');
    $left.empty();
    $right.empty();
    const av = getUserAvatar();
    const name = getUserName();
    $left.append(`<img src="${av}" /><div id="dc-user-left-name">${escapeHtml(name)}</div><div id="dc-user-left-status">在线 ●</div><div class="dc-divider"></div>`);
    const tabs = [
        { key: 'profile', label: '个人资料', icon: 'fa-user' },
        { key: 'appearance', label: '外观', icon: 'fa-palette' },
        { key: 'api', label: 'API 连接', icon: 'fa-plug' },
        { key: 'extensions', label: '扩展', icon: 'fa-puzzle-piece' },
        { key: 'persona', label: '人设管理', icon: 'fa-id-badge' },
    ];
    tabs.forEach(t => {
        const el = $(`<div class="dc-tab-btn ${userModalTab === t.key ? 'active' : ''}" data-tab="${t.key}"><i class="fa-solid ${t.icon}"></i>${t.label}</div>`);
        el.on('click', () => { userModalTab = t.key; openUserModal(); });
        $left.append(el);
    });
    $left.append(`<div style="margin-top:auto;padding-top:12px"><button id="dc-user-close2" class="dc-btn-secondary" style="width:100%">关闭</button></div>`);
    $('#dc-user-close2').on('click', closeUserModal);
    // Right content: try to move real ST panels instead of clone to preserve events
    if (userModalTab === 'profile') {
        $right.html(`<h2>个人资料</h2><p class="desc">管理你的用户名与头像</p>`);
        // Reuse existing persona management DOM by cloning with events but also sync values
        const $personaBlock = $('#PersonaManagement, #personas_list, #user_avatar_block').first().closest('.drawer-content, #PersonaManagement');
        if ($('#PersonaManagement').length) {
            const $clone = $('#PersonaManagement').clone(true, true);
            $clone.attr('id', 'dc-clone-persona').css({ display: 'block', position: 'relative', inset: 'auto', background: 'transparent', border: 'none' });
            $right.append($clone);
        }
        else if ($('#user_avatar_block').length) {
            const $clone = $('#user_avatar_block').closest('div').clone(true, true);
            $right.append($clone);
        }
        // username field
        const $nameInput = $('#your_name');
        if ($nameInput.length) {
            $right.append(`<div class="dc-field"><label>用户名</label><input class="dc-input" id="dc-user-name-input" value="${escapeHtml($nameInput.val() || name)}"/><div style="margin-top:8px"><button class="dc-btn-primary" id="dc-save-user-name">保存用户名</button></div></div>`);
            $('#dc-save-user-name').on('click', () => {
                const v = $('#dc-user-name-input').val().trim();
                if (!v)
                    return;
                // Try API
                try {
                    if (typeof SillyTavern !== 'undefined') {
                        SillyTavern.name1 = v;
                    }
                }
                catch { }
                $nameInput.val(v).trigger('input').trigger('change');
                updateUserBar();
                toastr.success('用户名已更新');
            });
        }
        else {
            $right.append(`<div class="dc-field"><label>用户名</label><input class="dc-input" id="dc-user-name-input2" value="${escapeHtml(name)}"/><button class="dc-btn-primary" id="dc-save-name2" style="margin-top:8px">保存</button></div>`);
            $('#dc-save-name2').on('click', () => { const v = $('#dc-user-name-input2').val().trim(); try {
                localStorage.setItem('player_name', v);
            }
            catch { } ; $('#dc-user-name').text(v); toastr.success('已保存'); });
        }
        // avatar preview
        $right.append(`<div class="dc-field"><label>头像预览</label><img src="${av}" style="width:64px;height:64px;border-radius:50%"/><div style="color:#b5bac1;font-size:12px;margin-top:4px">在酒馆左侧人设面板上传新头像</div></div>`);
    }
    else if (userModalTab === 'persona') {
        $right.html(`<h2>人设管理</h2><p class="desc">切换与编辑人设（Persona）</p>`);
        if ($('#PersonaManagement').length) {
            const $c = $('#PersonaManagement').clone(true, true);
            $c.css({ display: 'block' });
            $right.append($c);
        }
        else
            $right.append('<div style="color:#949ba4">未找到人设管理面板，请先在顶栏打开一次人设再试</div>');
        // also list persona via API
        try {
            const names = typeof getPersonaNames === 'function' ? getPersonaNames() : [];
            if (names?.length) {
                $right.append('<div class="dc-divider"></div><div style="color:white;font-weight:600;margin:8px 0">可用人设</div>');
                const cur = typeof getCurrentPersonaName === 'function' ? getCurrentPersonaName() : null;
                names.forEach((n) => { const active = n === cur ? ' style="background:#404249;color:white"' : ''; const row = $(`<div class="dc-vtool"${active}><i class="fa-solid fa-user"></i><span>${escapeHtml(n)}</span></div>`); row.on('click', async () => { try {
                    await triggerSlash(`/persona name="${n}"`);
                }
                catch { } ; updateUserBar(); }); $right.append(row); });
            }
        }
        catch { }
    }
    else if (userModalTab === 'api') {
        $right.html(`<h2>API 连接</h2><p class="desc">模型与密钥设置</p>`);
        // Try to find API settings drawer content
        const $api = $('#APISettings, #main_api, #oai_settings, #textgenerationwebui_settings').first();
        if ($api?.length) {
            const $c = $api.clone(true, true);
            $c.css({ display: 'block' });
            $right.append($c);
        }
        else {
            $right.append('<div style="color:#949ba4">在顶栏的 “AI Response Configuration” 或 “API” 按钮中可找到详细设置，此处为快捷入口。</div>');
            // Provide quick trigger buttons
            const $btns = $('<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px"></div>');
            $('#top-settings-holder .drawer').each((_, el) => { const title = $(el).find('.drawer-icon').attr('title') || ''; if (/API|连接|模型/i.test(title)) {
                const b = $(`<button class="dc-btn-secondary">${escapeHtml(title)}</button>`);
                b.on('click', () => { $(el).find('.drawer-icon').trigger('click'); closeUserModal(); });
                $btns.append(b);
            } });
            $right.append($btns);
        }
    }
    else if (userModalTab === 'appearance') {
        $right.html(`<h2>外观</h2><p class="desc">主题与背景</p><div style="color:#b5bac1">Discord 深色主题已启用。背景透明度与字体可在酒馆原生设置中调整。</div>`);
        // background settings if exists
        const $bg = $('#background_settings, #bg_menu_content').first();
        if ($bg?.length) {
            const $c = $bg.clone(true, true);
            $c.css({ display: 'block' });
            $right.append($c);
        }
    }
    else if (userModalTab === 'extensions') {
        $right.html(`<h2>扩展</h2><p class="desc">已安装的扩展与脚本</p>`);
        const $ext = $('#extensions_settings, #extensions_block').first();
        if ($ext?.length) {
            const $c = $ext.clone(true, true);
            $c.css({ display: 'block' });
            $right.append($c);
        }
        else
            $right.append('<div style="color:#949ba4">未检测到扩展面板</div>');
    }
    $('#dc-user-modal').removeClass('hidden');
}
function closeUserModal() { $('#dc-user-modal').addClass('hidden'); }
// ---------- Context menu ----------
function showContextMenu(x, y, items) {
    const $m = $('#dc-context-menu');
    $m.empty().removeClass('hidden');
    items.forEach(it => {
        const b = $(`<button class="${it.danger ? 'danger' : ''}">${escapeHtml(it.label)}</button>`);
        b.on('click', () => { hideContextMenu(); it.action(); });
        $m.append(b);
    });
    $m.css({ left: Math.min(x, window.innerWidth - 200) + 'px', top: Math.min(y, window.innerHeight - 150) + 'px' });
}
function hideContextMenu() { $('#dc-context-menu').addClass('hidden').empty(); }
// ---------- Selection page cleanup ----------
function cleanSelectionPage() {
    // Hide emoji entries except create temp chat
    // Look for containers that have character create buttons
    const selectors = ['#rm_print_characters_block', '#character_search_block', '#rm_characters_block', '#character-list', '.character_select_container'];
    // Generic: find buttons/links with emoji regex
    const emojiRegex = /[\u{1F300}-\u{1FAFF}]/u;
    document.querySelectorAll('button, a, .menu_button, .character_select, .list-group-item').forEach((el) => {
        const txt = el.textContent?.trim() || '';
        if (!txt)
            return;
        if (emojiRegex.test(txt) && !/创建临时聊天|临时聊天|Create.*Temp/i.test(txt)) {
            // Check if it's inside character selection area
            const isInSelection = el.closest('#rm_print_characters_block, #select_character, #character_search, .character-list');
            if (isInSelection || el.classList.contains('character_select') || el.classList.contains('menu_button')) {
                // Also ensure not the temp chat button we created
                if (el.id === 'dc-create-temp' || el.closest('#dc-sidebar'))
                    return;
                el.classList.add('dc-hidden-emoji');
                el.style.display = 'none';
            }
        }
        if (/创建临时聊天/i.test(txt)) {
            // pin to top, remove small arrow
            const container = el.closest('#rm_print_characters_block, #character_search, .character-list');
            if (container && el.parentElement === container) {
                container.prepend(el);
                el.style.order = '-1';
            }
            // remove arrow element inside
            const arrow = el.querySelector('.fa-chevron-down, .fa-chevron-right, .arrow, i.fa-solid.fa-chevron-down');
            if (arrow)
                arrow.style.display = 'none';
            el.style.removeProperty('display'); // ensure visible
            el.classList.remove('dc-hidden-emoji');
        }
    });
}
// ---------- Periodic / observers ----------
// ---------- Chat message enhancements (Discord spec) ----------
function getCharTags(name) {
    try {
        const ctx = getCtx();
        const ch = ctx?.characters?.find((c) => c?.data?.name === name);
        return ch?.data?.tags || ch?.tags || [];
    }
    catch {
        return [];
    }
}
function getPersonaDisplayName() {
    try {
        if (hasHelper('getPersona')) {
            const p = window.getPersona?.('current') || window.getPersona?.();
            if (p?.display_name)
                return String(p.display_name).trim();
        }
    }
    catch { }
    try {
        const ctx = getCtx();
        // Try to find persona object
        const personas = ctx?.personas || window.personas;
        if (Array.isArray(personas)) {
            const cur = getCtx().name1;
            const found = personas.find((p) => p.name === cur);
            if (found?.display_name)
                return String(found.display_name).trim();
        }
    }
    catch { }
    // Fallback: try to read from DOM input that holds display name
    try {
        const el = document.querySelector('#persona_display_name input, [data-persona-display]');
        if (el?.value)
            return el.value.trim();
    }
    catch { }
    return '';
}
function injectCharTag(el) {
    const nameEl = el.querySelector('.name_text, .ch_name, .mes_name, [data-name]');
    if (!nameEl)
        return;
    if (el.querySelector('.discord-name-tag'))
        return;
    const rawName = (nameEl.textContent || '').trim();
    if (!rawName)
        return;
    // Avoid injecting on user messages
    const isUser = el.classList.contains('is_user') || el.classList.contains('user');
    if (isUser)
        return;
    const tags = getCharTags(rawName);
    const first = (tags && tags[0]) ? String(tags[0]).trim() : '';
    if (!first)
        return;
    const tag = document.createElement('span');
    tag.className = 'discord-name-tag char-tag';
    tag.textContent = '🏷️ ' + first.slice(0, 15);
    tag.title = '角色标签：' + first;
    nameEl.after(tag);
}
function injectUserTag(el) {
    if (el.querySelector('.discord-name-tag'))
        return;
    const isUser = el.classList.contains('is_user') || el.classList.contains('user') || el.querySelector('.is_user');
    // Only for user messages: check if message is from user (has user avatar or class)
    // Fallback: check if name matches current user name
    const nameEl = el.querySelector('.name_text, .ch_name, .mes_name');
    if (!nameEl)
        return;
    // Ensure it's actually a user message: compare name to getUserName or check class
    const userName = getUserName();
    const msgName = (nameEl.textContent || '').trim();
    const looksUser = el.classList.contains('is_user') || msgName === userName;
    if (!looksUser)
        return;
    const display = getPersonaDisplayName();
    if (!display)
        return;
    const tag = document.createElement('span');
    tag.className = 'discord-name-tag user-tag';
    tag.textContent = display.slice(0, 15);
    tag.title = '显示名称：' + display;
    nameEl.after(tag);
}
function injectAllMessageTags() {
    document.querySelectorAll('#chat .mes, #dc-chat-container #chat .mes').forEach((mes) => {
        if (mes.querySelector('.discord-name-tag'))
            return;
        if (mes.classList.contains('is_user'))
            injectUserTag(mes);
        else
            injectCharTag(mes);
    });
}
function setupMessageTagObserver() {
    const chatEl = document.querySelector('#chat');
    if (!chatEl)
        return;
    injectAllMessageTags();
    const obs = new MutationObserver(_.debounce(() => injectAllMessageTags(), 200));
    obs.observe(chatEl, { childList: true, subtree: true });
    // Also on chat changed
    try {
        const ev = window.tavern_events || window.eventSource;
        if (ev && ev.on) {
            // Try to listen to chat changed
            try {
                ev.on('chat_id_changed', () => { setTimeout(() => { document.querySelectorAll('.discord-name-tag').forEach(e => e.remove()); injectAllMessageTags(); }, 400); });
            }
            catch { }
        }
    }
    catch { }
}
function ensureMessageHoverToolbar() {
    // Delegate creation of discord hover toolbar for each message
    const chatEl = document.querySelector('#chat');
    if (!chatEl)
        return;
    const createToolbar = (mes) => {
        if (mes.querySelector('.mes_buttons_discord'))
            return;
        const bar = document.createElement('div');
        bar.className = 'mes_buttons_discord';
        // 精简后的消息按钮：去除重复，仅保留核心 + 直连原生
        const buttons = [
            { icon: '👍', title: '点击用thumbsup反应', cls: '', action: () => toggleReaction(mes, '👍') },
            { icon: '💯', title: '点击用100反应', cls: '', action: () => toggleReaction(mes, '💯') },
            { icon: '💖', title: '点击用sparkling_heart反应', cls: '', action: () => toggleReaction(mes, '💖') },
            { icon: '😊', title: '添加反应', cls: '', action: () => openEmojiPicker(mes) },
            { icon: '✏️', title: '编辑', cls: '', action: () => {
                const native = mes.querySelector('.mes_edit, .mes_edit_button') as HTMLElement;
                if (native) { native.click(); return; }
                const idx = Array.from(mes.parentElement?.children||[]).indexOf(mes);
                try { (window as any).editMessage?.(idx); } catch {}
            } },
            { icon: '🌿', title: '创建分支', cls: '', action: () => {
                const native = mes.querySelector('.mes_create_branch') as HTMLElement;
                if (native) { native.click(); return; }
                const idx = Array.from(mes.parentElement?.children||[]).indexOf(mes);
                const ctx = (window as any).SillyTavern?.getContext?.();
                if (ctx?.branchChat) ctx.branchChat(idx);
            } },
            { icon: '✕', title: '删除', cls: 'btn-delete', action: () => { if(confirm('删除该消息？')){ const del=mes.querySelector('.mes_delete, .mes_del') as HTMLElement; if(del) del.click(); else mes.remove(); } } },
            { icon: '⋯', title: '消息操作', cls: '', action: () => {
                // 直连酒馆原生消息操作，不再弹出编辑/消息操作两个按钮
                const nativeOp = mes.querySelector('.extraMesButtonsHint, .mes_button.fa-ellipsis, [data-i18n*="Message Actions"]') as HTMLElement;
                if (nativeOp) { nativeOp.click(); return; }
                const more = mes.querySelector('.mes_buttons') as HTMLElement;
                if (more) {
                    // 隐藏重复的编辑按钮，避免显示两个
                    more.querySelectorAll('.mes_edit, .mes_edit_button').forEach((el:HTMLElement)=> el.style.display='none');
                    more.style.display = 'flex';
                    more.style.opacity = '1';
                    more.style.position = 'absolute';
                    more.style.top = '-36px';
                    more.style.right = '0';
                    more.style.background = '#111214';
                    more.style.border = '1px solid #232428';
                    more.style.borderRadius = '6px';
                    more.style.padding = '4px';
                    more.style.zIndex = '10';
                    setTimeout(()=>{
                        const closeMore = (e:Event)=>{
                            if (!(e.target as HTMLElement).closest('.mes_buttons') && !(e.target as HTMLElement).closest('.mes_btn_discord')) {
                                more.style.display='none';
                                // 恢复
                                more.querySelectorAll('.mes_edit, .mes_edit_button').forEach((el:HTMLElement)=> el.style.display='');
                                document.removeEventListener('click', closeMore);
                            }
                        };
                        setTimeout(()=>document.addEventListener('click', closeMore), 50);
                    },10);
                }
            } },
        ];
        buttons.forEach(b => {
            const btn = document.createElement('div');
            btn.className = 'mes_btn_discord ' + b.cls;
            btn.title = b.title;
            let iconHtml = b.icon;
            if (b.title==='编辑') {
                const n = mes.querySelector('.mes_edit, .mes_edit_button, [data-action="edit"]') as HTMLElement;
                if (n) {
                    const icon = n.querySelector('i') as HTMLElement;
                    iconHtml = icon ? icon.outerHTML : n.innerHTML;
                    if (!iconHtml || iconHtml.trim()==='') iconHtml = '✏️';
                }
            } else if (b.title==='创建分支') {
                const n = mes.querySelector('.mes_create_branch, [data-action="branch"]') as HTMLElement;
                if (n) {
                    const icon = n.querySelector('i') as HTMLElement;
                    iconHtml = icon ? icon.outerHTML : n.innerHTML;
                    if (!iconHtml || iconHtml.trim()==='') iconHtml = '🌿';
                }
            } else if (b.title==='消息操作') {
                const n = mes.querySelector('.extraMesButtonsHint, .mes_buttons .fa-ellipsis, .fa-ellipsis-h') as HTMLElement;
                if (n) {
                    const icon = n.querySelector('i') as HTMLElement;
                    iconHtml = icon ? icon.outerHTML : n.innerHTML;
                    if (!iconHtml || iconHtml.trim()==='') iconHtml = '⋯';
                }
            }
            btn.innerHTML = iconHtml;
            btn.querySelectorAll('i').forEach((el:HTMLElement)=> el.style.color='#b5bac1');
            btn.addEventListener('click', (e) => { e.stopPropagation(); b.action(); });
            bar.appendChild(btn);
        });
        mes.style.position = 'relative';
        mes.appendChild(bar);
    };
    // Apply to existing
    chatEl.querySelectorAll('.mes').forEach((m) => createToolbar(m));
    const obs = new MutationObserver((mut) => {
        mut.forEach(m => {
            m.addedNodes.forEach((n) => {
                if (n.nodeType === 1 && n.classList && n.classList.contains('mes'))
                    createToolbar(n);
                else if (n.nodeType === 1)
                    n.querySelectorAll?.('.mes').forEach((x) => createToolbar(x));
            });
        });
    });
    obs.observe(chatEl, { childList: true, subtree: true });
    // Also ensure avatar left via inline override for any new messages that might set flex-direction opposite
    const styleFix = () => {
        chatEl.querySelectorAll('.mes').forEach((m) => {
            m.style.flexDirection = 'row';
            m.style.justifyContent = 'flex-start';
        });
    };
    setInterval(styleFix, 1500);
}
function openEmojiPicker(mes) {
    // Close existing picker
    document.querySelectorAll('.emoji-picker-discord').forEach(e => e.remove());
    const picker = document.createElement('div');
    picker.className = 'emoji-picker-discord';
    picker.innerHTML = `
    <div class="emoji-picker-search"><input placeholder="找到最完美的反应" /></div>
    <div class="emoji-grid"></div>
    <div class="emoji-picker-footer">点击添加反应 · 再次点击取消</div>
  `;
    const grid = picker.querySelector('.emoji-grid');
    const common = ['👍', '💯', '💖', '✅', '😊', '🔥', '😤', '🌸', '🤍', '💜', '😈', '🕊️', '⭐', '☁️', '🍎', '🐛', '📖', '😂', '😢', '😡', '👏', '🙏', '🎉', '❤️', '😍', '🤔', '👌', '💪', '🫡'];
    common.forEach(em => {
        const item = document.createElement('div');
        item.className = 'emoji-item';
        item.textContent = em;
        item.addEventListener('click', () => { toggleReaction(mes, em); picker.remove(); });
        grid.appendChild(item);
    });
    // Position near the message's hover toolbar
    // 定位到添加反应按钮下方
    const rect = mes.getBoundingClientRect();
    picker.style.position = 'absolute';
    picker.style.top = (mes.offsetHeight - 20) + 'px';
    picker.style.left = '90px';
    picker.style.zIndex = '200';
    mes.appendChild(picker);
    // 确保宽度不超出
    const pr = picker.getBoundingClientRect();
    if (pr.right > window.innerWidth) picker.style.left = Math.max(8, window.innerWidth - pr.width - 24) + 'px';
    // Search filter
    const input = picker.querySelector('input');
    input?.addEventListener('input', () => {
        const q = input.value.trim();
        grid.querySelectorAll('.emoji-item').forEach((it) => {
            const show = !q || it.textContent.includes(q);
            it.style.display = show ? 'flex' : 'none';
        });
    });
    // Close on outside
    setTimeout(() => {
        const close = (e) => { if (!picker.contains(e.target) && !e.target.closest('.mes_btn_discord')) {
            picker.remove();
            document.removeEventListener('click', close);
        } };
        document.addEventListener('click', close);
    }, 50);
}
function getMessageId(mes) {
    // Use data attribute or index
    return mes.getAttribute('data-mesid') || mes.getAttribute('mesid') || Array.from(mes.parentElement?.children || []).indexOf(mes).toString();
}
function toggleReaction(mes, emoji) {
    const id = getMessageId(mes);
    // Use chat metadata or localStorage for persistence per chat
    const chatId = getCtx().chatId || 'global';
    const key = 'dc_reactions_' + chatId;
    let store = {};
    try {
        store = JSON.parse(localStorage.getItem(key) || '{}');
    }
    catch { }
    if (!store[id])
        store[id] = {};
    const reactions = store[id];
    if (!reactions[emoji])
        reactions[emoji] = { count: 1, self: true };
    else {
        if (reactions[emoji].self) {
            reactions[emoji].self = false;
            reactions[emoji].count = Math.max(0, reactions[emoji].count - 1);
            if (reactions[emoji].count === 0)
                delete reactions[emoji];
        }
        else {
            reactions[emoji].self = true;
            reactions[emoji].count += 1;
        }
    }
    try {
        localStorage.setItem(key, JSON.stringify(store));
    }
    catch { }
    renderReactions(mes, reactions);
    // Also try to persist via chat metadata if available
    try {
        const ctx = getCtx();
        if (ctx?.chatMetadata) {
            ctx.chatMetadata['dc_reactions'] = store;
            ctx.saveMetadataDebounced?.();
        }
    }
    catch { }
}
function renderReactions(mes, reactions) {
    let r = reactions;
    if (!r) {
        const id = getMessageId(mes);
        const chatId = getCtx().chatId || 'global';
        const key = 'dc_reactions_' + chatId;
        try {
            const store = JSON.parse(localStorage.getItem(key) || '{}');
            r = store[id] || {};
        }
        catch {
            r = {};
        }
    }
    let container = mes.querySelector('.mes-reactions');
    if (!container) {
        container = document.createElement('div');
        container.className = 'mes-reactions';
        const textEl = mes.querySelector('.mes_text');
        if (textEl)
            textEl.after(container);
        else
            mes.appendChild(container);
    }
    container.innerHTML = '';
    Object.entries(r).forEach(([emoji, data]) => {
        const pill = document.createElement('div');
        pill.className = 'reaction-pill ' + (data.self ? 'self-reacted' : '');
        pill.innerHTML = `<span>${emoji}</span><span>${data.count}</span>`;
        pill.addEventListener('click', () => toggleReaction(mes, emoji));
        container.appendChild(pill);
    });
}
function restoreAllReactions() {
    document.querySelectorAll('#chat .mes').forEach((m) => {
        try {
            renderReactions(m);
        }
        catch { }
    });
}
function periodicRefresh() {
    let lastChar = '';
    let lastChat = '';
    setInterval(() => {
        const cur = getCurrentCharacterName() || '';
        const chatId = getCtx()?.chatId || getCtx()?.chatMetadata?.chatId || '';
        if (cur !== lastChar) {
            lastChar = cur;
            updateHeader();
            renderGuildBar();
            renderChannels();
            buildDropdown();
        }
        if (chatId !== lastChat) {
            lastChat = chatId;
            renderChannels();
            updateHeader();
        }
        updateUserBar();
        cleanSelectionPage();
    }, 1500);
}
function setupDropdown() {
    $('#dc-sidebar-header').off('click').on('click', (e) => {
        e.stopPropagation();
        const $dd = $('#dc-char-dropdown');
        const hidden = $dd.hasClass('hidden');
        if (hidden) {
            $dd.removeClass('hidden');
            $('#dc-sidebar-header').addClass('open');
        }
        else {
            $dd.addClass('hidden');
            $('#dc-sidebar-header').removeClass('open');
        }
    });
}
function setupUserGear() {
    $('#dc-user-gear').off('click').on('click', (e) => { e.stopPropagation(); openUserModal(); });
}
function handleResize() { document.documentElement.style.setProperty('--sheldWidth', '100%'); }
// ---------- Init ----------
function errorCatched(fn) { return (...a) => { try {
    return fn(...a);
}
catch (e) {
    console.error('[dc-theme] error', e);
} }; }
$(errorCatched(async () => {
    log('init discord theme v2');
    injectStyle();
    ensureRoot();
    updateHeader();
    renderGuildBar();
    await renderChannels();
    buildDropdown();
    setupDropdown();
    setupUserGear();
    try {
        setupMessageTagObserver();
    }
    catch (e) {
        warn(e);
    }
    try {
        ensureMessageHoverToolbar();
    }
    catch (e) {
        warn(e);
    }
    try {
        restoreAllReactions();
    }
    catch (e) {
        warn(e);
    }
    periodicRefresh();
    handleResize();
    $(window).on('resize', handleResize);
    cleanSelectionPage();
    // observers
    const obs1 = new MutationObserver(_.debounce(() => { renderGuildBar(); updateHeader(); cleanSelectionPage(); }, 300));
    const block = document.getElementById('rm_print_characters_block');
    if (block)
        obs1.observe(block, { childList: true, subtree: true });
    const obs2 = new MutationObserver(_.debounce(() => updateUserBar(), 300));
    const av = document.getElementById('user_avatar_block');
    if (av)
        obs2.observe(av, { childList: true, subtree: true, attributes: true });
    const obs3 = new MutationObserver(_.debounce(() => cleanSelectionPage(), 400));
    obs3.observe(document.body, { childList: true, subtree: true });
    toastr?.success?.('Discord 美化 v2 已加载 · 三栏 + 详情页已就绪');
    window.dcTheme = { renderGuildBar, renderChannels, updateHeader, openCharModal, openUserModal };
}));
//# sourceURL=[module]
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxFQUFFLEVBQUUsR0FBRyxFQUFDLENBQUMsRUFBRSxFQUFFLEVBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUFDLENBQUM7SUFBQyxDQUFDO0lBQUMsTUFBTSxDQUFDLEVBQUM7SUFDdmEsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUMsQ0FBQztRQUFDLElBQUcsQ0FBQztZQUFDLE1BQU0sR0FBRyxHQUFDLE1BQU0sRUFBRSxDQUFDO1lBQUMsSUFBSSxHQUFHLEVBQUUsVUFBVSxFQUFFLE1BQU07Z0JBQUUsS0FBSyxHQUFHLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBSyxFQUFDLEVBQUUsRUFBQyxFQUFFLElBQUksRUFBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksSUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBQyxDQUFDLEVBQUUsRUFBRSxFQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFBQyxDQUFDO1FBQUMsTUFBTSxDQUFDLEVBQUM7SUFBQyxDQUFDO0lBQ3JNLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFDLENBQUM7UUFDakIsTUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsOENBQThDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQU0sRUFBQyxFQUFFLEVBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLElBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxFQUFFLFlBQVksQ0FBQyxLQUFLLENBQUMsSUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFDLEVBQUMs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Q0FBQyxDQUFDO0lBQ3pFLE1BQU0sRUFBRSxHQUFHLFFBQVEsQ0FBQyxjQUFjLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUN4RCxJQUFJLEVBQUU7UUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFDLElBQUksRUFBRSxVQUFVLEVBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUM1RSxNQUFNLElBQUksR0FBRyxJQUFJLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRSxFQUFFLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzlFLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLFNBQVMsRUFBQyxJQUFJLEVBQUUsT0FBTyxFQUFDLElBQUksRUFBRSxDQUFDLENBQUM7SUFDOUQsTUFBTSxFQUFFLE9BQU8sRUFBRSxDQUFDLGlDQUFpQyxDQUFDLENBQUM7SUFDcEQsTUFBYyxDQUFDLE9BQU8sR0FBRyxFQUFFLGNBQWMsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxhQUFhLEVBQUUsQ0FBQztBQUMzRyxDQUFDLENBQUMsQ0FBQyxDQUFDIiwic291cmNlcyI6WyJzcmM6Ly90YXZlcm5faGVscGVyX3RlbXBsYXRlL3NyYy9kaXNjb3JkLXRoZW1lL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIERpc2NvcmQg5LiJ5qCP576O5YyWIOKAlCDlrozmlbTph43mnoTniYggdjJcbi8vIOebruagh++8muKRoOacjeWKoeWZqOagjyDikaHpopHpgZMv6KeS6Imy6K+m5oOFIOKRouiBiuWkqeS4u+WMuiArIFAyL1A06KeS6Imy5Y2h57yW6L6RICsg5LiW55WM5LmmL+eUqOaIt+W8ueeql+WFqOWKn+iDveWPr+eUqFxuLy8gQHRzLWlnbm9yZVxuZGVjbGFyZSBjb25zdCAkOiBhbnk7XG5kZWNsYXJlIGNvbnN0IF86IGFueTtcbmRlY2xhcmUgY29uc3QgdG9hc3RyOiBhbnk7XG5kZWNsYXJlIGNvbnN0IFNpbGx5VGF2ZXJuOiBhbnk7XG5cbmNvbnN0IERDX09SREVSX0tFWSA9ICdkY19ndWlsZF9vcmRlcl92Mic7XG5jb25zdCBEQ19TVFlMRV9JRCA9ICdkYy1kaXNjb3JkLXRoZW1lLXN0eWxlLXYyJztcbmNvbnN0IERDX1RPT0xUSVBfSUQgPSAnZGMtdG9vbHRpcCc7XG5cbmZ1bmN0aW9uIGxvZyguLi5hOiBhbnlbXSkgeyBjb25zb2xlLmluZm8oJ1tkYy10aGVtZV0nLCAuLi5hKTsgfVxuZnVuY3Rpb24gd2FybiguLi5hOiBhbnlbXSkgeyBjb25zb2xlLndhcm4oJ1tkYy10aGVtZV0nLCAuLi5hKTsgfVxuXG5mdW5jdGlvbiBnZXRDdHgoKTogYW55IHtcbiAgdHJ5IHsgcmV0dXJuICh3aW5kb3cgYXMgYW55KS5TaWxseVRhdmVybj8uZ2V0Q29udGV4dD8uKCkgfHwgKHdpbmRvdyBhcyBhbnkpLlNpbGx5VGF2ZXJuIHx8IHt9OyB9IGNhdGNoIHsgcmV0dXJuIHt9OyB9XG59XG5mdW5jdGlvbiBnZXRDdXJyZW50Q2hhcmFjdGVyTmFtZSgpOiBzdHJpbmcgfCBudWxsIHtcbiAgdHJ5IHsgaWYgKHR5cGVvZiBnZXRDdXJyZW50Q2hhcmFjdGVySWQgPT09ICdmdW5jdGlvbicpIHsgY29uc3QgaWQgPSAoZ2V0Q3VycmVudENoYXJhY3RlcklkIGFzIGFueSkoKTsgaWYgKGlkKSB7IGNvbnN0IG5hbWVzID0gZ2V0Q2hhcmFjdGVyTmFtZXMoKTsgY29uc3QgaWRzID0gZ2V0Q2hhcmFjdGVySWRzKCk7IGNvbnN0IGlkeCA9IGlkcy5pbmRleE9mKGlkKTsgaWYgKGlkeCA+PSAwKSByZXR1cm4gbmFtZXNbaWR4XTsgfSB9IH0gY2F0Y2gge31cbiAgdHJ5IHsgY29uc3QgY3R4ID0gZ2V0Q3R4KCk7IHJldHVybiBjdHg/LmNoYXJhY3RlcnM/LltjdHg/LmNoYXJhY3RlcklkXT8uZGF0YT8ubmFtZSB8fCBjdHg/Lm5hbWUyIHx8IG51bGw7IH0gY2F0Y2ggeyByZXR1cm4gbnVsbDsgfVxufVxuZnVuY3Rpb24gZ2V0Q3VycmVudENoYXJhY3RlcklkU2FmZSgpOiBzdHJpbmcgfCBudWxsIHtcbiAgdHJ5IHsgaWYgKHR5cGVvZiBnZXRDdXJyZW50Q2hhcmFjdGVySWQgPT09ICdmdW5jdGlvbicpIHJldHVybiAoZ2V0Q3VycmVudENoYXJhY3RlcklkIGFzIGFueSkoKTsgfSBjYXRjaCB7fVxuICB0cnkgeyBjb25zdCBjdHggPSBnZXRDdHgoKTsgcmV0dXJuIGN0eD8uY2hhcmFjdGVySWQgfHwgY3R4Py50aGlzX2NoaWQgfHwgbnVsbDsgfSBjYXRjaCB7IHJldHVybiBudWxsOyB9XG59XG5mdW5jdGlvbiBnZXRUaHVtYih0eXBlOiBzdHJpbmcsIGZpbGU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHRyeSB7IGlmIChTaWxseVRhdmVybj8uZ2V0VGh1bWJuYWlsVXJsKSByZXR1cm4gU2lsbHlUYXZlcm4uZ2V0VGh1bWJuYWlsVXJsKHR5cGUsIGZpbGUpOyB9IGNhdGNoIHt9XG4gIHRyeSB7IGlmICgod2luZG93IGFzIGFueSkuZ2V0VGh1bWJuYWlsVXJsKSByZXR1cm4gKHdpbmRvdyBhcyBhbnkpLmdldFRodW1ibmFpbFVybCh0eXBlLCBmaWxlKTsgfSBjYXRjaCB7fVxuICByZXR1cm4gYHRodW1ibmFpbD90eXBlPSR7dHlwZX0mZmlsZT0ke2VuY29kZVVSSUNvbXBvbmVudChmaWxlKX1gO1xufVxuLy8gLS0tLSBUYXZlcm5IZWxwZXIgcG9seWZpbGxzIC0tLS1cbmRlY2xhcmUgY29uc3QgZ2V0Q2hhcmFjdGVyOiBhbnk7XG5kZWNsYXJlIGNvbnN0IGdldENoYXJhY3Rlck5hbWVzOiBhbnk7XG5kZWNsYXJlIGNvbnN0IGdldENoYXJhY3RlcklkczogYW55O1xuZGVjbGFyZSBjb25zdCBnZXRDdXJyZW50Q2hhcmFjdGVySWQ6IGFueTtcbmRlY2xhcmUgY29uc3QgdXBkYXRlQ2hhcmFjdGVyV2l0aDogYW55O1xuZGVjbGFyZSBjb25zdCBnZXRXb3JsZGJvb2s6IGFueTtcbmRlY2xhcmUgY29uc3QgZ2V0V29ybGRib29rTmFtZXM6IGFueTtcbmRlY2xhcmUgY29uc3Qgc2FmZUdldENoYXJXb3JsZGJvb2tOYW1lczogYW55O1xuZGVjbGFyZSBjb25zdCBzYWZlR2V0R2xvYmFsV29ybGRib29rTmFtZXM6IGFueTtcbmRlY2xhcmUgY29uc3Qgc2FmZVVwZGF0ZVdvcmxkYm9va1dpdGg6IGFueTtcbmRlY2xhcmUgY29uc3Qgc2FmZUNyZWF0ZVdvcmxkYm9va0VudHJpZXM6IGFueTtcbmRlY2xhcmUgY29uc3QgZ2V0UGVyc29uYU5hbWVzOiBhbnk7XG5kZWNsYXJlIGNvbnN0IGdldEN1cnJlbnRQZXJzb25hTmFtZTogYW55O1xuZGVjbGFyZSBjb25zdCBnZXRQZXJzb25hQXZhdGFyUGF0aDogYW55O1xuZGVjbGFyZSBjb25zdCBnZXRQZXJzb25hOiBhbnk7XG5mdW5jdGlvbiBoYXNIZWxwZXIobmFtZTpzdHJpbmcpeyB0cnl7IHJldHVybiB0eXBlb2YgKHdpbmRvdyBhcyBhbnkpW25hbWVdPT09J2Z1bmN0aW9uJzsgfWNhdGNoe3JldHVybiBmYWxzZX0gfVxuYXN5bmMgZnVuY3Rpb24gc2FmZUdldENoYXJhY3RlcihuYW1lOnN0cmluZyk6IFByb21pc2U8YW55PntcbiAgaWYgKGhhc0hlbHBlcignZ2V0Q2hhcmFjdGVyJykpIHsgdHJ5eyByZXR1cm4gYXdhaXQgKHdpbmRvdyBhcyBhbnkpLmdldENoYXJhY3RlcihuYW1lKTsgfWNhdGNoKGUpeyB3YXJuKCdnZXRDaGFyYWN0ZXIgaGVscGVyIGZhaWxlZCcsZSl9IH1cbiAgY29uc3QgY3R4PWdldEN0eCgpO1xuICBjb25zdCBjaCA9IGN0eD8uY2hhcmFjdGVycz8uZmluZCgoYzphbnkpPT4gYz8uZGF0YT8ubmFtZT09PW5hbWUgfHwgYz8ubmFtZT09PW5hbWUpO1xuICBpZiAoY2gpIHsgcmV0dXJuIHsgYXZhdGFyOiBjaC5hdmF0YXIsIGRhdGE6IGNoLmRhdGEgfHwgY2gsIC4uLmNoLCBkZXNjcmlwdGlvbjogY2guZGF0YT8uZGVzY3JpcHRpb24gfHwgY2guZGVzY3JpcHRpb24gfHwgJycsIGZpcnN0X21lczogY2guZGF0YT8uZmlyc3RfbWVzIHx8IGNoLmZpcnN0X21lcyB8fCAnJyB9OyB9XG4gIHRocm93IG5ldyBFcnJvcign6KeS6Imy5pyq5om+5YiwOiAnK25hbWUpO1xufVxuYXN5bmMgZnVuY3Rpb24gc2FmZVVwZGF0ZUNoYXJhY3RlcihuYW1lOnN0cmluZywgdXBkYXRlcjooYzphbnkpPT5hbnkpOiBQcm9taXNlPGFueT57XG4gIGlmIChoYXNIZWxwZXIoJ3VwZGF0ZUNoYXJhY3RlcldpdGgnKSkgeyB0cnl7IHJldHVybiBhd2FpdCAod2luZG93IGFzIGFueSkuc2FmZVVwZGF0ZUNoYXJhY3RlcihuYW1lLCB1cGRhdGVyKTsgfWNhdGNoKGUpeyB3YXJuKCd1cGRhdGVDaGFyYWN0ZXJXaXRoIGhlbHBlciBmYWlsZWQnLGUpfSB9XG4gIGNvbnN0IGN0eD1nZXRDdHgoKTtcbiAgY29uc3QgaWR4ID0gY3R4Py5jaGFyYWN0ZXJzPy5maW5kSW5kZXgoKGM6YW55KT0+IGM/LmRhdGE/Lm5hbWU9PT1uYW1lKTtcbiAgaWYgKGlkeD49MCl7XG4gICAgbGV0IGNoID0gY3R4LmNoYXJhY3RlcnNbaWR4XTtcbiAgICBsZXQgY29weSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoY2gpKTtcbiAgICBsZXQgdXBkYXRlZCA9IGF3YWl0IHVwZGF0ZXIoY29weSk7XG4gICAgaWYgKHVwZGF0ZWQpIGNvcHkgPSB1cGRhdGVkO1xuICAgIGN0eC5jaGFyYWN0ZXJzW2lkeF0gPSBjb3B5O1xuICAgIHRyeXtcbiAgICAgIGNvbnN0IGhlYWRlcnMgPSBnZXRDdHgoKS5nZXRSZXF1ZXN0SGVhZGVycygpIHx8IHsnQ29udGVudC1UeXBlJzonYXBwbGljYXRpb24vanNvbid9O1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvY2hhcmFjdGVycy9lZGl0JywgeyBtZXRob2Q6J1BPU1QnLCBoZWFkZXJzOiB7Li4uaGVhZGVycywgJ0NvbnRlbnQtVHlwZSc6J2FwcGxpY2F0aW9uL2pzb24nfSwgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBhdmF0YXJfdXJsOiBjaC5hdmF0YXIsIGRhdGE6IGNvcHkuZGF0YSB8fCBjb3B5IH0pIH0pO1xuICAgICAgaWYgKCFyZXMub2spIHRocm93IG5ldyBFcnJvcignc2F2ZSBmYWlsZWQgJytyZXMuc3RhdHVzKTtcbiAgICB9Y2F0Y2goZSl7IHdhcm4oJ2ZhbGxiYWNrIHNhdmUgZmFpbGVkJyxlKTsgdHJ5eyBTaWxseVRhdmVybj8uc2F2ZVNldHRpbmdzRGVib3VuY2VkPy4oKTsgfWNhdGNoe30gfVxuICAgIHJldHVybiBjb3B5O1xuICB9XG4gIHRocm93IG5ldyBFcnJvcign5pu05paw5aSx6LSl77yM5pyq5om+5Yiw6KeS6ImyJyk7XG59XG5hc3luYyBmdW5jdGlvbiBzYWZlR2V0V29ybGRib29rKG5hbWU6c3RyaW5nKTogUHJvbWlzZTxhbnlbXT57XG4gIGlmIChoYXNIZWxwZXIoJ2dldFdvcmxkYm9vaycpKSB7IHRyeXsgcmV0dXJuIGF3YWl0ICh3aW5kb3cgYXMgYW55KS5zYWZlR2V0V29ybGRib29rKG5hbWUpOyB9Y2F0Y2goZSl7IHdhcm4oZSl9IH1cbiAgdHJ5e1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBnZXRDdHgoKS5sb2FkV29ybGRJbmZvPy4obmFtZSk7XG4gICAgaWYgKGRhdGEpIHtcbiAgICAgIGNvbnN0IGVudHJpZXMgPSBkYXRhLmVudHJpZXMgPyBPYmplY3QudmFsdWVzKGRhdGEuZW50cmllcykubWFwKChlOmFueSk9Pih7IHVpZDogZS51aWQgPz8gZS5pZCwgbmFtZTogZS5jb21tZW50IHx8IGUua2V5Py5qb2luKCcsJykgfHwgJ+acquWRveWQjScsIGVuYWJsZWQ6ICFlLmRpc2FibGUsIHN0cmF0ZWd5OiB7IHR5cGU6IGUuY29uc3RhbnQgPyAnY29uc3RhbnQnIDogJ3NlbGVjdGl2ZScsIGtleXM6IGUua2V5IHx8IFtdLCBrZXlzX3NlY29uZGFyeTp7IGxvZ2ljOidhbmRfYW55Jywga2V5czogZS5rZXlzZWNvbmRhcnl8fFtdIH0sIHNjYW5fZGVwdGg6IGUuc2NhbkRlcHRofHwxIH0sIGNvbnRlbnQ6IGUuY29udGVudCwgcHJvYmFiaWxpdHk6IDEwMCB9KSkgOiBbXTtcbiAgICAgIHJldHVybiBlbnRyaWVzO1xuICAgIH1cbiAgfWNhdGNoKGUpeyB3YXJuKGUpIH1cbiAgcmV0dXJuIFtdO1xufVxuZnVuY3Rpb24gc2FmZUdldENoYXJXb3JsZGJvb2tOYW1lcyhuYW1lOnN0cmluZyk6IGFueXtcbiAgaWYgKGhhc0hlbHBlcignc2FmZUdldENoYXJXb3JsZGJvb2tOYW1lcycpKSB7IHRyeXsgcmV0dXJuICh3aW5kb3cgYXMgYW55KS5zYWZlR2V0Q2hhcldvcmxkYm9va05hbWVzKG5hbWUpOyB9Y2F0Y2goZSl7fSB9XG4gIHRyeXtcbiAgICBjb25zdCBjdHg9Z2V0Q3R4KCk7XG4gICAgY29uc3QgY2ggPSBjdHg/LmNoYXJhY3RlcnM/LmZpbmQoKGM6YW55KT0+IGM/LmRhdGE/Lm5hbWU9PT1uYW1lKTtcbiAgICBjb25zdCBwcmltYXJ5ID0gY2g/LmRhdGE/LmNoYXJhY3Rlcl9ib29rPy5uYW1lIHx8IG51bGw7XG4gICAgcmV0dXJuIHsgcHJpbWFyeSwgYWRkaXRpb25hbDogW10gfTtcbiAgfWNhdGNoeyByZXR1cm4geyBwcmltYXJ5Om51bGwsIGFkZGl0aW9uYWw6W10gfSB9XG59XG5mdW5jdGlvbiBzYWZlR2V0R2xvYmFsV29ybGRib29rTmFtZXMoKTogc3RyaW5nW117XG4gIGlmIChoYXNIZWxwZXIoJ3NhZmVHZXRHbG9iYWxXb3JsZGJvb2tOYW1lcycpKSB7IHRyeXsgcmV0dXJuICh3aW5kb3cgYXMgYW55KS5zYWZlR2V0R2xvYmFsV29ybGRib29rTmFtZXMoKTsgfWNhdGNoKGUpe30gfVxuICB0cnl7IHJldHVybiBTaWxseVRhdmVybj8uZ2V0Q29udGV4dD8uKCk/LndvcmxkSW5mb1NldHRpbmdzPy53b3JsZF9pbmZvIHx8IFtdOyB9Y2F0Y2h7IHJldHVybiBbXSB9XG59XG5mdW5jdGlvbiBzYWZlR2V0V29ybGRib29rTmFtZXMoKTogc3RyaW5nW117XG4gIGlmIChoYXNIZWxwZXIoJ2dldFdvcmxkYm9va05hbWVzJykpIHsgdHJ5eyByZXR1cm4gKHdpbmRvdyBhcyBhbnkpLmdldFdvcmxkYm9va05hbWVzKCk7IH1jYXRjaChlKXt9IH1cbiAgdHJ5eyByZXR1cm4gT2JqZWN0LmtleXMoU2lsbHlUYXZlcm4/LndvcmxkSW5mb0NhY2hlIHx8IHt9KTsgfWNhdGNoeyByZXR1cm4gW10gfVxufVxuYXN5bmMgZnVuY3Rpb24gc2FmZUNyZWF0ZVdvcmxkYm9va0VudHJpZXMoYm9vazpzdHJpbmcsIGVudHJpZXM6YW55W10pOiBQcm9taXNlPGFueT57XG4gIGlmIChoYXNIZWxwZXIoJ3NhZmVDcmVhdGVXb3JsZGJvb2tFbnRyaWVzJykpIHsgdHJ5eyByZXR1cm4gYXdhaXQgKHdpbmRvdyBhcyBhbnkpLnNhZmVDcmVhdGVXb3JsZGJvb2tFbnRyaWVzKGJvb2ssIGVudHJpZXMpOyB9Y2F0Y2goZSl7IHdhcm4oZSl9IH1cbiAgdHJ5e1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBnZXRDdHgoKS5sb2FkV29ybGRJbmZvPy4oYm9vayk7XG4gICAgaWYgKGRhdGEpe1xuICAgICAgZW50cmllcy5mb3JFYWNoKChlbjphbnkpPT57XG4gICAgICAgIGNvbnN0IHVpZCA9IERhdGUubm93KCkgKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkqMTAwMCk7XG4gICAgICAgIGRhdGEuZW50cmllc1t1aWRdID0geyB1aWQsIGtleTogW2VuLm5hbWVdLCBjb250ZW50OiBlbi5jb250ZW50LCBkaXNhYmxlOiAhZW4uZW5hYmxlZCwgY29uc3RhbnQ6IGZhbHNlLCBzZWxlY3RpdmU6dHJ1ZSwga2V5c2Vjb25kYXJ5OltdLCBzY2FuRGVwdGg6bnVsbCwgcG9zaXRpb246MCwgb3JkZXI6MTAwLCByb2xlOjAsIGRlcHRoOjQsIGV4dHJhOnt9fVxuICAgICAgfSk7XG4gICAgICBhd2FpdCBnZXRDdHgoKS5zYXZlV29ybGRJbmZvPy4oYm9vaywgZGF0YSk7XG4gICAgICByZXR1cm4geyB3b3JsZGJvb2s6IE9iamVjdC52YWx1ZXMoZGF0YS5lbnRyaWVzKSB9O1xuICAgIH1cbiAgfWNhdGNoKGUpeyB3YXJuKGUpIH1cbiAgdGhyb3cgbmV3IEVycm9yKCfliJvlu7rkuJbnlYzkuabmnaHnm67lpLHotKUnKTtcbn1cbmFzeW5jIGZ1bmN0aW9uIHNhZmVVcGRhdGVXb3JsZGJvb2tXaXRoKGJvb2s6c3RyaW5nLCB1cGRhdGVyOih3OmFueVtdKT0+YW55KTogUHJvbWlzZTxhbnk+e1xuICBpZiAoaGFzSGVscGVyKCdzYWZlVXBkYXRlV29ybGRib29rV2l0aCcpKSB7IHRyeXsgcmV0dXJuIGF3YWl0ICh3aW5kb3cgYXMgYW55KS5zYWZlVXBkYXRlV29ybGRib29rV2l0aChib29rLCB1cGRhdGVyKTsgfWNhdGNoKGUpeyB3YXJuKGUpfSB9XG4gIGNvbnN0IGVudHJpZXMgPSBhd2FpdCBzYWZlR2V0V29ybGRib29rKGJvb2spO1xuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgdXBkYXRlcihlbnRyaWVzKTtcbiAgdHJ5e1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBnZXRDdHgoKS5sb2FkV29ybGRJbmZvPy4oYm9vayk7XG4gICAgaWYgKGRhdGEpe1xuICAgICAgZGF0YS5lbnRyaWVzID0ge307XG4gICAgICB1cGRhdGVkLmZvckVhY2goKGU6YW55LCBpOm51bWJlcik9PnsgZGF0YS5lbnRyaWVzW2UudWlkfHxpXSA9IHsgdWlkOmUudWlkfHxpLCBrZXk6ZS5zdHJhdGVneT8ua2V5c3x8W2UubmFtZV0sIGNvbnRlbnQ6ZS5jb250ZW50LCBkaXNhYmxlOiFlLmVuYWJsZWQsIGNvbnN0YW50OmUuc3RyYXRlZ3k/LnR5cGU9PT0nY29uc3RhbnQnLCBzZWxlY3RpdmU6dHJ1ZSwgcG9zaXRpb246MCwgb3JkZXI6ZS5vcmRlcnx8aSB9IH0pO1xuICAgICAgYXdhaXQgZ2V0Q3R4KCkuc2F2ZVdvcmxkSW5mbz8uKGJvb2ssIGRhdGEpO1xuICAgIH1cbiAgICByZXR1cm4gdXBkYXRlZDtcbiAgfWNhdGNoKGUpeyB3YXJuKGUpOyByZXR1cm4gdXBkYXRlZDsgfVxufVxuZnVuY3Rpb24gc2FmZUdldFBlcnNvbmFOYW1lcygpOiBzdHJpbmdbXXtcbiAgaWYgKGhhc0hlbHBlcignZ2V0UGVyc29uYU5hbWVzJykpIHsgdHJ5eyByZXR1cm4gKHdpbmRvdyBhcyBhbnkpLnNhZmVHZXRQZXJzb25hTmFtZXMoKTsgfWNhdGNoKGUpe30gfVxuICByZXR1cm4gW107XG59XG5mdW5jdGlvbiBzYWZlR2V0Q3VycmVudFBlcnNvbmFOYW1lKCk6IHN0cmluZ3xudWxse1xuICBpZiAoaGFzSGVscGVyKCdnZXRDdXJyZW50UGVyc29uYU5hbWUnKSkgeyB0cnl7IHJldHVybiAod2luZG93IGFzIGFueSkuc2FmZUdldEN1cnJlbnRQZXJzb25hTmFtZSgpOyB9Y2F0Y2goZSl7fSB9XG4gIHRyeXsgcmV0dXJuIGdldEN0eCgpPy5uYW1lMSB8fCBudWxsOyB9Y2F0Y2h7IHJldHVybiBudWxsOyB9XG59XG5mdW5jdGlvbiBnZXRVc2VyTmFtZSgpOiBzdHJpbmcge1xuICBjb25zdCBjdHggPSBnZXRDdHgoKTtcbiAgcmV0dXJuIGN0eD8ubmFtZTEgfHwgKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN5b3VyX25hbWUnKSBhcyBIVE1MSW5wdXRFbGVtZW50KT8udmFsdWUgfHwgKHR5cGVvZiBnZXRDdXJyZW50UGVyc29uYU5hbWUgPT09ICdmdW5jdGlvbicgPyAoc2FmZUdldEN1cnJlbnRQZXJzb25hTmFtZSgpIGFzIGFueSkoKSA6IG51bGwpIHx8ICfnjqnlrrYnO1xufVxuZnVuY3Rpb24gZ2V0VXNlckF2YXRhcigpOiBzdHJpbmcge1xuICB0cnkgeyBpZiAodHlwZW9mIGdldFBlcnNvbmFBdmF0YXJQYXRoID09PSAnZnVuY3Rpb24nKSB7IGNvbnN0IHAgPSAoZ2V0UGVyc29uYUF2YXRhclBhdGggYXMgYW55KSgnY3VycmVudCcpOyBpZiAocCkgcmV0dXJuIHA7IH0gfSBjYXRjaCB7fVxuICBjb25zdCBpbWcgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdXNlcl9hdmF0YXJfYmxvY2sgaW1nLCAjcGVyc29uYV9hdmF0YXJfYmxvY2sgaW1nLCAudXNlcl9hdmF0YXIgaW1nJykgYXMgSFRNTEltYWdlRWxlbWVudCB8IG51bGw7XG4gIGlmIChpbWc/LnNyYykgcmV0dXJuIGltZy5zcmM7XG4gIGNvbnN0IGN0eCA9IGdldEN0eCgpO1xuICBpZiAoY3R4Py51c2VyQXZhdGFyKSByZXR1cm4gY3R4LnVzZXJBdmF0YXI7XG4gIHJldHVybiAnLi9pbWcvYWkyLnBuZyc7XG59XG5mdW5jdGlvbiBlc2NhcGVIdG1sKHM6IHN0cmluZykgeyByZXR1cm4gXy5lc2NhcGUoU3RyaW5nKHMgPz8gJycpKTsgfVxuXG4vLyAtLS0tLS0tLS0tIENTUyAtLS0tLS0tLS0tXG5mdW5jdGlvbiBpbmplY3RTdHlsZSgpIHtcbiAgJChgIyR7RENfU1RZTEVfSUR9YCkucmVtb3ZlKCk7XG4gIGNvbnN0IGNzcyA9IGBcbjpyb290e1xuICAtLWRjLWd1aWxkOiMxZTFmMjI7IC0tZGMtc2lkZWJhcjojMmIyZDMxOyAtLWRjLWNoYXQ6IzMxMzMzODsgLS1kYy1pbnB1dDojMzgzYTQwO1xuICAtLWRjLWhvdmVyOiMzNTM3M2M7IC0tZGMtYWN0aXZlOiM0MDQyNDk7IC0tZGMtdGV4dDojZjJmM2Y1OyAtLWRjLW11dGVkOiM5NDliYTQ7XG4gIC0tZGMtc3ViOiNiNWJhYzE7IC0tZGMtYmx1ZTojNTg2NWYyOyAtLWRjLWJsdWUtaG92ZXI6IzQ3NTJjNDsgLS1kYy1zZXA6IzIzMjQyODsgLS1kYy1saW5lOiMzZjQxNDc7XG4gIC0tZGMtZ3JlZW46IzIzYTU1OTsgLS1kYy1yZWQ6I2VkNDI0NTsgLS1kYy15ZWxsb3c6I2ZlZTc1Yztcbn1cbmJvZHkuZGMtZGlzY29yZC1lbmFibGVke2JhY2tncm91bmQ6dmFyKC0tZGMtY2hhdCkhaW1wb3J0YW50O21hcmdpbjowIWltcG9ydGFudDtvdmVyZmxvdzpoaWRkZW4haW1wb3J0YW50fVxuYm9keS5kYy1kaXNjb3JkLWVuYWJsZWQgI2JnMSxib2R5LmRjLWRpc2NvcmQtZW5hYmxlZCAjYmdfY3VzdG9te2ZpbHRlcjpicmlnaHRuZXNzKDAuNzgpfVxuXG4vKiBoaWRkZW4gb3JpZ2luYWxzIGJ1dCBrZWVwIGFjY2Vzc2libGUgZm9yIGxvZ2ljICovXG5ib2R5LmRjLWRpc2NvcmQtZW5hYmxlZCAjdG9wLWJhcntkaXNwbGF5Om5vbmUhaW1wb3J0YW50fVxuYm9keS5kYy1kaXNjb3JkLWVuYWJsZWQgI3NoZWxkaGVhZGVye2Rpc3BsYXk6bm9uZSFpbXBvcnRhbnR9XG5ib2R5LmRjLWRpc2NvcmQtZW5hYmxlZCAjcmlnaHQtbmF2LXBhbmVse2Rpc3BsYXk6bm9uZSFpbXBvcnRhbnR9XG5cbi8qIHJvb3QgKi9cbiNkYy1yb290e2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpyb3c7aGVpZ2h0OjEwMHZoO2hlaWdodDoxMDBkdmg7d2lkdGg6MTAwdnc7b3ZlcmZsb3c6aGlkZGVuO2ZvbnQtZmFtaWx5OlwiZ2cgc2Fuc1wiLFwiTm90byBTYW5zXCIsV2hpdG5leSxcIkhlbHZldGljYSBOZXVlXCIsSGVsdmV0aWNhLEFyaWFsLFwiUGluZ0ZhbmcgU0NcIixcIk5vdG8gU2FucyBTQ1wiLHNhbnMtc2VyaWY7YmFja2dyb3VuZDp2YXIoLS1kYy1jaGF0KTtwb3NpdGlvbjpyZWxhdGl2ZTt6LWluZGV4OjEwfVxuLyogZ3VpbGQgYmFyICovXG4jZGMtZ3VpbGQtYmFye3dpZHRoOjcycHg7bWluLXdpZHRoOjcycHgvKiBsaXZlIHRlc3QgKi87YmFja2dyb3VuZDp2YXIoLS1kYy1ndWlsZCk7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjthbGlnbi1pdGVtczpjZW50ZXI7cGFkZGluZzoxMnB4IDAgODBweCAwO2dhcDo4cHg7b3ZlcmZsb3cteTphdXRvO292ZXJmbG93LXg6aGlkZGVuO3Njcm9sbGJhci13aWR0aDpub25lO2ZsZXgtc2hyaW5rOjB9XG4jZGMtZ3VpbGQtYmFyOjotd2Via2l0LXNjcm9sbGJhcnt3aWR0aDowfVxuLmRjLWd1aWxkLWl0ZW17d2lkdGg6NDhweDtoZWlnaHQ6NDhweDtib3JkZXItcmFkaXVzOjE2cHg7YmFja2dyb3VuZDojMzEzMzM4O292ZXJmbG93OmhpZGRlbjtjdXJzb3I6cG9pbnRlcjtwb3NpdGlvbjpyZWxhdGl2ZTtmbGV4LXNocmluazowO3RyYW5zaXRpb246IGJvcmRlci1yYWRpdXMgLjE1cywgYmFja2dyb3VuZCAuMTVzO2JveC1zaGFkb3c6bm9uZTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXJ9XG4uZGMtZ3VpbGQtaXRlbTpob3Zlcntib3JkZXItcmFkaXVzOjEycHg7YmFja2dyb3VuZDp2YXIoLS1kYy1hY3RpdmUpfVxuLmRjLWd1aWxkLWl0ZW0uYWN0aXZle2JvcmRlci1yYWRpdXM6MTJweDtiYWNrZ3JvdW5kOnZhcigtLWRjLWdyZWVuKX1cbi5kYy1ndWlsZC1pdGVtLmFjdGl2ZSBpbWd7Ym9yZGVyLXJhZGl1czoxMnB4fVxuLmRjLWd1aWxkLWl0ZW0gaW1ne3dpZHRoOjEwMCU7aGVpZ2h0OjEwMCU7b2JqZWN0LWZpdDpjb3Zlcjtib3JkZXItcmFkaXVzOjE2cHg7dHJhbnNpdGlvbjpib3JkZXItcmFkaXVzIC4xNXM7ZGlzcGxheTpibG9ja31cbi5kYy1ndWlsZC1pdGVtOmhvdmVyIGltZ3tib3JkZXItcmFkaXVzOjEycHh9XG4uZGMtZ3VpbGQtcGlsbHtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0Oi04cHg7dG9wOjUwJTt0cmFuc2Zvcm06dHJhbnNsYXRlWSgtNTAlKTt3aWR0aDo4cHg7aGVpZ2h0OjA7YmFja2dyb3VuZDp3aGl0ZTtib3JkZXItcmFkaXVzOjAgNHB4IDRweCAwO3RyYW5zaXRpb246aGVpZ2h0IC4xNXMsIHdpZHRoIC4xNXN9XG4uZGMtZ3VpbGQtaXRlbTpob3ZlciAuZGMtZ3VpbGQtcGlsbHtoZWlnaHQ6MjBweDt3aWR0aDo0cHh9XG4uZGMtZ3VpbGQtaXRlbS5hY3RpdmUgLmRjLWd1aWxkLXBpbGx7aGVpZ2h0OjQwcHghaW1wb3J0YW50O3dpZHRoOjRweCFpbXBvcnRhbnR9XG4uZGMtZ3VpbGQtc2Vwe3dpZHRoOjMycHg7aGVpZ2h0OjJweDtiYWNrZ3JvdW5kOiMzNTM2M2M7Ym9yZGVyLXJhZGl1czoxcHg7bWFyZ2luOjRweCAwfVxuLmRjLWd1aWxkLWFkZHt3aWR0aDo0OHB4O2hlaWdodDo0OHB4O2JvcmRlci1yYWRpdXM6MTZweDtiYWNrZ3JvdW5kOiMzMTMzMzg7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2NvbG9yOnZhcigtLWRjLWdyZWVuKTtmb250LXNpemU6MjBweDtjdXJzb3I6cG9pbnRlcjt0cmFuc2l0aW9uOi4xNXN9XG4uZGMtZ3VpbGQtYWRkOmhvdmVye2JvcmRlci1yYWRpdXM6MTJweDtiYWNrZ3JvdW5kOnZhcigtLWRjLWdyZWVuKTtjb2xvcjp3aGl0ZX1cbi8qIHRvb2x0aXAgKi9cbiNkYy10b29sdGlwe3Bvc2l0aW9uOmZpeGVkO2xlZnQ6MDt0b3A6MDtiYWNrZ3JvdW5kOiMxMTEyMTQ7Y29sb3I6I2YyZjNmNTtwYWRkaW5nOjZweCAxMHB4O2JvcmRlci1yYWRpdXM6NHB4O2ZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjYwMDtwb2ludGVyLWV2ZW50czpub25lO3otaW5kZXg6OTk5OTk7d2hpdGUtc3BhY2U6bm93cmFwO29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlWCg2cHgpO3RyYW5zaXRpb246b3BhY2l0eSAuMTJzLCB0cmFuc2Zvcm0gLjEycztib3gtc2hhZG93OjAgOHB4IDE2cHggcmdiYSgwLDAsMCwuMzUpfVxuI2RjLXRvb2x0aXAuc2hvd3tvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoMCl9XG4jZGMtdG9vbHRpcDo6YmVmb3Jle2NvbnRlbnQ6XCJcIjtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0Oi02cHg7dG9wOjUwJTt0cmFuc2Zvcm06dHJhbnNsYXRlWSgtNTAlKTtib3JkZXI6NnB4IHNvbGlkIHRyYW5zcGFyZW50O2JvcmRlci1yaWdodC1jb2xvcjojMTExMjE0fVxuXG4vKiBzaWRlYmFyICovXG4jZGMtc2lkZWJhcnt3aWR0aDoyNDBweDttaW4td2lkdGg6MjQwcHg7YmFja2dyb3VuZDp2YXIoLS1kYy1zaWRlYmFyKTtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2ZsZXgtc2hyaW5rOjA7Ym9yZGVyLXJpZ2h0OjFweCBzb2xpZCAjMWYyMTI0O3Bvc2l0aW9uOnJlbGF0aXZlO292ZXJmbG93OmhpZGRlbn1cbiNkYy1zaWRlYmFyLWhlYWRlcntoZWlnaHQ6NDhweDtwYWRkaW5nOjAgMTJweCAwIDE2cHg7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2Vlbjtib3JkZXItYm90dG9tOjFweCBzb2xpZCAjMWYyMTI0O2JveC1zaGFkb3c6MCAxcHggMCAjMWYyMTI0LDAgMXB4IDJweCByZ2JhKDAsMCwwLC4yKTtjdXJzb3I6cG9pbnRlcjtmbGV4LXNocmluazowO3VzZXItc2VsZWN0Om5vbmV9XG4jZGMtY2hhci1uYW1le2NvbG9yOnZhcigtLWRjLXRleHQpO2ZvbnQtd2VpZ2h0OjcwMDtmb250LXNpemU6MTVweDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo2cHg7d2hpdGUtc3BhY2U6bm93cmFwO292ZXJmbG93OmhpZGRlbjt0ZXh0LW92ZXJmbG93OmVsbGlwc2lzfVxuI2RjLWNoYXItbmFtZSBpe2ZvbnQtc2l6ZToxMXB4O2NvbG9yOnZhcigtLWRjLW11dGVkKTt0cmFuc2l0aW9uOnRyYW5zZm9ybSAuMTVzfVxuI2RjLXNpZGViYXItaGVhZGVyLm9wZW4gaXt0cmFuc2Zvcm06cm90YXRlKDE4MGRlZyl9XG4vKiBQMiBkcm9wZG93biAtIHNlcnZlciBtZW51IHN0eWxlICovXG4jZGMtY2hhci1kcm9wZG93bntwb3NpdGlvbjphYnNvbHV0ZTt0b3A6NTZweDtsZWZ0OjhweDtyaWdodDo4cHg7YmFja2dyb3VuZDojMTExMjE0O2JvcmRlcjoxcHggc29saWQgIzIzMjQyODtib3JkZXItcmFkaXVzOjhweDtwYWRkaW5nOjhweDtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDowO3otaW5kZXg6NTA7Ym94LXNoYWRvdzowIDhweCAxNnB4IHJnYmEoMCwwLDAsLjQpO3RyYW5zZm9ybS1vcmlnaW46dG9wIGNlbnRlcjt0cmFuc2l0aW9uOnRyYW5zZm9ybSAuMTVzLCBvcGFjaXR5IC4xNXN9XG4jZGMtY2hhci1kcm9wZG93bi5oaWRkZW57b3BhY2l0eTowO3BvaW50ZXItZXZlbnRzOm5vbmU7dHJhbnNmb3JtOnNjYWxlKDAuOTcpfVxuI2RjLWNoYXItZHJvcGRvd246bm90KC5oaWRkZW4pe29wYWNpdHk6MTt0cmFuc2Zvcm06c2NhbGUoMSl9XG4jZGMtZHJvcGRvd24tZ3JvdXB7cGFkZGluZzo2cHggMH1cbiNkYy1kcm9wZG93bi1ncm91cCArICNkYy1kcm9wZG93bi1ncm91cHtib3JkZXItdG9wOjFweCBzb2xpZCAjM2Y0MTQ3O21hcmdpbi10b3A6MnB4O3BhZGRpbmctdG9wOjhweH1cbi5kYy1kZC1pdGVte2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEwcHg7cGFkZGluZzowIDEwcHg7aGVpZ2h0OjQwcHg7Ym9yZGVyLXJhZGl1czo0cHg7Y29sb3I6I2RiZGVlMTtmb250LXNpemU6MTRweDtmb250LXdlaWdodDo1MDA7Y3Vyc29yOnBvaW50ZXI7dXNlci1zZWxlY3Q6bm9uZTtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2Vlbn1cbi5kYy1kZC1pdGVtOmhvdmVye2JhY2tncm91bmQ6dmFyKC0tZGMtYmx1ZSk7Y29sb3I6d2hpdGV9XG4uZGMtZGQtaXRlbTpob3ZlciAuZGMtZGQtaWNvbntjb2xvcjp3aGl0ZX1cbi5kYy1kZC1pdGVtLmFsdC1ob3Zlcjpob3ZlcntiYWNrZ3JvdW5kOiMzNTM3M2M7Y29sb3I6d2hpdGV9XG4uZGMtZGQtaWNvbnt3aWR0aDoxNnB4O3RleHQtYWxpZ246Y2VudGVyO2NvbG9yOiNiNWJhYzE7Zm9udC1zaXplOjE0cHh9XG4uZGMtZGQtYXJyb3d7Y29sb3I6I2I1YmFjMTtmb250LXNpemU6MTJweDttYXJnaW4tbGVmdDphdXRvfVxuLmRjLWRkLWl0ZW0uZGFuZ2Vye2NvbG9yOiNlZDQyNDV9XG4uZGMtZGQtaXRlbS5kYW5nZXIgLmRjLWRkLWljb257Y29sb3I6I2VkNDI0NX1cbi5kYy1kZC1pdGVtLmRhbmdlcjpob3ZlcntiYWNrZ3JvdW5kOiNlZDQyNDU7Y29sb3I6d2hpdGV9XG4uZGMtZGQtaXRlbS5kYW5nZXI6aG92ZXIgLmRjLWRkLWljb257Y29sb3I6d2hpdGV9XG4uZGMtZGQtc2Vwe2hlaWdodDoxcHg7YmFja2dyb3VuZDojM2Y0MTQ3O21hcmdpbjo0cHggMH1cbi5kYy1kZC10b2tlbntwYWRkaW5nOjhweCAxMHB4O2NvbG9yOiM5NDliYTQ7Zm9udC1zaXplOjEycHg7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVufVxuI2RjLWJhbm5lcntoZWlnaHQ6MTM2cHg7bWFyZ2luOjA7YmFja2dyb3VuZDojMWUxZjIyO3Bvc2l0aW9uOnJlbGF0aXZlO292ZXJmbG93OmhpZGRlbjtmbGV4LXNocmluazowfVxuI2RjLWJhbm5lciBpbWd7d2lkdGg6MTAwJTtoZWlnaHQ6MTAwJTtvYmplY3QtZml0OmNvdmVyO2Rpc3BsYXk6YmxvY2t9XG4jZGMtYmFubmVyOjphZnRlcntjb250ZW50OlwiXCI7cG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCh0cmFuc3BhcmVudCA0NSUsIHJnYmEoMCwwLDAsLjU1KSl9XG4vKiB2ZXJ0aWNhbCB0b29sYmFyIGluc2lkZSBzaWRlYmFyIChtb3ZlZCB0b3AtYmFyKSAqL1xuI2RjLXRvb2xiYXItdmVydGljYWx7cGFkZGluZzo4cHggOHB4IDRweCA4cHg7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6MnB4O2ZsZXgtc2hyaW5rOjA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgIzIzMjQyODttYXJnaW4tYm90dG9tOjRweH1cbiNkYy10b29sYmFyLXZlcnRpY2FsOmVtcHR5e2Rpc3BsYXk6bm9uZX1cbi5kYy10b29sYmFyLWxhYmVse2NvbG9yOiM5NDliYTQ7Zm9udC1zaXplOjExcHg7Zm9udC13ZWlnaHQ6NzAwO2xldHRlci1zcGFjaW5nOi4wMmVtO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTtwYWRkaW5nOjhweCA4cHggNHB4IDhweH1cbi5kYy12dG9vbHtwYWRkaW5nOjZweCA4cHg7Ym9yZGVyLXJhZGl1czo0cHg7Y29sb3I6Izk0OWJhNDtmb250LXNpemU6MTRweDtmb250LXdlaWdodDo1MDA7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OHB4O2N1cnNvcjpwb2ludGVyfVxuLmRjLXZ0b29sOmhvdmVye2JhY2tncm91bmQ6dmFyKC0tZGMtaG92ZXIpO2NvbG9yOiNkYmRlZTF9XG4uZGMtdnRvb2wuYWN0aXZle2JhY2tncm91bmQ6dmFyKC0tZGMtYWN0aXZlKTtjb2xvcjp3aGl0ZX1cbi5kYy12dG9vbCBpe3dpZHRoOjE4cHg7dGV4dC1hbGlnbjpjZW50ZXI7Zm9udC1zaXplOjE0cHh9XG4vKiBjaGFubmVscyAqL1xuI2RjLWNoYW5uZWxzLWhlYWRlcntwYWRkaW5nOjEycHggOHB4IDRweCAxNnB4O2NvbG9yOnZhcigtLWRjLW11dGVkKTtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDA7bGV0dGVyLXNwYWNpbmc6LjAyZW07dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjRweDtmbGV4LXNocmluazowfVxuI2RjLWNyZWF0ZS10ZW1we21hcmdpbjo4cHggOHB4IDZweCA4cHg7cGFkZGluZzo4cHggMTBweDtiYWNrZ3JvdW5kOnJnYmEoMTUxLDE1MSwxNTksMC4xMik7Y29sb3I6I2YyZjNmNTtib3JkZXI6MXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4wNCk7Ym9yZGVyLXJhZGl1czo4cHg7Zm9udC1zaXplOjEzcHg7Zm9udC13ZWlnaHQ6NTAwO2N1cnNvcjpwb2ludGVyO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjZweDtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO3RyYW5zaXRpb246LjE1c31cbiNkYy1jcmVhdGUtdGVtcDpob3ZlcntiYWNrZ3JvdW5kOnJnYmEoMTUxLDE1MSwxNTksMC4xOCk7Ym9yZGVyLWNvbG9yOnJnYmEoMjU1LDI1NSwyNTUsMC4wOCl9XG4jZGMtY2hhbm5lbC1saXN0e2ZsZXg6MTtvdmVyZmxvdy15OmF1dG87cGFkZGluZzowIDhweCA4OHB4IDhweDtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDoxcHg7c2Nyb2xsYmFyLXdpZHRoOnRoaW47c2Nyb2xsYmFyLWNvbG9yOiMxYTFiMWUgdHJhbnNwYXJlbnR9XG4jZGMtY2hhbm5lbC1saXN0Ojotd2Via2l0LXNjcm9sbGJhcnt3aWR0aDo2cHh9XG4jZGMtY2hhbm5lbC1saXN0Ojotd2Via2l0LXNjcm9sbGJhci10aHVtYntiYWNrZ3JvdW5kOiMxYTFiMWU7Ym9yZGVyLXJhZGl1czo0cHh9XG4uZGMtY2F0ZWdvcnl7Y29sb3I6Izk0OWJhNDtmb250LXNpemU6MTFweDtmb250LXdlaWdodDo3MDA7bGV0dGVyLXNwYWNpbmc6LjAyZW07dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO3BhZGRpbmc6MTBweCA2cHggMnB4IDZweDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo0cHh9XG4uZGMtY2hhbm5lbHtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo2cHg7cGFkZGluZzo2cHggOHB4O2JvcmRlci1yYWRpdXM6NHB4O2NvbG9yOiM5NDliYTQ7Zm9udC1zaXplOjE0cHg7Y3Vyc29yOnBvaW50ZXI7Zm9udC13ZWlnaHQ6NTAwO3VzZXItc2VsZWN0Om5vbmU7cG9zaXRpb246cmVsYXRpdmV9XG4uZGMtY2hhbm5lbDpob3ZlcntiYWNrZ3JvdW5kOnZhcigtLWRjLWhvdmVyKTtjb2xvcjojZGJkZWUxfVxuLmRjLWNoYW5uZWwuYWN0aXZle2JhY2tncm91bmQ6dmFyKC0tZGMtYWN0aXZlKTtjb2xvcjp3aGl0ZX1cbi5kYy1jaGFubmVsIC5kYy1oYXNoe2ZvbnQtc2l6ZToxNXB4O2ZvbnQtd2VpZ2h0OjQwMDtjb2xvcjojODA4NDhlfVxuLmRjLWNoYW5uZWwuYWN0aXZlIC5kYy1oYXNoe2NvbG9yOndoaXRlfVxuLmRjLWNoYW5uZWwtYWN0aW9uc3ttYXJnaW4tbGVmdDphdXRvO2Rpc3BsYXk6ZmxleDtnYXA6NHB4O29wYWNpdHk6MH1cbi5kYy1jaGFubmVsOmhvdmVyIC5kYy1jaGFubmVsLWFjdGlvbnN7b3BhY2l0eToxfVxuLmRjLWNoYW5uZWwtYWN0aW9ucyBpe3dpZHRoOjE4cHg7aGVpZ2h0OjE4cHg7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2JvcmRlci1yYWRpdXM6M3B4O2ZvbnQtc2l6ZToxMXB4fVxuLmRjLWNoYW5uZWwtYWN0aW9ucyBpOmhvdmVye2JhY2tncm91bmQ6IzJiMmQzMX1cbi8qIGNoYXQgbWFpbiAqL1xuI2RjLWNoYXQtbWFpbntmbGV4OjE7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjttaW4td2lkdGg6MDtiYWNrZ3JvdW5kOnZhcigtLWRjLWNoYXQpO3Bvc2l0aW9uOnJlbGF0aXZlfVxuI2RjLXRvcC10b29sYmFyLWN1c3RvbXtoZWlnaHQ6NDhweDttaW4taGVpZ2h0OjQ4cHg7YmFja2dyb3VuZDp2YXIoLS1kYy1jaGF0KTtib3JkZXItYm90dG9tOjFweCBzb2xpZCAjMWYyMTI0O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47cGFkZGluZzowIDE2cHg7Z2FwOjhweDtib3gtc2hhZG93OjAgMXB4IDAgIzFmMjEyNDtmbGV4LXNocmluazowfVxuI2RjLWN1cnJlbnQtY2hhbm5lbHtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo4cHg7Y29sb3I6dmFyKC0tZGMtdGV4dCk7Zm9udC13ZWlnaHQ6NzAwO2ZvbnQtc2l6ZToxNXB4fVxuI2RjLWN1cnJlbnQtY2hhbm5lbCAuZGMtaGFzaHtjb2xvcjojODA4NDhlO2ZvbnQtc2l6ZToxOHB4fVxuI2RjLXRvcC1hY3Rpb25ze2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjJweDttYXJnaW4tbGVmdDphdXRvfVxuLmRjLXRvcC1pY29ue3dpZHRoOjMycHg7aGVpZ2h0OjMycHg7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2NvbG9yOnZhcigtLWRjLW11dGVkKTtmb250LXNpemU6MTZweDtjdXJzb3I6cG9pbnRlcjtib3JkZXItcmFkaXVzOjRweH1cbi5kYy10b3AtaWNvbjpob3ZlcntiYWNrZ3JvdW5kOnZhcigtLWRjLWhvdmVyKTtjb2xvcjojZGJkZWUxfVxuI2RjLWNoYXQtY29udGFpbmVye2ZsZXg6MTtvdmVyZmxvdy15OmF1dG87b3ZlcmZsb3cteDpoaWRkZW47cGFkZGluZzoxMnB4IDAgOHB4IDA7c2Nyb2xsYmFyLXdpZHRoOnRoaW47c2Nyb2xsYmFyLWNvbG9yOiMxYTFiMWUgdHJhbnNwYXJlbnQ7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbn1cbiNkYy1jaGF0LWNvbnRhaW5lcjo6LXdlYmtpdC1zY3JvbGxiYXJ7d2lkdGg6OHB4fVxuI2RjLWNoYXQtY29udGFpbmVyOjotd2Via2l0LXNjcm9sbGJhci10aHVtYntiYWNrZ3JvdW5kOiMxYTFiMWU7Ym9yZGVyLXJhZGl1czo0cHh9XG4jZGMtY2hhdC1jb250YWluZXIgI2NoYXR7ZGlzcGxheTpmbGV4IWltcG9ydGFudDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjJweDttYXgtd2lkdGg6MTAwJTttYXJnaW46MDtwYWRkaW5nOjA7YmFja2dyb3VuZDp0cmFuc3BhcmVudCFpbXBvcnRhbnQ7Ym94LXNoYWRvdzpub25lIWltcG9ydGFudDt3aWR0aDoxMDAlIWltcG9ydGFudH1cbiNkYy1jaGF0LWNvbnRhaW5lciAjY2hhdCAubWVze2Rpc3BsYXk6ZmxleDtnYXA6MTJweDtwYWRkaW5nOjZweCAxNnB4IDZweCA3MnB4O3Bvc2l0aW9uOnJlbGF0aXZlO2JhY2tncm91bmQ6dHJhbnNwYXJlbnQhaW1wb3J0YW50O2JvcmRlcjpub25lIWltcG9ydGFudDtib3JkZXItcmFkaXVzOjAhaW1wb3J0YW50O21hcmdpbjowIWltcG9ydGFudDttYXgtd2lkdGg6MTAwJSFpbXBvcnRhbnQ7dHJhbnNpdGlvbjpiYWNrZ3JvdW5kIC4wOHN9XG4jZGMtY2hhdC1jb250YWluZXIgI2NoYXQgLm1lczpob3ZlcntiYWNrZ3JvdW5kOiMyZTMwMzUhaW1wb3J0YW50fVxuI2RjLWNoYXQtY29udGFpbmVyICNjaGF0IC5tZXMgLmF2YXRhciwgI2RjLWNoYXQtY29udGFpbmVyICNjaGF0IC5tZXMgLm1lc0F2YXRhcldyYXBwZXIsICNkYy1jaGF0LWNvbnRhaW5lciAjY2hhdCAubWVzIC5hdmF0YXIgaW1ne3dpZHRoOjQwcHghaW1wb3J0YW50O2hlaWdodDo0MHB4IWltcG9ydGFudDtib3JkZXItcmFkaXVzOjUwJSFpbXBvcnRhbnQ7cG9zaXRpb246YWJzb2x1dGUhaW1wb3J0YW50O2xlZnQ6MTZweCFpbXBvcnRhbnQ7dG9wOjZweCFpbXBvcnRhbnQ7bWFyZ2luOjAhaW1wb3J0YW50fVxuI2RjLWNoYXQtY29udGFpbmVyICNjaGF0IC5tZXMgLm1lc19ibG9jaywjZGMtY2hhdC1jb250YWluZXIgI2NoYXQgLm1lcyAubWVzX3RleHR7ZmxleDoxO21pbi13aWR0aDowO2JhY2tncm91bmQ6dHJhbnNwYXJlbnQhaW1wb3J0YW50O2NvbG9yOiNkYmRlZTEhaW1wb3J0YW50O2ZvbnQtc2l6ZToxNXB4O2xpbmUtaGVpZ2h0OjEuMzc1O3BhZGRpbmc6MCFpbXBvcnRhbnR9XG4jZGMtY2hhdC1jb250YWluZXIgI2NoYXQgLm1lcyAuY2hfbmFtZSwjZGMtY2hhdC1jb250YWluZXIgI2NoYXQgLm1lcyAubmFtZXtjb2xvcjp2YXIoLS1kYy10ZXh0KSFpbXBvcnRhbnQ7Zm9udC13ZWlnaHQ6NTUwIWltcG9ydGFudDtmb250LXNpemU6MTUuNXB4IWltcG9ydGFudDttYXJnaW46MCA4cHggMnB4IDAhaW1wb3J0YW50O2Rpc3BsYXk6aW5saW5lLWZsZXghaW1wb3J0YW50O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OHB4fVxuI2RjLWNoYXQtY29udGFpbmVyICNjaGF0IC5tZXMgLm1lc190ZXh0e2NvbG9yOiNkYmRlZTEhaW1wb3J0YW50fVxuI2RjLWNoYXQtY29udGFpbmVyICNjaGF0IC5tZXMgLm1lc190ZXh0IHB7bWFyZ2luOjRweCAwfVxuI2RjLWNoYXQtY29udGFpbmVyICNjaGF0IC5tZXMgLnRpbWVzdGFtcCwjZGMtY2hhdC1jb250YWluZXIgI2NoYXQgLm1lcyAubWVzX3RpbWVzdGFtcHtjb2xvcjp2YXIoLS1kYy1tdXRlZCkhaW1wb3J0YW50O2ZvbnQtc2l6ZToxMXB4IWltcG9ydGFudDtmb250LXdlaWdodDo0MDAhaW1wb3J0YW50O29wYWNpdHk6MSFpbXBvcnRhbnR9XG4jZGMtY2hhdC1jb250YWluZXIgI2NoYXQgLm1lc19ib29rbWFyaywjZGMtY2hhdC1jb250YWluZXIgI2NoYXQgLm1lc19idXR0b25ze29wYWNpdHk6MDt0cmFuc2l0aW9uOi4xNXM7YmFja2dyb3VuZDojMzEzMzM4O2JvcmRlcjoxcHggc29saWQgIzQwNDI0OTtib3JkZXItcmFkaXVzOjZweDtib3gtc2hhZG93OjAgNHB4IDhweCByZ2JhKDAsMCwwLC4yKX1cbiNkYy1jaGF0LWNvbnRhaW5lciAjY2hhdCAubWVzOmhvdmVyIC5tZXNfYnV0dG9uc3tvcGFjaXR5OjF9XG4jZGMtaW5wdXQtd3JhcHtwYWRkaW5nOjAgMTZweCAxNnB4IDE2cHg7YmFja2dyb3VuZDp2YXIoLS1kYy1jaGF0KTtmbGV4LXNocmluazowfVxuI2RjLWlucHV0LXdyYXAgI2Zvcm1fc2hlbGR7bWFyZ2luOjAhaW1wb3J0YW50O2JhY2tncm91bmQ6dmFyKC0tZGMtaW5wdXQpIWltcG9ydGFudDtib3JkZXItcmFkaXVzOjhweCFpbXBvcnRhbnQ7Ym9yZGVyOm5vbmUhaW1wb3J0YW50O3BhZGRpbmc6MCAxMnB4IWltcG9ydGFudDtkaXNwbGF5OmZsZXghaW1wb3J0YW50O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbiFpbXBvcnRhbnQ7d2lkdGg6MTAwJSFpbXBvcnRhbnQ7bWF4LXdpZHRoOjEwMCUhaW1wb3J0YW50O2JveC1zaGFkb3c6bm9uZSFpbXBvcnRhbnQ7cG9zaXRpb246cmVsYXRpdmUhaW1wb3J0YW50O2xlZnQ6YXV0byFpbXBvcnRhbnQ7cmlnaHQ6YXV0byFpbXBvcnRhbnQ7Ym90dG9tOmF1dG8haW1wb3J0YW50fVxuI2RjLWlucHV0LXdyYXAgI3NlbmRfZm9ybXtiYWNrZ3JvdW5kOnRyYW5zcGFyZW50IWltcG9ydGFudDtib3JkZXI6bm9uZSFpbXBvcnRhbnQ7ZGlzcGxheTpmbGV4IWltcG9ydGFudDthbGlnbi1pdGVtczpmbGV4LWVuZCFpbXBvcnRhbnQ7Z2FwOjhweCFpbXBvcnRhbnQ7cGFkZGluZzo4cHggMCFpbXBvcnRhbnR9XG4jZGMtaW5wdXQtd3JhcCAjc2VuZF90ZXh0YXJlYXtmbGV4OjE7YmFja2dyb3VuZDp0cmFuc3BhcmVudCFpbXBvcnRhbnQ7Ym9yZGVyOm5vbmUhaW1wb3J0YW50O2NvbG9yOiNkYmRlZTEhaW1wb3J0YW50O21pbi1oZWlnaHQ6NDRweCFpbXBvcnRhbnQ7bWF4LWhlaWdodDo1MHZoIWltcG9ydGFudDtwYWRkaW5nOjEwcHggMCFpbXBvcnRhbnQ7cmVzaXplOm5vbmUhaW1wb3J0YW50O2ZvbnQtc2l6ZToxNXB4IWltcG9ydGFudDtsaW5lLWhlaWdodDoxLjM1IWltcG9ydGFudH1cbiNkYy1pbnB1dC13cmFwICNzZW5kX3RleHRhcmVhOjpwbGFjZWhvbGRlcntjb2xvcjojNmQ3NThkIWltcG9ydGFudH1cbiNkYy11c2VyLWZsb2F0e3Bvc2l0aW9uOmZpeGVkO2xlZnQ6OHB4O2JvdHRvbTo4cHg7d2lkdGg6Mjk2cHg7aGVpZ2h0OjUycHg7YmFja2dyb3VuZDojMzgzYTQwO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweDtwYWRkaW5nOjAgOHB4O2JvcmRlcjoxcHggc29saWQgIzNmNDE0Nztib3JkZXItcmFkaXVzOjhweDt6LWluZGV4OjMwO2JveC1zaGFkb3c6MCA0cHggOHB4IHJnYmEoMCwwLDAsMC4xNil9XG4jZGMtZ3VpbGQtYmFye3BhZGRpbmctYm90dG9tOjY4cHggIWltcG9ydGFudH1cbiNkYy1zaWRlYmFye3BhZGRpbmctYm90dG9tOjY4cHggIWltcG9ydGFudH1cbiNkYy1pbnB1dC13cmFwe3BhZGRpbmc6MCAxNnB4IDhweCAxNnB4ICFpbXBvcnRhbnR9XG4jZGMtaW5wdXQtd3JhcCAjZm9ybV9zaGVsZCwgI2RjLWlucHV0LXdyYXAgI3NlbmRfZm9ybSwgI2RjLWlucHV0LXdyYXAgZm9ybXtoZWlnaHQ6NTJweCAhaW1wb3J0YW50O21pbi1oZWlnaHQ6NTJweCAhaW1wb3J0YW50O21heC1oZWlnaHQ6NTJweCAhaW1wb3J0YW50O2JhY2tncm91bmQ6IzM4M2E0MCAhaW1wb3J0YW50O2JvcmRlcjoxcHggc29saWQgIzNmNDE0NyAhaW1wb3J0YW50O2JvcmRlci1yYWRpdXM6OHB4ICFpbXBvcnRhbnQ7Ym94LXNoYWRvdzowIDRweCA4cHggcmdiYSgwLDAsMCwwLjE2KSAhaW1wb3J0YW50fVxuI2RjLXVzZXItZmxvYXQgaW1ne3dpZHRoOjMycHg7aGVpZ2h0OjMycHg7Ym9yZGVyLXJhZGl1czo1MCU7b2JqZWN0LWZpdDpjb3ZlcjtiYWNrZ3JvdW5kOiMzMTMzMzg7ZmxleC1zaHJpbms6MH1cbiNkYy11c2VyLW5hbWV7ZmxleDoxO2NvbG9yOnZhcigtLWRjLXRleHQpO2ZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjYwMDt3aGl0ZS1zcGFjZTpub3dyYXA7b3ZlcmZsb3c6aGlkZGVuO3RleHQtb3ZlcmZsb3c6ZWxsaXBzaXN9XG4jZGMtdXNlci1zdGF0dXN7d2lkdGg6MTBweDtoZWlnaHQ6MTBweDtiYWNrZ3JvdW5kOiMyM2E1NTk7Ym9yZGVyLXJhZGl1czo1MCU7cG9zaXRpb246YWJzb2x1dGU7cmlnaHQ6LTFweDtib3R0b206LTFweDtib3JkZXI6MnB4IHNvbGlkICMyMzI0Mjh9XG4jZGMtYXZhdGFyLXdyYXB7cG9zaXRpb246cmVsYXRpdmU7ZmxleC1zaHJpbms6MH1cbiNkYy11c2VyLWdlYXJ7d2lkdGg6MzJweDtoZWlnaHQ6MzJweDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Ym9yZGVyLXJhZGl1czo0cHg7Y29sb3I6dmFyKC0tZGMtbXV0ZWQpO2N1cnNvcjpwb2ludGVyfVxuI2RjLXVzZXItZ2Vhcjpob3ZlcntiYWNrZ3JvdW5kOiMzNTM3M2M7Y29sb3I6I2RiZGVlMX1cbi8qIHVzZXIgbW9kYWwgKi9cbiNkYy11c2VyLW1vZGFsLmhpZGRlbiwgI2RjLWNoYXItbW9kYWwuaGlkZGVuLCAjZGMtd29ybGRib29rLW1vZGFsLmhpZGRlbiwgI2RjLWNvbnRleHQtbWVudS5oaWRkZW57ZGlzcGxheTpub25lIWltcG9ydGFudH1cbiNkYy11c2VyLW1vZGFse3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7ei1pbmRleDo5OTk5O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcn1cbiNkYy1tb2RhbC1iYWNrZHJvcHtwb3NpdGlvbjphYnNvbHV0ZTtpbnNldDowO2JhY2tncm91bmQ6cmdiYSgwLDAsMCwuNyk7YmFja2Ryb3AtZmlsdGVyOmJsdXIoMnB4KX1cbiNkYy11c2VyLXBhbmVse3Bvc2l0aW9uOnJlbGF0aXZlO3dpZHRoOm1pbigxMDAwcHgsOTR2dyk7aGVpZ2h0Om1pbig2ODBweCw4NnZoKTtiYWNrZ3JvdW5kOiMzMTMzMzg7Ym9yZGVyLXJhZGl1czo4cHg7b3ZlcmZsb3c6aGlkZGVuO2Rpc3BsYXk6ZmxleDtib3gtc2hhZG93OjAgMTJweCAzMnB4IHJnYmEoMCwwLDAsLjUpfVxuI2RjLXVzZXItbGVmdHt3aWR0aDoyNDBweDttaW4td2lkdGg6MjQwcHg7YmFja2dyb3VuZDojMmIyZDMxO3BhZGRpbmc6MTZweDtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDo4cHg7b3ZlcmZsb3cteTphdXRvfVxuI2RjLXVzZXItbGVmdCBpbWd7d2lkdGg6ODBweDtoZWlnaHQ6ODBweDtib3JkZXItcmFkaXVzOjUwJTtvYmplY3QtZml0OmNvdmVyO2JhY2tncm91bmQ6IzMxMzMzODtkaXNwbGF5OmJsb2NrO21hcmdpbjowIGF1dG99XG4jZGMtdXNlci1sZWZ0LW5hbWV7Y29sb3I6d2hpdGU7Zm9udC13ZWlnaHQ6NzAwO2ZvbnQtc2l6ZToxNnB4O3RleHQtYWxpZ246Y2VudGVyfVxuI2RjLXVzZXItbGVmdC1zdGF0dXN7Y29sb3I6Izk0OWJhNDtmb250LXNpemU6MTJweDt0ZXh0LWFsaWduOmNlbnRlcjttYXJnaW4tdG9wOi00cHh9XG4uZGMtdGFiLWJ0bntwYWRkaW5nOjhweCAxMHB4O2JvcmRlci1yYWRpdXM6NHB4O2NvbG9yOiM5NDliYTQ7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NTAwO2N1cnNvcjpwb2ludGVyO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweH1cbi5kYy10YWItYnRuOmhvdmVye2JhY2tncm91bmQ6IzM1MzczYztjb2xvcjojZGJkZWUxfVxuLmRjLXRhYi1idG4uYWN0aXZle2JhY2tncm91bmQ6IzQwNDI0OTtjb2xvcjp3aGl0ZX1cbiNkYy11c2VyLXJpZ2h0e2ZsZXg6MTtvdmVyZmxvdy15OmF1dG87cGFkZGluZzoyMHB4O2JhY2tncm91bmQ6IzMxMzMzOH1cbiNkYy11c2VyLXJpZ2h0IGgye2NvbG9yOndoaXRlO2ZvbnQtc2l6ZToyMHB4O2ZvbnQtd2VpZ2h0OjcwMDttYXJnaW46MCAwIDhweCAwfVxuI2RjLXVzZXItcmlnaHQgcC5kZXNje2NvbG9yOiNiNWJhYzE7Zm9udC1zaXplOjE0cHg7bWFyZ2luOjAgMCAxNnB4IDB9XG4uZGMtZmllbGR7bWFyZ2luOjE0cHggMH1cbi5kYy1maWVsZCBsYWJlbHtjb2xvcjojYjViYWMxO2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjcwMDtsZXR0ZXItc3BhY2luZzouMDJlbTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7ZGlzcGxheTpibG9jazttYXJnaW4tYm90dG9tOjZweH1cbi5kYy1pbnB1dCwgLmRjLXRleHRhcmVhLCAuZGMtc2VsZWN0e3dpZHRoOjEwMCU7YmFja2dyb3VuZDojMWUxZjIyO2JvcmRlcjpub25lO2JvcmRlci1yYWRpdXM6M3B4O2NvbG9yOiNkYmRlZTE7Zm9udC1zaXplOjE1cHg7cGFkZGluZzoxMHB4IDEycHg7b3V0bGluZTpub25lO2JveC1zaXppbmc6Ym9yZGVyLWJveH1cbi5kYy10ZXh0YXJlYXttaW4taGVpZ2h0OjEyMHB4O3Jlc2l6ZTp2ZXJ0aWNhbDtsaW5lLWhlaWdodDoxLjR9XG4uZGMtaW5wdXQ6Zm9jdXMsIC5kYy10ZXh0YXJlYTpmb2N1c3tib3gtc2hhZG93OjAgMCAwIDJweCByZ2JhKDg4LDEwMSwyNDIsLjYpfVxuLmRjLWJ0bi1wcmltYXJ5e2JhY2tncm91bmQ6IzU4NjVmMjtjb2xvcjp3aGl0ZTtib3JkZXI6bm9uZTtib3JkZXItcmFkaXVzOjNweDtwYWRkaW5nOjEwcHggMTZweDtmb250LXdlaWdodDo2MDA7Y3Vyc29yOnBvaW50ZXJ9XG4uZGMtYnRuLXByaW1hcnk6aG92ZXJ7YmFja2dyb3VuZDojNDc1MmM0fVxuLmRjLWJ0bi1zZWNvbmRhcnl7YmFja2dyb3VuZDojNGU1MDU4O2NvbG9yOndoaXRlO2JvcmRlcjpub25lO2JvcmRlci1yYWRpdXM6M3B4O3BhZGRpbmc6OHB4IDEycHg7Y3Vyc29yOnBvaW50ZXJ9XG4uZGMtYnRuLXNlY29uZGFyeTpob3ZlcntiYWNrZ3JvdW5kOiM2ZDZmNzh9XG4uZGMtYnRuLWRhbmdlcntiYWNrZ3JvdW5kOiNlZDQyNDU7Y29sb3I6d2hpdGU7Ym9yZGVyOm5vbmU7Ym9yZGVyLXJhZGl1czozcHg7cGFkZGluZzo4cHggMTJweH1cbi5kYy1kaXZpZGVye2hlaWdodDoxcHg7YmFja2dyb3VuZDojM2Y0MTQ3O21hcmdpbjoxNnB4IDB9XG4vKiBjaGFyIG1vZGFsIFA0ICovXG4jZGMtY2hhci1tb2RhbHtwb3NpdGlvbjpmaXhlZDtpbnNldDowO3otaW5kZXg6OTk5ODtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2JhY2tncm91bmQ6IzMxMzMzOH1cbiNkYy1jaGFyLW1vZGFsLXRvcHtoZWlnaHQ6NDhweDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpmbGV4LWVuZDtwYWRkaW5nOjAgMTZweDtib3JkZXItYm90dG9tOjFweCBzb2xpZCAjMWYyMTI0O2JhY2tncm91bmQ6IzMxMzMzODtmbGV4LXNocmluazowfVxuI2RjLWNoYXItY2xvc2V7d2lkdGg6MzJweDtoZWlnaHQ6MzJweDtib3JkZXItcmFkaXVzOjUwJTtiYWNrZ3JvdW5kOiM0ZTUwNTg7Y29sb3I6I2RiZGVlMTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Y3Vyc29yOnBvaW50ZXI7Ym9yZGVyOm5vbmV9XG4jZGMtY2hhci1jbG9zZTpob3ZlcntiYWNrZ3JvdW5kOiM2ZDZmNzh9XG4jZGMtY2hhci1ib2R5e2ZsZXg6MTtkaXNwbGF5OmZsZXg7b3ZlcmZsb3c6aGlkZGVufVxuI2RjLWNoYXItbGVmdHt3aWR0aDoyMzBweDttaW4td2lkdGg6MjMwcHg7YmFja2dyb3VuZDojMmIyZDMxO3BhZGRpbmc6MTZweCA4cHg7b3ZlcmZsb3cteTphdXRvO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjRweH1cbi5kYy1uYXYtdGl0bGV7Y29sb3I6Izk0OWJhNDtmb250LXNpemU6MTFweDtmb250LXdlaWdodDo3MDA7bGV0dGVyLXNwYWNpbmc6LjA2ZW07dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO3BhZGRpbmc6MTZweCA4cHggNHB4IDhweH1cbi5kYy1uYXYtaXRlbXtwYWRkaW5nOjhweCAxMHB4O2JvcmRlci1yYWRpdXM6NHB4O2NvbG9yOiM5NDliYTQ7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NTAwO2N1cnNvcjpwb2ludGVyO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweH1cbi5kYy1uYXYtaXRlbTpob3ZlcntiYWNrZ3JvdW5kOiMzNTM3M2M7Y29sb3I6I2RiZGVlMX1cbi5kYy1uYXYtaXRlbS5hY3RpdmV7YmFja2dyb3VuZDojNDA0MjQ5O2NvbG9yOndoaXRlfVxuI2RjLWNoYXItcmlnaHR7ZmxleDoxO292ZXJmbG93LXk6YXV0bztwYWRkaW5nOjI0cHggMzJweDtiYWNrZ3JvdW5kOiMzMTMzMzh9XG4jZGMtY2hhci1yaWdodC1pbm5lcnttYXgtd2lkdGg6NzQwcHh9XG4jZGMtY2hhci1yaWdodCBoMntjb2xvcjp3aGl0ZTtmb250LXNpemU6MjBweDtmb250LXdlaWdodDo4MDA7bWFyZ2luOjAgMCA2cHggMH1cbiNkYy1jaGFyLXJpZ2h0IHAuZGVzY3tjb2xvcjojYjViYWMxO2ZvbnQtc2l6ZToxNHB4O21hcmdpbjowIDAgMjBweCAwfVxuLmRjLWFjY29yZGlvbntib3JkZXItdG9wOjFweCBzb2xpZCAjM2Y0MTQ3fVxuLmRjLWFjYy1oZWFke2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47cGFkZGluZzoxNnB4IDA7Y29sb3I6I2YyZjNmNTtmb250LXdlaWdodDo2MDA7Y3Vyc29yOnBvaW50ZXI7dXNlci1zZWxlY3Q6bm9uZX1cbi5kYy1hY2MtaGVhZCBzcGFuLnN1Yntjb2xvcjojYjViYWMxO2ZvbnQtd2VpZ2h0OjQwMDtmb250LXNpemU6MTNweH1cbi5kYy1hY2MtYm9keXtkaXNwbGF5Om5vbmU7cGFkZGluZzowIDAgMTZweCAwfVxuLmRjLWFjYy1ib2R5Lm9wZW57ZGlzcGxheTpibG9jazthbmltYXRpb246ZGNGYWRlIC4xNXMgZWFzZX1cbkBrZXlmcmFtZXMgZGNGYWRle2Zyb217b3BhY2l0eTowfXRve29wYWNpdHk6MX19XG4uZGMtcHJldmlldy1jYXJke3Bvc2l0aW9uOmFic29sdXRlO3JpZ2h0OjI0cHg7dG9wOjg0cHg7d2lkdGg6MjgwcHg7YmFja2dyb3VuZDojMjMyNDI4O2JvcmRlci1yYWRpdXM6OHB4O292ZXJmbG93OmhpZGRlbjtib3gtc2hhZG93OjAgOHB4IDE2cHggcmdiYSgwLDAsMCwuMyk7Ym9yZGVyOjFweCBzb2xpZCAjMWYyMTI0fVxuLmRjLXByZXZpZXctY2FyZCBpbWd7d2lkdGg6MTAwJTtoZWlnaHQ6MTgwcHg7b2JqZWN0LWZpdDpjb3ZlcjtkaXNwbGF5OmJsb2NrfVxuLmRjLXByZXZpZXctY2FyZCAuaW5mb3twYWRkaW5nOjEycHh9XG4uZGMtcHJldmlldy1jYXJkIC5pbmZvIGJ7Y29sb3I6d2hpdGV9XG4uZGMtcHJldmlldy1jYXJkIC5pbmZvIHB7Y29sb3I6I2I1YmFjMTtmb250LXNpemU6MTNweDttYXJnaW46NnB4IDAgMCAwfVxuLmRjLXNhdmUtYmFye3Bvc2l0aW9uOnN0aWNreTtib3R0b206LTI0cHg7bWFyZ2luOjI0cHggLTMycHggLTI0cHggLTMycHg7YmFja2dyb3VuZDojMmIyZDMxO2JvcmRlci10b3A6MXB4IHNvbGlkICMxZjIxMjQ7cGFkZGluZzoxMnB4IDE2cHg7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtnYXA6MTJweH1cbi5kYy1zYXZlLWJhciBzcGFue2NvbG9yOiNiNWJhYzE7Zm9udC1zaXplOjEzcHh9XG4vKiB3b3JsZGJvb2sgKi9cbi5kYy13Yi1lbnRyeXtwYWRkaW5nOjEycHg7Ym9yZGVyOjFweCBzb2xpZCAjM2Y0MTQ3O2JvcmRlci1yYWRpdXM6NnB4O2JhY2tncm91bmQ6IzJiMmQzMTttYXJnaW46OHB4IDB9XG4uZGMtd2ItZW50cnktaGVhZHtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo4cHg7Y29sb3I6d2hpdGU7Zm9udC13ZWlnaHQ6NjAwfVxuLmRjLXdiLWVudHJ5LWhlYWQgc21hbGx7Y29sb3I6Izk0OWJhNDtmb250LXdlaWdodDo0MDB9XG4uZGMtd2ItY29udGVudHtjb2xvcjojYjViYWMxO2ZvbnQtc2l6ZToxM3B4O21hcmdpbjo2cHggMDt3aGl0ZS1zcGFjZTpwcmUtd3JhcDt3b3JkLWJyZWFrOmJyZWFrLXdvcmR9XG4uZGMtd2Ita2V5c3tjb2xvcjojOTQ5YmE0O2ZvbnQtc2l6ZToxMXB4O21hcmdpbi10b3A6NHB4fVxuLmRjLXBpbGx7ZGlzcGxheTppbmxpbmUtYmxvY2s7YmFja2dyb3VuZDojNDA0MjQ5O2NvbG9yOiNkYmRlZTE7Ym9yZGVyLXJhZGl1czo5OTlweDtwYWRkaW5nOjJweCA4cHg7Zm9udC1zaXplOjExcHg7bWFyZ2luOjJweH1cbi8qIGNvbnRleHQgbWVudSAqL1xuI2RjLWNvbnRleHQtbWVudXtwb3NpdGlvbjpmaXhlZDt6LWluZGV4Ojk5OTk7YmFja2dyb3VuZDojMTExMjE0O2JvcmRlcjoxcHggc29saWQgIzIzMjQyODtib3JkZXItcmFkaXVzOjZweDtwYWRkaW5nOjZweDttaW4td2lkdGg6MTgwcHg7Ym94LXNoYWRvdzowIDhweCAxNnB4IHJnYmEoMCwwLDAsLjQpO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjJweH1cbiNkYy1jb250ZXh0LW1lbnUgYnV0dG9ue2JhY2tncm91bmQ6dHJhbnNwYXJlbnQ7Ym9yZGVyOm5vbmU7Y29sb3I6I2RiZGVlMTt0ZXh0LWFsaWduOmxlZnQ7cGFkZGluZzo4cHggMTBweDtib3JkZXItcmFkaXVzOjRweDtjdXJzb3I6cG9pbnRlcjtmb250LXNpemU6MTNweH1cbiNkYy1jb250ZXh0LW1lbnUgYnV0dG9uOmhvdmVye2JhY2tncm91bmQ6IzM1MzczY31cbiNkYy1jb250ZXh0LW1lbnUgYnV0dG9uLmRhbmdlcntjb2xvcjojZWQ0MjQ1fVxuLyogc2VsZWN0IGNoYXJhY3RlciBwYWdlIGNsZWFudXAgKi9cbmJvZHkuZGMtZGlzY29yZC1lbmFibGVkICNybV9wcmludF9jaGFyYWN0ZXJzX2Jsb2NrIC5jaGFyYWN0ZXJfc2VsZWN0OmhhcyguY2hfbmFtZSl7ZGlzcGxheTpmbGV4IWltcG9ydGFudH1cbmJvZHkuZGMtZGlzY29yZC1lbmFibGVkIC5kYy1oaWRkZW4tZW1vaml7ZGlzcGxheTpub25lIWltcG9ydGFudH1cbi8qIHNjcm9sbGJhciAqL1xuKntzY3JvbGxiYXItd2lkdGg6dGhpbjtzY3JvbGxiYXItY29sb3I6IzFhMWIxZSB0cmFuc3BhcmVudH1cblxuLyogPT09IENoYXQgbWVzc2FnZSBEaXNjb3JkIHNwZWMgPT09ICovXG4jZGMtY2hhdC1jb250YWluZXIgI2NoYXQgLm1lc3tmbGV4LWRpcmVjdGlvbjpyb3cgIWltcG9ydGFudDtqdXN0aWZ5LWNvbnRlbnQ6ZmxleC1zdGFydCAhaW1wb3J0YW50O2FsaWduLWl0ZW1zOmZsZXgtc3RhcnQgIWltcG9ydGFudDtwb3NpdGlvbjpyZWxhdGl2ZX1cbiNkYy1jaGF0LWNvbnRhaW5lciAjY2hhdCAubWVzLmlzX3VzZXJ7ZmxleC1kaXJlY3Rpb246cm93ICFpbXBvcnRhbnQ7anVzdGlmeS1jb250ZW50OmZsZXgtc3RhcnQgIWltcG9ydGFudH1cbiNkYy1jaGF0LWNvbnRhaW5lciAjY2hhdCAubWVzIC5hdmF0YXJ7b3JkZXI6MCAhaW1wb3J0YW50O2ZsZXgtc2hyaW5rOjAgIWltcG9ydGFudH1cbiNkYy1jaGF0LWNvbnRhaW5lciAjY2hhdCAubWVzIC5tZXNfYmxvY2t7b3JkZXI6MSAhaW1wb3J0YW50O2ZsZXg6MTttaW4td2lkdGg6MH1cbiNkYy1jaGF0LWNvbnRhaW5lciAjY2hhdCAubWVzIC5uYW1lX3RleHRfd3JhcHBlcntkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6YmFzZWxpbmU7Z2FwOjZweDttYXJnaW4tYm90dG9tOjJweDtmbGV4LXdyYXA6d3JhcH1cbiNkYy1jaGF0LWNvbnRhaW5lciAjY2hhdCAubWVzIC5uYW1lX3RleHR7Zm9udC1zaXplOjE1cHg7Zm9udC13ZWlnaHQ6NTAwO2xpbmUtaGVpZ2h0OjEuMzc1O2N1cnNvcjpwb2ludGVyfVxuI2RjLWNoYXQtY29udGFpbmVyICNjaGF0IC5tZXM6bm90KC5pc191c2VyKSAubmFtZV90ZXh0e2NvbG9yOiNmMmYzZjV9XG4jZGMtY2hhdC1jb250YWluZXIgI2NoYXQgLm1lcy5pc191c2VyIC5uYW1lX3RleHR7Y29sb3I6I2U4ZWFlZH1cbiNkYy1jaGF0LWNvbnRhaW5lciAjY2hhdCAubWVzIC50aW1lc3RhbXB7Zm9udC1zaXplOjExcHggIWltcG9ydGFudDtjb2xvcjojNzI3NjdkICFpbXBvcnRhbnQ7Zm9udC13ZWlnaHQ6NDAwICFpbXBvcnRhbnQ7bWFyZ2luLWxlZnQ6NHB4fVxuI2RjLWNoYXQtY29udGFpbmVyICNjaGF0IC5tZXMgLm1lc190ZXh0e2ZvbnQtc2l6ZToxNXB4O2xpbmUtaGVpZ2h0OjEuMzc1O2NvbG9yOiNkY2RkZGU7d29yZC13cmFwOmJyZWFrLXdvcmR9XG4jZGMtY2hhdC1jb250YWluZXIgI2NoYXQgLm1lcy5jb250aW51ZSAuYXZhdGFye3Zpc2liaWxpdHk6aGlkZGVuICFpbXBvcnRhbnR9XG4jZGMtY2hhdC1jb250YWluZXIgI2NoYXQgLm1lcy5jb250aW51ZSAubmFtZV90ZXh0X3dyYXBwZXJ7ZGlzcGxheTpub25lICFpbXBvcnRhbnR9XG4uZGlzY29yZC1uYW1lLXRhZ3tkaXNwbGF5OmlubGluZS1mbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjttYXJnaW4tbGVmdDo2cHg7cGFkZGluZzoxcHggNnB4O2JvcmRlci1yYWRpdXM6NHB4O2ZvbnQtc2l6ZToxMXB4O2ZvbnQtd2VpZ2h0OjUwMDt2ZXJ0aWNhbC1hbGlnbjptaWRkbGU7bGluZS1oZWlnaHQ6MS40O2N1cnNvcjpkZWZhdWx0O3doaXRlLXNwYWNlOm5vd3JhcDttYXgtd2lkdGg6MTIwcHg7b3ZlcmZsb3c6aGlkZGVuO3RleHQtb3ZlcmZsb3c6ZWxsaXBzaXM7dHJhbnNpdGlvbjpiYWNrZ3JvdW5kIC4xcyxjb2xvciAuMXN9XG4uZGlzY29yZC1uYW1lLXRhZy5jaGFyLXRhZ3tiYWNrZ3JvdW5kOnJnYmEoODgsMTAxLDI0MiwwLjE1KTtjb2xvcjojOTQ5YmE0O2JvcmRlcjoxcHggc29saWQgcmdiYSg4OCwxMDEsMjQyLDAuMil9XG4uZGlzY29yZC1uYW1lLXRhZy5jaGFyLXRhZzpob3ZlcntiYWNrZ3JvdW5kOnJnYmEoODgsMTAxLDI0MiwwLjI1KTtjb2xvcjojYzljZGZifVxuLmRpc2NvcmQtbmFtZS10YWcudXNlci10YWd7YmFja2dyb3VuZDpyZ2JhKDM1LDE2NSw5MCwwLjE1KTtjb2xvcjojOTQ5YmE0O2JvcmRlcjoxcHggc29saWQgcmdiYSgzNSwxNjUsOTAsMC4yKX1cbi5kaXNjb3JkLW5hbWUtdGFnLnVzZXItdGFnOmhvdmVye2JhY2tncm91bmQ6cmdiYSgzNSwxNjUsOTAsMC4yNSk7Y29sb3I6I2EzZDliNX1cbi5tZXNfYnV0dG9uc19kaXNjb3Jke3Bvc2l0aW9uOmFic29sdXRlO3RvcDotMThweDtyaWdodDo4cHg7ZGlzcGxheTpub25lO2JhY2tncm91bmQ6IzJiMmQzMTtib3JkZXItcmFkaXVzOjhweDtib3gtc2hhZG93OjAgNHB4IDhweCByZ2JhKDAsMCwwLDAuMyk7cGFkZGluZzo0cHg7Z2FwOjJweDthbGlnbi1pdGVtczpjZW50ZXI7ei1pbmRleDo1O2JvcmRlcjoxcHggc29saWQgIzIzMjQyOH1cbi5tZXM6aG92ZXIgLm1lc19idXR0b25zX2Rpc2NvcmR7ZGlzcGxheTpmbGV4fVxuLm1lc19idG5fZGlzY29yZHt3aWR0aDozMnB4O2hlaWdodDozMnB4O2JvcmRlci1yYWRpdXM6NHB4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtjdXJzb3I6cG9pbnRlcjtjb2xvcjojYjViYWMxO2ZvbnQtc2l6ZToxNXB4O3RyYW5zaXRpb246YmFja2dyb3VuZCAuMXMsY29sb3IgLjFzfVxuLm1lc19idG5fZGlzY29yZDpob3ZlcntiYWNrZ3JvdW5kOiMzNTM3M2M7Y29sb3I6I2YyZjNmNX1cbi5tZXNfYnRuX2Rpc2NvcmQuYnRuLWRlbGV0ZTpob3ZlcntiYWNrZ3JvdW5kOnJnYmEoMjM3LDY2LDY5LDAuMik7Y29sb3I6I2VkNDI0NX1cbi5tZXMtcmVhY3Rpb25ze2Rpc3BsYXk6ZmxleDtmbGV4LXdyYXA6d3JhcDtnYXA6NHB4O21hcmdpbi10b3A6NHB4fVxuLnJlYWN0aW9uLXBpbGx7ZGlzcGxheTppbmxpbmUtZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjRweDtiYWNrZ3JvdW5kOiMyYjJkMzE7Ym9yZGVyOjFweCBzb2xpZCAjM2Y0MTQ3O2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6NHB4IDhweDtjdXJzb3I6cG9pbnRlcjtmb250LXNpemU6MTNweDtjb2xvcjojZGJkZWUxO3RyYW5zaXRpb246YmFja2dyb3VuZCAuMXN9XG4ucmVhY3Rpb24tcGlsbC5zZWxmLXJlYWN0ZWR7YmFja2dyb3VuZDpyZ2JhKDg4LDEwMSwyNDIsMC4zKTtib3JkZXItY29sb3I6IzU4NjVmMn1cbi5yZWFjdGlvbi1waWxsOmhvdmVye2JhY2tncm91bmQ6IzM1MzczY31cbi5lbW9qaS1waWNrZXItZGlzY29yZHtwb3NpdGlvbjphYnNvbHV0ZTt3aWR0aDo0NDBweDttYXgtaGVpZ2h0OjQyMHB4O2JhY2tncm91bmQ6IzJiMmQzMTtib3JkZXItcmFkaXVzOjhweDtib3gtc2hhZG93OjAgOHB4IDE2cHggcmdiYSgwLDAsMCwwLjQpO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47b3ZlcmZsb3c6aGlkZGVuO3otaW5kZXg6MjAwO2JvcmRlcjoxcHggc29saWQgIzFlMWYyMn1cbi5lbW9qaS1waWNrZXItc2VhcmNoe3BhZGRpbmc6OHB4O2JvcmRlci1ib3R0b206MXB4IHNvbGlkICMzZjQxNDd9XG4uZW1vamktcGlja2VyLXNlYXJjaCBpbnB1dHt3aWR0aDoxMDAlO2JhY2tncm91bmQ6IzFlMWYyMjtib3JkZXI6bm9uZTtib3JkZXItcmFkaXVzOjRweDtwYWRkaW5nOjZweCAxMHB4O2NvbG9yOiNmMmYzZjU7Zm9udC1zaXplOjE0cHg7b3V0bGluZTpub25lfVxuLmVtb2ppLWdyaWR7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoOSwxZnIpO2dhcDoycHg7cGFkZGluZzo4cHg7b3ZlcmZsb3cteTphdXRvfVxuLmVtb2ppLWl0ZW17d2lkdGg6MzZweDtoZWlnaHQ6MzZweDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC1zaXplOjIycHg7Ym9yZGVyLXJhZGl1czo0cHg7Y3Vyc29yOnBvaW50ZXJ9XG4uZW1vamktaXRlbTpob3ZlcntiYWNrZ3JvdW5kOiMzNTM3M2N9XG4uZW1vamktcGlja2VyLWZvb3RlcntwYWRkaW5nOjZweCAxMnB4O2JhY2tncm91bmQ6IzIzMjQyODtmb250LXNpemU6MTJweDtjb2xvcjojNzI3NjdkO2JvcmRlci10b3A6MXB4IHNvbGlkICMzZjQxNDd9XG5cbkBtZWRpYShtYXgtd2lkdGg6OTAwcHgpeyNkYy1zaWRlYmFye3dpZHRoOjIwMHB4O21pbi13aWR0aDoyMDBweH0jZGMtZ3VpbGQtYmFye3dpZHRoOjYwcHg7bWluLXdpZHRoOjYwcHh9LmRjLWd1aWxkLWl0ZW0sLmRjLWd1aWxkLWFkZHt3aWR0aDo0MHB4O2hlaWdodDo0MHB4fSNkYy1jaGFyLWxlZnR7d2lkdGg6MjAwcHg7bWluLXdpZHRoOjIwMHB4fS5kYy1wcmV2aWV3LWNhcmR7ZGlzcGxheTpub25lfX1cbmA7XG4gIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgc3R5bGUuaWQgPSBEQ19TVFlMRV9JRDtcbiAgc3R5bGUudGV4dENvbnRlbnQgPSBjc3M7XG4gIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO1xufVxuXG4vLyAtLS0tLS0tLS0tIExheW91dCAtLS0tLS0tLS0tXG5mdW5jdGlvbiBlbnN1cmVSb290KCkge1xuICBpZiAoJCgnI2RjLXJvb3QnKS5sZW5ndGgpIHJldHVybjtcbiAgJCgnYm9keScpLmFkZENsYXNzKCdkYy1kaXNjb3JkLWVuYWJsZWQnKTtcbiAgY29uc3QgZ2xvYmFsSGVhZGVySHRtbCA9IGBcbjxkaXYgaWQ9XCJkYy1nbG9iYWwtaGVhZGVyXCI+XG4gIDxkaXYgc3R5bGU9XCJ3aWR0aDo4MHB4XCI+PC9kaXY+XG4gIDxkaXYgaWQ9XCJkYy1nbG9iYWwtaGVhZGVyLWNlbnRlclwiPlNpbGx5VGF2ZXJuPC9kaXY+XG4gIDxkaXYgaWQ9XCJkYy1nbG9iYWwtaGVhZGVyLXJpZ2h0XCI+XG4gICAgPGJ1dHRvbiBjbGFzcz1cImRjLWdsb2JhbC1idG5cIiBkYXRhLWFjdGlvbj1cImRvY3NcIiB0aXRsZT1cIuaWh+aho1wiPjxpIGNsYXNzPVwiZmEtc29saWQgZmEtYm9va1wiPjwvaT4g5paH5qGjPC9idXR0b24+XG4gICAgPGJ1dHRvbiBjbGFzcz1cImRjLWdsb2JhbC1idG5cIiBkYXRhLWFjdGlvbj1cImdpdGh1YlwiIHRpdGxlPVwiR2l0SHViXCI+PGkgY2xhc3M9XCJmYS1icmFuZHMgZmEtZ2l0aHViXCI+PC9pPiBHaXRIdWI8L2J1dHRvbj5cbiAgICA8YnV0dG9uIGNsYXNzPVwiZGMtZ2xvYmFsLWJ0blwiIGRhdGEtYWN0aW9uPVwiZGlzY29yZFwiIHRpdGxlPVwiRGlzY29yZFwiPjxpIGNsYXNzPVwiZmEtYnJhbmRzIGZhLWRpc2NvcmRcIj48L2k+IERpc2NvcmQ8L2J1dHRvbj5cbiAgPC9kaXY+XG48L2Rpdj5gO1xuICBjb25zdCByb290SHRtbCA9IGBcbiR7Z2xvYmFsSGVhZGVySHRtbH1cbjxkaXYgaWQ9XCJkYy1yb290XCI+XG4gIDxuYXYgaWQ9XCJkYy1ndWlsZC1iYXJcIj48L25hdj5cbiAgPGFzaWRlIGlkPVwiZGMtc2lkZWJhclwiPlxuICAgIDxkaXYgaWQ9XCJkYy1zaWRlYmFyLWhlYWRlclwiPjxzcGFuIGlkPVwiZGMtY2hhci1uYW1lXCI+6YCJ5oup6KeS6ImyIDxpIGNsYXNzPVwiZmEtc29saWQgZmEtY2hldnJvbi1kb3duXCI+PC9pPjwvc3Bhbj48L2Rpdj5cbiAgICA8ZGl2IGlkPVwiZGMtY2hhci1kcm9wZG93blwiIGNsYXNzPVwiaGlkZGVuXCI+PC9kaXY+XG4gICAgPGRpdiBpZD1cImRjLWJhbm5lclwiPjxpbWcgaWQ9XCJkYy1iYW5uZXItaW1nXCIgc3JjPVwiXCIgYWx0PVwiXCIgc3R5bGU9XCJkaXNwbGF5Om5vbmVcIj48L2Rpdj5cbiAgICA8ZGl2IGlkPVwiZGMtdG9vbGJhci12ZXJ0aWNhbFwiPjwvZGl2PlxuICAgIDxidXR0b24gaWQ9XCJkYy1jcmVhdGUtdGVtcFwiPu+8iyDliJvlu7rkuLTml7bogYrlpKk8L2J1dHRvbj5cbiAgICA8ZGl2IGlkPVwiZGMtY2hhbm5lbHMtaGVhZGVyXCI+PHNwYW4+5paH5a2X6aKR6YGTPC9zcGFuPjxzcGFuIGlkPVwiZGMtYWRkLWNoYW5uZWxcIiBzdHlsZT1cIm1hcmdpbi1sZWZ0OmF1dG87IGN1cnNvcjpwb2ludGVyOyBmb250LXNpemU6MTRweFwiPu+8izwvc3Bhbj48L2Rpdj5cbiAgICA8ZGl2IGlkPVwiZGMtY2hhbm5lbC1saXN0XCI+PC9kaXY+XG4gICAgPGRpdiBpZD1cImRjLXVzZXItZmxvYXRcIj5cbiAgICAgIDxkaXYgaWQ9XCJkYy1hdmF0YXItd3JhcFwiPjxpbWcgaWQ9XCJkYy11c2VyLWF2YXRhclwiIHNyYz1cIi4vaW1nL2FpMi5wbmdcIiAvPjxzcGFuIGlkPVwiZGMtdXNlci1zdGF0dXNcIj48L3NwYW4+PC9kaXY+XG4gICAgICA8c3BhbiBpZD1cImRjLXVzZXItbmFtZVwiPueOqeWutjwvc3Bhbj5cbiAgICAgIDxpIGlkPVwiZGMtdXNlci1nZWFyXCIgY2xhc3M9XCJmYS1zb2xpZCBmYS1nZWFyXCIgdGl0bGU9XCLnlKjmiLforr7nva5cIj48L2k+XG4gICAgPC9kaXY+XG4gIDwvYXNpZGU+XG4gIDxtYWluIGlkPVwiZGMtY2hhdC1tYWluXCI+XG4gICAgPGRpdiBpZD1cImRjLXRvcC10b29sYmFyLWN1c3RvbVwiPlxuICAgICAgPGRpdiBpZD1cImRjLWN1cnJlbnQtY2hhbm5lbFwiPjxzcGFuIGNsYXNzPVwiZGMtaGFzaFwiPiM8L3NwYW4+PHNwYW4gaWQ9XCJkYy1jdXJyZW50LWNoYW5uZWwtbmFtZVwiPuS4gOiIrDwvc3Bhbj48L2Rpdj5cbiAgICAgIDxkaXYgaWQ9XCJkYy10b3AtYWN0aW9uc1wiPjwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgaWQ9XCJkYy1jaGF0LWNvbnRhaW5lclwiPjwvZGl2PlxuICAgIDxkaXYgaWQ9XCJkYy1pbnB1dC13cmFwXCI+PC9kaXY+XG4gIDwvbWFpbj5cbjwvZGl2PlxuPGRpdiBpZD1cImRjLXRvb2x0aXBcIj48L2Rpdj5cbjxkaXYgaWQ9XCJkYy1jb250ZXh0LW1lbnVcIiBjbGFzcz1cImhpZGRlblwiPjwvZGl2PlxuPGRpdiBpZD1cImRjLXVzZXItbW9kYWxcIiBjbGFzcz1cImhpZGRlblwiPjxkaXYgaWQ9XCJkYy1tb2RhbC1iYWNrZHJvcFwiIGRhdGEtY2xvc2U9XCJ1c2VyXCI+PC9kaXY+PGRpdiBpZD1cImRjLXVzZXItcGFuZWxcIj48ZGl2IGlkPVwiZGMtdXNlci1sZWZ0XCI+PC9kaXY+PGRpdiBpZD1cImRjLXVzZXItcmlnaHRcIj48L2Rpdj48L2Rpdj48L2Rpdj5cbjxkaXYgaWQ9XCJkYy1jaGFyLW1vZGFsXCIgY2xhc3M9XCJoaWRkZW5cIj5cbiAgPGRpdiBpZD1cImRjLWNoYXItbW9kYWwtdG9wXCI+PGJ1dHRvbiBpZD1cImRjLWNoYXItY2xvc2VcIiB0aXRsZT1cIuWFs+mXrSBFU0NcIj7inJU8L2J1dHRvbj48L2Rpdj5cbiAgPGRpdiBpZD1cImRjLWNoYXItYm9keVwiPjxkaXYgaWQ9XCJkYy1jaGFyLWxlZnRcIj48L2Rpdj48ZGl2IGlkPVwiZGMtY2hhci1yaWdodFwiPjxkaXYgaWQ9XCJkYy1jaGFyLXJpZ2h0LWlubmVyXCI+PC9kaXY+PC9kaXY+PC9kaXY+XG48L2Rpdj5cbmA7XG4gICQoJ2JvZHknKS5wcmVwZW5kKHJvb3RIdG1sKTtcbiAgLy8gbW92ZSBjaGF0ICsgZm9ybSAoaGFuZGxlIGJvdGggbGVnYWN5IGFuZCBuZXcgU1Qgc3RydWN0dXJlcylcbiAgY29uc3QgJGNoYXQgPSAkKCcjY2hhdCcpOyBpZiAoJGNoYXQubGVuZ3RoKSAkKCcjZGMtY2hhdC1jb250YWluZXInKS5hcHBlbmQoJGNoYXQpO1xuICBjb25zdCAkZm9ybSA9ICQoJyNmb3JtX3NoZWxkJyk7IGlmICgkZm9ybS5sZW5ndGgpICQoJyNkYy1pbnB1dC13cmFwJykuYXBwZW5kKCRmb3JtKTtcbiAgY29uc3QgJHNoZWxkID0gJCgnI3NoZWxkJyk7XG4gIGlmICgkc2hlbGQubGVuZ3RoKSB7XG4gICAgLy8gTmV3IFNUIHVzZXMgI3NoZWxkIGFzIGNvbnRhaW5lcjsgbW92ZSBpdHMgY29udGVudCAoZXhjbHVkaW5nIGhlYWRlcikgdG8gaW5wdXQgd3JhcFxuICAgIGNvbnN0ICRzZW5kRm9ybSA9ICRzaGVsZC5maW5kKCcjc2VuZF9mb3JtLCBmb3JtJykuZmlyc3QoKTtcbiAgICBpZiAoJHNlbmRGb3JtLmxlbmd0aCkge1xuICAgICAgJCgnI2RjLWlucHV0LXdyYXAnKS5hcHBlbmQoJHNlbmRGb3JtKTtcbiAgICAgICRzZW5kRm9ybS5jc3MoeyBwb3NpdGlvbjoncmVsYXRpdmUnLCBsZWZ0OidhdXRvJywgcmlnaHQ6J2F1dG8nLCBib3R0b206J2F1dG8nLCB0b3A6J2F1dG8nLCB3aWR0aDonMTAwJScsIG1heFdpZHRoOicxMDAlJywgbWFyZ2luOicwJywgcGFkZGluZzonMCcgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEZhbGxiYWNrOiBtb3ZlIGFsbCBjaGlsZHJlbiBleGNlcHQgaGVhZGVyXG4gICAgICBjb25zdCAkY2hpbGRyZW4gPSAkc2hlbGQuY2hpbGRyZW4oKS5ub3QoJyNzaGVsZGhlYWRlcicpO1xuICAgICAgaWYgKCRjaGlsZHJlbi5sZW5ndGgpICQoJyNkYy1pbnB1dC13cmFwJykuYXBwZW5kKCRjaGlsZHJlbik7XG4gICAgICBlbHNlICQoJyNkYy1pbnB1dC13cmFwJykuYXBwZW5kKCRzaGVsZC5jb250ZW50cygpKTtcbiAgICB9XG4gICAgLy8gRW5zdXJlIHNoZWxkIGl0c2VsZiBpcyBoaWRkZW4gYnV0IG5vdCBibG9ja2luZ1xuICAgICRzaGVsZC5jc3MoeyBwb3NpdGlvbjonYWJzb2x1dGUnLCBsZWZ0OictOTk5OXB4JywgdG9wOictOTk5OXB4Jywgd2lkdGg6JzAnLCBoZWlnaHQ6JzAnLCBvdmVyZmxvdzonaGlkZGVuJywgb3BhY2l0eTonMCcsIHBvaW50ZXJFdmVudHM6J25vbmUnIH0pO1xuICAgIC8vIEFsc28gZW5zdXJlIHNlbmRfdGV4dGFyZWEgaWYgZXhpc3RzIGlzIGluc2lkZSBpbnB1dCB3cmFwXG4gICAgY29uc3QgJHRhID0gJCgnI3NlbmRfdGV4dGFyZWEsICN1c2VyX2lucHV0LCB0ZXh0YXJlYVtuYW1lPVwibWVzc2FnZVwiXScpO1xuICAgIGlmICgkdGEubGVuZ3RoICYmICEkdGEuY2xvc2VzdCgnI2RjLWlucHV0LXdyYXAnKS5sZW5ndGgpICQoJyNkYy1pbnB1dC13cmFwJykuYXBwZW5kKCR0YS5jbG9zZXN0KCdmb3JtLCBkaXYnKSk7XG4gIH1cbiAgLy8gRW5zdXJlIGFueSByZW1haW5pbmcgc2VuZCBhcmVhIGlzIHZpc2libGVcbiAgJCgnI2RjLWlucHV0LXdyYXAnKS5jc3MoeyBkaXNwbGF5OidibG9jaycsIG1pbkhlaWdodDonNjBweCcgfSk7XG4gICQoJyNkYy1pbnB1dC13cmFwICNzZW5kX2Zvcm0sICNkYy1pbnB1dC13cmFwIGZvcm0nKS5jc3MoeyBkaXNwbGF5OidmbGV4Jywgd2lkdGg6JzEwMCUnIH0pO1xuICAvLyBtb3ZlIHRvcC1zZXR0aW5ncy1ob2xkZXIgZHJhd2VycyBpY29ucyBpbnRvIHZlcnRpY2FsICsgdG9wIGFjdGlvbnNcbiAgYnVpbGRUb29sYmFyRnJvbUV4aXN0aW5nKCk7XG4gIC8vIEdsb2JhbCBoZWFkZXIgYnV0dG9uc1xuICAkKCcjZGMtZ2xvYmFsLWhlYWRlciBbZGF0YS1hY3Rpb249XCJkb2NzXCJdJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsICgpPT57XG4gICAgY29uc3QgbW9kYWw9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgbW9kYWwuc3R5bGUuY3NzVGV4dD0ncG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDt6LWluZGV4Ojk5OTk7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2JhY2tncm91bmQ6cmdiYSgwLDAsMCwwLjYpJztcbiAgICBtb2RhbC5pbm5lckhUTUw9JzxkaXYgc3R5bGU9XCJiYWNrZ3JvdW5kOiMzMTMzMzg7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzoyNHB4O21heC13aWR0aDo2MDBweDt3aWR0aDo5MCU7Y29sb3I6I2YyZjNmNVwiPjxoMiBzdHlsZT1cIm1hcmdpbjowIDAgMTJweCAwXCI+U2lsbHlUYXZlcm4g5paH5qGjPC9oMj48cCBzdHlsZT1cImNvbG9yOiNiNWJhYzFcIj7lrpjmlrnmlofmoaPlnLDlnYDvvJo8YSBocmVmPVwiaHR0cHM6Ly9kb2NzLnNpbGx5dGF2ZXJuLmFwcFwiIHRhcmdldD1cIl9ibGFua1wiIHN0eWxlPVwiY29sb3I6IzAwYThmY1wiPmh0dHBzOi8vZG9jcy5zaWxseXRhdmVybi5hcHA8L2E+PC9wPjxwIHN0eWxlPVwibWFyZ2luLXRvcDoxMnB4XCI+PGEgaHJlZj1cImh0dHBzOi8vZG9jcy5zaWxseXRhdmVybi5hcHBcIiB0YXJnZXQ9XCJfYmxhbmtcIiBjbGFzcz1cImRjLWJ0bi1wcmltYXJ5XCIgc3R5bGU9XCJkaXNwbGF5OmlubGluZS1ibG9jaztwYWRkaW5nOjhweCAxNnB4O2JhY2tncm91bmQ6IzU4NjVmMjtjb2xvcjp3aGl0ZTtib3JkZXItcmFkaXVzOjRweDt0ZXh0LWRlY29yYXRpb246bm9uZVwiPuaJk+W8gOaWh+ahozwvYT4gPGJ1dHRvbiBjbGFzcz1cImRjLWJ0bi1zZWNvbmRhcnlcIiBzdHlsZT1cIm1hcmdpbi1sZWZ0OjhweFwiPuWFs+mXrTwvYnV0dG9uPjwvcD48L2Rpdj4nO1xuICAgIG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCk9Pm1vZGFsLnJlbW92ZSgpKTtcbiAgICBtb2RhbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKT0+eyBpZihlLnRhcmdldD09PW1vZGFsKSBtb2RhbC5yZW1vdmUoKTsgfSk7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChtb2RhbCk7XG4gIH0pO1xuICAkKCcjZGMtZ2xvYmFsLWhlYWRlciBbZGF0YS1hY3Rpb249XCJnaXRodWJcIl0nKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgKCk9PiB3aW5kb3cub3BlbignaHR0cHM6Ly9naXRodWIuY29tL1NpbGx5VGF2ZXJuL1NpbGx5VGF2ZXJuJywnX2JsYW5rJykpO1xuICAkKCcjZGMtZ2xvYmFsLWhlYWRlciBbZGF0YS1hY3Rpb249XCJkaXNjb3JkXCJdJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsICgpPT4gd2luZG93Lm9wZW4oJ2h0dHBzOi8vZGlzY29yZC5nZy9zaWxseXRhdmVybicsJ19ibGFuaycpKTtcbiAgLy8gdG9vbHRpcCBlbGVtZW50XG4gIC8vIGNsb3NlIGhhbmRsZXJzXG4gICQoJyNkYy1tb2RhbC1iYWNrZHJvcCcpLm9uKCdjbGljaycsIGNsb3NlVXNlck1vZGFsKTtcbiAgJCgnI2RjLWNoYXItY2xvc2UnKS5vbignY2xpY2snLCBjbG9zZUNoYXJNb2RhbCk7XG4gICQoZG9jdW1lbnQpLm9uKCdrZXlkb3duJywgKGU6YW55KT0+e1xuICAgIGlmIChlLmtleT09PSdFc2NhcGUnKXsgY2xvc2VDaGFyTW9kYWwoKTsgY2xvc2VVc2VyTW9kYWwoKTsgaGlkZUNvbnRleHRNZW51KCk7ICQoJyNkYy1jaGFyLWRyb3Bkb3duJykuYWRkQ2xhc3MoJ2hpZGRlbicpOyAkKCcjZGMtc2lkZWJhci1oZWFkZXInKS5yZW1vdmVDbGFzcygnb3BlbicpOyB9XG4gIH0pO1xuICAkKGRvY3VtZW50KS5vbignY2xpY2snLCAoZTphbnkpPT57XG4gICAgaWYgKCEkKGUudGFyZ2V0KS5jbG9zZXN0KCcjZGMtc2lkZWJhci1oZWFkZXIsICNkYy1jaGFyLWRyb3Bkb3duJykubGVuZ3RoKXsgJCgnI2RjLWNoYXItZHJvcGRvd24nKS5hZGRDbGFzcygnaGlkZGVuJyk7ICQoJyNkYy1zaWRlYmFyLWhlYWRlcicpLnJlbW92ZUNsYXNzKCdvcGVuJyk7IH1cbiAgICBpZiAoISQoZS50YXJnZXQpLmNsb3Nlc3QoJyNkYy1jb250ZXh0LW1lbnUsIC5kYy1jaGFubmVsJykubGVuZ3RoKSBoaWRlQ29udGV4dE1lbnUoKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkVG9vbGJhckZyb21FeGlzdGluZygpe1xuICBjb25zdCAkaG9sZGVyID0gJCgnI3RvcC1zZXR0aW5ncy1ob2xkZXInKTtcbiAgaWYgKCEkaG9sZGVyLmxlbmd0aCkgcmV0dXJuO1xuICBjb25zdCAkdmVydGljYWwgPSAkKCcjZGMtdG9vbGJhci12ZXJ0aWNhbCcpO1xuICBjb25zdCAkdG9wQWN0aW9ucyA9ICQoJyNkYy10b3AtYWN0aW9ucycpO1xuICAkdmVydGljYWwuZW1wdHkoKTtcbiAgJHRvcEFjdGlvbnMuZW1wdHkoKTtcbiAgJGhvbGRlci5jc3MoeyBwb3NpdGlvbjonZml4ZWQnLCBsZWZ0OictOTk5OXB4JywgdG9wOicwJywgb3BhY2l0eTonMCcsIHBvaW50ZXJFdmVudHM6J25vbmUnLCB3aWR0aDonMCcsIGhlaWdodDonMCcsIG92ZXJmbG93OidoaWRkZW4nIH0pO1xuICBjb25zdCBhbGxvd1RvcEtleXdvcmRzID0gWyfkuJbnlYzkuaYnLCdBUEknLCfov57mjqUnXTtcbiAgY29uc3QgZGVueVZlcnRpY2FsS2V5d29yZHMgPSBbJ0FJIOWTjeW6lOmFjee9ricsJ0FJ5ZON5bqU6YWN572uJywn5LiW55WM5LmmJywnQVBJJywn6L+e5o6lJywn55So5oi36K6+572uJywn55So5oi36K6+5a6a566h55CGJywnUGVyc29uYScsJ+S6uuiuvicsJ+inkuiJsueuoeeQhicsJ+aJqeWxleeoi+W6jycsJ+aJqeWxlSddO1xuICAkaG9sZGVyLmZpbmQoJy5kcmF3ZXInKS5lYWNoKChfOmFueSwgZWw6YW55KT0+e1xuICAgIGNvbnN0ICRkID0gJChlbCk7XG4gICAgY29uc3QgJGljb24gPSAkZC5maW5kKCcuZHJhd2VyLWljb24nKS5maXJzdCgpO1xuICAgIGNvbnN0IHRpdGxlID0gKCRpY29uLmF0dHIoJ3RpdGxlJykgfHwgJGljb24uYXR0cignZGF0YS1pMThuJykgfHwgJGQuZmluZCgnLmRyYXdlci1oZWFkZXInKS50ZXh0KCkudHJpbSgpIHx8ICforr7nva4nKS50cmltKCk7XG4gICAgY29uc3QgZmEgPSAkaWNvbi5hdHRyKCdjbGFzcycpPy5tYXRjaCgvZmEtW2Etei1dKy9nKT8uam9pbignICcpIHx8ICdmYS1zb2xpZCBmYS1nZWFyJztcbiAgICBjb25zdCBpc1RvcEFsbG93ZWQgPSBhbGxvd1RvcEtleXdvcmRzLnNvbWUoaz0+dGl0bGUuaW5jbHVkZXMoaykpO1xuICAgIGNvbnN0IGlzVmVydGljYWxEZW5pZWQgPSBkZW55VmVydGljYWxLZXl3b3Jkcy5zb21lKGs9PnRpdGxlLmluY2x1ZGVzKGspKSB8fCB0aXRsZS5pbmNsdWRlcygnQUkg5ZON5bqUJykgfHwgdGl0bGUuaW5jbHVkZXMoJ0FJ5ZON5bqUJyk7XG4gICAgaWYgKGlzVG9wQWxsb3dlZCl7XG4gICAgICBjb25zdCAkdCA9ICQoYDxkaXYgY2xhc3M9XCJkYy10b3AtaWNvblwiIHRpdGxlPVwiJHtlc2NhcGVIdG1sKHRpdGxlKX1cIj48aSBjbGFzcz1cIiR7ZmF9XCI+PC9pPjwvZGl2PmApO1xuICAgICAgJHQub24oJ2NsaWNrJywgKCk9PntcbiAgICAgICAgJGljb24udHJpZ2dlcignY2xpY2snKTtcbiAgICAgICAgY29uc3QgJGNvbnRlbnQgPSAkZC5maW5kKCcuZHJhd2VyLWNvbnRlbnQnKS5maXJzdCgpO1xuICAgICAgICBpZiAoJGNvbnRlbnQubGVuZ3RoKXtcbiAgICAgICAgICAkY29udGVudC5jc3MoeyBwb3NpdGlvbjonZml4ZWQnLCBsZWZ0OiczMjhweCcsIHJpZ2h0OicxNnB4JywgdG9wOic1NnB4Jywgd2lkdGg6J2F1dG8nLCBtYXhXaWR0aDonNzIwcHgnLCBtYXJnaW46JzAgYXV0bycsIG1heEhlaWdodDonNzh2aCcsIG92ZXJmbG93WTonYXV0bycsIHpJbmRleDonOTk5NycsIGJhY2tncm91bmQ6JyMzMTMzMzgnLCBib3JkZXI6JzFweCBzb2xpZCAjMmIyZDMxJywgYm9yZGVyUmFkaXVzOic4cHgnLCBib3hTaGFkb3c6JzAgOHB4IDI0cHggcmdiYSgwLDAsMCwwLjQpJywgZGlzcGxheTonYmxvY2snIH0pO1xuICAgICAgICAgIHNldFRpbWVvdXQoKCk9PntcbiAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSAoZXY6YW55KT0+eyBpZiAoISQoZXYudGFyZ2V0KS5jbG9zZXN0KCRjb250ZW50KS5sZW5ndGggJiYgISQoZXYudGFyZ2V0KS5jbG9zZXN0KCR0KS5sZW5ndGgpeyAkY29udGVudC5oaWRlKCk7ICQoZG9jdW1lbnQpLm9mZignY2xpY2snLCBoYW5kbGVyIGFzIGFueSk7IH0gfTtcbiAgICAgICAgICAgICQoZG9jdW1lbnQpLm9uKCdjbGljaycsIGhhbmRsZXIgYXMgYW55KTtcbiAgICAgICAgICB9LCA1MCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgJHRvcEFjdGlvbnMuYXBwZW5kKCR0KTtcbiAgICB9XG4gICAgaWYgKGlzVmVydGljYWxEZW5pZWQpIHJldHVybjtcbiAgICBjb25zdCAkdiA9ICQoYDxkaXYgY2xhc3M9XCJkYy12dG9vbFwiIGRhdGEtZHJhd2VyPVwiJHtlc2NhcGVIdG1sKHRpdGxlKX1cIj48aSBjbGFzcz1cIiR7ZmF9XCI+PC9pPjxzcGFuPiR7ZXNjYXBlSHRtbCh0aXRsZSl9PC9zcGFuPjwvZGl2PmApO1xuICAgICR2Lm9uKCdjbGljaycsICgpPT57XG4gICAgICAkaWNvbi50cmlnZ2VyKCdjbGljaycpO1xuICAgICAgY29uc3QgJGNvbnRlbnQgPSAkZC5maW5kKCcuZHJhd2VyLWNvbnRlbnQnKS5maXJzdCgpO1xuICAgICAgaWYgKCRjb250ZW50Lmxlbmd0aCl7XG4gICAgICAgICRjb250ZW50LmNzcyh7IHBvc2l0aW9uOidmaXhlZCcsIGxlZnQ6JzMyOHB4JywgcmlnaHQ6JzE2cHgnLCB0b3A6JzU2cHgnLCB3aWR0aDonYXV0bycsIG1heFdpZHRoOic3MjBweCcsIG1hcmdpbjonMCBhdXRvJywgbWF4SGVpZ2h0Oic3OHZoJywgb3ZlcmZsb3dZOidhdXRvJywgekluZGV4Oic5OTk3JywgYmFja2dyb3VuZDonIzMxMzMzOCcsIGJvcmRlcjonMXB4IHNvbGlkICMyYjJkMzEnLCBib3JkZXJSYWRpdXM6JzhweCcsIGJveFNoYWRvdzonMCA4cHggMjRweCByZ2JhKDAsMCwwLDAuNCknLCBkaXNwbGF5OidibG9jaycgfSk7XG4gICAgICAgIHNldFRpbWVvdXQoKCk9PntcbiAgICAgICAgICBjb25zdCBoYW5kbGVyID0gKGV2OmFueSk9PnsgaWYgKCEkKGV2LnRhcmdldCkuY2xvc2VzdCgkY29udGVudCkubGVuZ3RoICYmICEkKGV2LnRhcmdldCkuY2xvc2VzdCgkdikubGVuZ3RoKXsgJGNvbnRlbnQuaGlkZSgpOyAkKGRvY3VtZW50KS5vZmYoJ2NsaWNrJywgaGFuZGxlciBhcyBhbnkpOyB9IH07XG4gICAgICAgICAgJChkb2N1bWVudCkub24oJ2NsaWNrJywgaGFuZGxlciBhcyBhbnkpO1xuICAgICAgICB9LCA1MCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgJHZlcnRpY2FsLmFwcGVuZCgkdik7XG4gIH0pO1xuICBjb25zdCBvYnMgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihfLmRlYm91bmNlKCgpPT4gYnVpbGRUb29sYmFyRnJvbUV4aXN0aW5nKCksIDUwMCkpO1xuICBpZiAoJGhvbGRlclswXSkgb2JzLm9ic2VydmUoJGhvbGRlclswXSwgeyBjaGlsZExpc3Q6dHJ1ZSwgc3VidHJlZTp0cnVlIH0pO1xufVxuXG4vLyAtLS0tLS0tLS0tIEhlYWRlciAvIEJhbm5lciAtLS0tLS0tLS0tXG5mdW5jdGlvbiB1cGRhdGVIZWFkZXIoKXtcbiAgY29uc3QgcmF3TmFtZSA9IGdldEN1cnJlbnRDaGFyYWN0ZXJOYW1lKCk7XG4gIGNvbnN0IGlzSG9tZSA9ICh3aW5kb3cgYXMgYW55KS5fX2RjSG9tZSB8fCAhcmF3TmFtZTtcbiAgY29uc3QgbmFtZSA9IGlzSG9tZSA/ICfkuLvpobUnIDogKHJhd05hbWUgfHwgJ+S4u+mhtScpO1xuICAkKCcjZGMtY2hhci1uYW1lJykuaHRtbChgJHtlc2NhcGVIdG1sKG5hbWUpfSA8aSBjbGFzcz1cImZhLXNvbGlkIGZhLWNoZXZyb24tZG93blwiPjwvaT5gKTtcbiAgJCgnI2RjLWN1cnJlbnQtY2hhbm5lbC1uYW1lJykudGV4dCgkKCcjZGMtY2hhbm5lbC1saXN0IC5kYy1jaGFubmVsLmFjdGl2ZScpLnRleHQoKS5yZXBsYWNlKCcjJywnJykudHJpbSgpIHx8IG5hbWUgfHwgJ+S4gOiIrCcpO1xuICBjb25zdCBpZCA9IGdldEN1cnJlbnRDaGFyYWN0ZXJJZFNhZmUoKTtcbiAgbGV0IGF2YXRhckZpbGUgPSAnJztcbiAgdHJ5IHsgY29uc3QgY3R4ID0gZ2V0Q3R4KCk7IGNvbnN0IGNoID0gY3R4Py5jaGFyYWN0ZXJzPy5bY3R4Py5jaGFyYWN0ZXJJZF07IGF2YXRhckZpbGUgPSBjaD8uYXZhdGFyIHx8ICcnOyB9IGNhdGNoIHt9XG4gIGlmICghYXZhdGFyRmlsZSAmJiBpZCkgeyB0cnkgeyBhdmF0YXJGaWxlID0gaWQ7IH0gY2F0Y2gge30gfVxuICBjb25zdCAkaW1nID0gJCgnI2RjLWJhbm5lci1pbWcnKTtcbiAgY29uc3QgJGJhbm5lciA9ICQoJyNkYy1iYW5uZXInKTtcbiAgaWYgKGlzSG9tZSl7ICRiYW5uZXIuaGlkZSgpOyAkaW1nLmhpZGUoKTsgfSBlbHNlIHtcbiAgICAkYmFubmVyLnNob3coKTtcbiAgICBpZiAoYXZhdGFyRmlsZSl7ICRpbWcuYXR0cignc3JjJywgZ2V0VGh1bWIoJ2F2YXRhcicsIGF2YXRhckZpbGUpKS5zaG93KCk7IH0gZWxzZSB7ICRpbWcuaGlkZSgpOyB9XG4gIH1cbiAgLy8gdGVtcCBidXR0b24gb25seSBvbiBob21lXG4gIGlmIChpc0hvbWUpeyAkKCcjZGMtY3JlYXRlLXRlbXAnKS5zaG93KCk7IH0gZWxzZSB7ICQoJyNkYy1jcmVhdGUtdGVtcCcpLmhpZGUoKTsgfVxuICAvLyBoaWRlIGFtcGVyc2FuZCBmb3IgaG9tZT8gZW5zdXJlIGNoYW5uZWwgaGVhZGVyIHN0aWxsXG4gIHVwZGF0ZVVzZXJCYXIoKTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlVXNlckJhcigpe1xuICBjb25zdCBuYW1lID0gZ2V0VXNlck5hbWUoKTtcbiAgY29uc3QgYXYgPSBnZXRVc2VyQXZhdGFyKCk7XG4gICQoJyNkYy11c2VyLW5hbWUnKS50ZXh0KG5hbWUpO1xuICAkKCcjZGMtdXNlci1hdmF0YXInKS5hdHRyKCdzcmMnLCBhdik7XG59XG5cbi8vIC0tLS0tLS0tLS0gR3VpbGQgYmFyIC0tLS0tLS0tLS1cbmZ1bmN0aW9uIGdldEFsbENoYXJhY3RlcnMoKTogYW55W10ge1xuICBsZXQgY2hhcnM6IGFueVtdID0gW107XG4gIHRyeSB7IGNvbnN0IG5hbWVzID0gdHlwZW9mIGdldENoYXJhY3Rlck5hbWVzID09PSAnZnVuY3Rpb24nID8gKGdldENoYXJhY3Rlck5hbWVzKCkgYXMgYW55KSgpIDogW107IGNvbnN0IGlkcyA9IHR5cGVvZiBnZXRDaGFyYWN0ZXJJZHMgPT09ICdmdW5jdGlvbicgPyAoZ2V0Q2hhcmFjdGVySWRzKCkgYXMgYW55KSgpIDogW107IGlmIChuYW1lcz8ubGVuZ3RoKSB7IGNvbnN0IGN0eCA9IGdldEN0eCgpOyBjaGFycyA9IG5hbWVzLm1hcCgobjpzdHJpbmcsaTpudW1iZXIpPT57IGNvbnN0IGMgPSBjdHg/LmNoYXJhY3RlcnM/LmZpbmQoKHg6YW55KT0+IHg/LmRhdGE/Lm5hbWU9PT1uKSB8fCB7fTsgcmV0dXJuIHsgbmFtZTpuLCBhdmF0YXI6aWRzW2ldIHx8IGMuYXZhdGFyIHx8ICcnLCByYXc6YywgaWQ6aWRzW2ldfTsgfSk7IH0gfSBjYXRjaCB7fVxuICBpZiAoIWNoYXJzLmxlbmd0aCl7IHRyeXsgY29uc3QgY3R4PWdldEN0eCgpOyBpZiAoY3R4Py5jaGFyYWN0ZXJzPy5sZW5ndGgpIGNoYXJzID0gY3R4LmNoYXJhY3RlcnMubWFwKChjOmFueSk9Pih7IG5hbWU6Yz8uZGF0YT8ubmFtZXx8Yz8ubmFtZSwgYXZhdGFyOmM/LmF2YXRhciwgcmF3OmMsIGlkOmM/LmF2YXRhciB9KSk7IH0gY2F0Y2gge30gfVxuICBpZiAoIWNoYXJzLmxlbmd0aCl7XG4gICAgY29uc3QgZG9tID0gQXJyYXkuZnJvbShkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcjcm1fcHJpbnRfY2hhcmFjdGVyc19ibG9jayAuY2hhcmFjdGVyX3NlbGVjdCcpKS5tYXAoKGVsOmFueSk9Pih7IG5hbWU6IGVsLnF1ZXJ5U2VsZWN0b3IoJy5jaF9uYW1lJyk/LnRleHRDb250ZW50Py50cmltKCl8fCcnLCBhdmF0YXI6IGVsLnF1ZXJ5U2VsZWN0b3IoJ2ltZycpPy5nZXRBdHRyaWJ1dGUoJ3NyYycpfHwnJywgcmF3OntkYXRhOntuYW1lOiBlbC5xdWVyeVNlbGVjdG9yKCcuY2hfbmFtZScpPy50ZXh0Q29udGVudD8udHJpbSgpfHwnJ319LCBpZDonJyB9KSk7XG4gICAgaWYgKGRvbS5sZW5ndGgpIGNoYXJzID0gZG9tIGFzIGFueTtcbiAgfVxuICByZXR1cm4gY2hhcnM7XG59XG5mdW5jdGlvbiByZW5kZXJHdWlsZEJhcigpe1xuICBjb25zdCAkYmFyID0gJCgnI2RjLWd1aWxkLWJhcicpOyBpZiAoISRiYXIubGVuZ3RoKSByZXR1cm47XG4gIGNvbnN0IGNoYXJzID0gZ2V0QWxsQ2hhcmFjdGVycygpO1xuICBsZXQgb3JkZXI6IHN0cmluZ1tdID0gW107IHRyeXsgb3JkZXIgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKERDX09SREVSX0tFWSl8fCdbXScpOyB9Y2F0Y2h7fVxuICBjb25zdCBuYW1lVG9DaGFyID0gbmV3IE1hcChjaGFycy5tYXAoKGM6YW55KT0+W2MubmFtZSxjXSkpO1xuICBsZXQgc29ydGVkOmFueVtdO1xuICBpZiAob3JkZXIubGVuZ3RoKSB7IHNvcnRlZCA9IG9yZGVyLm1hcChuPT5uYW1lVG9DaGFyLmdldChuKSkuZmlsdGVyKEJvb2xlYW4pOyBjb25zdCBtaXNzaW5nID0gY2hhcnMuZmlsdGVyKGM9PiFvcmRlci5pbmNsdWRlcyhjLm5hbWUpKTsgc29ydGVkID0gWy4uLm1pc3NpbmcucmV2ZXJzZSgpLCAuLi5zb3J0ZWRdOyB9XG4gIGVsc2Ugc29ydGVkID0gWy4uLmNoYXJzXS5yZXZlcnNlKCk7XG4gICRiYXIuZW1wdHkoKTtcbiAgJGJhci5hcHBlbmQoYDxkaXYgY2xhc3M9XCJkYy1ndWlsZC1pdGVtXCIgZGF0YS1ob21lPVwiMVwiIHRpdGxlPVwi5Li76aG1XCI+PGRpdiBjbGFzcz1cImRjLWd1aWxkLXBpbGxcIj48L2Rpdj48ZGl2IHN0eWxlPVwid2lkdGg6MTAwJTtoZWlnaHQ6MTAwJTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7YmFja2dyb3VuZDojMzEzMzM4O2NvbG9yOndoaXRlXCI+PGkgY2xhc3M9XCJmYS1zb2xpZCBmYS1ob3VzZVwiPjwvaT48L2Rpdj48L2Rpdj48ZGl2IGNsYXNzPVwiZGMtZ3VpbGQtc2VwXCI+PC9kaXY+YCk7XG4gIC8vIEhvbWUgY2xpY2s6IGZvcmNlIGhvbWUgc3RhdGUgKG5vIGNoYXJhY3RlcilcbiAgJGJhci5maW5kKCdbZGF0YS1ob21lXScpLm9uKCdjbGljaycsICgpPT57XG4gICAgKHdpbmRvdyBhcyBhbnkpLl9fZGNIb21lID0gdHJ1ZTtcbiAgICAkKCcuZGMtZ3VpbGQtaXRlbScpLnJlbW92ZUNsYXNzKCdhY3RpdmUnKTtcbiAgICAkYmFyLmZpbmQoJ1tkYXRhLWhvbWVdJykuYWRkQ2xhc3MoJ2FjdGl2ZScpO1xuICAgIHVwZGF0ZUhlYWRlcigpO1xuICAgIHJlbmRlckNoYW5uZWxzKCk7XG4gICAgLy8gT3B0aW9uYWxseSBjbGVhciBjaGF0IHZpZXcgdG8gaG9tZSB3ZWxjb21lXG4gICAgJCgnI2RjLWNoYXQtY29udGFpbmVyICNjaGF0JykuaHRtbChgPGRpdiBzdHlsZT1cInBhZGRpbmc6MzJweDtjb2xvcjojYjViYWMxO3RleHQtYWxpZ246Y2VudGVyXCI+PGgyIHN0eWxlPVwiY29sb3I6d2hpdGVcIj7mrKLov47mnaXliLDkuLvpobU8L2gyPjxwPumAieaLqeW3puS+p+inkuiJsuW8gOWni+Wvueivne+8jOaIlueCueWHu+S4i+aWueKAnOWIm+W7uuS4tOaXtuiBiuWkqeKAnTwvcD48L2Rpdj5gKTtcbiAgICAkKCcjZGMtY3VycmVudC1jaGFubmVsLW5hbWUnKS50ZXh0KCfkuLvpobUnKTtcbiAgfSkub24oJ21vdXNlZW50ZXInLCAoZTphbnkpPT57XG4gICAgY29uc3QgdGlwPSQoJyNkYy10b29sdGlwJyk7IHRpcC50ZXh0KCfkuLvpobUnKS5hZGRDbGFzcygnc2hvdycpO1xuICAgIGNvbnN0IHI9KGUuY3VycmVudFRhcmdldCBhcyBIVE1MRWxlbWVudCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgdGlwLmNzcyh7IGxlZnQ6IChyLnJpZ2h0KzEwKSsncHgnLCB0b3A6IChyLnRvcCArIHIuaGVpZ2h0LzIgLSB0aXAub3V0ZXJIZWlnaHQoKS8yKSsncHgnIH0pO1xuICB9KS5vbignbW91c2VsZWF2ZScsICgpPT4gJCgnI2RjLXRvb2x0aXAnKS5yZW1vdmVDbGFzcygnc2hvdycpKTtcbiAgY29uc3QgY3VyTmFtZSA9ICh3aW5kb3cgYXMgYW55KS5fX2RjSG9tZSA/IG51bGwgOiBnZXRDdXJyZW50Q2hhcmFjdGVyTmFtZSgpO1xuICBzb3J0ZWQuZm9yRWFjaCgoY2g6YW55KT0+e1xuICAgIGNvbnN0IG5hbWUgPSBjaC5uYW1lIHx8ICfmnKrnn6UnO1xuICAgIGNvbnN0IGF2YXRhciA9IGNoLmF2YXRhciB8fCBjaC5yYXc/LmF2YXRhciB8fCAnJztcbiAgICBjb25zdCB0aHVtYiA9IGF2YXRhciAmJiAoYXZhdGFyLnN0YXJ0c1dpdGgoJ2h0dHAnKXx8YXZhdGFyLnN0YXJ0c1dpdGgoJ2RhdGE6JykpID8gYXZhdGFyIDogKGF2YXRhcj8gZ2V0VGh1bWIoJ2F2YXRhcicsIGF2YXRhcikgOiAnLi9pbWcvYWkyLnBuZycpO1xuICAgIGNvbnN0IGFjdGl2ZSA9IG5hbWU9PT1jdXJOYW1lID8gJyBhY3RpdmUnOicnOyBcbiAgICBjb25zdCBlbCA9ICQoYDxkaXYgY2xhc3M9XCJkYy1ndWlsZC1pdGVtJHthY3RpdmV9XCIgZGF0YS1jaGFyPVwiJHtlc2NhcGVIdG1sKG5hbWUpfVwiIHRpdGxlPVwiJHtlc2NhcGVIdG1sKG5hbWUpfVwiPjxkaXYgY2xhc3M9XCJkYy1ndWlsZC1waWxsXCI+PC9kaXY+PGltZyBzcmM9XCIke3RodW1ifVwiIGFsdD1cIiR7ZXNjYXBlSHRtbChuYW1lKX1cIiBsb2FkaW5nPVwibGF6eVwiPjwvZGl2PmApO1xuICAgIC8vIHRvb2x0aXBcbiAgICBlbC5vbignbW91c2VlbnRlcicsIChlOmFueSk9PntcbiAgICAgIGNvbnN0IHRpcCA9ICQoJyNkYy10b29sdGlwJyk7XG4gICAgICB0aXAudGV4dChuYW1lKS5hZGRDbGFzcygnc2hvdycpO1xuICAgICAgY29uc3QgciA9IChlbFswXSBhcyBIVE1MRWxlbWVudCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICB0aXAuY3NzKHsgbGVmdDogKHIucmlnaHQrMTApKydweCcsIHRvcDogKHIudG9wICsgci5oZWlnaHQvMiAtIHRpcC5vdXRlckhlaWdodCgpLzIpKydweCcgfSk7XG4gICAgfSkub24oJ21vdXNlbGVhdmUnLCAoKT0+ICQoJyNkYy10b29sdGlwJykucmVtb3ZlQ2xhc3MoJ3Nob3cnKSlcbiAgICAvLyBjbGlja1xuICAgIC5vbignY2xpY2snLCBhc3luYyAoKT0+e1xuICAgICAgKHdpbmRvdyBhcyBhbnkpLl9fZGNIb21lID0gZmFsc2U7XG4gICAgICB0cnl7XG4gICAgICAgIC8vIGZpbmQgaW5kZXhcbiAgICAgICAgbGV0IGlkeCA9IC0xOyB0cnl7IGNvbnN0IG5hbWVzPWdldENoYXJhY3Rlck5hbWVzKCk7IGlkeCA9IG5hbWVzLmluZGV4T2YobmFtZSk7IH1jYXRjaHt9XG4gICAgICAgIGlmIChpZHg+PTAgJiYgU2lsbHlUYXZlcm4/LnNlbGVjdENoYXJhY3RlckJ5SWQpIGF3YWl0IFNpbGx5VGF2ZXJuLnNlbGVjdENoYXJhY3RlckJ5SWQoaWR4KTtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgLy8gZmFsbGJhY2sgRE9NIGNsaWNrXG4gICAgICAgICAgY29uc3Qgbm9kZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcjcm1fcHJpbnRfY2hhcmFjdGVyc19ibG9jayAuY2hhcmFjdGVyX3NlbGVjdCcpO1xuICAgICAgICAgIGZvciAoY29uc3QgbiBvZiBBcnJheS5mcm9tKG5vZGVzKSBhcyBhbnlbXSl7IGlmIChuLnRleHRDb250ZW50Py5pbmNsdWRlcyhuYW1lKSl7IChuIGFzIEhUTUxFbGVtZW50KS5jbGljaygpOyBicmVhazsgfSB9XG4gICAgICAgICAgaWYgKHR5cGVvZiAod2luZG93IGFzIGFueSkuc2VsZWN0Q2hhcmFjdGVyQnlJZCA9PT0gJ2Z1bmN0aW9uJykgYXdhaXQgKHdpbmRvdyBhcyBhbnkpLnNlbGVjdENoYXJhY3RlckJ5SWQoaWR4KTtcbiAgICAgICAgfVxuICAgICAgfWNhdGNoKGUpeyB3YXJuKGUpOyB9XG4gICAgICBzZXRUaW1lb3V0KCgpPT57IHVwZGF0ZUhlYWRlcigpOyByZW5kZXJHdWlsZEJhcigpOyByZW5kZXJDaGFubmVscygpOyBidWlsZERyb3Bkb3duKCk7IH0sIDQwMCk7XG4gICAgfSk7XG4gICAgLy8gZHJhZyBzdXBwb3J0IHZpYSBqcXVlcnl1aSBzb3J0YWJsZSBhbHJlYWR5IGhhbmRsZXM7IGFsc28gbG9uZy1wcmVzcyBjdXN0b21cbiAgICAkYmFyLmFwcGVuZChlbCk7XG4gIH0pO1xuICAkYmFyLmFwcGVuZChgPGRpdiBjbGFzcz1cImRjLWd1aWxkLWFkZFwiIHRpdGxlPVwi5a+85YWl6KeS6ImyXCI+PGkgY2xhc3M9XCJmYS1zb2xpZCBmYS1wbHVzXCI+PC9pPjwvZGl2PmApO1xuICAkYmFyLmZpbmQoJy5kYy1ndWlsZC1hZGQnKS5vbignY2xpY2snLCAoKT0+IChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuZXh0ZXJuYWxfaW1wb3J0X2J1dHRvbicpIGFzIEhUTUxFbGVtZW50KT8uY2xpY2soKSApO1xuICAvLyBzb3J0YWJsZSB3aXRoIDUwMG1zIGRlbGF5IHBlciBzcGVjIChkcmFnc3RhcnQgZGVsYXkpXG4gIHRyeXtcbiAgICBjb25zdCAkanFCYXI6YW55ID0gJGJhciBhcyBhbnk7XG4gICAgaWYgKCRqcUJhci5zb3J0YWJsZSl7XG4gICAgICBpZiAoJGpxQmFyLmRhdGEoJ3VpLXNvcnRhYmxlJykpICRqcUJhci5zb3J0YWJsZSgnZGVzdHJveScpO1xuICAgICAgJGpxQmFyLnNvcnRhYmxlKHtcbiAgICAgICAgaXRlbXM6ICcuZGMtZ3VpbGQtaXRlbVtkYXRhLWNoYXJdJyxcbiAgICAgICAgYXhpczoneScsXG4gICAgICAgIGRlbGF5OiA1MDAsXG4gICAgICAgIGRpc3RhbmNlOjYsXG4gICAgICAgIHRvbGVyYW5jZToncG9pbnRlcicsXG4gICAgICAgIHBsYWNlaG9sZGVyOidkYy1ndWlsZC1pdGVtJyxcbiAgICAgICAgc3RhcnQ6IChfOmFueSwgdWk6YW55KT0+eyB1aS5wbGFjZWhvbGRlci5jc3MoeyB2aXNpYmlsaXR5Oid2aXNpYmxlJywgYmFja2dyb3VuZDonIzJiMmQzMScsIGJvcmRlcjonMnB4IGRhc2hlZCAjNTg2NWYyJyB9KTsgfSxcbiAgICAgICAgc3RvcDogKCk9PntcbiAgICAgICAgICBjb25zdCBuZXdPcmRlciA9ICRiYXIuZmluZCgnLmRjLWd1aWxkLWl0ZW1bZGF0YS1jaGFyXScpLm1hcCgoXzphbnksIGVsOmFueSk9PiBlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtY2hhcicpKS5nZXQoKTtcbiAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShEQ19PUkRFUl9LRVksIEpTT04uc3RyaW5naWZ5KG5ld09yZGVyKSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfWNhdGNoKGUpeyB3YXJuKCdzb3J0YWJsZScsIGUpOyB9XG59XG5cbi8vIC0tLS0tLS0tLS0gQ2hhdCBjaGFubmVscyAtLS0tLS0tLS0tXG5hc3luYyBmdW5jdGlvbiBmZXRjaENoYXRGaWxlc0ZvckN1cnJlbnQoKTogUHJvbWlzZTxzdHJpbmdbXT57XG4gIGNvbnN0IGN0eCA9IGdldEN0eCgpO1xuICBjb25zdCBjdXJOYW1lID0gZ2V0Q3VycmVudENoYXJhY3Rlck5hbWUoKTtcbiAgbGV0IGF2YXRhckZpbGUgPSAnJztcbiAgdHJ5eyBjb25zdCBjaElkeCA9IGN0eD8uY2hhcmFjdGVycz8uZmluZEluZGV4KChjOmFueSk9PiBjPy5kYXRhPy5uYW1lPT09Y3VyTmFtZSk7IGlmIChjaElkeD49MCkgYXZhdGFyRmlsZSA9IGN0eC5jaGFyYWN0ZXJzW2NoSWR4XT8uYXZhdGFyOyB9Y2F0Y2h7fVxuICAvLyBUcnkgaGVscGVyIGdldENoYXRIaXN0b3J5QnJpZWYgaWYgZXhpc3RlZCAoc29tZSBUSCB2ZXJzaW9ucylcbiAgdHJ5eyBjb25zdCBmbiA9ICh3aW5kb3cgYXMgYW55KS5nZXRDaGF0SGlzdG9yeUJyaWVmOyBpZiAodHlwZW9mIGZuID09PSAnZnVuY3Rpb24nKXsgY29uc3QgciA9IGF3YWl0IGZuKGN1ck5hbWUpOyBpZiAoQXJyYXkuaXNBcnJheShyKSAmJiByLmxlbmd0aCkgcmV0dXJuIHIubWFwKCh4OmFueSk9PiB4LmZpbGVfbmFtZXx8eC5maWxlTmFtZXx8eC5uYW1lKS5maWx0ZXIoQm9vbGVhbik7IH0gfWNhdGNoe31cbiAgLy8gVHJ5IFNpbGx5VGF2ZXJuIEFQSVxuICB0cnl7XG4gICAgY29uc3QgaGVhZGVycyA9IGdldEN0eCgpLmdldFJlcXVlc3RIZWFkZXJzKCkgfHwgeyAnQ29udGVudC1UeXBlJzonYXBwbGljYXRpb24vanNvbicgfTtcbiAgICAvLyBTVCBlbmRwb2ludDogL2FwaS9jaGFyYWN0ZXJzL2NoYXRzIOKAlCBpbnNwZWN0IHZpYSBmZXRjaCBhdHRlbXB0XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvY2hhcmFjdGVycy9jaGF0cycsIHsgbWV0aG9kOidQT1NUJywgaGVhZGVyczogeyAuLi5oZWFkZXJzLCAnQ29udGVudC1UeXBlJzonYXBwbGljYXRpb24vanNvbicgfSwgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBhdmF0YXJfdXJsOiBhdmF0YXJGaWxlIH0pIH0pO1xuICAgIGlmIChyZXMub2speyBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKTsgLy8gZGF0YSBtYXkgYmUgeyBjaGF0czogW10gfSBvciBbXVxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpIHJldHVybiBkYXRhLm1hcCgoeDphbnkpPT4geC5maWxlX25hbWV8fHguZmlsZU5hbWV8fHgpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIGlmIChkYXRhPy5jaGF0cyAmJiBBcnJheS5pc0FycmF5KGRhdGEuY2hhdHMpKSByZXR1cm4gZGF0YS5jaGF0cy5tYXAoKHg6YW55KT0+IHguZmlsZV9uYW1lfHx4LmZpbGVOYW1lfHx4KS5maWx0ZXIoQm9vbGVhbik7XG4gICAgfVxuICB9Y2F0Y2goZSl7IC8qIGlnbm9yZSAqLyB9XG4gIC8vIFRyeSBhbHRlcm5hdGl2ZSBlbmRwb2ludCAvYXBpL2NoYXRzL2dldCA/XG4gIHRyeXtcbiAgICBjb25zdCByZXMyID0gYXdhaXQgZmV0Y2goJy9hcGkvY2hhdHMvc2VhcmNoJywgeyBtZXRob2Q6J1BPU1QnLCBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOidhcHBsaWNhdGlvbi9qc29uJywgLi4uKGdldEN0eCgpLmdldFJlcXVlc3RIZWFkZXJzKCl8fHt9KSB9LCBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGF2YXRhcl91cmw6IGF2YXRhckZpbGUsIHNlYXJjaDogJycgfSkgfSk7XG4gICAgaWYgKHJlczIub2speyBjb25zdCBkID0gYXdhaXQgcmVzMi5qc29uKCk7IGlmIChBcnJheS5pc0FycmF5KGQ/LmNoYXRzKSkgcmV0dXJuIGQuY2hhdHMubWFwKCh4OmFueSk9PiB4LmZpbGVfbmFtZXx8eC5maWxlTmFtZSk7IH1cbiAgfWNhdGNoe31cbiAgLy8gRmFsbGJhY2sgRE9NIHNjcmFwZSBmcm9tIFNpbGx5VGF2ZXJuJ3MgY2hhdCBoaXN0b3J5IGRyYXdlcjogb3BlbiBpdCBwcm9ncmFtbWF0aWNhbGx5IHRvIHBvcHVsYXRlXG4gIHRyeXtcbiAgICAvLyBUcnkgdG8gbG9jYXRlIGV4aXN0aW5nIGNoYXQgbGlzdCBpbiBET00gdW5kZXIgI3NlbGVjdF9jaGF0X2Jsb2NrIG9yIHNpbWlsYXIgaGlkZGVuIHBhbmVsXG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IFtcbiAgICAgICcjc2VsZWN0X2NoYXRfYmxvY2sgLmNoYXRfaGlzdG9yeV9pdGVtJyxcbiAgICAgICcjc2VsZWN0X2NoYXRfcG9wdXAgLlBhc3RDaGF0X2hpc3RvcnlfaXRlbScsXG4gICAgICAnLnNlbGVjdF9jaGF0X2Jsb2NrIC5jaGF0LWl0ZW0nLFxuICAgICAgJ1tkYXRhLWZpbGVfbmFtZV0nLFxuICAgICAgJy5jaGF0X2ZpbGVfbmFtZSdcbiAgICBdO1xuICAgIGZvciAoY29uc3Qgc2VsIG9mIGNhbmRpZGF0ZXMpe1xuICAgICAgY29uc3QgZWxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWwpO1xuICAgICAgaWYgKGVscy5sZW5ndGgpe1xuICAgICAgICBjb25zdCBmaWxlcyA9IEFycmF5LmZyb20oZWxzKS5tYXAoKGVsOmFueSk9PiBlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZmlsZScpfHxlbC5nZXRBdHRyaWJ1dGUoJ2ZpbGVfbmFtZScpfHxlbC50ZXh0Q29udGVudD8udHJpbSgpKS5maWx0ZXIoQm9vbGVhbikgYXMgc3RyaW5nW107XG4gICAgICAgIGlmIChmaWxlcy5sZW5ndGgpIHJldHVybiBmaWxlcy5tYXAoZj0+IGYuZW5kc1dpdGgoJy5qc29ubCcpP2Y6ZisnLmpzb25sJyk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIExhc3QgcmVzb3J0OiBjaGF0TWV0YWRhdGEga2V5c1xuICAgIGNvbnN0IG1ldGEgPSBjdHg/LmNoYXRNZXRhZGF0YSB8fCB7fTtcbiAgICAvLyBjaGF0SWQgaXMgY3VycmVudCBmaWxlXG4gICAgY29uc3QgY3VyQ2hhdCA9IGN0eD8uY2hhdElkIHx8IGN0eD8uY3VycmVudENoYXRJZCB8fCBTaWxseVRhdmVybj8uY2hhdElkO1xuICAgIGlmIChjdXJDaGF0KSByZXR1cm4gW2N1ckNoYXRdO1xuICB9Y2F0Y2h7fVxuICByZXR1cm4gW107XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlbmRlckNoYW5uZWxzKCl7XG4gIGNvbnN0ICRsaXN0ID0gJCgnI2RjLWNoYW5uZWwtbGlzdCcpOyBpZiAoISRsaXN0Lmxlbmd0aCkgcmV0dXJuO1xuICAkbGlzdC5lbXB0eSgpO1xuICAvLyBFbnN1cmUgdGVtcCBjaGF0IGJ1dHRvbiBpcyBwaW5uZWQgYWxyZWFkeVxuICBjb25zdCBmaWxlcyA9IGF3YWl0IGZldGNoQ2hhdEZpbGVzRm9yQ3VycmVudCgpO1xuICBjb25zdCBjdHggPSBnZXRDdHgoKTtcbiAgY29uc3QgY3VyQ2hhdElkID0gY3R4Py5jaGF0SWQgfHwgY3R4Py5jaGF0TWV0YWRhdGE/LmNoYXRJZCB8fCBTaWxseVRhdmVybj8uY2hhdElkIHx8ICcnO1xuICBjb25zdCBpc0hvbWVOb3cgPSAod2luZG93IGFzIGFueSkuX19kY0hvbWUgfHwgIWdldEN1cnJlbnRDaGFyYWN0ZXJOYW1lKCk7XG4gIC8vIEJ1aWxkIGxpc3Q7IGlmIGVtcHR5IHNob3cgcGxhY2Vob2xkZXIgKG5vIHZvaWNlIHBlciBzcGVjKVxuICBpZiAoIWZpbGVzLmxlbmd0aCl7XG4gICAgJGxpc3QuYXBwZW5kKGA8ZGl2IGNsYXNzPVwiZGMtY2F0ZWdvcnlcIj7mloflrZfpopHpgZM8L2Rpdj5gKTtcbiAgICAkbGlzdC5hcHBlbmQoYDxkaXYgY2xhc3M9XCJkYy1jaGFubmVsIGFjdGl2ZVwiPjxzcGFuIGNsYXNzPVwiZGMtaGFzaFwiPiM8L3NwYW4+PHNwYW4+5LiA6IisPC9zcGFuPjwvZGl2PmApO1xuICAgICQoJyNkYy1jdXJyZW50LWNoYW5uZWwtbmFtZScpLnRleHQoaXNIb21lTm93PyfkuLvpobUnOifkuIDoiKwnKTtcbiAgICBiaW5kTmV3VGVtcCgpO1xuICAgIHJldHVybjtcbiAgfVxuICAkbGlzdC5hcHBlbmQoYDxkaXYgY2xhc3M9XCJkYy1jYXRlZ29yeVwiPuaWh+Wtl+mikemBkzwvZGl2PmApO1xuICAvLyBTb3J0OiBsYXRlc3QgZmlyc3Qg4oCUIGFzc3VtZSBmaWxlcyBhbHJlYWR5IGxhdGVzdCBmaXJzdDsgd2Uga2VlcCBvcmRlciwgYnV0IGhpZ2hsaWdodCBjdXJyZW50XG4gIGZpbGVzLmZvckVhY2goKGZpbGU6c3RyaW5nLCBpZHg6bnVtYmVyKT0+e1xuICAgIGNvbnN0IGJhc2UgPSBmaWxlLnJlcGxhY2UoJy5qc29ubCcsJycpO1xuICAgIGNvbnN0IGRpc3BsYXkgPSBiYXNlLmxlbmd0aD4yMD8gYmFzZS5zbGljZSgwLDIwKSsn4oCmJzogYmFzZTtcbiAgICBjb25zdCBpc0FjdGl2ZSA9IGZpbGU9PT1jdXJDaGF0SWQgfHwgKGlkeD09PTAgJiYgIWN1ckNoYXRJZCk7XG4gICAgY29uc3QgZWwgPSAkKGA8ZGl2IGNsYXNzPVwiZGMtY2hhbm5lbCAke2lzQWN0aXZlPydhY3RpdmUnOicnfVwiIGRhdGEtZmlsZT1cIiR7ZXNjYXBlSHRtbChmaWxlKX1cIj48c3BhbiBjbGFzcz1cImRjLWhhc2hcIj4jPC9zcGFuPjxzcGFuPiR7ZXNjYXBlSHRtbChkaXNwbGF5KX08L3NwYW4+PHNwYW4gY2xhc3M9XCJkYy1jaGFubmVsLWFjdGlvbnNcIj48aSBjbGFzcz1cImZhLXNvbGlkIGZhLXBlblwiIHRpdGxlPVwi6YeN5ZG95ZCNXCI+PC9pPjxpIGNsYXNzPVwiZmEtc29saWQgZmEtdHJhc2hcIiB0aXRsZT1cIuWIoOmZpFwiPjwvaT48L3NwYW4+PC9kaXY+YCk7XG4gICAgZWwub24oJ2NsaWNrJywgYXN5bmMgKGU6YW55KT0+e1xuICAgICAgaWYgKCQoZS50YXJnZXQpLmlzKCdpJykpIHJldHVybjtcbiAgICAgICRsaXN0LmZpbmQoJy5kYy1jaGFubmVsJykucmVtb3ZlQ2xhc3MoJ2FjdGl2ZScpOyBlbC5hZGRDbGFzcygnYWN0aXZlJyk7XG4gICAgICAkKCcjZGMtY3VycmVudC1jaGFubmVsLW5hbWUnKS50ZXh0KGRpc3BsYXkpO1xuICAgICAgYXdhaXQgb3BlbkNoYXRGaWxlKGZpbGUpO1xuICAgIH0pO1xuICAgIC8vIHJlbmFtZS9kZWxldGUgYWN0aW9uc1xuICAgIGVsLmZpbmQoJy5mYS1wZW4nKS5vbignY2xpY2snLCBhc3luYyAoZTphbnkpPT57XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgY29uc3QgbmV3TmFtZSA9IHByb21wdCgn6YeN5ZG95ZCN6IGK5aSp5paH5Lu2JywgYmFzZSk7XG4gICAgICBpZiAoIW5ld05hbWUgfHwgbmV3TmFtZT09PWJhc2UpIHJldHVybjtcbiAgICAgIHRyeXtcbiAgICAgICAgaWYgKFNpbGx5VGF2ZXJuPy5yZW5hbWVDaGF0KSBhd2FpdCBTaWxseVRhdmVybi5yZW5hbWVDaGF0KGZpbGUsIG5ld05hbWUuZW5kc1dpdGgoJy5qc29ubCcpP25ld05hbWU6bmV3TmFtZSsnLmpzb25sJyk7XG4gICAgICAgIGVsc2UgYXdhaXQgdHJpZ2dlclNsYXNoKGAvcmVuYW1lY2hhdCBvbGQ9XCIke2ZpbGV9XCIgbmV3PVwiJHtuZXdOYW1lfVwiYCk7XG4gICAgICAgIHJlbmRlckNoYW5uZWxzKCk7XG4gICAgICB9Y2F0Y2goZXJyKXsgdG9hc3RyLmVycm9yKFN0cmluZyhlcnIpKTsgfVxuICAgIH0pO1xuICAgIGVsLmZpbmQoJy5mYS10cmFzaCcpLm9uKCdjbGljaycsIGFzeW5jIChlOmFueSk9PntcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBpZiAoIWNvbmZpcm0oYOWIoOmZpOiBiuWkqSBcIiR7ZGlzcGxheX1cIiA/YCkpIHJldHVybjtcbiAgICAgIHRyeXtcbiAgICAgICAgLy8gZGVsZXRpb24gdmlhIEFQSSBvciBzbGFzaFxuICAgICAgICBhd2FpdCB0cmlnZ2VyU2xhc2goYC9kZWxjaGF0IGZpbGU9XCIke2ZpbGV9XCJgKTtcbiAgICAgICAgcmVuZGVyQ2hhbm5lbHMoKTtcbiAgICAgIH1jYXRjaChlcnIpeyB0b2FzdHIuZXJyb3IoU3RyaW5nKGVycikpOyB9XG4gICAgfSk7XG4gICAgLy8gcmlnaHQgY2xpY2tcbiAgICBlbC5vbignY29udGV4dG1lbnUnLCAoZTphbnkpPT57XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBzaG93Q29udGV4dE1lbnUoZS5jbGllbnRYLCBlLmNsaWVudFksIFtcbiAgICAgICAgeyBsYWJlbDon6YeN5ZG95ZCNJywgYWN0aW9uOigpPT4gZWwuZmluZCgnLmZhLXBlbicpLnRyaWdnZXIoJ2NsaWNrJykgfSxcbiAgICAgICAgeyBsYWJlbDon5a+85Ye6JywgYWN0aW9uOiBhc3luYyAoKT0+eyB0cnl7IGF3YWl0IHRyaWdnZXJTbGFzaChgL2V4cG9ydGNoYXQgZmlsZT1cIiR7ZmlsZX1cImApO31jYXRjaHt9IH0gfSxcbiAgICAgICAgeyBsYWJlbDon5Yig6ZmkJywgZGFuZ2VyOnRydWUsIGFjdGlvbjooKT0+IGVsLmZpbmQoJy5mYS10cmFzaCcpLnRyaWdnZXIoJ2NsaWNrJykgfSxcbiAgICAgIF0pO1xuICAgIH0pO1xuICAgICRsaXN0LmFwcGVuZChlbCk7XG4gIH0pO1xuICAvLyBObyB2b2ljZSBjaGFubmVsIHBlciBzcGVjOyBvbmx5IHRleHQgY2hhbm5lbHMgbGlzdCBhbGwgY2hhdHNcbiAgaWYgKGlzSG9tZU5vdyl7XG4gICAgJGxpc3QuYXBwZW5kKGA8YnV0dG9uIGlkPVwiZGMtbmV3LWNoYW5uZWxcIiBjbGFzcz1cImRjLXZ0b29sXCIgc3R5bGU9XCJtYXJnaW46OHB4IDBcIj48aSBjbGFzcz1cImZhLXNvbGlkIGZhLXBsdXNcIj48L2k+PHNwYW4+5paw5bu66IGK5aSpPC9zcGFuPjwvYnV0dG9uPmApO1xuICAgICQoJyNkYy1uZXctY2hhbm5lbCcpLm9uKCdjbGljaycsICgpPT4gY3JlYXRlTmV3Q2hhdCgpKTtcbiAgfVxuICAkKCcjZGMtY3VycmVudC1jaGFubmVsLW5hbWUnKS50ZXh0KCRsaXN0LmZpbmQoJy5kYy1jaGFubmVsLmFjdGl2ZSBzcGFuJykuZXEoMSkudGV4dCgpfHxmaWxlc1swXT8ucmVwbGFjZSgnLmpzb25sJywnJyl8fCAoaXNIb21lTm93PyfkuLvpobUnOifkuIDoiKwnKSk7XG4gIGJpbmROZXdUZW1wKCk7XG59XG5hc3luYyBmdW5jdGlvbiBvcGVuQ2hhdEZpbGUoZmlsZTpzdHJpbmcpe1xuICB0cnl7XG4gICAgaWYgKFNpbGx5VGF2ZXJuPy5vcGVuQ2hhcmFjdGVyQ2hhdCkgeyBhd2FpdCBTaWxseVRhdmVybi5vcGVuQ2hhcmFjdGVyQ2hhdChmaWxlKTsgcmV0dXJuOyB9XG4gICAgaWYgKFNpbGx5VGF2ZXJuPy5vcGVuR3JvdXBDaGF0KSB7IC8qIG5vdCBncm91cCAqLyB9XG4gICAgYXdhaXQgdHJpZ2dlclNsYXNoKGAvY2hhdC1vcGVuIGZpbGU9XCIke2ZpbGV9XCJgKTtcbiAgfWNhdGNoKGUpeyB3YXJuKCdvcGVuQ2hhdCcsIGUpOyB0b2FzdHIuaW5mbygn5YiH5o2i6IGK5aSpOiAnK2ZpbGUpOyB9XG4gIC8vIEFsc28gYXR0ZW1wdCBkaXJlY3Qgc2VsZWN0IHZpYSBTVCdzIGZ1bmN0aW9uXG4gIHRyeXsgY29uc3QgY3R4PWdldEN0eCgpOyBpZiAoY3R4Py5jaGFyYWN0ZXJzICYmICh3aW5kb3cgYXMgYW55KS5zZWxlY3RDaGFyYWN0ZXJCeUlkKSB7IC8qIGFscmVhZHkgKi8gfSB9Y2F0Y2h7fVxuICBzZXRUaW1lb3V0KCgpPT4gcmVuZGVyQ2hhbm5lbHMoKSwgMzAwKTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZU5ld0NoYXQoKXtcbiAgdHJ5e1xuICAgIGlmICgod2luZG93IGFzIGFueSkudHJpZ2dlclNsYXNoKSBhd2FpdCAod2luZG93IGFzIGFueSkudHJpZ2dlclNsYXNoKCcvbmV3Y2hhdCcpO1xuICAgIGVsc2UgaWYgKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNvcHRpb25fc3RhcnRfbmV3X2NoYXQnKSkgKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNvcHRpb25fc3RhcnRfbmV3X2NoYXQnKSBhcyBIVE1MRWxlbWVudCk/LmNsaWNrKCk7XG4gICAgZWxzZSBpZiAoU2lsbHlUYXZlcm4/LmNsZWFyQ2hhdCkgYXdhaXQgU2lsbHlUYXZlcm4uY2xlYXJDaGF0KCk7XG4gIH1jYXRjaChlKXsgd2FybihlKTsgfVxuICBzZXRUaW1lb3V0KCgpPT4gcmVuZGVyQ2hhbm5lbHMoKSwgNjAwKTtcbn1cbmZ1bmN0aW9uIGJpbmROZXdUZW1wKCl7XG4gICQoJyNkYy1jcmVhdGUtdGVtcCcpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBjcmVhdGVOZXdDaGF0KTtcbiAgJCgnI2RjLWFkZC1jaGFubmVsJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIGNyZWF0ZU5ld0NoYXQpO1xufVxuYXN5bmMgZnVuY3Rpb24gdHJpZ2dlclNsYXNoKGNtZDpzdHJpbmcpe1xuICB0cnl7IGlmICgod2luZG93IGFzIGFueSkudHJpZ2dlclNsYXNoKSByZXR1cm4gYXdhaXQgKHdpbmRvdyBhcyBhbnkpLnRyaWdnZXJTbGFzaChjbWQpO1xuICAgIGlmIChTaWxseVRhdmVybj8uU2xhc2hDb21tYW5kUGFyc2VyKSByZXR1cm4gYXdhaXQgU2lsbHlUYXZlcm4uU2xhc2hDb21tYW5kUGFyc2VyLnBhcnNlKGNtZCk7XG4gIH1jYXRjaChlKXsgd2Fybignc2xhc2gnLCBlKTsgfVxuICAvLyBmYWxsYmFjayB2aWEgRE9NIGluamVjdG9yXG4gIHRyeXsgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjc2VuZF90ZXh0YXJlYScpIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQ7IGlmIChlbCl7IGVsLnZhbHVlID0gY21kOyBlbC5kaXNwYXRjaEV2ZW50KG5ldyBLZXlib2FyZEV2ZW50KCdrZXlkb3duJyx7a2V5OidFbnRlcid9KSk7IH0gfWNhdGNoe31cbn1cblxuLy8gLS0tLS0tLS0tLSBEcm9wZG93biBQMiAtLS0tLS0tLS0tXG5mdW5jdGlvbiBidWlsZERyb3Bkb3duKCl7XG4gIGNvbnN0ICRkZCA9ICQoJyNkYy1jaGFyLWRyb3Bkb3duJyk7IGlmICghJGRkLmxlbmd0aCkgcmV0dXJuO1xuICBjb25zdCBjdXIgPSBnZXRDdXJyZW50Q2hhcmFjdGVyTmFtZSgpIHx8ICfmnKrpgInmi6knO1xuICAvLyBDb21wdXRlIHRva2VucyBmb3IgY3VycmVudCBjaGFyIGxhdGVyIGFzeW5jXG4gICRkZC5lbXB0eSgpO1xuICBjb25zdCByb3dzID0gW1xuICAgIHsgaWNvbjonZmEtc29saWQgZmEtaW1hZ2UnLCBsYWJlbDon6KeS6Imy5aS05YOPICYg5Z+65pys5L+h5oGvJywga2V5OidhdmF0YXInLCBhcnJvdzp0cnVlIH0sXG4gICAgeyBzZXA6dHJ1ZSB9LFxuICAgIHsgaWNvbjonZmEtc29saWQgZmEtZmlsZS1saW5lcycsIGxhYmVsOifop5LoibLmj4/ov7AnLCBrZXk6J2Rlc2MnLCBhcnJvdzp0cnVlIH0sXG4gICAgeyBpY29uOidmYS1zb2xpZCBmYS1jb21tZW50JywgbGFiZWw6J+W8gOWcuueZvSAmIOWAmeihpeW8gOWcuueZvScsIGtleTonZ3JlZXRpbmcnLCBhcnJvdzp0cnVlIH0sXG4gICAgeyBpY29uOidmYS1zb2xpZCBmYS1ub3RlLXN0aWNreScsIGxhYmVsOifliJvkvZzogIXnmoTms6jph4onLCBrZXk6J2NyZWF0b3InLCBhcnJvdzp0cnVlIH0sXG4gICAgeyBpY29uOidmYS1zb2xpZCBmYS1ib29rJywgbGFiZWw6J+inkuiJsuS4lueVjOS5picsIGtleTonbG9yZScsIGFycm93OnRydWUgfSxcbiAgICB7IHNlcDp0cnVlIH0sXG4gICAgeyBpY29uOidmYS1zb2xpZCBmYS1nZWFyJywgbGFiZWw6J+mrmOe6p+WumuS5iScsIGtleTonYWR2YW5jZWQnLCBhcnJvdzp0cnVlIH0sXG4gICAgeyBpY29uOidmYS1zb2xpZCBmYS10YWdzJywgbGFiZWw6J+agh+etvueuoeeQhicsIGtleTondGFncycsIGFycm93OnRydWUgfSxcbiAgICB7IGljb246J2ZhLXNvbGlkIGZhLWxpbmsnLCBsYWJlbDon5aSW6YOo5aqS5L2TJywga2V5OidtZWRpYScsIGFycm93OnRydWUgfSxcbiAgICB7IHNlcDp0cnVlIH0sXG4gIF07XG4gIHJvd3MuZm9yRWFjaChyPT57XG4gICAgaWYgKChyIGFzIGFueSkuc2VwKXsgJGRkLmFwcGVuZChgPGRpdiBjbGFzcz1cImRjLWRkLXNlcFwiPjwvZGl2PmApOyByZXR1cm47IH1cbiAgICBjb25zdCBlbCA9ICQoYDxkaXYgY2xhc3M9XCJkYy1kZC1pdGVtXCIgZGF0YS1rZXk9XCIke3Iua2V5fVwiPjxzcGFuIHN0eWxlPVwiZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTBweFwiPjxpIGNsYXNzPVwiZGMtZGQtaWNvbiAke3IuaWNvbn1cIj48L2k+PHNwYW4+JHtyLmxhYmVsfTwvc3Bhbj48L3NwYW4+PHNwYW4gY2xhc3M9XCJkYy1kZC1hcnJvd1wiPiR7ci5hcnJvdz8n4oC6JzonJ308L3NwYW4+PC9kaXY+YCk7XG4gICAgZWwub24oJ2NsaWNrJywgKCk9PnsgJCgnI2RjLWNoYXItZHJvcGRvd24nKS5hZGRDbGFzcygnaGlkZGVuJyk7ICQoJyNkYy1zaWRlYmFyLWhlYWRlcicpLnJlbW92ZUNsYXNzKCdvcGVuJyk7IG9wZW5DaGFyTW9kYWwoci5rZXkpOyB9KTtcbiAgICAkZGQuYXBwZW5kKGVsKTtcbiAgfSk7XG4gICRkZC5hcHBlbmQoYDxkaXYgY2xhc3M9XCJkYy1kZC10b2tlblwiPjxzcGFuPlRva2VuIOe7n+iuoTwvc3Bhbj48c3BhbiBpZD1cImRjLXRva2VuLWNvdW50XCI+6K6h566X5Lit4oCmPC9zcGFuPjwvZGl2PmApO1xuICAvLyBmYXYvcXVpY2tcbiAgJGRkLmFwcGVuZChgPGRpdiBjbGFzcz1cImRjLWRkLWl0ZW0gYWx0LWhvdmVyXCIgZGF0YS1rZXk9XCJmYXZcIj48c3BhbiBzdHlsZT1cImRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEwcHhcIj48aSBjbGFzcz1cImRjLWRkLWljb24gZmEtc29saWQgZmEtc3RhclwiPjwvaT48c3Bhbj7mlLbol48gLyDlv6vpgJ/liIfmjaI8L3NwYW4+PC9zcGFuPjxzcGFuIGNsYXNzPVwiZGMtZGQtYXJyb3dcIj48L3NwYW4+PC9kaXY+YCk7XG4gICRkZC5maW5kKCdbZGF0YS1rZXk9XCJmYXZcIl0nKS5vbignY2xpY2snLCBhc3luYyAoKT0+e1xuICAgICQoJyNkYy1jaGFyLWRyb3Bkb3duJykuYWRkQ2xhc3MoJ2hpZGRlbicpO1xuICAgIC8vIHRvZ2dsZSBmYXZcbiAgICBjb25zdCBuYW1lID0gZ2V0Q3VycmVudENoYXJhY3Rlck5hbWUoKTsgaWYgKCFuYW1lKSByZXR1cm47XG4gICAgdHJ5eyBjb25zdCBjaCA9IGF3YWl0IHNhZmVHZXRDaGFyYWN0ZXIobmFtZSk7IGNvbnN0IGN1ckZhdiA9IChjaCBhcyBhbnkpLmZhdiB8fCAoY2ggYXMgYW55KS5leHRlbnNpb25zPy5mYXYgfHwgZmFsc2U7IGF3YWl0IHNhZmVVcGRhdGVDaGFyYWN0ZXIobmFtZSwgKGM6YW55KT0+eyBjLmV4dGVuc2lvbnMgPSBjLmV4dGVuc2lvbnN8fHt9OyBjLmV4dGVuc2lvbnMuZmF2ID0gIWN1ckZhdjsgKGMgYXMgYW55KS5mYXYgPSAhY3VyRmF2OyByZXR1cm4gYzsgfSk7IHRvYXN0ci5zdWNjZXNzKGN1ckZhdj8n5bey5Y+W5raI5pS26JePJzon5bey5pS26JePJyk7IH1jYXRjaChlKXsgd2FybihlKTsgfVxuICB9KTtcbiAgLy8gY29tcHV0ZSB0b2tlbnMgYXN5bmNcbiAgc2V0VGltZW91dChhc3luYyAoKT0+e1xuICAgIHRyeXsgY29uc3QgdHh0ID0gYXdhaXQgZ2V0Q3VycmVudENoYXJUb2tlbnMoKTsgJCgnI2RjLXRva2VuLWNvdW50JykudGV4dCh0eHQpOyB9Y2F0Y2h7ICQoJyNkYy10b2tlbi1jb3VudCcpLnRleHQoJ+KAlCcpOyB9XG4gIH0sIDMwMCk7XG59XG5cbi8vIC0tLS0tLS0tLS0gQ2hhciBNb2RhbCBQNCAtLS0tLS0tLS0tXG5sZXQgY3VycmVudENoYXJNb2RhbFRhYiA9ICdhdmF0YXInO1xuZnVuY3Rpb24gb3BlbkNoYXJNb2RhbCh0YWI6c3RyaW5nKXtcbiAgY3VycmVudENoYXJNb2RhbFRhYiA9IHRhYjtcbiAgJCgnI2RjLWNoYXItbW9kYWwnKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gIHJlbmRlckNoYXJNb2RhbCgpO1xufVxuZnVuY3Rpb24gY2xvc2VDaGFyTW9kYWwoKXsgJCgnI2RjLWNoYXItbW9kYWwnKS5hZGRDbGFzcygnaGlkZGVuJyk7IH1cbmZ1bmN0aW9uIHJlbmRlckNoYXJNb2RhbCgpe1xuICBjb25zdCBjaGFyTmFtZSA9IGdldEN1cnJlbnRDaGFyYWN0ZXJOYW1lKCkgfHwgJ+acqumAieaLqeinkuiJsic7XG4gIGNvbnN0ICRsZWZ0ID0gJCgnI2RjLWNoYXItbGVmdCcpOyAkbGVmdC5lbXB0eSgpO1xuICBjb25zdCAkcmlnaHRJbm5lciA9ICQoJyNkYy1jaGFyLXJpZ2h0LWlubmVyJyk7ICRyaWdodElubmVyLmVtcHR5KCk7XG4gIC8vIGxlZnQgbmF2IHN0cnVjdHVyZVxuICBjb25zdCBncm91cHMgPSBbXG4gICAgeyB0aXRsZTogY2hhck5hbWUsIGl0ZW1zOiBbIHtrZXk6J2F2YXRhcicsIGxhYmVsOifop5LoibLlpLTlg48gJiDln7rmnKzkv6Hmga8nfSwge2tleTonZGVzYycsIGxhYmVsOifop5LoibLmj4/ov7AnfSwge2tleTonZ3JlZXRpbmcnLCBsYWJlbDon5byA5Zy655m96K6+572uJ30gXSB9LFxuICAgIHsgdGl0bGU6J+WGheWuueiuvuWumicsIGl0ZW1zOiBbIHtrZXk6J2NyZWF0b3InLCBsYWJlbDon5Yib5L2c6ICF55qE5rOo6YeKJ30sIHtrZXk6J2xvcmUnLCBsYWJlbDon6KeS6Imy5LiW55WM5LmmJ30sIHtrZXk6J3RhZ3MnLCBsYWJlbDon5qCH562+566h55CGJ30gXSB9LFxuICAgIHsgdGl0bGU6J+mrmOe6p+mAiemhuScsIGl0ZW1zOiBbIHtrZXk6J2FkdmFuY2VkJywgbGFiZWw6J+mrmOe6p+WumuS5iSd9LCB7a2V5Oidwcm9tcHRzJywgbGFiZWw6J+aPkOekuuivjeimhueblid9LCB7a2V5OidtZXRhJywgbGFiZWw6J+WIm+S9nOiAheeahOWFg+aVsOaNrid9LCB7a2V5OidtZWRpYScsIGxhYmVsOiflpJbpg6jlqpLkvZPpk77mjqUnfSBdIH0sXG4gICAgeyB0aXRsZTon5pWw5o2uJywgaXRlbXM6IFsge2tleTondG9rZW5zJywgbGFiZWw6J1Rva2VuIOe7n+iuoSd9LCB7a2V5OidmYXYnLCBsYWJlbDon5pS26JeP5LiO54Ot6ZSuJ30gXSB9LFxuICBdO1xuICBncm91cHMuZm9yRWFjaChnPT57XG4gICAgJGxlZnQuYXBwZW5kKGA8ZGl2IGNsYXNzPVwiZGMtbmF2LXRpdGxlXCI+JHtlc2NhcGVIdG1sKGcudGl0bGUpfTwvZGl2PmApO1xuICAgIGcuaXRlbXMuZm9yRWFjaChpdD0+e1xuICAgICAgY29uc3QgYWN0aXZlID0gaXQua2V5PT09Y3VycmVudENoYXJNb2RhbFRhYiA/ICcgYWN0aXZlJzonJztcbiAgICAgIGNvbnN0IGVsID0gJChgPGRpdiBjbGFzcz1cImRjLW5hdi1pdGVtJHthY3RpdmV9XCIgZGF0YS10YWI9XCIke2l0LmtleX1cIj4ke2VzY2FwZUh0bWwoaXQubGFiZWwpfTwvZGl2PmApO1xuICAgICAgZWwub24oJ2NsaWNrJywgKCk9PnsgY3VycmVudENoYXJNb2RhbFRhYiA9IGl0LmtleTsgcmVuZGVyQ2hhck1vZGFsKCk7IH0pO1xuICAgICAgJGxlZnQuYXBwZW5kKGVsKTtcbiAgICB9KTtcbiAgfSk7XG4gIC8vIHJpZ2h0IGNvbnRlbnRcbiAgbG9hZENoYXJQYW5lbCgkcmlnaHRJbm5lciwgY3VycmVudENoYXJNb2RhbFRhYik7XG59XG5hc3luYyBmdW5jdGlvbiBsb2FkQ2hhclBhbmVsKCR3cmFwOmFueSwgdGFiOnN0cmluZyl7XG4gIGNvbnN0IG5hbWUgPSBnZXRDdXJyZW50Q2hhcmFjdGVyTmFtZSgpO1xuICBpZiAoIW5hbWUpeyAkd3JhcC5odG1sKGA8aDI+5pyq6YCJ5oup6KeS6ImyPC9oMj48cCBjbGFzcz1cImRlc2NcIj7or7flhYjlnKjlt6bkvqfpgInmi6nkuIDkuKrop5LoibI8L3A+YCk7IHJldHVybjsgfVxuICBsZXQgY2g6YW55ID0gbnVsbDsgdHJ5eyBjaCA9IGF3YWl0IHNhZmVHZXRDaGFyYWN0ZXIobmFtZSk7IH1jYXRjaChlKXsgJHdyYXAuaHRtbChgPHAgc3R5bGU9XCJjb2xvcjojZWQ0MjQ1XCI+6K+75Y+W5aSx6LSlOiAke2VzY2FwZUh0bWwoU3RyaW5nKGUpKX08L3A+YCk7IHJldHVybjsgfVxuICAvLyBjb21tb24gcHJldmlldyBjYXJkXG4gIGNvbnN0IGF2YXRhckZpbGUgPSAoY2ggYXMgYW55KS5hdmF0YXIgfHwgY2g/LmRhdGE/LmF2YXRhciB8fCAnJztcbiAgY29uc3QgdGh1bWIgPSBhdmF0YXJGaWxlPyBnZXRUaHVtYignYXZhdGFyJywgU3RyaW5nKGF2YXRhckZpbGUpKSA6ICcuL2ltZy9haTIucG5nJztcbiAgLy8gV2UnbGwgcG9zaXRpb24gcHJldmlldyBhYnNvbHV0ZWx5IHZpYSBDU1MgbWF5YmUsIGJ1dCBhZGQgaW5zaWRlIHdyYXBcbiAgaWYgKFsnYXZhdGFyJywnZGVzYycsJ2dyZWV0aW5nJ10uaW5jbHVkZXModGFiKSl7XG4gICAgLy8gcHJldmlldyBjYXJkXG4gICAgY29uc3QgcHJldmlldyA9ICQoYDxkaXYgY2xhc3M9XCJkYy1wcmV2aWV3LWNhcmRcIj48aW1nIHNyYz1cIiR7dGh1bWJ9XCIvPjxkaXYgY2xhc3M9XCJpbmZvXCI+PGI+JHtlc2NhcGVIdG1sKGNoPy5kYXRhPy5uYW1lIHx8IG5hbWUpfTwvYj48cD4ke2VzY2FwZUh0bWwoKGNoPy5kYXRhPy5kZXNjcmlwdGlvbnx8JycpLnNsaWNlKDAsMTIwKSl9PC9wPjwvZGl2PjwvZGl2PmApO1xuICAgICR3cmFwLmNzcygncG9zaXRpb24nLCdyZWxhdGl2ZScpO1xuICAgIC8vIEFwcGVuZCBsYXRlclxuICAgIHNldFRpbWVvdXQoKCk9PiAkd3JhcC5hcHBlbmQocHJldmlldyksIDUwKTtcbiAgfVxuICBpZiAodGFiPT09J2F2YXRhcicpe1xuICAgICR3cmFwLmh0bWwoYFxuICAgICAgPGgyPuinkuiJsui1hOaWmTwvaDI+PHAgY2xhc3M9XCJkZXNjXCI+566h55CG5aS05YOP44CB5ZCN56ew5LiO5Z+656GA5L+h5oGvPC9wPlxuICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6MTZweDthbGlnbi1pdGVtczpjZW50ZXJcIj48aW1nIHNyYz1cIiR7dGh1bWJ9XCIgc3R5bGU9XCJ3aWR0aDo5NnB4O2hlaWdodDo5NnB4O2JvcmRlci1yYWRpdXM6MTJweDtvYmplY3QtZml0OmNvdmVyXCIvPjxkaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJkYy1maWVsZFwiPjxsYWJlbD7op5LoibLlkI08L2xhYmVsPjxpbnB1dCBjbGFzcz1cImRjLWlucHV0XCIgaWQ9XCJkYy1lZGl0LW5hbWVcIiB2YWx1ZT1cIiR7ZXNjYXBlSHRtbChjaD8uZGF0YT8ubmFtZXx8bmFtZSl9XCIvPjwvZGl2PlxuICAgICAgICA8aW5wdXQgdHlwZT1cImZpbGVcIiBpZD1cImRjLWF2YXRhci11cGxvYWRcIiBhY2NlcHQ9XCJpbWFnZS8qXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjhweFwiLz5cbiAgICAgIDwvZGl2PjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImRjLWZpZWxkXCI+PGxhYmVsPlRva2VuIOaVsDwvbGFiZWw+PGRpdiBpZD1cImRjLWF2YXRhci10b2tlblwiIHN0eWxlPVwiY29sb3I6I2I1YmFjMVwiPuiuoeeul+S4reKApjwvZGl2PjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImRjLWRpdmlkZXJcIj48L2Rpdj5cbiAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7Z2FwOjhweFwiPjxidXR0b24gY2xhc3M9XCJkYy1idG4tcHJpbWFyeVwiIGlkPVwiZGMtc2F2ZS1hdmF0YXJcIj7kv53lrZjmm7TmlLk8L2J1dHRvbj48YnV0dG9uIGNsYXNzPVwiZGMtYnRuLXNlY29uZGFyeVwiIGlkPVwiZGMtcmVzZXQtYXZhdGFyXCI+6YeN572uPC9idXR0b24+PC9kaXY+XG4gICAgYCk7XG4gICAgKGFzeW5jKCk9PnsgdHJ5eyBjb25zdCB0ID0gYXdhaXQgZ2V0VG9rZW5Db3VudEFzeW5jKGNoPy5kYXRhPy5kZXNjcmlwdGlvbnx8JycpOyAkKCcjZGMtYXZhdGFyLXRva2VuJykudGV4dCgn5o+P6L+wIFRva2VuOiAnK3QpOyB9Y2F0Y2h7fSB9KSgpO1xuICAgICQoJyNkYy1zYXZlLWF2YXRhcicpLm9uKCdjbGljaycsIGFzeW5jICgpPT57XG4gICAgICBjb25zdCBuZXdOYW1lID0gKCQoJyNkYy1lZGl0LW5hbWUnKS52YWwoKSBhcyBzdHJpbmcpLnRyaW0oKTtcbiAgICAgIGNvbnN0IGZpbGVJbnB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkYy1hdmF0YXItdXBsb2FkJykgYXMgSFRNTElucHV0RWxlbWVudDtcbiAgICAgIHRyeXtcbiAgICAgICAgaWYgKGZpbGVJbnB1dD8uZmlsZXM/LlswXSl7IGNvbnN0IGJsb2IgPSBmaWxlSW5wdXQuZmlsZXNbMF07IGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCBzYWZlVXBkYXRlQ2hhcmFjdGVyKG5hbWUsIGFzeW5jIChjOmFueSk9PnsgYy5hdmF0YXIgPSBibG9iIGFzIGFueTsgaWYgKG5ld05hbWUgJiYgbmV3TmFtZSE9PW5hbWUpIGMuZGF0YS5uYW1lID0gbmV3TmFtZTsgcmV0dXJuIGM7IH0pOyB0b2FzdHIuc3VjY2Vzcygn5aS05YOP5bey5pu05pawJyk7IH1cbiAgICAgICAgZWxzZSBpZiAobmV3TmFtZSAmJiBuZXdOYW1lIT09bmFtZSl7IGF3YWl0IHNhZmVVcGRhdGVDaGFyYWN0ZXIobmFtZSwgKGM6YW55KT0+eyBjLmRhdGEubmFtZT1uZXdOYW1lOyByZXR1cm4gYzsgfSk7IHRvYXN0ci5zdWNjZXNzKCflkI3np7Dlt7Lmm7TmlrAnKTsgfVxuICAgICAgICByZW5kZXJHdWlsZEJhcigpOyB1cGRhdGVIZWFkZXIoKTsgcmVuZGVyQ2hhck1vZGFsKCk7XG4gICAgICB9Y2F0Y2goZSl7IHRvYXN0ci5lcnJvcihTdHJpbmcoZSkpOyB9XG4gICAgfSk7XG4gIH0gZWxzZSBpZiAodGFiPT09J2Rlc2MnKXtcbiAgICAkd3JhcC5odG1sKGBcbiAgICAgIDxoMj7op5LoibLmj4/ov7A8L2gyPjxwIGNsYXNzPVwiZGVzY1wiPuWumuS5ieinkuiJsueahOaguOW/g+iuvuWumu+8jOaUr+aMgeWkp+aWh+acrOe8lui+kTwvcD5cbiAgICAgIDxkaXYgY2xhc3M9XCJkYy1maWVsZFwiPjxsYWJlbD7op5LoibLmj4/ov7A8L2xhYmVsPjx0ZXh0YXJlYSBjbGFzcz1cImRjLXRleHRhcmVhXCIgaWQ9XCJkYy1lZGl0LWRlc2NcIiBzdHlsZT1cIm1pbi1oZWlnaHQ6MjQwcHhcIj4ke2VzY2FwZUh0bWwoY2g/LmRhdGE/LmRlc2NyaXB0aW9ufHxjaD8uZGVzY3JpcHRpb258fCcnKX08L3RleHRhcmVhPjxkaXYgc3R5bGU9XCJjb2xvcjojOTQ5YmE0O2ZvbnQtc2l6ZToxMXB4O21hcmdpbi10b3A6NHB4XCI+VG9rZW46IDxzcGFuIGlkPVwiZGMtZGVzYy10b2tlblwiPuKAlDwvc3Bhbj48L2Rpdj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkYy1zYXZlLWJhclwiPjxzcGFuPuacieacquS/neWtmOeahOabtOaUue+8n+eCueWHu+S/neWtmDwvc3Bhbj48ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2dhcDo4cHhcIj48YnV0dG9uIGNsYXNzPVwiZGMtYnRuLXNlY29uZGFyeVwiIGlkPVwiZGMtZGVzYy1yZXNldFwiPumHjee9rjwvYnV0dG9uPjxidXR0b24gY2xhc3M9XCJkYy1idG4tcHJpbWFyeVwiIGlkPVwiZGMtZGVzYy1zYXZlXCI+5L+d5a2Y5pu05pS5PC9idXR0b24+PC9kaXY+PC9kaXY+XG4gICAgYCk7XG4gICAgY29uc3QgdXBkYXRlVG9rID0gYXN5bmMgKCk9PnsgdHJ5eyBjb25zdCB2ID0gKCQoJyNkYy1lZGl0LWRlc2MnKS52YWwoKSBhcyBzdHJpbmcpOyBjb25zdCB0ID0gYXdhaXQgU2lsbHlUYXZlcm4uZ2V0VG9rZW5Db3VudEFzeW5jKHYpOyAkKCcjZGMtZGVzYy10b2tlbicpLnRleHQoU3RyaW5nKHQpKTsgfWNhdGNoe319O1xuICAgICQoJyNkYy1lZGl0LWRlc2MnKS5vbignaW5wdXQnLCBfLmRlYm91bmNlKHVwZGF0ZVRvaywzMDApKTsgdXBkYXRlVG9rKCk7XG4gICAgJCgnI2RjLWRlc2Mtc2F2ZScpLm9uKCdjbGljaycsIGFzeW5jICgpPT57IHRyeXsgY29uc3QgdiA9ICgkKCcjZGMtZWRpdC1kZXNjJykudmFsKCkgYXMgc3RyaW5nKTsgYXdhaXQgc2FmZVVwZGF0ZUNoYXJhY3RlcihuYW1lLCAoYzphbnkpPT57IGMuZGF0YS5kZXNjcmlwdGlvbj12OyBjLmRlc2NyaXB0aW9uPXY7IHJldHVybiBjOyB9KTsgdG9hc3RyLnN1Y2Nlc3MoJ+W3suS/neWtmCcpOyB9Y2F0Y2goZSl7IHRvYXN0ci5lcnJvcihTdHJpbmcoZSkpOyB9IH0pO1xuICAgICQoJyNkYy1kZXNjLXJlc2V0Jykub24oJ2NsaWNrJywgKCk9PiAkKCcjZGMtZWRpdC1kZXNjJykudmFsKGNoPy5kYXRhPy5kZXNjcmlwdGlvbnx8JycpKTtcbiAgfSBlbHNlIGlmICh0YWI9PT0nZ3JlZXRpbmcnKXtcbiAgICBjb25zdCBmaXJzdCA9IGNoPy5kYXRhPy5maXJzdF9tZXMgfHwgY2g/LmZpcnN0X21lcyB8fCAnJztcbiAgICBjb25zdCBhbHRzOiBzdHJpbmdbXSA9IGNoPy5kYXRhPy5hbHRlcm5hdGVfZ3JlZXRpbmdzfHxbXTtcbiAgICAkd3JhcC5odG1sKGBcbiAgICAgIDxoMj7lvIDlnLrnmb08L2gyPjxwIGNsYXNzPVwiZGVzY1wiPuS4u+W8gOWcuueZveS4juWAmeihpeW8gOWcuueZveWIl+ihqDwvcD5cbiAgICAgIDxkaXYgY2xhc3M9XCJkYy1maWVsZFwiPjxsYWJlbD7kuLvlvIDlnLrnmb08L2xhYmVsPjx0ZXh0YXJlYSBjbGFzcz1cImRjLXRleHRhcmVhXCIgaWQ9XCJkYy1maXJzdFwiPiR7ZXNjYXBlSHRtbChmaXJzdCl9PC90ZXh0YXJlYT48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkYy1maWVsZFwiPjxsYWJlbD7lgJnooaXlvIDlnLrnmb0gKCR7YWx0cy5sZW5ndGh9KTwvbGFiZWw+PGRpdiBpZD1cImRjLWFsdC1saXN0XCI+PC9kaXY+PGJ1dHRvbiBjbGFzcz1cImRjLWJ0bi1zZWNvbmRhcnlcIiBpZD1cImRjLWFkZC1hbHRcIj7vvIsg5re75Yqg5YCZ6KGlPC9idXR0b24+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGMtc2F2ZS1iYXJcIj48c3Bhbj48L3NwYW4+PGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6OHB4XCI+PGJ1dHRvbiBjbGFzcz1cImRjLWJ0bi1wcmltYXJ5XCIgaWQ9XCJkYy1ncmVldC1zYXZlXCI+5L+d5a2Y5pu05pS5PC9idXR0b24+PC9kaXY+PC9kaXY+XG4gICAgYCk7XG4gICAgY29uc3QgJGFsdExpc3QgPSAkKCcjZGMtYWx0LWxpc3QnKTsgYWx0cy5mb3JFYWNoKChnOnN0cmluZyxpOm51bWJlcik9PntcbiAgICAgIGNvbnN0IHJvdyA9ICQoYDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7Z2FwOjhweDttYXJnaW46NnB4IDBcIj48dGV4dGFyZWEgY2xhc3M9XCJkYy10ZXh0YXJlYVwiIGRhdGEtaWR4PVwiJHtpfVwiIHN0eWxlPVwiZmxleDoxO21pbi1oZWlnaHQ6ODBweFwiPiR7ZXNjYXBlSHRtbChnKX08L3RleHRhcmVhPjxidXR0b24gY2xhc3M9XCJkYy1idG4tZGFuZ2VyXCIgZGF0YS1kZWw9XCIke2l9XCI+5Yig6ZmkPC9idXR0b24+PC9kaXY+YCk7XG4gICAgICByb3cuZmluZCgnW2RhdGEtZGVsXScpLm9uKCdjbGljaycsICgpPT4gcm93LnJlbW92ZSgpKTtcbiAgICAgICRhbHRMaXN0LmFwcGVuZChyb3cpO1xuICAgIH0pO1xuICAgICQoJyNkYy1hZGQtYWx0Jykub24oJ2NsaWNrJywgKCk9PntcbiAgICAgIGNvbnN0IHJvdyA9ICQoYDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7Z2FwOjhweDttYXJnaW46NnB4IDBcIj48dGV4dGFyZWEgY2xhc3M9XCJkYy10ZXh0YXJlYVwiIHN0eWxlPVwiZmxleDoxO21pbi1oZWlnaHQ6ODBweFwiIHBsYWNlaG9sZGVyPVwi5paw55qE5YCZ6KGl5byA5Zy655m9XCI+PC90ZXh0YXJlYT48YnV0dG9uIGNsYXNzPVwiZGMtYnRuLWRhbmdlclwiPuWIoOmZpDwvYnV0dG9uPjwvZGl2PmApO1xuICAgICAgcm93LmZpbmQoJ2J1dHRvbicpLm9uKCdjbGljaycsICgpPT4gcm93LnJlbW92ZSgpKTtcbiAgICAgICRhbHRMaXN0LmFwcGVuZChyb3cpO1xuICAgIH0pO1xuICAgICQoJyNkYy1ncmVldC1zYXZlJykub24oJ2NsaWNrJywgYXN5bmMgKCk9PntcbiAgICAgIGNvbnN0IG1haW4gPSAoJCgnI2RjLWZpcnN0JykudmFsKCkgYXMgc3RyaW5nKTtcbiAgICAgIGNvbnN0IGFsdHNOZXcgPSAkYWx0TGlzdC5maW5kKCd0ZXh0YXJlYScpLm1hcCgoXzphbnksIGVsOmFueSk9PiAkKGVsKS52YWwoKSBhcyBzdHJpbmcpLmdldCgpLmZpbHRlcigoczpzdHJpbmcpPT4gcy50cmltKCkubGVuZ3RoPjApO1xuICAgICAgdHJ5eyBhd2FpdCBzYWZlVXBkYXRlQ2hhcmFjdGVyKG5hbWUsIChjOmFueSk9PnsgYy5kYXRhLmZpcnN0X21lcz1tYWluOyBjLmZpcnN0X21lcz1tYWluOyBjLmRhdGEuYWx0ZXJuYXRlX2dyZWV0aW5ncz1hbHRzTmV3OyByZXR1cm4gYzsgfSk7IHRvYXN0ci5zdWNjZXNzKCflvIDlnLrnmb3lt7Lkv53lrZgnKTsgfWNhdGNoKGUpeyB0b2FzdHIuZXJyb3IoU3RyaW5nKGUpKTsgfVxuICAgIH0pO1xuICB9IGVsc2UgaWYgKHRhYj09PSdjcmVhdG9yJyl7XG4gICAgJHdyYXAuaHRtbChgXG4gICAgICA8aDI+5Yib5L2c6ICF5rOo6YeKPC9oMj48cCBjbGFzcz1cImRlc2NcIj7ku4XliJvkvZzogIXlj6/op4HnmoTlpIfms6jvvIzkuI3kvJrlj5HpgIHnu5kgQUk8L3A+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGMtZmllbGRcIj48bGFiZWw+Q3JlYXRvciBOb3RlczwvbGFiZWw+PHRleHRhcmVhIGNsYXNzPVwiZGMtdGV4dGFyZWFcIiBpZD1cImRjLWNyZWF0b3Itbm90ZXNcIiBzdHlsZT1cIm1pbi1oZWlnaHQ6MTYwcHhcIj4ke2VzY2FwZUh0bWwoY2g/LmRhdGE/LmNyZWF0b3Jfbm90ZXN8fGNoPy5jcmVhdG9yX25vdGVzfHwnJyl9PC90ZXh0YXJlYT48L2Rpdj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJkYy1idG4tcHJpbWFyeVwiIGlkPVwiZGMtY3JlYXRvci1zYXZlXCI+5L+d5a2YPC9idXR0b24+XG4gICAgYCk7XG4gICAgJCgnI2RjLWNyZWF0b3Itc2F2ZScpLm9uKCdjbGljaycsIGFzeW5jICgpPT57IGNvbnN0IHYgPSAoJCgnI2RjLWNyZWF0b3Itbm90ZXMnKS52YWwoKSBhcyBzdHJpbmcpOyB0cnl7IGF3YWl0IHNhZmVVcGRhdGVDaGFyYWN0ZXIobmFtZSwgKGM6YW55KT0+eyBjLmRhdGEuY3JlYXRvcl9ub3Rlcz12OyBjLmNyZWF0b3Jfbm90ZXM9djsgcmV0dXJuIGM7IH0pOyB0b2FzdHIuc3VjY2Vzcygn5bey5L+d5a2YJyk7IH1jYXRjaChlKXsgdG9hc3RyLmVycm9yKFN0cmluZyhlKSk7IH0gfSk7XG4gIH0gZWxzZSBpZiAodGFiPT09J2xvcmUnKXtcbiAgICAkd3JhcC5odG1sKGA8aDI+6KeS6Imy5LiW55WM5LmmPC9oMj48cCBjbGFzcz1cImRlc2NcIj7mmL7npLror6Xop5LoibLnu5HlrprnmoTkuLvopoHkuJbnlYzkuablhoXlrrnvvIzmnaXoh6rphZLppobmnKzkvZPlrZjlgqg8L3A+PGRpdiBpZD1cImRjLWxvcmUtaW5mb1wiIHN0eWxlPVwiY29sb3I6I2I1YmFjMTtmb250LXNpemU6MTNweDttYXJnaW46OHB4IDBcIj7liqDovb3kuK3igKY8L2Rpdj48ZGl2IGlkPVwiZGMtbG9yZS1saXN0XCI+PC9kaXY+PGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6MTJweDtkaXNwbGF5OmZsZXg7Z2FwOjhweFwiPjxidXR0b24gY2xhc3M9XCJkYy1idG4tcHJpbWFyeVwiIGlkPVwiZGMtbG9yZS1uZXdcIj7vvIsg5paw5bu65p2h55uuPC9idXR0b24+PGJ1dHRvbiBjbGFzcz1cImRjLWJ0bi1zZWNvbmRhcnlcIiBpZD1cImRjLWxvcmUtbWFuYWdlXCI+5omT5byA5LiW55WM5Lmm57yW6L6R5ZmoPC9idXR0b24+PC9kaXY+YCk7XG4gICAgbG9hZExvcmVQYW5lbCgpO1xuICB9IGVsc2UgaWYgKHRhYj09PSd0YWdzJyl7XG4gICAgY29uc3QgdGFnczogc3RyaW5nW10gPSBjaD8uZGF0YT8udGFncyB8fCBjaD8udGFncyB8fCBbXTtcbiAgICAkd3JhcC5odG1sKGBcbiAgICAgIDxoMj7moIfnrb48L2gyPjxwIGNsYXNzPVwiZGVzY1wiPuS4uuinkuiJsua3u+WKoOagh+etvu+8jOS+v+S6juetm+mAiTwvcD5cbiAgICAgIDxkaXYgY2xhc3M9XCJkYy1maWVsZFwiPjxsYWJlbD7lvZPliY3moIfnrb48L2xhYmVsPjxkaXYgaWQ9XCJkYy10YWdzLXdyYXBcIiBzdHlsZT1cImRpc3BsYXk6ZmxleDtmbGV4LXdyYXA6d3JhcDtnYXA6NnB4XCI+JHt0YWdzLm1hcCh0PT5gPHNwYW4gY2xhc3M9XCJkYy1waWxsXCI+JHtlc2NhcGVIdG1sKHQpfSA8aSBjbGFzcz1cImZhLXNvbGlkIGZhLXhtYXJrXCIgc3R5bGU9XCJjdXJzb3I6cG9pbnRlclwiIGRhdGEtdGFnPVwiJHtlc2NhcGVIdG1sKHQpfVwiPjwvaT48L3NwYW4+YCkuam9pbignJykgfHwgJzxzcGFuIHN0eWxlPVwiY29sb3I6Izk0OWJhNFwiPuaaguaXoOagh+etvjwvc3Bhbj4nfTwvZGl2PjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImRjLWZpZWxkXCI+PGxhYmVsPua3u+WKoOagh+etvjwvbGFiZWw+PGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6OHB4XCI+PGlucHV0IGNsYXNzPVwiZGMtaW5wdXRcIiBpZD1cImRjLXRhZy1pbnB1dFwiIHBsYWNlaG9sZGVyPVwi6L6T5YWl5qCH562+5ZCO5Zue6L2mXCIvPjxidXR0b24gY2xhc3M9XCJkYy1idG4tc2Vjb25kYXJ5XCIgaWQ9XCJkYy10YWctYWRkXCI+5re75YqgPC9idXR0b24+PC9kaXY+PC9kaXY+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiZGMtYnRuLXByaW1hcnlcIiBpZD1cImRjLXRhZy1zYXZlXCI+5L+d5a2Y5qCH562+PC9idXR0b24+XG4gICAgYCk7XG4gICAgbGV0IGN1clRhZ3MgPSBbLi4udGFnc107XG4gICAgY29uc3QgcmVmcmVzaCA9ICgpPT57ICQoJyNkYy10YWdzLXdyYXAnKS5odG1sKGN1clRhZ3MubWFwKHQ9PmA8c3BhbiBjbGFzcz1cImRjLXBpbGxcIj4ke2VzY2FwZUh0bWwodCl9IDxpIGNsYXNzPVwiZmEtc29saWQgZmEteG1hcmtcIiBkYXRhLXRhZz1cIiR7ZXNjYXBlSHRtbCh0KX1cIiBzdHlsZT1cImN1cnNvcjpwb2ludGVyXCI+PC9pPjwvc3Bhbj5gKS5qb2luKCcnKXx8JzxzcGFuIHN0eWxlPVwiY29sb3I6Izk0OWJhNFwiPuaaguaXoOagh+etvjwvc3Bhbj4nKTsgJCgnI2RjLXRhZ3Mtd3JhcCBbZGF0YS10YWddJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXsgY29uc3QgdGFnPSQodGhpcykuYXR0cignZGF0YS10YWcnKTsgY3VyVGFncyA9IGN1clRhZ3MuZmlsdGVyKHg9PnghPT10YWcpOyByZWZyZXNoKCk7IH0pOyB9O1xuICAgIHJlZnJlc2goKTtcbiAgICAkKCcjZGMtdGFnLWFkZCcpLm9uKCdjbGljaycsICgpPT57IGNvbnN0IHYgPSAoJCgnI2RjLXRhZy1pbnB1dCcpLnZhbCgpIGFzIHN0cmluZykudHJpbSgpOyBpZiAoIXYpIHJldHVybjsgaWYgKCFjdXJUYWdzLmluY2x1ZGVzKHYpKSBjdXJUYWdzLnB1c2godik7ICgkKCcjZGMtdGFnLWlucHV0JykgYXMgYW55KS52YWwoJycpOyByZWZyZXNoKCk7IH0pO1xuICAgICQoJyNkYy10YWctaW5wdXQnKS5vbigna2V5ZG93bicsIChlOmFueSk9PnsgaWYgKGUua2V5PT09J0VudGVyJyl7IGUucHJldmVudERlZmF1bHQoKTsgJCgnI2RjLXRhZy1hZGQnKS50cmlnZ2VyKCdjbGljaycpOyB9IH0pO1xuICAgICQoJyNkYy10YWctc2F2ZScpLm9uKCdjbGljaycsIGFzeW5jICgpPT57IHRyeXsgYXdhaXQgc2FmZVVwZGF0ZUNoYXJhY3RlcihuYW1lLCAoYzphbnkpPT57IGMuZGF0YS50YWdzPWN1clRhZ3M7IGMudGFncz1jdXJUYWdzOyByZXR1cm4gYzsgfSk7IHRvYXN0ci5zdWNjZXNzKCfmoIfnrb7lt7Lkv53lrZgnKTsgfWNhdGNoKGUpeyB0b2FzdHIuZXJyb3IoU3RyaW5nKGUpKTsgfSB9KTtcbiAgfSBlbHNlIGlmICh0YWI9PT0nYWR2YW5jZWQnIHx8IHRhYj09PSdwcm9tcHRzJyB8fCB0YWI9PT0nbWV0YScgfHwgdGFiPT09J21lZGlhJyl7XG4gICAgYXdhaXQgcmVuZGVyQWR2YW5jZWRQYW5lbCgkd3JhcCwgY2gsIHRhYik7XG4gIH0gZWxzZSBpZiAodGFiPT09J3Rva2Vucycpe1xuICAgICR3cmFwLmh0bWwoYDxoMj5Ub2tlbiDnu5/orqE8L2gyPjxwIGNsYXNzPVwiZGVzY1wiPuWQhOWtl+autSBUb2tlbiDliIbluIM8L3A+PGRpdiBpZD1cImRjLXRva2VuLWRldGFpbFwiIHN0eWxlPVwiY29sb3I6I2I1YmFjMVwiPue7n+iuoeS4reKApjwvZGl2PmApO1xuICAgIHRyeXtcbiAgICAgIGNvbnN0IGZpZWxkczogUmVjb3JkPHN0cmluZyxzdHJpbmc+ID0ge1xuICAgICAgICAn6KeS6Imy5o+P6L+wJzogY2g/LmRhdGE/LmRlc2NyaXB0aW9ufHwnJyxcbiAgICAgICAgJ+S6uuagvCc6IGNoPy5kYXRhPy5wZXJzb25hbGl0eXx8JycsXG4gICAgICAgICfmg4Xmma8nOiBjaD8uZGF0YT8uc2NlbmFyaW98fCcnLFxuICAgICAgICAn5byA5Zy655m9JzogY2g/LmRhdGE/LmZpcnN0X21lc3x8JycsXG4gICAgICAgICfnpLrkvovmtojmga8nOiBjaD8uZGF0YT8ubWVzX2V4YW1wbGV8fCcnLFxuICAgICAgICAn5Yib5L2c6ICF5rOo6YeKJzogY2g/LmRhdGE/LmNyZWF0b3Jfbm90ZXN8fCcnLFxuICAgICAgfTtcbiAgICAgIGxldCB0b3RhbCA9IDA7IGxldCBodG1sID0gJzxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDo4cHg7bWFyZ2luLXRvcDoxMnB4XCI+JztcbiAgICAgIGZvciAoY29uc3QgW2ssdl0gb2YgT2JqZWN0LmVudHJpZXMoZmllbGRzKSl7XG4gICAgICAgIGNvbnN0IHQgPSBhd2FpdCBTaWxseVRhdmVybi5nZXRUb2tlbkNvdW50QXN5bmModik7XG4gICAgICAgIHRvdGFsKz10O1xuICAgICAgICBodG1sKz1gPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtiYWNrZ3JvdW5kOiMyYjJkMzE7cGFkZGluZzo4cHggMTBweDtib3JkZXItcmFkaXVzOjRweFwiPjxzcGFuPiR7a308L3NwYW4+PGI+JHt0fTwvYj48L2Rpdj5gO1xuICAgICAgfVxuICAgICAgaHRtbCs9YDwvZGl2PjxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOjEycHg7Y29sb3I6d2hpdGU7Zm9udC13ZWlnaHQ6NzAwXCI+5oC76K6hOiAke3RvdGFsfSBUb2tlbnM8L2Rpdj5gO1xuICAgICAgJCgnI2RjLXRva2VuLWRldGFpbCcpLmh0bWwoaHRtbCk7XG4gICAgfWNhdGNoKGUpeyAkKCcjZGMtdG9rZW4tZGV0YWlsJykudGV4dCgn57uf6K6h5aSx6LSlOiAnK1N0cmluZyhlKSk7IH1cbiAgfSBlbHNlIGlmICh0YWI9PT0nZmF2Jyl7XG4gICAgY29uc3QgaXNGYXYgPSAhIShjaD8uZGF0YT8uZXh0ZW5zaW9ucz8uZmF2IHx8IChjaCBhcyBhbnkpLmZhdik7XG4gICAgJHdyYXAuaHRtbChgXG4gICAgICA8aDI+5pS26JeP5LiO54Ot6ZSuPC9oMj48cCBjbGFzcz1cImRlc2NcIj7lv6vpgJ/liIfmjaLkuI7mlLbol488L3A+XG4gICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2dhcDoxMnB4O2FsaWduLWl0ZW1zOmNlbnRlcjttYXJnaW46MTZweCAwXCI+PGJ1dHRvbiBjbGFzcz1cImRjLWJ0bi1wcmltYXJ5XCIgaWQ9XCJkYy10b2dnbGUtZmF2XCI+JHtpc0Zhdj8n4piFIOW3suaUtuiXjyc6J+KYhiDmlLbol4/op5LoibInfTwvYnV0dG9uPjxzcGFuIHN0eWxlPVwiY29sb3I6I2I1YmFjMVwiPuaUtuiXj+WQjuS8mue9rumhtuaYvuekujwvc3Bhbj48L2Rpdj5cbiAgICBgKTtcbiAgICAkKCcjZGMtdG9nZ2xlLWZhdicpLm9uKCdjbGljaycsIGFzeW5jICgpPT57IHRyeXsgYXdhaXQgc2FmZVVwZGF0ZUNoYXJhY3RlcihuYW1lLCAoYzphbnkpPT57IGMuZXh0ZW5zaW9ucz1jLmV4dGVuc2lvbnN8fHt9OyBjLmV4dGVuc2lvbnMuZmF2PSFpc0ZhdjsgYy5mYXY9IWlzRmF2OyByZXR1cm4gYzsgfSk7IHRvYXN0ci5zdWNjZXNzKCflt7LliIfmjaInKTsgcmVuZGVyQ2hhck1vZGFsKCk7IH1jYXRjaChlKXsgdG9hc3RyLmVycm9yKFN0cmluZyhlKSk7IH0gfSk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVuZGVyQWR2YW5jZWRQYW5lbCgkd3JhcDphbnksIGNoOmFueSwgdGFiOnN0cmluZyl7XG4gIGNvbnN0IHBlcnNvbmFsaXR5ID0gY2g/LmRhdGE/LnBlcnNvbmFsaXR5fHwnJztcbiAgY29uc3Qgc2NlbmFyaW8gPSBjaD8uZGF0YT8uc2NlbmFyaW98fCcnO1xuICBjb25zdCBtZXNFeGFtcGxlID0gY2g/LmRhdGE/Lm1lc19leGFtcGxlfHwnJztcbiAgY29uc3Qgc3lzdGVtUHJvbXB0ID0gY2g/LmRhdGE/LnN5c3RlbV9wcm9tcHR8fCcnO1xuICBjb25zdCBwb3N0SGlzdG9yeSA9IGNoPy5kYXRhPy5wb3N0X2hpc3RvcnlfaW5zdHJ1Y3Rpb25zfHwnJztcbiAgY29uc3QgY3JlYXRvciA9IGNoPy5kYXRhPy5jcmVhdG9yfHwnJztcbiAgY29uc3QgY2hhclZlcnNpb24gPSBjaD8uZGF0YT8uY2hhcmFjdGVyX3ZlcnNpb258fCcnO1xuICBjb25zdCBleHRlbnNpb25zID0gY2g/LmRhdGE/LmV4dGVuc2lvbnN8fHt9O1xuICBpZiAodGFiPT09J2FkdmFuY2VkJyl7XG4gICAgJHdyYXAuaHRtbChgXG4gICAgICA8aDI+6auY57qn5a6a5LmJPC9oMj48cCBjbGFzcz1cImRlc2NcIj7op5LoibLorr7lrprmkZjopoHjgIHmg4Xmma/nrYnpq5jnuqflrZfmrrU8L3A+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGMtYWNjb3JkaW9uXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJkYy1hY2MtaGVhZFwiIGRhdGEtYWNjPVwicHJvbXB0X292ZXJcIj7mj5DnpLror43opobnm5YgPHNwYW4gY2xhc3M9XCJzdWJcIj7nlKjkuo7ogYrlpKnooaXlhajlkozmoLzlvI/mjIflvJXmqKHlvI88L3NwYW4+IDxzcGFuIHN0eWxlPVwiY29sb3I6I2I1YmFjMVwiPuKWvDwvc3Bhbj48L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImRjLWFjYy1ib2R5XCIgaWQ9XCJkYy1hY2MtcHJvbXB0X292ZXJcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGMtZmllbGRcIj48bGFiZWw+U3lzdGVtIFByb21wdDwvbGFiZWw+PHRleHRhcmVhIGNsYXNzPVwiZGMtdGV4dGFyZWFcIiBpZD1cImRjLXN5c3RlbS1wcm9tcHRcIj4ke2VzY2FwZUh0bWwoc3lzdGVtUHJvbXB0KX08L3RleHRhcmVhPjwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJkYy1maWVsZFwiPjxsYWJlbD5Qb3N0IEhpc3RvcnkgSW5zdHJ1Y3Rpb25zPC9sYWJlbD48dGV4dGFyZWEgY2xhc3M9XCJkYy10ZXh0YXJlYVwiIGlkPVwiZGMtcG9zdC1oaXN0b3J5XCI+JHtlc2NhcGVIdG1sKHBvc3RIaXN0b3J5KX08L3RleHRhcmVhPjwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImRjLWFjY29yZGlvblwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZGMtYWNjLWhlYWRcIiBkYXRhLWFjYz1cImNyZWF0b3JfbWV0YTJcIj7liJvkvZzogIXnmoTlhYPmlbDmja4gPHNwYW4gY2xhc3M9XCJzdWJcIj7kuI3kuI5BSeaPkOekuuivjeS4gOi1t+WPkemAgTwvc3Bhbj4gPHNwYW4gc3R5bGU9XCJjb2xvcjojYjViYWMxXCI+4pa8PC9zcGFuPjwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZGMtYWNjLWJvZHlcIiBpZD1cImRjLWFjYy1jcmVhdG9yX21ldGEyXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImRjLWZpZWxkXCI+PGxhYmVsPkNyZWF0b3I8L2xhYmVsPjxpbnB1dCBjbGFzcz1cImRjLWlucHV0XCIgaWQ9XCJkYy1jcmVhdG9yXCIgdmFsdWU9XCIke2VzY2FwZUh0bWwoY3JlYXRvcil9XCIvPjwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJkYy1maWVsZFwiPjxsYWJlbD5DaGFyYWN0ZXIgVmVyc2lvbjwvbGFiZWw+PGlucHV0IGNsYXNzPVwiZGMtaW5wdXRcIiBpZD1cImRjLXZlcnNpb25cIiB2YWx1ZT1cIiR7ZXNjYXBlSHRtbChjaGFyVmVyc2lvbil9XCIvPjwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImRjLWZpZWxkXCI+PGxhYmVsPuinkuiJsuiuvuWumuaRmOimgSA8c3BhbiB0aXRsZT1cInBlcnNvbmFsaXR5XCI+Pzwvc3Bhbj48L2xhYmVsPjx0ZXh0YXJlYSBjbGFzcz1cImRjLXRleHRhcmVhXCIgaWQ9XCJkYy1wZXJzb25hbGl0eVwiPiR7ZXNjYXBlSHRtbChwZXJzb25hbGl0eSl9PC90ZXh0YXJlYT48ZGl2IHN0eWxlPVwiY29sb3I6Izk0OWJhNDtmb250LXNpemU6MTFweFwiPlRva2VuOiA8c3BhbiBpZD1cImRjLXBlcnMtdG9rXCI+4oCUPC9zcGFuPjwvZGl2PjwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImRjLWZpZWxkXCI+PGxhYmVsPuaDheaZryA8c3BhbiB0aXRsZT1cInNjZW5hcmlvXCI+Pzwvc3Bhbj48L2xhYmVsPjx0ZXh0YXJlYSBjbGFzcz1cImRjLXRleHRhcmVhXCIgaWQ9XCJkYy1zY2VuYXJpb1wiPiR7ZXNjYXBlSHRtbChzY2VuYXJpbyl9PC90ZXh0YXJlYT48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkYy1maWVsZFwiPjxsYWJlbD7npLrkvovmtojmga88L2xhYmVsPjx0ZXh0YXJlYSBjbGFzcz1cImRjLXRleHRhcmVhXCIgaWQ9XCJkYy1tZXMtZXhhbXBsZVwiIHN0eWxlPVwibWluLWhlaWdodDoxNjBweFwiPiR7ZXNjYXBlSHRtbChtZXNFeGFtcGxlKX08L3RleHRhcmVhPjwvZGl2PlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImRjLWJ0bi1wcmltYXJ5XCIgaWQ9XCJkYy1hZHZhbmNlZC1zYXZlXCI+5L+d5a2Y5pu05pS5PC9idXR0b24+XG4gICAgYCk7XG4gICAgJHdyYXAuZmluZCgnW2RhdGEtYWNjXScpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7IGNvbnN0IGlkID0gJCh0aGlzKS5hdHRyKCdkYXRhLWFjYycpOyAkKGAjZGMtYWNjLSR7aWR9YCkudG9nZ2xlQ2xhc3MoJ29wZW4nKTsgfSk7XG4gICAgJCgnI2RjLWFkdmFuY2VkLXNhdmUnKS5vbignY2xpY2snLCBhc3luYyAoKT0+e1xuICAgICAgY29uc3QgdXBkID0ge1xuICAgICAgICBwZXJzb25hbGl0eTogKCQoJyNkYy1wZXJzb25hbGl0eScpLnZhbCgpIGFzIHN0cmluZyksXG4gICAgICAgIHNjZW5hcmlvOiAoJCgnI2RjLXNjZW5hcmlvJykudmFsKCkgYXMgc3RyaW5nKSxcbiAgICAgICAgbWVzX2V4YW1wbGU6ICgkKCcjZGMtbWVzLWV4YW1wbGUnKS52YWwoKSBhcyBzdHJpbmcpLFxuICAgICAgICBzeXN0ZW1fcHJvbXB0OiAoJCgnI2RjLXN5c3RlbS1wcm9tcHQnKS52YWwoKSBhcyBzdHJpbmcpLFxuICAgICAgICBwb3N0X2hpc3RvcnlfaW5zdHJ1Y3Rpb25zOiAoJCgnI2RjLXBvc3QtaGlzdG9yeScpLnZhbCgpIGFzIHN0cmluZyksXG4gICAgICAgIGNyZWF0b3I6ICgkKCcjZGMtY3JlYXRvcicpLnZhbCgpIGFzIHN0cmluZyksXG4gICAgICAgIGNoYXJhY3Rlcl92ZXJzaW9uOiAoJCgnI2RjLXZlcnNpb24nKS52YWwoKSBhcyBzdHJpbmcpLFxuICAgICAgfTtcbiAgICAgIHRyeXsgYXdhaXQgc2FmZVVwZGF0ZUNoYXJhY3RlcihnZXRDdXJyZW50Q2hhcmFjdGVyTmFtZSgpISwgKGM6YW55KT0+eyBjLmRhdGEucGVyc29uYWxpdHk9dXBkLnBlcnNvbmFsaXR5OyBjLmRhdGEuc2NlbmFyaW89dXBkLnNjZW5hcmlvOyBjLmRhdGEubWVzX2V4YW1wbGU9dXBkLm1lc19leGFtcGxlOyBjLmRhdGEuc3lzdGVtX3Byb21wdD11cGQuc3lzdGVtX3Byb21wdDsgYy5kYXRhLnBvc3RfaGlzdG9yeV9pbnN0cnVjdGlvbnM9dXBkLnBvc3RfaGlzdG9yeV9pbnN0cnVjdGlvbnM7IGMuZGF0YS5jcmVhdG9yPXVwZC5jcmVhdG9yOyBjLmRhdGEuY2hhcmFjdGVyX3ZlcnNpb249dXBkLmNoYXJhY3Rlcl92ZXJzaW9uOyByZXR1cm4gYzsgfSk7IHRvYXN0ci5zdWNjZXNzKCfpq5jnuqflrprkuYnlt7Lkv53lrZgnKTsgfWNhdGNoKGUpeyB0b2FzdHIuZXJyb3IoU3RyaW5nKGUpKTsgfVxuICAgIH0pO1xuICB9IGVsc2UgaWYgKHRhYj09PSdwcm9tcHRzJyl7XG4gICAgJHdyYXAuaHRtbChgPGgyPuaPkOekuuivjeimhuebljwvaDI+PHAgY2xhc3M9XCJkZXNjXCI+5omp5bGV5o+Q56S66K+N55u45YWz6K6+572uPC9wPlxuICAgICAgPGRpdiBjbGFzcz1cImRjLWZpZWxkXCI+PGxhYmVsPlN5c3RlbSBQcm9tcHQ8L2xhYmVsPjx0ZXh0YXJlYSBjbGFzcz1cImRjLXRleHRhcmVhXCIgaWQ9XCJkYy1zeXMyXCI+JHtlc2NhcGVIdG1sKHN5c3RlbVByb21wdCl9PC90ZXh0YXJlYT48L2Rpdj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJkYy1idG4tcHJpbWFyeVwiIGlkPVwiZGMtc2F2ZS1wcm9tcHRcIj7kv53lrZg8L2J1dHRvbj5cbiAgICBgKTtcbiAgICAkKCcjZGMtc2F2ZS1wcm9tcHQnKS5vbignY2xpY2snLCBhc3luYyAoKT0+eyBjb25zdCB2ID0gKCQoJyNkYy1zeXMyJykudmFsKCkgYXMgc3RyaW5nKTsgdHJ5eyBhd2FpdCBzYWZlVXBkYXRlQ2hhcmFjdGVyKGdldEN1cnJlbnRDaGFyYWN0ZXJOYW1lKCkhLCAoYzphbnkpPT57IGMuZGF0YS5zeXN0ZW1fcHJvbXB0PXY7IHJldHVybiBjOyB9KTsgdG9hc3RyLnN1Y2Nlc3MoJ+W3suS/neWtmCcpOyB9Y2F0Y2goZSl7IHRvYXN0ci5lcnJvcihTdHJpbmcoZSkpOyB9IH0pO1xuICB9IGVsc2UgaWYgKHRhYj09PSdtZXRhJyl7XG4gICAgJHdyYXAuaHRtbChgPGgyPuWIm+S9nOiAheeahOWFg+aVsOaNrjwvaDI+PHAgY2xhc3M9XCJkZXNjXCI+5Yib5bu66ICF44CB54mI5pys562JPC9wPlxuICAgICAgPGRpdiBjbGFzcz1cImRjLWZpZWxkXCI+PGxhYmVsPkNyZWF0b3I8L2xhYmVsPjxpbnB1dCBjbGFzcz1cImRjLWlucHV0XCIgaWQ9XCJkYy1jcmVhdG9yMlwiIHZhbHVlPVwiJHtlc2NhcGVIdG1sKGNyZWF0b3IpfVwiLz48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkYy1maWVsZFwiPjxsYWJlbD5WZXJzaW9uPC9sYWJlbD48aW5wdXQgY2xhc3M9XCJkYy1pbnB1dFwiIGlkPVwiZGMtdmVyMlwiIHZhbHVlPVwiJHtlc2NhcGVIdG1sKGNoYXJWZXJzaW9uKX1cIi8+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGMtZmllbGRcIj48bGFiZWw+RXh0ZW5zaW9ucyBSYXcgKEpTT04pPC9sYWJlbD48dGV4dGFyZWEgY2xhc3M9XCJkYy10ZXh0YXJlYVwiIHN0eWxlPVwibWluLWhlaWdodDoxNDBweFwiIGlkPVwiZGMtZXh0XCI+JHtlc2NhcGVIdG1sKEpTT04uc3RyaW5naWZ5KGV4dGVuc2lvbnMsbnVsbCwyKSl9PC90ZXh0YXJlYT48L2Rpdj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJkYy1idG4tcHJpbWFyeVwiIGlkPVwiZGMtbWV0YS1zYXZlXCI+5L+d5a2YPC9idXR0b24+XG4gICAgYCk7XG4gICAgJCgnI2RjLW1ldGEtc2F2ZScpLm9uKCdjbGljaycsIGFzeW5jICgpPT57IHRyeXsgY29uc3QgY3JlYXRvclYgPSAoJCgnI2RjLWNyZWF0b3IyJykudmFsKCkgYXMgc3RyaW5nKTsgY29uc3QgdmVyViA9ICgkKCcjZGMtdmVyMicpLnZhbCgpIGFzIHN0cmluZyk7IGF3YWl0IHNhZmVVcGRhdGVDaGFyYWN0ZXIoZ2V0Q3VycmVudENoYXJhY3Rlck5hbWUoKSEsIChjOmFueSk9PnsgYy5kYXRhLmNyZWF0b3I9Y3JlYXRvclY7IGMuZGF0YS5jaGFyYWN0ZXJfdmVyc2lvbj12ZXJWOyByZXR1cm4gYzsgfSk7IHRvYXN0ci5zdWNjZXNzKCflt7Lkv53lrZgnKTsgfWNhdGNoKGUpeyB0b2FzdHIuZXJyb3IoU3RyaW5nKGUpKTsgfSB9KTtcbiAgfSBlbHNlIGlmICh0YWI9PT0nbWVkaWEnKXtcbiAgICAkd3JhcC5odG1sKGA8aDI+5aSW6YOo5aqS5L2TPC9oMj48cCBjbGFzcz1cImRlc2NcIj7lpJbpg6jlqpLkvZPpk77mjqXvvIjljaDkvY3vvIk8L3A+PGRpdiBzdHlsZT1cImNvbG9yOiM5NDliYTRcIj7lvZPliY3op5LoibLml6DlpJbpg6jlqpLkvZPphY3nva7vvIzlj6/lnKjmianlsZXkuK3mt7vliqDjgII8L2Rpdj5gKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRDdXJyZW50Q2hhclRva2VucygpOiBQcm9taXNlPHN0cmluZz57XG4gIGNvbnN0IG5hbWUgPSBnZXRDdXJyZW50Q2hhcmFjdGVyTmFtZSgpOyBpZiAoIW5hbWUpIHJldHVybiAn4oCUJztcbiAgdHJ5eyBjb25zdCBjaCA9IGF3YWl0IHNhZmVHZXRDaGFyYWN0ZXIobmFtZSk7IGNvbnN0IHR4dCA9IChjaD8uZGF0YT8uZGVzY3JpcHRpb258fCcnKSArIChjaD8uZGF0YT8ucGVyc29uYWxpdHl8fCcnKSArIChjaD8uZGF0YT8uc2NlbmFyaW98fCcnKTsgY29uc3QgdCA9IGF3YWl0IFNpbGx5VGF2ZXJuLmdldFRva2VuQ291bnRBc3luYyh0eHQpOyByZXR1cm4gU3RyaW5nKHQpOyB9Y2F0Y2h7IHJldHVybiAn4oCUJzsgfVxufVxuXG4vLyAtLS0tLS0tLS0tIFdvcmxkYm9vayAtLS0tLS0tLS0tXG5hc3luYyBmdW5jdGlvbiBsb2FkTG9yZVBhbmVsKCl7XG4gIGNvbnN0ICRpbmZvID0gJCgnI2RjLWxvcmUtaW5mbycpOyBjb25zdCAkbGlzdCA9ICQoJyNkYy1sb3JlLWxpc3QnKTsgaWYgKCEkaW5mby5sZW5ndGgpIHJldHVybjtcbiAgY29uc3QgbmFtZSA9IGdldEN1cnJlbnRDaGFyYWN0ZXJOYW1lKCk7IGlmICghbmFtZSl7ICRpbmZvLnRleHQoJ+acqumAieaLqeinkuiJsicpOyByZXR1cm47IH1cbiAgdHJ5e1xuICAgIGNvbnN0IGNoYXJMb3JlID0gdHlwZW9mIHNhZmVHZXRDaGFyV29ybGRib29rTmFtZXMgPT09ICdmdW5jdGlvbicgPyAoc2FmZUdldENoYXJXb3JsZGJvb2tOYW1lcyBhcyBhbnkpKG5hbWUpIGFzIGFueSA6IHsgcHJpbWFyeTpudWxsLCBhZGRpdGlvbmFsOltdIH07XG4gICAgLy8gRmFsbGJhY2sgdmlhIFNpbGx5VGF2ZXJuIGNvbnRleHRcbiAgICBsZXQgcHJpbWFyeSA9IGNoYXJMb3JlPy5wcmltYXJ5IHx8IG51bGw7XG4gICAgbGV0IGFkZGl0aW9uYWw6IHN0cmluZ1tdID0gY2hhckxvcmU/LmFkZGl0aW9uYWwgfHwgW107XG4gICAgLy8gYWxzbyB0cnkgY3R4XG4gICAgdHJ5eyBjb25zdCBjdHg9Z2V0Q3R4KCk7IGNvbnN0IGlkeCA9IGN0eD8uY2hhcmFjdGVycz8uZmluZEluZGV4KChjOmFueSk9PiBjPy5kYXRhPy5uYW1lPT09bmFtZSk7IGlmIChpZHg+PTApeyBjb25zdCBjID0gY3R4LmNoYXJhY3RlcnNbaWR4XTsgcHJpbWFyeSA9IGM/LmRhdGE/LmNoYXJhY3Rlcl9ib29rPy5uYW1lIHx8IHByaW1hcnk7IH0gfWNhdGNoe31cbiAgICBjb25zdCBnbG9iYWxzID0gdHlwZW9mIHNhZmVHZXRHbG9iYWxXb3JsZGJvb2tOYW1lcyA9PT0gJ2Z1bmN0aW9uJyA/IChzYWZlR2V0R2xvYmFsV29ybGRib29rTmFtZXMgYXMgYW55KSgpIDogW107XG4gICAgY29uc3QgYWxsQm9va3MgPSBBcnJheS5mcm9tKG5ldyBTZXQoW3ByaW1hcnksIC4uLmFkZGl0aW9uYWwsIC4uLmdsb2JhbHNdLmZpbHRlcihCb29sZWFuKSBhcyBzdHJpbmdbXSkpO1xuICAgIGlmIChwcmltYXJ5KSAkaW5mby5odG1sKGDkuLvopoHkuJbnlYzkuaY6IDxiIHN0eWxlPVwiY29sb3I6d2hpdGVcIj4ke2VzY2FwZUh0bWwocHJpbWFyeSl9PC9iPiAke2FkZGl0aW9uYWwubGVuZ3RoP2AgfCDpmYTliqA6ICR7YWRkaXRpb25hbC5tYXAoZXNjYXBlSHRtbCkuam9pbignLCAnKX1gOicnfSAke2dsb2JhbHMubGVuZ3RoP2AgfCDlhajlsYA6ICR7Z2xvYmFscy5tYXAoZXNjYXBlSHRtbCkuam9pbignLCAnKX1gOicnfWApO1xuICAgIGVsc2UgaWYgKGFsbEJvb2tzLmxlbmd0aCkgJGluZm8uaHRtbChg5LiW55WM5LmmOiAke2FsbEJvb2tzLm1hcChlc2NhcGVIdG1sKS5qb2luKCcsICcpfWApO1xuICAgIGVsc2UgeyAkaW5mby50ZXh0KCfor6Xop5LoibLmnKrnu5HlrprkuJbnlYzkuabvvIzmmL7npLrlhajlsYDlj6/nlKjkuJbnlYzkuaYnKTsgY29uc3QgbmFtZXMgPSB0eXBlb2YgZ2V0V29ybGRib29rTmFtZXMgPT09ICdmdW5jdGlvbic/IChnZXRXb3JsZGJvb2tOYW1lcyBhcyBhbnkpKCk6W107IGlmIChuYW1lcz8ubGVuZ3RoKSAkaW5mby5hcHBlbmQoYDxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOjZweFwiPiR7bmFtZXMuc2xpY2UoMCw4KS5tYXAoKG46c3RyaW5nKT0+YDxzcGFuIGNsYXNzPVwiZGMtcGlsbFwiPiR7ZXNjYXBlSHRtbChuKX08L3NwYW4+YCkuam9pbignICcpfTwvZGl2PmApOyB9XG4gICAgJGxpc3QuZW1wdHkoKTtcbiAgICBpZiAoIWFsbEJvb2tzLmxlbmd0aCl7ICRsaXN0Lmh0bWwoJzxkaXYgc3R5bGU9XCJjb2xvcjojOTQ5YmE0O3BhZGRpbmc6MTJweFwiPuaaguaXoOS4lueVjOS5puadoeebrjwvZGl2PicpOyByZXR1cm47IH1cbiAgICBmb3IgKGNvbnN0IGJvb2tOYW1lIG9mIGFsbEJvb2tzKXtcbiAgICAgIHRyeXtcbiAgICAgICAgY29uc3QgZW50cmllcyA9IGF3YWl0IHNhZmVHZXRXb3JsZGJvb2soYm9va05hbWUgYXMgc3RyaW5nKSBhcyBhbnlbXTtcbiAgICAgICAgJGxpc3QuYXBwZW5kKGA8ZGl2IHN0eWxlPVwiY29sb3I6I2YyZjNmNTtmb250LXdlaWdodDo3MDA7bWFyZ2luOjEycHggMCA0cHggMDtib3JkZXItdG9wOjFweCBzb2xpZCAjM2Y0MTQ3O3BhZGRpbmctdG9wOjhweFwiPvCfk5ogJHtlc2NhcGVIdG1sKGJvb2tOYW1lKX0gKCR7ZW50cmllcy5sZW5ndGh9IOadoSk8L2Rpdj5gKTtcbiAgICAgICAgaWYgKCFlbnRyaWVzLmxlbmd0aCkgJGxpc3QuYXBwZW5kKCc8ZGl2IHN0eWxlPVwiY29sb3I6Izk0OWJhNDtmb250LXNpemU6MTNweFwiPu+8iOepuu+8iTwvZGl2PicpO1xuICAgICAgICBlbnRyaWVzLmZvckVhY2goKGU6YW55KT0+e1xuICAgICAgICAgIGNvbnN0IGtleXMgPSBbLi4uKGUuc3RyYXRlZ3k/LmtleXN8fFtdKSwgLi4uKGUuc3RyYXRlZ3k/LmtleXNfc2Vjb25kYXJ5Py5rZXlzfHxbXSldLmpvaW4oJywgJyk7XG4gICAgICAgICAgY29uc3QgZW5hYmxlZCA9IGUuZW5hYmxlZCA/ICfwn5+iJyA6ICfimqonO1xuICAgICAgICAgIGNvbnN0IHJvdyA9ICQoYFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cImRjLXdiLWVudHJ5XCI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJkYy13Yi1lbnRyeS1oZWFkXCI+JHtlbmFibGVkfSAke2VzY2FwZUh0bWwoZS5uYW1lfHwn5pyq5ZG95ZCNJyl9IDxzbWFsbD4jJHtlLnVpZH08L3NtYWxsPiA8c3BhbiBzdHlsZT1cIm1hcmdpbi1sZWZ0OmF1dG87Y29sb3I6Izk0OWJhNDtmb250LXNpemU6MTFweFwiPiR7ZXNjYXBlSHRtbChlLnN0cmF0ZWd5Py50eXBlfHwnJyl9PC9zcGFuPjwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGMtd2ItY29udGVudFwiPiR7ZXNjYXBlSHRtbCgoZS5jb250ZW50fHwnJykuc2xpY2UoMCwyNjApKX0keyhlLmNvbnRlbnR8fCcnKS5sZW5ndGg+MjYwPyfigKYnOicnfTwvZGl2PlxuICAgICAgICAgICAgICAke2tleXM/YDxkaXYgY2xhc3M9XCJkYy13Yi1rZXlzXCI+5YWz6ZSu6K+NOiAke2VzY2FwZUh0bWwoa2V5cy5zbGljZSgwLDEyMCkpfTwvZGl2PmA6Jyd9XG4gICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOjZweDtkaXNwbGF5OmZsZXg7Z2FwOjZweFwiPjxidXR0b24gY2xhc3M9XCJkYy1idG4tc2Vjb25kYXJ5XCIgZGF0YS1lZGl0PVwiJHtlLnVpZH1cIiBzdHlsZT1cInBhZGRpbmc6NHB4IDhweDtmb250LXNpemU6MTJweFwiPue8lui+kTwvYnV0dG9uPjxidXR0b24gY2xhc3M9XCJkYy1idG4tc2Vjb25kYXJ5XCIgZGF0YS10b2dnbGU9XCIke2UudWlkfVwiIHN0eWxlPVwicGFkZGluZzo0cHggOHB4O2ZvbnQtc2l6ZToxMnB4XCI+JHtlLmVuYWJsZWQ/J+emgeeUqCc6J+WQr+eUqCd9PC9idXR0b24+PC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICBgKTtcbiAgICAgICAgICByb3cuZmluZChgW2RhdGEtZWRpdF1gKS5vbignY2xpY2snLCBhc3luYyAoKT0+e1xuICAgICAgICAgICAgY29uc3QgbmV3Q29udGVudCA9IHByb21wdChg57yW6L6R5p2h55uuIFwiJHtlLm5hbWV9XCIg55qE5YaF5a65YCwgZS5jb250ZW50KTtcbiAgICAgICAgICAgIGlmIChuZXdDb250ZW50PT09bnVsbCkgcmV0dXJuO1xuICAgICAgICAgICAgdHJ5eyBhd2FpdCBzYWZlVXBkYXRlV29ybGRib29rV2l0aChib29rTmFtZSBhcyBzdHJpbmcsICh3OmFueSk9PiB3Lm1hcCgoeDphbnkpPT4geC51aWQ9PT1lLnVpZD97Li4ueCwgY29udGVudDpuZXdDb250ZW50fTp4KSk7IHRvYXN0ci5zdWNjZXNzKCflt7Lmm7TmlrAnKTsgbG9hZExvcmVQYW5lbCgpOyB9Y2F0Y2goZXJyKXsgdG9hc3RyLmVycm9yKFN0cmluZyhlcnIpKTsgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJvdy5maW5kKGBbZGF0YS10b2dnbGVdYCkub24oJ2NsaWNrJywgYXN5bmMgKCk9PntcbiAgICAgICAgICAgIHRyeXsgYXdhaXQgc2FmZVVwZGF0ZVdvcmxkYm9va1dpdGgoYm9va05hbWUgYXMgc3RyaW5nLCAodzphbnkpPT4gdy5tYXAoKHg6YW55KT0+IHgudWlkPT09ZS51aWQ/ey4uLngsIGVuYWJsZWQ6IXguZW5hYmxlZH06eCkpOyBsb2FkTG9yZVBhbmVsKCk7IH1jYXRjaChlcnIpeyB0b2FzdHIuZXJyb3IoU3RyaW5nKGVycikpOyB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgJGxpc3QuYXBwZW5kKHJvdyk7XG4gICAgICAgIH0pO1xuICAgICAgfWNhdGNoKGVycil7ICRsaXN0LmFwcGVuZChgPGRpdiBzdHlsZT1cImNvbG9yOiNlZDQyNDVcIj7liqDovb0gJHtlc2NhcGVIdG1sKGJvb2tOYW1lKX0g5aSx6LSlOiAke2VzY2FwZUh0bWwoU3RyaW5nKGVycikpfTwvZGl2PmApOyB9XG4gICAgfVxuICAgICQoJyNkYy1sb3JlLW5ldycpLm9mZignY2xpY2snKS5vbignY2xpY2snLCBhc3luYyAoKT0+e1xuICAgICAgaWYgKCFhbGxCb29rc1swXSl7IHRvYXN0ci5lcnJvcign6K+35YWI57uR5a6a5LiW55WM5LmmJyk7IHJldHVybjsgfVxuICAgICAgY29uc3QgdGFyZ2V0ID0gYWxsQm9va3NbMF0gYXMgc3RyaW5nO1xuICAgICAgY29uc3QgbmFtZUluID0gcHJvbXB0KCfmlrDmnaHnm67moIfpopgnKTsgaWYgKG5hbWVJbj09PW51bGwpIHJldHVybjtcbiAgICAgIGNvbnN0IGNvbnRlbnRJbiA9IHByb21wdCgn5p2h55uu5YaF5a65Jyl8fCcnO1xuICAgICAgdHJ5eyBhd2FpdCBzYWZlQ3JlYXRlV29ybGRib29rRW50cmllcyh0YXJnZXQsIFt7IG5hbWU6IG5hbWVJbiwgY29udGVudDogY29udGVudEluLCBlbmFibGVkOnRydWUgfV0pOyB0b2FzdHIuc3VjY2Vzcygn5bey5Yib5bu6Jyk7IGxvYWRMb3JlUGFuZWwoKTsgfWNhdGNoKGVycil7IHRvYXN0ci5lcnJvcihTdHJpbmcoZXJyKSk7IH1cbiAgICB9KTtcbiAgICAkKCcjZGMtbG9yZS1tYW5hZ2UnKS5vZmYoJ2NsaWNrJykub24oJ2NsaWNrJywgKCk9PntcbiAgICAgIC8vIFRyeSB0byBvcGVuIFNUJ3Mgd29ybGQgaW5mbyBkcmF3ZXJcbiAgICAgIChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjV0lCdXR0b24sICNXSURyYXdlckljb24sIFtkYXRhLWRyYXdlcj1cIldJXCJdJykgYXMgSFRNTEVsZW1lbnQpPy5jbGljaygpO1xuICAgICAgLy8gQWxzbyBhdHRlbXB0IHRvIHRyaWdnZXIgdmlhIFNpbGx5VGF2ZXJuIEFQSVxuICAgICAgdHJ5eyAod2luZG93IGFzIGFueSkuU2lsbHlUYXZlcm4/LnJlbG9hZFdvcmxkSW5mb0VkaXRvcj8uKGFsbEJvb2tzWzBdKTsgfWNhdGNoe31cbiAgICB9KTtcbiAgfWNhdGNoKGUpeyAkaW5mby50ZXh0KCfliqDovb3lpLHotKU6ICcrU3RyaW5nKGUpKTsgfVxufVxuXG4vLyAtLS0tLS0tLS0tIFVzZXIgbW9kYWwgLS0tLS0tLS0tLVxubGV0IHVzZXJNb2RhbFRhYiA9ICdwcm9maWxlJztcbmZ1bmN0aW9uIG9wZW5Vc2VyTW9kYWwoKXtcbiAgY29uc3QgJGxlZnQgPSAkKCcjZGMtdXNlci1sZWZ0Jyk7IGNvbnN0ICRyaWdodCA9ICQoJyNkYy11c2VyLXJpZ2h0Jyk7XG4gICRsZWZ0LmVtcHR5KCk7ICRyaWdodC5lbXB0eSgpO1xuICBjb25zdCBhdiA9IGdldFVzZXJBdmF0YXIoKTsgY29uc3QgbmFtZSA9IGdldFVzZXJOYW1lKCk7XG4gICRsZWZ0LmFwcGVuZChgPGltZyBzcmM9XCIke2F2fVwiIC8+PGRpdiBpZD1cImRjLXVzZXItbGVmdC1uYW1lXCI+JHtlc2NhcGVIdG1sKG5hbWUpfTwvZGl2PjxkaXYgaWQ9XCJkYy11c2VyLWxlZnQtc3RhdHVzXCI+5Zyo57q/IOKXjzwvZGl2PjxkaXYgY2xhc3M9XCJkYy1kaXZpZGVyXCI+PC9kaXY+YCk7XG4gIGNvbnN0IHRhYnMgPSBbXG4gICAgeyBrZXk6J3Byb2ZpbGUnLCBsYWJlbDon5Liq5Lq66LWE5paZJywgaWNvbjonZmEtdXNlcicgfSxcbiAgICB7IGtleTonYXBwZWFyYW5jZScsIGxhYmVsOiflpJbop4InLCBpY29uOidmYS1wYWxldHRlJyB9LFxuICAgIHsga2V5OidhcGknLCBsYWJlbDonQVBJIOi/nuaOpScsIGljb246J2ZhLXBsdWcnIH0sXG4gICAgeyBrZXk6J2V4dGVuc2lvbnMnLCBsYWJlbDon5omp5bGVJywgaWNvbjonZmEtcHV6emxlLXBpZWNlJyB9LFxuICAgIHsga2V5OidwZXJzb25hJywgbGFiZWw6J+S6uuiuvueuoeeQhicsIGljb246J2ZhLWlkLWJhZGdlJyB9LFxuICBdO1xuICB0YWJzLmZvckVhY2godD0+e1xuICAgIGNvbnN0IGVsID0gJChgPGRpdiBjbGFzcz1cImRjLXRhYi1idG4gJHt1c2VyTW9kYWxUYWI9PT10LmtleT8nYWN0aXZlJzonJ31cIiBkYXRhLXRhYj1cIiR7dC5rZXl9XCI+PGkgY2xhc3M9XCJmYS1zb2xpZCAke3QuaWNvbn1cIj48L2k+JHt0LmxhYmVsfTwvZGl2PmApO1xuICAgIGVsLm9uKCdjbGljaycsICgpPT57IHVzZXJNb2RhbFRhYj10LmtleTsgb3BlblVzZXJNb2RhbCgpOyB9KTtcbiAgICAkbGVmdC5hcHBlbmQoZWwpO1xuICB9KTtcbiAgJGxlZnQuYXBwZW5kKGA8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDphdXRvO3BhZGRpbmctdG9wOjEycHhcIj48YnV0dG9uIGlkPVwiZGMtdXNlci1jbG9zZTJcIiBjbGFzcz1cImRjLWJ0bi1zZWNvbmRhcnlcIiBzdHlsZT1cIndpZHRoOjEwMCVcIj7lhbPpl608L2J1dHRvbj48L2Rpdj5gKTtcbiAgJCgnI2RjLXVzZXItY2xvc2UyJykub24oJ2NsaWNrJywgY2xvc2VVc2VyTW9kYWwpO1xuICAvLyBSaWdodCBjb250ZW50OiB0cnkgdG8gbW92ZSByZWFsIFNUIHBhbmVscyBpbnN0ZWFkIG9mIGNsb25lIHRvIHByZXNlcnZlIGV2ZW50c1xuICBpZiAodXNlck1vZGFsVGFiPT09J3Byb2ZpbGUnKXtcbiAgICAkcmlnaHQuaHRtbChgPGgyPuS4quS6uui1hOaWmTwvaDI+PHAgY2xhc3M9XCJkZXNjXCI+566h55CG5L2g55qE55So5oi35ZCN5LiO5aS05YOPPC9wPmApO1xuICAgIC8vIFJldXNlIGV4aXN0aW5nIHBlcnNvbmEgbWFuYWdlbWVudCBET00gYnkgY2xvbmluZyB3aXRoIGV2ZW50cyBidXQgYWxzbyBzeW5jIHZhbHVlc1xuICAgIGNvbnN0ICRwZXJzb25hQmxvY2sgPSAkKCcjUGVyc29uYU1hbmFnZW1lbnQsICNwZXJzb25hc19saXN0LCAjdXNlcl9hdmF0YXJfYmxvY2snKS5maXJzdCgpLmNsb3Nlc3QoJy5kcmF3ZXItY29udGVudCwgI1BlcnNvbmFNYW5hZ2VtZW50Jyk7XG4gICAgaWYgKCQoJyNQZXJzb25hTWFuYWdlbWVudCcpLmxlbmd0aCl7XG4gICAgICBjb25zdCAkY2xvbmUgPSAkKCcjUGVyc29uYU1hbmFnZW1lbnQnKS5jbG9uZSh0cnVlLHRydWUpO1xuICAgICAgJGNsb25lLmF0dHIoJ2lkJywnZGMtY2xvbmUtcGVyc29uYScpLmNzcyh7IGRpc3BsYXk6J2Jsb2NrJywgcG9zaXRpb246J3JlbGF0aXZlJywgaW5zZXQ6J2F1dG8nLCBiYWNrZ3JvdW5kOid0cmFuc3BhcmVudCcsIGJvcmRlcjonbm9uZScgfSk7XG4gICAgICAkcmlnaHQuYXBwZW5kKCRjbG9uZSk7XG4gICAgfSBlbHNlIGlmICgkKCcjdXNlcl9hdmF0YXJfYmxvY2snKS5sZW5ndGgpe1xuICAgICAgY29uc3QgJGNsb25lID0gJCgnI3VzZXJfYXZhdGFyX2Jsb2NrJykuY2xvc2VzdCgnZGl2JykuY2xvbmUodHJ1ZSx0cnVlKTtcbiAgICAgICRyaWdodC5hcHBlbmQoJGNsb25lKTtcbiAgICB9XG4gICAgLy8gdXNlcm5hbWUgZmllbGRcbiAgICBjb25zdCAkbmFtZUlucHV0ID0gJCgnI3lvdXJfbmFtZScpO1xuICAgIGlmICgkbmFtZUlucHV0Lmxlbmd0aCl7XG4gICAgICAkcmlnaHQuYXBwZW5kKGA8ZGl2IGNsYXNzPVwiZGMtZmllbGRcIj48bGFiZWw+55So5oi35ZCNPC9sYWJlbD48aW5wdXQgY2xhc3M9XCJkYy1pbnB1dFwiIGlkPVwiZGMtdXNlci1uYW1lLWlucHV0XCIgdmFsdWU9XCIke2VzY2FwZUh0bWwoKCRuYW1lSW5wdXQudmFsKCkgYXMgc3RyaW5nKXx8bmFtZSl9XCIvPjxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOjhweFwiPjxidXR0b24gY2xhc3M9XCJkYy1idG4tcHJpbWFyeVwiIGlkPVwiZGMtc2F2ZS11c2VyLW5hbWVcIj7kv53lrZjnlKjmiLflkI08L2J1dHRvbj48L2Rpdj48L2Rpdj5gKTtcbiAgICAgICQoJyNkYy1zYXZlLXVzZXItbmFtZScpLm9uKCdjbGljaycsICgpPT57XG4gICAgICAgIGNvbnN0IHYgPSAoJCgnI2RjLXVzZXItbmFtZS1pbnB1dCcpLnZhbCgpIGFzIHN0cmluZykudHJpbSgpO1xuICAgICAgICBpZiAoIXYpIHJldHVybjtcbiAgICAgICAgLy8gVHJ5IEFQSVxuICAgICAgICB0cnl7IGlmICh0eXBlb2YgU2lsbHlUYXZlcm4gIT09J3VuZGVmaW5lZCcpeyAoU2lsbHlUYXZlcm4gYXMgYW55KS5uYW1lMSA9IHY7IH0gfWNhdGNoe31cbiAgICAgICAgKCRuYW1lSW5wdXQgYXMgYW55KS52YWwodikudHJpZ2dlcignaW5wdXQnKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgdXBkYXRlVXNlckJhcigpOyB0b2FzdHIuc3VjY2Vzcygn55So5oi35ZCN5bey5pu05pawJyk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgJHJpZ2h0LmFwcGVuZChgPGRpdiBjbGFzcz1cImRjLWZpZWxkXCI+PGxhYmVsPueUqOaIt+WQjTwvbGFiZWw+PGlucHV0IGNsYXNzPVwiZGMtaW5wdXRcIiBpZD1cImRjLXVzZXItbmFtZS1pbnB1dDJcIiB2YWx1ZT1cIiR7ZXNjYXBlSHRtbChuYW1lKX1cIi8+PGJ1dHRvbiBjbGFzcz1cImRjLWJ0bi1wcmltYXJ5XCIgaWQ9XCJkYy1zYXZlLW5hbWUyXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjhweFwiPuS/neWtmDwvYnV0dG9uPjwvZGl2PmApO1xuICAgICAgJCgnI2RjLXNhdmUtbmFtZTInKS5vbignY2xpY2snLCAoKT0+eyBjb25zdCB2PSgkKCcjZGMtdXNlci1uYW1lLWlucHV0MicpLnZhbCgpIGFzIHN0cmluZykudHJpbSgpOyB0cnl7IGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdwbGF5ZXJfbmFtZScsIHYpO31jYXRjaHt9OyAkKCcjZGMtdXNlci1uYW1lJykudGV4dCh2KTsgdG9hc3RyLnN1Y2Nlc3MoJ+W3suS/neWtmCcpOyB9KTtcbiAgICB9XG4gICAgLy8gYXZhdGFyIHByZXZpZXdcbiAgICAkcmlnaHQuYXBwZW5kKGA8ZGl2IGNsYXNzPVwiZGMtZmllbGRcIj48bGFiZWw+5aS05YOP6aKE6KeIPC9sYWJlbD48aW1nIHNyYz1cIiR7YXZ9XCIgc3R5bGU9XCJ3aWR0aDo2NHB4O2hlaWdodDo2NHB4O2JvcmRlci1yYWRpdXM6NTAlXCIvPjxkaXYgc3R5bGU9XCJjb2xvcjojYjViYWMxO2ZvbnQtc2l6ZToxMnB4O21hcmdpbi10b3A6NHB4XCI+5Zyo6YWS6aaG5bem5L6n5Lq66K6+6Z2i5p2/5LiK5Lyg5paw5aS05YOPPC9kaXY+PC9kaXY+YCk7XG4gIH0gZWxzZSBpZiAodXNlck1vZGFsVGFiPT09J3BlcnNvbmEnKXtcbiAgICAkcmlnaHQuaHRtbChgPGgyPuS6uuiuvueuoeeQhjwvaDI+PHAgY2xhc3M9XCJkZXNjXCI+5YiH5o2i5LiO57yW6L6R5Lq66K6+77yIUGVyc29uYe+8iTwvcD5gKTtcbiAgICBpZiAoJCgnI1BlcnNvbmFNYW5hZ2VtZW50JykubGVuZ3RoKXsgY29uc3QgJGM9JCgnI1BlcnNvbmFNYW5hZ2VtZW50JykuY2xvbmUodHJ1ZSx0cnVlKTsgJGMuY3NzKHtkaXNwbGF5OidibG9jayd9KTsgJHJpZ2h0LmFwcGVuZCgkYyk7IH1cbiAgICBlbHNlICRyaWdodC5hcHBlbmQoJzxkaXYgc3R5bGU9XCJjb2xvcjojOTQ5YmE0XCI+5pyq5om+5Yiw5Lq66K6+566h55CG6Z2i5p2/77yM6K+35YWI5Zyo6aG25qCP5omT5byA5LiA5qyh5Lq66K6+5YaN6K+VPC9kaXY+Jyk7XG4gICAgLy8gYWxzbyBsaXN0IHBlcnNvbmEgdmlhIEFQSVxuICAgIHRyeXsgY29uc3QgbmFtZXMgPSB0eXBlb2YgZ2V0UGVyc29uYU5hbWVzPT09J2Z1bmN0aW9uJz8gKGdldFBlcnNvbmFOYW1lcyBhcyBhbnkpKCk6W107IGlmIChuYW1lcz8ubGVuZ3RoKXsgJHJpZ2h0LmFwcGVuZCgnPGRpdiBjbGFzcz1cImRjLWRpdmlkZXJcIj48L2Rpdj48ZGl2IHN0eWxlPVwiY29sb3I6d2hpdGU7Zm9udC13ZWlnaHQ6NjAwO21hcmdpbjo4cHggMFwiPuWPr+eUqOS6uuiuvjwvZGl2PicpOyBjb25zdCBjdXIgPSB0eXBlb2YgZ2V0Q3VycmVudFBlcnNvbmFOYW1lPT09J2Z1bmN0aW9uJz8gKGdldEN1cnJlbnRQZXJzb25hTmFtZSBhcyBhbnkpKCk6bnVsbDsgbmFtZXMuZm9yRWFjaCgobjpzdHJpbmcpPT57IGNvbnN0IGFjdGl2ZSA9IG49PT1jdXI/JyBzdHlsZT1cImJhY2tncm91bmQ6IzQwNDI0OTtjb2xvcjp3aGl0ZVwiJzonJzsgY29uc3Qgcm93PSQoYDxkaXYgY2xhc3M9XCJkYy12dG9vbFwiJHthY3RpdmV9PjxpIGNsYXNzPVwiZmEtc29saWQgZmEtdXNlclwiPjwvaT48c3Bhbj4ke2VzY2FwZUh0bWwobil9PC9zcGFuPjwvZGl2PmApOyByb3cub24oJ2NsaWNrJywgYXN5bmMgKCk9PnsgdHJ5eyBhd2FpdCB0cmlnZ2VyU2xhc2goYC9wZXJzb25hIG5hbWU9XCIke259XCJgKTsgfWNhdGNoe307IHVwZGF0ZVVzZXJCYXIoKTsgfSk7ICRyaWdodC5hcHBlbmQocm93KTsgfSk7IH0gfWNhdGNoe31cbiAgfSBlbHNlIGlmICh1c2VyTW9kYWxUYWI9PT0nYXBpJyl7XG4gICAgJHJpZ2h0Lmh0bWwoYDxoMj5BUEkg6L+e5o6lPC9oMj48cCBjbGFzcz1cImRlc2NcIj7mqKHlnovkuI7lr4bpkqXorr7nva48L3A+YCk7XG4gICAgLy8gVHJ5IHRvIGZpbmQgQVBJIHNldHRpbmdzIGRyYXdlciBjb250ZW50XG4gICAgY29uc3QgJGFwaSA9ICQoJyNBUElTZXR0aW5ncywgI21haW5fYXBpLCAjb2FpX3NldHRpbmdzLCAjdGV4dGdlbmVyYXRpb253ZWJ1aV9zZXR0aW5ncycpLmZpcnN0KCk7XG4gICAgaWYgKCRhcGk/Lmxlbmd0aCl7IGNvbnN0ICRjPSRhcGkuY2xvbmUodHJ1ZSx0cnVlKTsgJGMuY3NzKHtkaXNwbGF5OidibG9jayd9KTsgJHJpZ2h0LmFwcGVuZCgkYyk7IH1cbiAgICBlbHNlIHsgJHJpZ2h0LmFwcGVuZCgnPGRpdiBzdHlsZT1cImNvbG9yOiM5NDliYTRcIj7lnKjpobbmoI/nmoQg4oCcQUkgUmVzcG9uc2UgQ29uZmlndXJhdGlvbuKAnSDmiJYg4oCcQVBJ4oCdIOaMiemSruS4reWPr+aJvuWIsOivpue7huiuvue9ru+8jOatpOWkhOS4uuW/q+aNt+WFpeWPo+OAgjwvZGl2PicpO1xuICAgICAgLy8gUHJvdmlkZSBxdWljayB0cmlnZ2VyIGJ1dHRvbnNcbiAgICAgIGNvbnN0ICRidG5zID0gJCgnPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjhweDttYXJnaW4tdG9wOjEycHhcIj48L2Rpdj4nKTtcbiAgICAgICQoJyN0b3Atc2V0dGluZ3MtaG9sZGVyIC5kcmF3ZXInKS5lYWNoKChfOmFueSwgZWw6YW55KT0+eyBjb25zdCB0aXRsZT0kKGVsKS5maW5kKCcuZHJhd2VyLWljb24nKS5hdHRyKCd0aXRsZScpfHwnJzsgaWYgKC9BUEl86L+e5o6lfOaooeWeiy9pLnRlc3QodGl0bGUpKXsgY29uc3QgYj0kKGA8YnV0dG9uIGNsYXNzPVwiZGMtYnRuLXNlY29uZGFyeVwiPiR7ZXNjYXBlSHRtbCh0aXRsZSl9PC9idXR0b24+YCk7IGIub24oJ2NsaWNrJywgKCk9PnsgJChlbCkuZmluZCgnLmRyYXdlci1pY29uJykudHJpZ2dlcignY2xpY2snKTsgY2xvc2VVc2VyTW9kYWwoKTsgfSk7ICRidG5zLmFwcGVuZChiKTsgfSB9KTtcbiAgICAgICRyaWdodC5hcHBlbmQoJGJ0bnMpO1xuICAgIH1cbiAgfSBlbHNlIGlmICh1c2VyTW9kYWxUYWI9PT0nYXBwZWFyYW5jZScpe1xuICAgICRyaWdodC5odG1sKGA8aDI+5aSW6KeCPC9oMj48cCBjbGFzcz1cImRlc2NcIj7kuLvpopjkuI7og4zmma88L3A+PGRpdiBzdHlsZT1cImNvbG9yOiNiNWJhYzFcIj5EaXNjb3JkIOa3seiJsuS4u+mimOW3suWQr+eUqOOAguiDjOaZr+mAj+aYjuW6puS4juWtl+S9k+WPr+WcqOmFkummhuWOn+eUn+iuvue9ruS4reiwg+aVtOOAgjwvZGl2PmApO1xuICAgIC8vIGJhY2tncm91bmQgc2V0dGluZ3MgaWYgZXhpc3RzXG4gICAgY29uc3QgJGJnID0gJCgnI2JhY2tncm91bmRfc2V0dGluZ3MsICNiZ19tZW51X2NvbnRlbnQnKS5maXJzdCgpO1xuICAgIGlmICgkYmc/Lmxlbmd0aCl7IGNvbnN0ICRjPSRiZy5jbG9uZSh0cnVlLHRydWUpOyAkYy5jc3Moe2Rpc3BsYXk6J2Jsb2NrJ30pOyAkcmlnaHQuYXBwZW5kKCRjKTsgfVxuICB9IGVsc2UgaWYgKHVzZXJNb2RhbFRhYj09PSdleHRlbnNpb25zJyl7XG4gICAgJHJpZ2h0Lmh0bWwoYDxoMj7mianlsZU8L2gyPjxwIGNsYXNzPVwiZGVzY1wiPuW3suWuieijheeahOaJqeWxleS4juiEmuacrDwvcD5gKTtcbiAgICBjb25zdCAkZXh0ID0gJCgnI2V4dGVuc2lvbnNfc2V0dGluZ3MsICNleHRlbnNpb25zX2Jsb2NrJykuZmlyc3QoKTtcbiAgICBpZiAoJGV4dD8ubGVuZ3RoKXsgY29uc3QgJGM9JGV4dC5jbG9uZSh0cnVlLHRydWUpOyAkYy5jc3Moe2Rpc3BsYXk6J2Jsb2NrJ30pOyAkcmlnaHQuYXBwZW5kKCRjKTsgfVxuICAgIGVsc2UgJHJpZ2h0LmFwcGVuZCgnPGRpdiBzdHlsZT1cImNvbG9yOiM5NDliYTRcIj7mnKrmo4DmtYvliLDmianlsZXpnaLmnb88L2Rpdj4nKTtcbiAgfVxuICAkKCcjZGMtdXNlci1tb2RhbCcpLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbn1cbmZ1bmN0aW9uIGNsb3NlVXNlck1vZGFsKCl7ICQoJyNkYy11c2VyLW1vZGFsJykuYWRkQ2xhc3MoJ2hpZGRlbicpOyB9XG5cbi8vIC0tLS0tLS0tLS0gQ29udGV4dCBtZW51IC0tLS0tLS0tLS1cbmZ1bmN0aW9uIHNob3dDb250ZXh0TWVudSh4Om51bWJlcix5Om51bWJlciwgaXRlbXM6e2xhYmVsOnN0cmluZywgYWN0aW9uOigpPT52b2lkLCBkYW5nZXI/OmJvb2xlYW59W10pe1xuICBjb25zdCAkbSA9ICQoJyNkYy1jb250ZXh0LW1lbnUnKTsgJG0uZW1wdHkoKS5yZW1vdmVDbGFzcygnaGlkZGVuJyk7XG4gIGl0ZW1zLmZvckVhY2goaXQ9PntcbiAgICBjb25zdCBiID0gJChgPGJ1dHRvbiBjbGFzcz1cIiR7aXQuZGFuZ2VyPydkYW5nZXInOicnfVwiPiR7ZXNjYXBlSHRtbChpdC5sYWJlbCl9PC9idXR0b24+YCk7XG4gICAgYi5vbignY2xpY2snLCAoKT0+eyBoaWRlQ29udGV4dE1lbnUoKTsgaXQuYWN0aW9uKCk7IH0pO1xuICAgICRtLmFwcGVuZChiKTtcbiAgfSk7XG4gICRtLmNzcyh7IGxlZnQ6IE1hdGgubWluKHgsIHdpbmRvdy5pbm5lcldpZHRoLTIwMCkrJ3B4JywgdG9wOiBNYXRoLm1pbih5LCB3aW5kb3cuaW5uZXJIZWlnaHQtMTUwKSsncHgnIH0pO1xufVxuZnVuY3Rpb24gaGlkZUNvbnRleHRNZW51KCl7ICQoJyNkYy1jb250ZXh0LW1lbnUnKS5hZGRDbGFzcygnaGlkZGVuJykuZW1wdHkoKTsgfVxuXG4vLyAtLS0tLS0tLS0tIFNlbGVjdGlvbiBwYWdlIGNsZWFudXAgLS0tLS0tLS0tLVxuZnVuY3Rpb24gY2xlYW5TZWxlY3Rpb25QYWdlKCl7XG4gIC8vIEhpZGUgZW1vamkgZW50cmllcyBleGNlcHQgY3JlYXRlIHRlbXAgY2hhdFxuICAvLyBMb29rIGZvciBjb250YWluZXJzIHRoYXQgaGF2ZSBjaGFyYWN0ZXIgY3JlYXRlIGJ1dHRvbnNcbiAgY29uc3Qgc2VsZWN0b3JzID0gWycjcm1fcHJpbnRfY2hhcmFjdGVyc19ibG9jaycsICcjY2hhcmFjdGVyX3NlYXJjaF9ibG9jaycsICcjcm1fY2hhcmFjdGVyc19ibG9jaycsICcjY2hhcmFjdGVyLWxpc3QnLCAnLmNoYXJhY3Rlcl9zZWxlY3RfY29udGFpbmVyJ107XG4gIC8vIEdlbmVyaWM6IGZpbmQgYnV0dG9ucy9saW5rcyB3aXRoIGVtb2ppIHJlZ2V4XG4gIGNvbnN0IGVtb2ppUmVnZXggPSAvW1xcdXsxRjMwMH0tXFx1ezFGQUZGfV0vdTtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYnV0dG9uLCBhLCAubWVudV9idXR0b24sIC5jaGFyYWN0ZXJfc2VsZWN0LCAubGlzdC1ncm91cC1pdGVtJykuZm9yRWFjaCgoZWw6YW55KT0+e1xuICAgIGNvbnN0IHR4dCA9IGVsLnRleHRDb250ZW50Py50cmltKCl8fCcnO1xuICAgIGlmICghdHh0KSByZXR1cm47XG4gICAgaWYgKGVtb2ppUmVnZXgudGVzdCh0eHQpICYmICEv5Yib5bu65Li05pe26IGK5aSpfOS4tOaXtuiBiuWkqXxDcmVhdGUuKlRlbXAvaS50ZXN0KHR4dCkpe1xuICAgICAgLy8gQ2hlY2sgaWYgaXQncyBpbnNpZGUgY2hhcmFjdGVyIHNlbGVjdGlvbiBhcmVhXG4gICAgICBjb25zdCBpc0luU2VsZWN0aW9uID0gZWwuY2xvc2VzdCgnI3JtX3ByaW50X2NoYXJhY3RlcnNfYmxvY2ssICNzZWxlY3RfY2hhcmFjdGVyLCAjY2hhcmFjdGVyX3NlYXJjaCwgLmNoYXJhY3Rlci1saXN0Jyk7XG4gICAgICBpZiAoaXNJblNlbGVjdGlvbiB8fCBlbC5jbGFzc0xpc3QuY29udGFpbnMoJ2NoYXJhY3Rlcl9zZWxlY3QnKSB8fCBlbC5jbGFzc0xpc3QuY29udGFpbnMoJ21lbnVfYnV0dG9uJykpe1xuICAgICAgICAvLyBBbHNvIGVuc3VyZSBub3QgdGhlIHRlbXAgY2hhdCBidXR0b24gd2UgY3JlYXRlZFxuICAgICAgICBpZiAoZWwuaWQ9PT0nZGMtY3JlYXRlLXRlbXAnIHx8IGVsLmNsb3Nlc3QoJyNkYy1zaWRlYmFyJykpIHJldHVybjtcbiAgICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnZGMtaGlkZGVuLWVtb2ppJyk7XG4gICAgICAgIChlbCBhcyBIVE1MRWxlbWVudCkuc3R5bGUuZGlzcGxheT0nbm9uZSc7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICgv5Yib5bu65Li05pe26IGK5aSpL2kudGVzdCh0eHQpKXtcbiAgICAgIC8vIHBpbiB0byB0b3AsIHJlbW92ZSBzbWFsbCBhcnJvd1xuICAgICAgY29uc3QgY29udGFpbmVyID0gZWwuY2xvc2VzdCgnI3JtX3ByaW50X2NoYXJhY3RlcnNfYmxvY2ssICNjaGFyYWN0ZXJfc2VhcmNoLCAuY2hhcmFjdGVyLWxpc3QnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gICAgICBpZiAoY29udGFpbmVyICYmIGVsLnBhcmVudEVsZW1lbnQ9PT1jb250YWluZXIpe1xuICAgICAgICBjb250YWluZXIucHJlcGVuZChlbCk7XG4gICAgICAgIGVsLnN0eWxlLm9yZGVyPSctMSc7XG4gICAgICB9XG4gICAgICAvLyByZW1vdmUgYXJyb3cgZWxlbWVudCBpbnNpZGVcbiAgICAgIGNvbnN0IGFycm93ID0gZWwucXVlcnlTZWxlY3RvcignLmZhLWNoZXZyb24tZG93biwgLmZhLWNoZXZyb24tcmlnaHQsIC5hcnJvdywgaS5mYS1zb2xpZC5mYS1jaGV2cm9uLWRvd24nKTtcbiAgICAgIGlmIChhcnJvdykgKGFycm93IGFzIEhUTUxFbGVtZW50KS5zdHlsZS5kaXNwbGF5PSdub25lJztcbiAgICAgIGVsLnN0eWxlLnJlbW92ZVByb3BlcnR5KCdkaXNwbGF5Jyk7IC8vIGVuc3VyZSB2aXNpYmxlXG4gICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKCdkYy1oaWRkZW4tZW1vamknKTtcbiAgICB9XG4gIH0pO1xufVxuXG4vLyAtLS0tLS0tLS0tIFBlcmlvZGljIC8gb2JzZXJ2ZXJzIC0tLS0tLS0tLS1cblxuLy8gLS0tLS0tLS0tLSBDaGF0IG1lc3NhZ2UgZW5oYW5jZW1lbnRzIChEaXNjb3JkIHNwZWMpIC0tLS0tLS0tLS1cbmZ1bmN0aW9uIGdldENoYXJUYWdzKG5hbWUpe1xuICB0cnl7XG4gICAgY29uc3QgY3R4PWdldEN0eCgpO1xuICAgIGNvbnN0IGNoPWN0eD8uY2hhcmFjdGVycz8uZmluZCgoYzphbnkpPT5jPy5kYXRhPy5uYW1lPT09bmFtZSk7XG4gICAgcmV0dXJuIGNoPy5kYXRhPy50YWdzfHxjaD8udGFnc3x8W107XG4gIH1jYXRjaHtyZXR1cm4gW119XG59XG5mdW5jdGlvbiBnZXRQZXJzb25hRGlzcGxheU5hbWUoKXtcbiAgdHJ5e1xuICAgIGlmIChoYXNIZWxwZXIoJ2dldFBlcnNvbmEnKSkge1xuICAgICAgY29uc3QgcD0od2luZG93IGFzIGFueSkuZ2V0UGVyc29uYT8uKCdjdXJyZW50JykgfHwgKHdpbmRvdyBhcyBhbnkpLmdldFBlcnNvbmE/LigpO1xuICAgICAgaWYgKHA/LmRpc3BsYXlfbmFtZSkgcmV0dXJuIFN0cmluZyhwLmRpc3BsYXlfbmFtZSkudHJpbSgpO1xuICAgIH1cbiAgfWNhdGNoe31cbiAgdHJ5e1xuICAgIGNvbnN0IGN0eD1nZXRDdHgoKTtcbiAgICAvLyBUcnkgdG8gZmluZCBwZXJzb25hIG9iamVjdFxuICAgIGNvbnN0IHBlcnNvbmFzPWN0eD8ucGVyc29uYXMgfHwgKHdpbmRvdyBhcyBhbnkpLnBlcnNvbmFzO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHBlcnNvbmFzKSl7XG4gICAgICBjb25zdCBjdXI9Z2V0Q3R4KCkubmFtZTE7XG4gICAgICBjb25zdCBmb3VuZD1wZXJzb25hcy5maW5kKChwOmFueSk9PnAubmFtZT09PWN1cik7XG4gICAgICBpZiAoZm91bmQ/LmRpc3BsYXlfbmFtZSkgcmV0dXJuIFN0cmluZyhmb3VuZC5kaXNwbGF5X25hbWUpLnRyaW0oKTtcbiAgICB9XG4gIH1jYXRjaHt9XG4gIC8vIEZhbGxiYWNrOiB0cnkgdG8gcmVhZCBmcm9tIERPTSBpbnB1dCB0aGF0IGhvbGRzIGRpc3BsYXkgbmFtZVxuICB0cnl7XG4gICAgY29uc3QgZWw9ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3BlcnNvbmFfZGlzcGxheV9uYW1lIGlucHV0LCBbZGF0YS1wZXJzb25hLWRpc3BsYXldJykgYXMgSFRNTElucHV0RWxlbWVudHxudWxsO1xuICAgIGlmIChlbD8udmFsdWUpIHJldHVybiBlbC52YWx1ZS50cmltKCk7XG4gIH1jYXRjaHt9XG4gIHJldHVybiAnJztcbn1cbmZ1bmN0aW9uIGluamVjdENoYXJUYWcoZWw6YW55KXtcbiAgY29uc3QgbmFtZUVsPWVsLnF1ZXJ5U2VsZWN0b3IoJy5uYW1lX3RleHQsIC5jaF9uYW1lLCAubWVzX25hbWUsIFtkYXRhLW5hbWVdJyk7XG4gIGlmICghbmFtZUVsKSByZXR1cm47XG4gIGlmIChlbC5xdWVyeVNlbGVjdG9yKCcuZGlzY29yZC1uYW1lLXRhZycpKSByZXR1cm47XG4gIGNvbnN0IHJhd05hbWU9KG5hbWVFbC50ZXh0Q29udGVudHx8JycpLnRyaW0oKTtcbiAgaWYgKCFyYXdOYW1lKSByZXR1cm47XG4gIC8vIEF2b2lkIGluamVjdGluZyBvbiB1c2VyIG1lc3NhZ2VzXG4gIGNvbnN0IGlzVXNlcj1lbC5jbGFzc0xpc3QuY29udGFpbnMoJ2lzX3VzZXInKSB8fCBlbC5jbGFzc0xpc3QuY29udGFpbnMoJ3VzZXInKTtcbiAgaWYgKGlzVXNlcikgcmV0dXJuO1xuICBjb25zdCB0YWdzPWdldENoYXJUYWdzKHJhd05hbWUpO1xuICBjb25zdCBmaXJzdD0odGFncyYmdGFnc1swXSk/IFN0cmluZyh0YWdzWzBdKS50cmltKCk6ICcnO1xuICBpZiAoIWZpcnN0KSByZXR1cm47XG4gIGNvbnN0IHRhZz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIHRhZy5jbGFzc05hbWU9J2Rpc2NvcmQtbmFtZS10YWcgY2hhci10YWcnO1xuICB0YWcudGV4dENvbnRlbnQ9J/Cfj7fvuI8gJytmaXJzdC5zbGljZSgwLDE1KTtcbiAgKHRhZyBhcyBhbnkpLnRpdGxlPSfop5LoibLmoIfnrb7vvJonK2ZpcnN0O1xuICBuYW1lRWwuYWZ0ZXIodGFnKTtcbn1cbmZ1bmN0aW9uIGluamVjdFVzZXJUYWcoZWw6YW55KXtcbiAgaWYgKGVsLnF1ZXJ5U2VsZWN0b3IoJy5kaXNjb3JkLW5hbWUtdGFnJykpIHJldHVybjtcbiAgY29uc3QgaXNVc2VyPWVsLmNsYXNzTGlzdC5jb250YWlucygnaXNfdXNlcicpIHx8IGVsLmNsYXNzTGlzdC5jb250YWlucygndXNlcicpIHx8IGVsLnF1ZXJ5U2VsZWN0b3IoJy5pc191c2VyJyk7XG4gIC8vIE9ubHkgZm9yIHVzZXIgbWVzc2FnZXM6IGNoZWNrIGlmIG1lc3NhZ2UgaXMgZnJvbSB1c2VyIChoYXMgdXNlciBhdmF0YXIgb3IgY2xhc3MpXG4gIC8vIEZhbGxiYWNrOiBjaGVjayBpZiBuYW1lIG1hdGNoZXMgY3VycmVudCB1c2VyIG5hbWVcbiAgY29uc3QgbmFtZUVsPWVsLnF1ZXJ5U2VsZWN0b3IoJy5uYW1lX3RleHQsIC5jaF9uYW1lLCAubWVzX25hbWUnKTtcbiAgaWYgKCFuYW1lRWwpIHJldHVybjtcbiAgLy8gRW5zdXJlIGl0J3MgYWN0dWFsbHkgYSB1c2VyIG1lc3NhZ2U6IGNvbXBhcmUgbmFtZSB0byBnZXRVc2VyTmFtZSBvciBjaGVjayBjbGFzc1xuICBjb25zdCB1c2VyTmFtZT1nZXRVc2VyTmFtZSgpO1xuICBjb25zdCBtc2dOYW1lPShuYW1lRWwudGV4dENvbnRlbnR8fCcnKS50cmltKCk7XG4gIGNvbnN0IGxvb2tzVXNlciA9IGVsLmNsYXNzTGlzdC5jb250YWlucygnaXNfdXNlcicpIHx8IG1zZ05hbWU9PT11c2VyTmFtZTtcbiAgaWYgKCFsb29rc1VzZXIpIHJldHVybjtcbiAgY29uc3QgZGlzcGxheT1nZXRQZXJzb25hRGlzcGxheU5hbWUoKTtcbiAgaWYgKCFkaXNwbGF5KSByZXR1cm47XG4gIGNvbnN0IHRhZz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIHRhZy5jbGFzc05hbWU9J2Rpc2NvcmQtbmFtZS10YWcgdXNlci10YWcnO1xuICB0YWcudGV4dENvbnRlbnQ9ZGlzcGxheS5zbGljZSgwLDE1KTtcbiAgKHRhZyBhcyBhbnkpLnRpdGxlPSfmmL7npLrlkI3np7DvvJonK2Rpc3BsYXk7XG4gIG5hbWVFbC5hZnRlcih0YWcpO1xufVxuZnVuY3Rpb24gaW5qZWN0QWxsTWVzc2FnZVRhZ3MoKXtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnI2NoYXQgLm1lcywgI2RjLWNoYXQtY29udGFpbmVyICNjaGF0IC5tZXMnKS5mb3JFYWNoKChtZXM6YW55KT0+e1xuICAgIGlmIChtZXMucXVlcnlTZWxlY3RvcignLmRpc2NvcmQtbmFtZS10YWcnKSkgcmV0dXJuO1xuICAgIGlmIChtZXMuY2xhc3NMaXN0LmNvbnRhaW5zKCdpc191c2VyJykpIGluamVjdFVzZXJUYWcobWVzKTtcbiAgICBlbHNlIGluamVjdENoYXJUYWcobWVzKTtcbiAgfSk7XG59XG5mdW5jdGlvbiBzZXR1cE1lc3NhZ2VUYWdPYnNlcnZlcigpe1xuICBjb25zdCBjaGF0RWw9ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2NoYXQnKTtcbiAgaWYgKCFjaGF0RWwpIHJldHVybjtcbiAgaW5qZWN0QWxsTWVzc2FnZVRhZ3MoKTtcbiAgY29uc3Qgb2JzPW5ldyBNdXRhdGlvbk9ic2VydmVyKF8uZGVib3VuY2UoKCk9PmluamVjdEFsbE1lc3NhZ2VUYWdzKCksIDIwMCkpO1xuICBvYnMub2JzZXJ2ZShjaGF0RWwsIHsgY2hpbGRMaXN0OnRydWUsIHN1YnRyZWU6dHJ1ZSB9KTtcbiAgLy8gQWxzbyBvbiBjaGF0IGNoYW5nZWRcbiAgdHJ5e1xuICAgIGNvbnN0IGV2PSh3aW5kb3cgYXMgYW55KS50YXZlcm5fZXZlbnRzIHx8ICh3aW5kb3cgYXMgYW55KS5ldmVudFNvdXJjZTtcbiAgICBpZiAoZXYgJiYgZXYub24pIHtcbiAgICAgIC8vIFRyeSB0byBsaXN0ZW4gdG8gY2hhdCBjaGFuZ2VkXG4gICAgICB0cnl7IGV2Lm9uKCdjaGF0X2lkX2NoYW5nZWQnLCAoKT0+eyBzZXRUaW1lb3V0KCgpPT57IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5kaXNjb3JkLW5hbWUtdGFnJykuZm9yRWFjaChlPT5lLnJlbW92ZSgpKTsgaW5qZWN0QWxsTWVzc2FnZVRhZ3MoKTsgfSwgNDAwKTsgfSk7IH1jYXRjaHt9XG4gICAgfVxuICB9Y2F0Y2h7fVxufVxuZnVuY3Rpb24gZW5zdXJlTWVzc2FnZUhvdmVyVG9vbGJhcigpe1xuICAvLyBEZWxlZ2F0ZSBjcmVhdGlvbiBvZiBkaXNjb3JkIGhvdmVyIHRvb2xiYXIgZm9yIGVhY2ggbWVzc2FnZVxuICBjb25zdCBjaGF0RWw9ZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2NoYXQnKTtcbiAgaWYgKCFjaGF0RWwpIHJldHVybjtcbiAgY29uc3QgY3JlYXRlVG9vbGJhcj0obWVzOmFueSk9PntcbiAgICBpZiAobWVzLnF1ZXJ5U2VsZWN0b3IoJy5tZXNfYnV0dG9uc19kaXNjb3JkJykpIHJldHVybjtcbiAgICBjb25zdCBiYXI9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgYmFyLmNsYXNzTmFtZT0nbWVzX2J1dHRvbnNfZGlzY29yZCc7XG4gICAgY29uc3QgYnV0dG9ucz1bXG4gICAgICB7aWNvbjon8J+YiicsIHRpdGxlOifmt7vliqDlj43lupQnLCBjbHM6JycsIGFjdGlvbjooKT0+IG9wZW5FbW9qaVBpY2tlcihtZXMpfSxcbiAgICAgIHtpY29uOifinI/vuI8nLCB0aXRsZTon57yW6L6RJywgY2xzOicnLCBhY3Rpb246KCk9PiB7IGNvbnN0IGJ0bj1tZXMucXVlcnlTZWxlY3RvcignLm1lc19lZGl0LCAubWVzX2VkaXRfYnV0dG9uLCBbZGF0YS1hY3Rpb249XCJlZGl0XCJdJykgYXMgSFRNTEVsZW1lbnR8bnVsbDsgaWYoYnRuKSBidG4uY2xpY2soKTsgZWxzZSB0b2FzdHIuaW5mbygn57yW6L6R5Yqf6IO9Jyk7IH19LFxuICAgICAge2ljb246J+KGqe+4jycsIHRpdGxlOifph43mlrDnlJ/miJAnLCBjbHM6JycsIGFjdGlvbjooKT0+IHsgY29uc3QgYnRuPW1lcy5xdWVyeVNlbGVjdG9yKCcubWVzX3JlZ2VuZXJhdGUsIFtkYXRhLWFjdGlvbj1cInJlZ2VuZXJhdGVcIl0nKSBhcyBIVE1MRWxlbWVudHxudWxsOyBpZihidG4pIGJ0bi5jbGljaygpOyBlbHNlIHsgY29uc3Qgc3dpcGU9bWVzLnF1ZXJ5U2VsZWN0b3IoJy5zd2lwZV9yaWdodCwgLm1lc19zd2lwZScpIGFzIEhUTUxFbGVtZW50fG51bGw7IGlmKHN3aXBlKSBzd2lwZS5jbGljaygpOyB9IH19LFxuICAgICAge2ljb246J/Cfk4snLCB0aXRsZTon5aSN5Yi2JywgY2xzOicnLCBhY3Rpb246KCk9PnsgY29uc3QgdHh0PW1lcy5xdWVyeVNlbGVjdG9yKCcubWVzX3RleHQnKT8uaW5uZXJUZXh0fHwnJzsgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodHh0KS50aGVuKCgpPT50b2FzdHIuc3VjY2Vzcygn5bey5aSN5Yi2JykpLmNhdGNoKCgpPT57fSk7IH19LFxuICAgICAge2ljb246J+KLrycsIHRpdGxlOifmm7TlpJonLCBjbHM6JycsIGFjdGlvbjooKT0+eyBjb25zdCBtb3JlPW1lcy5xdWVyeVNlbGVjdG9yKCcubWVzX2J1dHRvbnMsIC5leHRyYU1lc0J1dHRvbnMnKSBhcyBIVE1MRWxlbWVudHxudWxsOyBpZihtb3JlKSBtb3JlLnN0eWxlLmRpc3BsYXk9J2ZsZXgnOyB9fSxcbiAgICAgIHtpY29uOifinJUnLCB0aXRsZTon5Yig6ZmkJywgY2xzOididG4tZGVsZXRlJywgYWN0aW9uOigpPT57IGlmKGNvbmZpcm0oJ+WIoOmZpOivpea2iOaBr++8nycpKXsgY29uc3QgZGVsPW1lcy5xdWVyeVNlbGVjdG9yKCcubWVzX2RlbGV0ZSwgLm1lc19kZWwsIFtkYXRhLWFjdGlvbj1cImRlbGV0ZVwiXScpIGFzIEhUTUxFbGVtZW50fG51bGw7IGlmKGRlbCkgKGRlbCBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTsgZWxzZSBtZXMucmVtb3ZlKCk7IH0gfX0sXG4gICAgXTtcbiAgICBidXR0b25zLmZvckVhY2goYj0+e1xuICAgICAgY29uc3QgYnRuPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgYnRuLmNsYXNzTmFtZT0nbWVzX2J0bl9kaXNjb3JkICcrYi5jbHM7XG4gICAgICBidG4udGl0bGU9Yi50aXRsZTtcbiAgICAgIGJ0bi50ZXh0Q29udGVudD1iLmljb247XG4gICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSk9PnsgZS5zdG9wUHJvcGFnYXRpb24oKTsgYi5hY3Rpb24oKTsgfSk7XG4gICAgICBiYXIuYXBwZW5kQ2hpbGQoYnRuKTtcbiAgICB9KTtcbiAgICBtZXMuc3R5bGUucG9zaXRpb249J3JlbGF0aXZlJztcbiAgICBtZXMuYXBwZW5kQ2hpbGQoYmFyKTtcbiAgfTtcbiAgLy8gQXBwbHkgdG8gZXhpc3RpbmdcbiAgY2hhdEVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5tZXMnKS5mb3JFYWNoKChtOmFueSk9PmNyZWF0ZVRvb2xiYXIobSkpO1xuICBjb25zdCBvYnM9bmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dCk9PntcbiAgICBtdXQuZm9yRWFjaChtPT57XG4gICAgICBtLmFkZGVkTm9kZXMuZm9yRWFjaCgobjphbnkpPT57XG4gICAgICAgIGlmIChuLm5vZGVUeXBlPT09MSAmJiBuLmNsYXNzTGlzdCAmJiBuLmNsYXNzTGlzdC5jb250YWlucygnbWVzJykpIGNyZWF0ZVRvb2xiYXIobik7XG4gICAgICAgIGVsc2UgaWYgKG4ubm9kZVR5cGU9PT0xKSBuLnF1ZXJ5U2VsZWN0b3JBbGw/LignLm1lcycpLmZvckVhY2goKHg6YW55KT0+Y3JlYXRlVG9vbGJhcih4KSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG4gIG9icy5vYnNlcnZlKGNoYXRFbCwgeyBjaGlsZExpc3Q6dHJ1ZSwgc3VidHJlZTp0cnVlIH0pO1xuICAvLyBBbHNvIGVuc3VyZSBhdmF0YXIgbGVmdCB2aWEgaW5saW5lIG92ZXJyaWRlIGZvciBhbnkgbmV3IG1lc3NhZ2VzIHRoYXQgbWlnaHQgc2V0IGZsZXgtZGlyZWN0aW9uIG9wcG9zaXRlXG4gIGNvbnN0IHN0eWxlRml4PSgpPT57XG4gICAgY2hhdEVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5tZXMnKS5mb3JFYWNoKChtOmFueSk9PntcbiAgICAgIChtIGFzIEhUTUxFbGVtZW50KS5zdHlsZS5mbGV4RGlyZWN0aW9uPSdyb3cnO1xuICAgICAgKG0gYXMgSFRNTEVsZW1lbnQpLnN0eWxlLmp1c3RpZnlDb250ZW50PSdmbGV4LXN0YXJ0JztcbiAgICB9KTtcbiAgfTtcbiAgc2V0SW50ZXJ2YWwoc3R5bGVGaXgsIDE1MDApO1xufVxuZnVuY3Rpb24gb3BlbkVtb2ppUGlja2VyKG1lczphbnkpe1xuICAvLyBDbG9zZSBleGlzdGluZyBwaWNrZXJcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmVtb2ppLXBpY2tlci1kaXNjb3JkJykuZm9yRWFjaChlPT5lLnJlbW92ZSgpKTtcbiAgY29uc3QgcGlja2VyPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBwaWNrZXIuY2xhc3NOYW1lPSdlbW9qaS1waWNrZXItZGlzY29yZCc7XG4gIHBpY2tlci5pbm5lckhUTUw9YFxuICAgIDxkaXYgY2xhc3M9XCJlbW9qaS1waWNrZXItc2VhcmNoXCI+PGlucHV0IHBsYWNlaG9sZGVyPVwi5om+5Yiw5pyA5a6M576O55qE5Y+N5bqUXCIgLz48L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwiZW1vamktZ3JpZFwiPjwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJlbW9qaS1waWNrZXItZm9vdGVyXCI+54K55Ye75re75Yqg5Y+N5bqUIMK3IOWGjeasoeeCueWHu+WPlua2iDwvZGl2PlxuICBgO1xuICBjb25zdCBncmlkPXBpY2tlci5xdWVyeVNlbGVjdG9yKCcuZW1vamktZ3JpZCcpIGFzIEhUTUxFbGVtZW50O1xuICBjb25zdCBjb21tb249Wyfwn5GNJywn8J+SrycsJ/CfkpYnLCfinIUnLCfwn5iKJywn8J+UpScsJ/CfmKQnLCfwn4y4Jywn8J+kjScsJ/CfkpwnLCfwn5iIJywn8J+Viu+4jycsJ+KtkCcsJ+KYge+4jycsJ/CfjY4nLCfwn5CbJywn8J+TlicsJ/CfmIInLCfwn5iiJywn8J+YoScsJ/CfkY8nLCfwn5mPJywn8J+OiScsJ+KdpO+4jycsJ/CfmI0nLCfwn6SUJywn8J+RjCcsJ/CfkqonLCfwn6uhJ107XG4gIGNvbW1vbi5mb3JFYWNoKGVtPT57XG4gICAgY29uc3QgaXRlbT1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBpdGVtLmNsYXNzTmFtZT0nZW1vamktaXRlbSc7XG4gICAgaXRlbS50ZXh0Q29udGVudD1lbTtcbiAgICBpdGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCk9PnsgdG9nZ2xlUmVhY3Rpb24obWVzLCBlbSk7IHBpY2tlci5yZW1vdmUoKTsgfSk7XG4gICAgZ3JpZC5hcHBlbmRDaGlsZChpdGVtKTtcbiAgfSk7XG4gIC8vIFBvc2l0aW9uIG5lYXIgdGhlIG1lc3NhZ2UncyBob3ZlciB0b29sYmFyXG4gIGNvbnN0IHJlY3Q9bWVzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICBwaWNrZXIuc3R5bGUucG9zaXRpb249J2Fic29sdXRlJztcbiAgcGlja2VyLnN0eWxlLnRvcD0obWVzLm9mZnNldFRvcCttZXMub2Zmc2V0SGVpZ2h0KSsncHgnO1xuICBwaWNrZXIuc3R5bGUubGVmdD0nMjRweCc7XG4gIHBpY2tlci5zdHlsZS56SW5kZXg9JzIwMCc7XG4gIG1lcy5hcHBlbmRDaGlsZChwaWNrZXIpO1xuICAvLyBTZWFyY2ggZmlsdGVyXG4gIGNvbnN0IGlucHV0PXBpY2tlci5xdWVyeVNlbGVjdG9yKCdpbnB1dCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gIGlucHV0Py5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpPT57XG4gICAgY29uc3QgcT1pbnB1dC52YWx1ZS50cmltKCk7XG4gICAgZ3JpZC5xdWVyeVNlbGVjdG9yQWxsKCcuZW1vamktaXRlbScpLmZvckVhY2goKGl0OmFueSk9PntcbiAgICAgIGNvbnN0IHNob3c9IXEgfHwgaXQudGV4dENvbnRlbnQuaW5jbHVkZXMocSk7XG4gICAgICAoaXQgYXMgSFRNTEVsZW1lbnQpLnN0eWxlLmRpc3BsYXk9c2hvdz8nZmxleCc6J25vbmUnO1xuICAgIH0pO1xuICB9KTtcbiAgLy8gQ2xvc2Ugb24gb3V0c2lkZVxuICBzZXRUaW1lb3V0KCgpPT57XG4gICAgY29uc3QgY2xvc2U9KGU6YW55KT0+eyBpZighcGlja2VyLmNvbnRhaW5zKGUudGFyZ2V0IGFzIE5vZGUpICYmICFlLnRhcmdldC5jbG9zZXN0KCcubWVzX2J0bl9kaXNjb3JkJykpeyBwaWNrZXIucmVtb3ZlKCk7IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgY2xvc2UpOyB9IH07XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBjbG9zZSk7XG4gIH0sIDUwKTtcbn1cbmZ1bmN0aW9uIGdldE1lc3NhZ2VJZChtZXM6YW55KTogc3RyaW5ne1xuICAvLyBVc2UgZGF0YSBhdHRyaWJ1dGUgb3IgaW5kZXhcbiAgcmV0dXJuIG1lcy5nZXRBdHRyaWJ1dGUoJ2RhdGEtbWVzaWQnKSB8fCBtZXMuZ2V0QXR0cmlidXRlKCdtZXNpZCcpIHx8IEFycmF5LmZyb20obWVzLnBhcmVudEVsZW1lbnQ/LmNoaWxkcmVufHxbXSkuaW5kZXhPZihtZXMpLnRvU3RyaW5nKCk7XG59XG5mdW5jdGlvbiB0b2dnbGVSZWFjdGlvbihtZXM6YW55LCBlbW9qaTpzdHJpbmcpe1xuICBjb25zdCBpZD1nZXRNZXNzYWdlSWQobWVzKTtcbiAgLy8gVXNlIGNoYXQgbWV0YWRhdGEgb3IgbG9jYWxTdG9yYWdlIGZvciBwZXJzaXN0ZW5jZSBwZXIgY2hhdFxuICBjb25zdCBjaGF0SWQ9Z2V0Q3R4KCkuY2hhdElkIHx8ICdnbG9iYWwnO1xuICBjb25zdCBrZXk9J2RjX3JlYWN0aW9uc18nK2NoYXRJZDtcbiAgbGV0IHN0b3JlOmFueT17fTtcbiAgdHJ5eyBzdG9yZT1KU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSl8fCd7fScpOyB9Y2F0Y2h7fVxuICBpZiAoIXN0b3JlW2lkXSkgc3RvcmVbaWRdPXt9O1xuICBjb25zdCByZWFjdGlvbnM9c3RvcmVbaWRdO1xuICBpZiAoIXJlYWN0aW9uc1tlbW9qaV0pIHJlYWN0aW9uc1tlbW9qaV09e2NvdW50OjEsIHNlbGY6dHJ1ZX07XG4gIGVsc2Uge1xuICAgIGlmIChyZWFjdGlvbnNbZW1vamldLnNlbGYpeyByZWFjdGlvbnNbZW1vamldLnNlbGY9ZmFsc2U7IHJlYWN0aW9uc1tlbW9qaV0uY291bnQ9TWF0aC5tYXgoMCwgcmVhY3Rpb25zW2Vtb2ppXS5jb3VudC0xKTsgaWYocmVhY3Rpb25zW2Vtb2ppXS5jb3VudD09PTApIGRlbGV0ZSByZWFjdGlvbnNbZW1vamldOyB9XG4gICAgZWxzZSB7IHJlYWN0aW9uc1tlbW9qaV0uc2VsZj10cnVlOyByZWFjdGlvbnNbZW1vamldLmNvdW50Kz0xOyB9XG4gIH1cbiAgdHJ5eyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShrZXksIEpTT04uc3RyaW5naWZ5KHN0b3JlKSk7IH1jYXRjaHt9XG4gIHJlbmRlclJlYWN0aW9ucyhtZXMsIHJlYWN0aW9ucyk7XG4gIC8vIEFsc28gdHJ5IHRvIHBlcnNpc3QgdmlhIGNoYXQgbWV0YWRhdGEgaWYgYXZhaWxhYmxlXG4gIHRyeXtcbiAgICBjb25zdCBjdHg9Z2V0Q3R4KCk7XG4gICAgaWYgKGN0eD8uY2hhdE1ldGFkYXRhKXsgY3R4LmNoYXRNZXRhZGF0YVsnZGNfcmVhY3Rpb25zJ109c3RvcmU7IGN0eC5zYXZlTWV0YWRhdGFEZWJvdW5jZWQ/LigpOyB9XG4gIH1jYXRjaHt9XG59XG5mdW5jdGlvbiByZW5kZXJSZWFjdGlvbnMobWVzOmFueSwgcmVhY3Rpb25zPzphbnkpe1xuICBsZXQgcj1yZWFjdGlvbnM7XG4gIGlmICghcil7XG4gICAgY29uc3QgaWQ9Z2V0TWVzc2FnZUlkKG1lcyk7XG4gICAgY29uc3QgY2hhdElkPWdldEN0eCgpLmNoYXRJZCB8fCAnZ2xvYmFsJztcbiAgICBjb25zdCBrZXk9J2RjX3JlYWN0aW9uc18nK2NoYXRJZDtcbiAgICB0cnl7IGNvbnN0IHN0b3JlPUpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KXx8J3t9Jyk7IHI9c3RvcmVbaWRdfHx7fTsgfWNhdGNoeyByPXt9OyB9XG4gIH1cbiAgbGV0IGNvbnRhaW5lcj1tZXMucXVlcnlTZWxlY3RvcignLm1lcy1yZWFjdGlvbnMnKTtcbiAgaWYgKCFjb250YWluZXIpe1xuICAgIGNvbnRhaW5lcj1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb250YWluZXIuY2xhc3NOYW1lPSdtZXMtcmVhY3Rpb25zJztcbiAgICBjb25zdCB0ZXh0RWw9bWVzLnF1ZXJ5U2VsZWN0b3IoJy5tZXNfdGV4dCcpO1xuICAgIGlmICh0ZXh0RWwpIHRleHRFbC5hZnRlcihjb250YWluZXIpO1xuICAgIGVsc2UgbWVzLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG4gIH1cbiAgY29udGFpbmVyLmlubmVySFRNTD0nJztcbiAgT2JqZWN0LmVudHJpZXMocikuZm9yRWFjaCgoW2Vtb2ppLCBkYXRhXTphbnkpPT57XG4gICAgY29uc3QgcGlsbD1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBwaWxsLmNsYXNzTmFtZT0ncmVhY3Rpb24tcGlsbCAnKyhkYXRhLnNlbGY/J3NlbGYtcmVhY3RlZCc6JycpO1xuICAgIHBpbGwuaW5uZXJIVE1MPWA8c3Bhbj4ke2Vtb2ppfTwvc3Bhbj48c3Bhbj4ke2RhdGEuY291bnR9PC9zcGFuPmA7XG4gICAgcGlsbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpPT50b2dnbGVSZWFjdGlvbihtZXMsIGVtb2ppKSk7XG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKHBpbGwpO1xuICB9KTtcbn1cbmZ1bmN0aW9uIHJlc3RvcmVBbGxSZWFjdGlvbnMoKXtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnI2NoYXQgLm1lcycpLmZvckVhY2goKG06YW55KT0+e1xuICAgIHRyeXsgcmVuZGVyUmVhY3Rpb25zKG0pOyB9Y2F0Y2h7fVxuICB9KTtcbn1cblxuZnVuY3Rpb24gcGVyaW9kaWNSZWZyZXNoKCl7XG4gIGxldCBsYXN0Q2hhciA9ICcnOyBsZXQgbGFzdENoYXQgPSAnJztcbiAgc2V0SW50ZXJ2YWwoKCk9PntcbiAgICBjb25zdCBjdXIgPSBnZXRDdXJyZW50Q2hhcmFjdGVyTmFtZSgpfHwnJztcbiAgICBjb25zdCBjaGF0SWQgPSBnZXRDdHgoKT8uY2hhdElkIHx8IGdldEN0eCgpPy5jaGF0TWV0YWRhdGE/LmNoYXRJZCB8fCAnJztcbiAgICBpZiAoY3VyIT09bGFzdENoYXIpeyBsYXN0Q2hhcj1jdXI7IHVwZGF0ZUhlYWRlcigpOyByZW5kZXJHdWlsZEJhcigpOyByZW5kZXJDaGFubmVscygpOyBidWlsZERyb3Bkb3duKCk7IH1cbiAgICBpZiAoY2hhdElkIT09bGFzdENoYXQpeyBsYXN0Q2hhdD1jaGF0SWQ7IHJlbmRlckNoYW5uZWxzKCk7IHVwZGF0ZUhlYWRlcigpOyB9XG4gICAgdXBkYXRlVXNlckJhcigpO1xuICAgIGNsZWFuU2VsZWN0aW9uUGFnZSgpO1xuICB9LCAxNTAwKTtcbn1cbmZ1bmN0aW9uIHNldHVwRHJvcGRvd24oKXtcbiAgJCgnI2RjLXNpZGViYXItaGVhZGVyJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIChlOmFueSk9PntcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGNvbnN0ICRkZCA9ICQoJyNkYy1jaGFyLWRyb3Bkb3duJyk7XG4gICAgY29uc3QgaGlkZGVuID0gJGRkLmhhc0NsYXNzKCdoaWRkZW4nKTtcbiAgICBpZiAoaGlkZGVuKXsgJGRkLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTsgJCgnI2RjLXNpZGViYXItaGVhZGVyJykuYWRkQ2xhc3MoJ29wZW4nKTsgfVxuICAgIGVsc2UgeyAkZGQuYWRkQ2xhc3MoJ2hpZGRlbicpOyAkKCcjZGMtc2lkZWJhci1oZWFkZXInKS5yZW1vdmVDbGFzcygnb3BlbicpOyB9XG4gIH0pO1xufVxuZnVuY3Rpb24gc2V0dXBVc2VyR2Vhcigpe1xuICAkKCcjZGMtdXNlci1nZWFyJykub2ZmKCdjbGljaycpLm9uKCdjbGljaycsIChlOmFueSk9PnsgZS5zdG9wUHJvcGFnYXRpb24oKTsgb3BlblVzZXJNb2RhbCgpOyB9KTtcbn1cbmZ1bmN0aW9uIGhhbmRsZVJlc2l6ZSgpeyBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoJy0tc2hlbGRXaWR0aCcsJzEwMCUnKTsgfVxuXG4vLyAtLS0tLS0tLS0tIEluaXQgLS0tLS0tLS0tLVxuZnVuY3Rpb24gZXJyb3JDYXRjaGVkKGZuOkZ1bmN0aW9uKXsgcmV0dXJuICguLi5hOmFueVtdKT0+eyB0cnl7IHJldHVybiAoZm4gYXMgYW55KSguLi5hKTt9Y2F0Y2goZSl7IGNvbnNvbGUuZXJyb3IoJ1tkYy10aGVtZV0gZXJyb3InLCBlKTsgfX07IH1cblxuJChlcnJvckNhdGNoZWQoYXN5bmMgKCk9PntcbiAgbG9nKCdpbml0IGRpc2NvcmQgdGhlbWUgdjInKTtcbiAgaW5qZWN0U3R5bGUoKTtcbiAgZW5zdXJlUm9vdCgpO1xuICB1cGRhdGVIZWFkZXIoKTtcbiAgcmVuZGVyR3VpbGRCYXIoKTtcbiAgYXdhaXQgcmVuZGVyQ2hhbm5lbHMoKTtcbiAgYnVpbGREcm9wZG93bigpO1xuICBzZXR1cERyb3Bkb3duKCk7XG4gIHNldHVwVXNlckdlYXIoKTtcbiAgdHJ5eyBzZXR1cE1lc3NhZ2VUYWdPYnNlcnZlcigpOyB9Y2F0Y2goZSl7IHdhcm4oZSk7IH1cbiAgdHJ5eyBlbnN1cmVNZXNzYWdlSG92ZXJUb29sYmFyKCk7IH1jYXRjaChlKXsgd2FybihlKTsgfVxuICB0cnl7IHJlc3RvcmVBbGxSZWFjdGlvbnMoKTsgfWNhdGNoKGUpeyB3YXJuKGUpOyB9XG4gIHBlcmlvZGljUmVmcmVzaCgpO1xuICBoYW5kbGVSZXNpemUoKTtcbiAgJCh3aW5kb3cpLm9uKCdyZXNpemUnLCBoYW5kbGVSZXNpemUpO1xuICBjbGVhblNlbGVjdGlvblBhZ2UoKTtcbiAgLy8gb2JzZXJ2ZXJzXG4gIGNvbnN0IG9iczEgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihfLmRlYm91bmNlKCgpPT57IHJlbmRlckd1aWxkQmFyKCk7IHVwZGF0ZUhlYWRlcigpOyBjbGVhblNlbGVjdGlvblBhZ2UoKTsgfSwgMzAwKSk7XG4gIGNvbnN0IGJsb2NrID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JtX3ByaW50X2NoYXJhY3RlcnNfYmxvY2snKTtcbiAgaWYgKGJsb2NrKSBvYnMxLm9ic2VydmUoYmxvY2ssIHsgY2hpbGRMaXN0OnRydWUsIHN1YnRyZWU6dHJ1ZSB9KTtcbiAgY29uc3Qgb2JzMiA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKF8uZGVib3VuY2UoKCk9PiB1cGRhdGVVc2VyQmFyKCksIDMwMCkpO1xuICBjb25zdCBhdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd1c2VyX2F2YXRhcl9ibG9jaycpO1xuICBpZiAoYXYpIG9iczIub2JzZXJ2ZShhdiwgeyBjaGlsZExpc3Q6dHJ1ZSwgc3VidHJlZTp0cnVlLCBhdHRyaWJ1dGVzOnRydWUgfSk7XG4gIGNvbnN0IG9iczMgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihfLmRlYm91bmNlKCgpPT4gY2xlYW5TZWxlY3Rpb25QYWdlKCksIDQwMCkpO1xuICBvYnMzLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBjaGlsZExpc3Q6dHJ1ZSwgc3VidHJlZTp0cnVlIH0pO1xuICB0b2FzdHI/LnN1Y2Nlc3M/LignRGlzY29yZCDnvo7ljJYgdjIg5bey5Yqg6L29IMK3IOS4ieagjyArIOivpuaDhemhteW3suWwsee7qicpO1xuICAod2luZG93IGFzIGFueSkuZGNUaGVtZSA9IHsgcmVuZGVyR3VpbGRCYXIsIHJlbmRlckNoYW5uZWxzLCB1cGRhdGVIZWFkZXIsIG9wZW5DaGFyTW9kYWwsIG9wZW5Vc2VyTW9kYWwgfTtcbn0pKTtcbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==
//# sourceURL=webpack-internal:///./src/discord-theme/index.ts/ /   B u i l d   t r i g g e r e d   a t   2 0 2 6 - 0 9 - 1 3   0 0 : 5 6 : 2 1  
 