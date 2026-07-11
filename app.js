// ==========================
// app.js - STAYO Final
// ==========================

// ========== SUPABASE CONFIG ==========
const SUPABASE_URL = 'https://ukbekfcjfcjcqrpxfpmq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrYmVrZmNqZmNqY3FycHhmcG1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDk2NzcsImV4cCI6MjA4OTkyNTY3N30.KK3nxQOLTi3IZjYoRtrNC6mS_ixSsrZMI3J4WfxJVYU';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

var currentUser = null;

// Vérifier la session au chargement
(async function initAuth() {
    var { data: { session } } = await sb.auth.getSession();
    if (session) {
        currentUser = session.user;
        await loadUserProfile();
        updateUIForLoggedUser();
    }
})();

// ========== SCROLL ==========
var lastScrollY = 0;
var topBar = document.getElementById('topBar');
var hotelSidebar = document.getElementById('hotelSidebar');
var aiHub = document.getElementById('aiHub');

window.addEventListener('scroll', function() {
    var sy = window.scrollY || window.pageYOffset;
    if (sy > 50 && sy > lastScrollY) topBar.classList.add('scrolled');
    else if (sy < 30) topBar.classList.remove('scrolled');
    lastScrollY = sy;
}, { passive: true });

document.getElementById('map').addEventListener('touchmove', function() {
    var sy = window.scrollY || window.pageYOffset;
    if (sy > 50) topBar.classList.add('scrolled'); else topBar.classList.remove('scrolled');
}, { passive: true });

// Sidebar → cache AI Hub sur mobile
var observer = new MutationObserver(function(muts) {
    muts.forEach(function(m) {
        if (m.attributeName === 'class') {
            if (hotelSidebar.classList.contains('open') && window.innerWidth <= 600) {
                if (aiHub) aiHub.style.display = 'none';
            } else {
                // Remettre le AI Hub quand la sidebar se ferme
                if (aiHub) {
                    aiHub.style.display = '';
                    aiHub.classList.remove('collapsed');
                    aiHubState = 'normal';
                }
            }
        }
    });
});
observer.observe(hotelSidebar, { attributes: true });

// ========== AI HUB TOGGLE ==========
var aiHubState = 'normal';
var aiToggleBtn = document.createElement('button');
aiToggleBtn.className = 'ai-toggle-btn';
aiToggleBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
if (aiHub) aiHub.appendChild(aiToggleBtn);

aiToggleBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (aiHubState === 'collapsed') { aiHub.classList.remove('collapsed'); aiHubState = 'normal'; }
    else { aiHub.classList.add('collapsed'); aiHubState = 'collapsed'; }
});

var aiHubHandle = document.getElementById('aiHubHandle');
if (aiHubHandle) {
    aiHubHandle.addEventListener('click', function() { aiHub.classList.add('collapsed'); aiHubState = 'collapsed'; });
}

var touchStartY = 0;
if (aiHub) {
    aiHub.addEventListener('touchstart', function(e) { touchStartY = e.touches[0].clientY; }, { passive: true });
    aiHub.addEventListener('touchend', function(e) {
        var d = e.changedTouches[0].clientY - touchStartY;
        if (d > 40 && aiHubState !== 'collapsed') { aiHub.classList.add('collapsed'); aiHubState = 'collapsed'; }
        if (d < -40 && aiHubState === 'collapsed') { aiHub.classList.remove('collapsed'); aiHubState = 'normal'; }
    });
}

// ========== VOICE ==========
var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
var recognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR'; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = function(e) {
        var t = e.results[0][0].transcript;
        var inp = document.getElementById('aiUserInput');
        if (inp) inp.value = t;
        document.getElementById('voiceBtn')?.classList.remove('listening');
        document.getElementById('voiceBtnChat')?.classList.remove('listening');
        if (typeof callEngine === 'function') callEngine(t);
    };
    recognition.onerror = function() {
        document.getElementById('voiceBtn')?.classList.remove('listening');
        document.getElementById('voiceBtnChat')?.classList.remove('listening');
    };
    recognition.onend = function() {
        document.getElementById('voiceBtn')?.classList.remove('listening');
        document.getElementById('voiceBtnChat')?.classList.remove('listening');
    };
}

function startVoiceSearch() {
    if (!recognition) { alert('Reconnaissance vocale non supportee.'); return; }
    document.getElementById('voiceBtn')?.classList.add('listening');
    document.getElementById('voiceBtnChat')?.classList.add('listening');
    recognition.start();
}

// ========== AUTH ==========
function openAuth() {
    document.getElementById('authOverlay').classList.add('open');
    if (currentUser) { showProfile(); } else { showLogin(); }
}

function closeAuth() { document.getElementById('authOverlay').classList.remove('open'); }

function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('profileForm').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('profileForm').style.display = 'none';
}

function updateUIForLoggedUser() {
    var btn = document.getElementById('userBtn');
    if (currentUser && currentUser.email) {
        if (btn) btn.style.background = 'var(--primary-light)';
    } else {
        if (btn) btn.style.background = '';
    }
}

// ========== GOOGLE / APPLE LOGIN ==========
async function loginWithGoogle() {
    var { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { 
            redirectTo: window.location.origin + '/'  // Redirige vers la page actuelle
        }
    });
    if (error) showToast(error.message, true);
}

async function loginWithApple() {
    var { error } = await sb.auth.signInWithOAuth({
        provider: 'apple',
        options: { 
            redirectTo: window.location.origin + '/'
        }
    });
    if (error) showToast(error.message, true);
}

// ========== EMAIL LOGIN ==========
async function login() {
    var email = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value.trim();
    if (!email || !password) { showToast('Fill all fields.', true); return; }
    var { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { showToast(error.message, true); return; }
    currentUser = data.user;
    await loadUserProfile();
    updateUIForLoggedUser();
    showProfile();
    showToast('Welcome back!');
}

// ========== REGISTER ==========
async function register() {
    var name = document.getElementById('registerName').value.trim();
    var username = document.getElementById('registerUsername').value.trim();
    var email = document.getElementById('registerEmail').value.trim();
    var password = document.getElementById('registerPassword').value.trim();
    if (!name || !email || !password) { showToast('Fill all fields.', true); return; }
    var { data, error } = await sb.auth.signUp({ email, password, options: { data: { name, username } } });
    if (error) { showToast(error.message, true); return; }
    currentUser = data.user;
    var avatarFile = document.getElementById('avatarInput').files[0];
    if (avatarFile) await uploadAvatar(avatarFile);
    var styles = [];
    document.querySelectorAll('.style-chip.selected').forEach(function(c) { styles.push(c.textContent); });
    await saveUserProfile({ name, username, styles });
    updateUIForLoggedUser();
    showProfile();
    showToast('Account created!');
}

// ========== LOGOUT ==========
async function logout() {
    await sb.auth.signOut();
    currentUser = null;
    updateUIForLoggedUser();
    closeAuth();
    showToast('Signed out.');
}

// ========== GUEST ==========
async function continueAsGuest() {
    var { data, error } = await sb.auth.signInAnonymously();
    if (error) { showToast(error.message, true); return; }
    currentUser = data.user;
    updateUIForLoggedUser();
    closeAuth();
    showToast('Guest mode.');
}

// ========== AVATAR ==========
async function uploadAvatar(file) {
    var fileName = currentUser.id + '/avatar.' + file.name.split('.').pop();
    var { error } = await sb.storage.from('avatars').upload(fileName, file, { upsert: true });
    if (!error) {
        var { data: urlData } = sb.storage.from('avatars').getPublicUrl(fileName);
        localStorage.setItem('stayo_avatar', urlData.publicUrl);
        await saveUserProfile({ avatar_url: urlData.publicUrl });
    }
}

function previewAvatar(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('avatarPreview').innerHTML = '<img src="' + e.target.result + '" alt="avatar" />';
    };
    reader.readAsDataURL(file);
}

// ========== PROFILE DB ==========
async function saveUserProfile(profile) {
    await sb.from('profiles').upsert({ id: currentUser.id, ...profile, updated_at: new Date() });
}

async function loadUserProfile() {
    var { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) localStorage.setItem('stayo_profile', JSON.stringify(data));
}

// ========== FAVORITES (Supabase) ==========
async function addToFavoritesSB(hotel) {
    var { error } = await sb.from('favorites').upsert({
        user_id: currentUser.id, hotel_id: hotel.id, hotel_name: hotel.name,
        hotel_city: hotel.city, hotel_price: hotel.price,
        hotel_thumbnail: hotel.thumbnail, hotel_rating: hotel.rating
    });
    if (!error) showToast('Added to favorites!');
}

async function removeFromFavoritesSB(hotelId) {
    await sb.from('favorites').delete().eq('user_id', currentUser.id).eq('hotel_id', hotelId);
    showToast('Removed');
}

async function getFavoritesFromDB() {
    var { data } = await sb.from('favorites').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    return data || [];
}

async function renderFavorites() {
    var container = document.getElementById('tabFavorites');
    if (!container) return;
    var favs = currentUser ? await getFavoritesFromDB() : [];
    if (favs.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--text-lighter);padding:20px;">No favorites yet.</p>';
        return;
    }
    container.innerHTML = favs.map(function(h) {
        return '<div class="fav-card" onclick="focusHotel(\'' + h.hotel_id + '\', 48.85, 2.35)">' +
            '<img src="' + (h.hotel_thumbnail || 'https://ukbekfcjfcjcqrpxfpmq.supabase.co/storage/v1/object/public/logo%20luvia/STAYO%20ICON%20PIN.png') + '" alt="' + h.hotel_name + '" />' +
            '<div class="info"><h4>' + h.hotel_name + '</h4><p>' + (h.hotel_city || '') + ' · ' + (h.hotel_price ? h.hotel_price + '€' : '') + '</p></div>' +
            '<div class="fav-actions">' +
                '<button class="fav-btn" onclick="event.stopPropagation();shareFavorite(\'' + h.hotel_id + '\')">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
                '</button>' +
                '<button class="fav-btn heart" onclick="event.stopPropagation();removeFromFavoritesSB(\'' + h.hotel_id + '\');renderFavorites();">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
                '</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

// ========== SHARING ==========
function shareFavorite(hotelId) {
    var shareData = { title: 'STAYO', text: 'Check out this hotel on STAYO!', url: window.location.href + '?hotel=' + hotelId };
    if (navigator.share) { navigator.share(shareData); }
    else { navigator.clipboard.writeText(shareData.url); showToast('Link copied!'); }
}

function shareProfile() {
    var profile = JSON.parse(localStorage.getItem('stayo_profile') || '{}');
    var shareData = { title: profile.name + ' on STAYO', text: 'Check out my travel profile!', url: window.location.href };
    if (navigator.share) { navigator.share(shareData); }
    else { navigator.clipboard.writeText(shareData.url); showToast('Profile link copied!'); }
}

// ========== UI HELPERS ==========
function showProfile() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('profileForm').style.display = 'block';
    var profile = JSON.parse(localStorage.getItem('stayo_profile') || '{}');
    var avatarUrl = profile.avatar_url || localStorage.getItem('stayo_avatar') || '';
    document.getElementById('profilePic').innerHTML = avatarUrl ? '<img src="' + avatarUrl + '" alt="avatar" />' : (profile.name || 'U').charAt(0).toUpperCase();
    document.getElementById('profileName').textContent = profile.name || 'Traveler';
    document.getElementById('profileUsername').textContent = '@' + (profile.username || 'user');
    renderFavorites();
}

function toggleStyle(el) { el.classList.toggle('selected'); }

function switchTab(tab) {
    document.querySelectorAll('.profile-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.profile-tab-content').forEach(function(c) { c.style.display = 'none'; });
    if (tab === 'favorites') {
        document.querySelector('.profile-tab:nth-child(1)').classList.add('active');
        document.getElementById('tabFavorites').style.display = 'block';
        renderFavorites();
    } else if (tab === 'history') {
        document.querySelector('.profile-tab:nth-child(2)').classList.add('active');
        document.getElementById('tabHistory').style.display = 'block';
        var searches = JSON.parse(localStorage.getItem('stayo_searches') || '[]');
        document.getElementById('tabHistory').innerHTML = searches.slice(0, 10).map(function(s) {
            return '<div class="fav-card"><div class="info"><h4>' + s.query + '</h4><p>' + s.date + '</p></div></div>';
        }).join('') || '<p style="text-align:center;color:var(--text-lighter);">No searches yet.</p>';
    } else if (tab === 'shared') {
        document.querySelector('.profile-tab:nth-child(3)').classList.add('active');
        document.getElementById('tabShared').style.display = 'block';
        document.getElementById('tabShared').innerHTML = '<p style="text-align:center;color:var(--text-lighter);padding:20px;">Coming soon.</p>';
    }
}

// Ouvrir l'auth au clic sur le bouton profil
document.getElementById('userBtn')?.addEventListener('click', openAuth);