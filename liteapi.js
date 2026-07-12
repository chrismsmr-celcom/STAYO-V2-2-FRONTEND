// ==========================
// liteapi.js - STAYO Leaflet Final - VERSION SIMPLIFIÉE
// ==========================

const STAYO_ENGINE_URL = 'https://stayo-engine2.onrender.com';

var allMarkers = [];
var allHotelsData = [];
var markersLayer = L.layerGroup().addTo(map);

var currentSearchParams = {
    checkin: getDefaultDate(0),
    checkout: getDefaultDate(1),
    adults: 2,
    currency: 'EUR'
};
var ratesCache = new Map();
// ========== HELPERS ==========
function getDefaultDate(d) {
    var dt = new Date();
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().split('T')[0];
}

function openUberToHotel(lat, lng, name) {
    window.open('https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=' + lat + '&dropoff[longitude]=' + lng + '&dropoff[nickname]=' + encodeURIComponent(name), '_blank');
}

function openGetYourGuide(lat, lng, city) {
    window.open('https://www.getyourguide.fr/s/?q=' + encodeURIComponent(city || 'activites') + '&partner_id=TNCQUZX&cmp=share_to_earn&lat=' + lat + '&lng=' + lng, '_blank');
}

// ========== SIDEBAR ==========
var sidebar = document.getElementById('hotelSidebar');
var sidebarOverlay = document.getElementById('sidebarOverlay');
var sidebarContent = document.getElementById('sidebarContent');

function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    var hub = document.getElementById('aiHub');
    if (hub && window.innerWidth <= 600) hub.style.display = 'none';
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
    document.body.style.overflow = '';
    sidebarContent.innerHTML = '<div class="sidebar-loading"><div class="spinner"></div><p>Selectionnez un logement</p></div>';
    var hub = document.getElementById('aiHub');
    if (hub) {
        hub.style.display = '';
        hub.classList.remove('collapsed');
    }
    if (typeof aiHubState !== 'undefined') aiHubState = 'normal';
}

sidebarOverlay.addEventListener('click', closeSidebar);
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeSidebar(); });

// ========== DEEP LINK ==========
function buildHotelDeepLink(id, ci, co, ad, cu, lang) {
    var occ = btoa(JSON.stringify([{ adults: ad, children: [] }]));
    var p = new URLSearchParams();
    p.set('checkin', ci);
    p.set('checkout', co);
    p.set('occupancies', occ);
    if (cu) p.set('currency', cu);
    if (lang) p.set('language', lang);
    return 'https://luviaplace.com/hotels/' + id + '?' + p.toString();
}

function formatCancellation(policies) {
    if (!policies || !policies.cancelPolicyInfos || !policies.cancelPolicyInfos.length)
        return '<p>Aucune information disponible.</p>';
    var html = (policies.refundableTag === 'RFN' ?
        '<p class="refundable-badge">Annulation gratuite possible</p>' :
        '<p class="non-refundable-badge">Non remboursable</p>');
    policies.cancelPolicyInfos.forEach(function(p, i) {
        var d = new Date(p.cancelTime).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        html += '<div class="policy-item"><p><strong>Politique ' + (i + 1) + '</strong></p>' +
            '<p>Avant le : ' + d + ' (' + p.timezone + ')</p>' +
            '<p>Frais : ' + (p.amount ? p.amount + ' ' + p.currency : 'Non specifie') + '</p></div>';
    });
    return html;
}

// ============================================================
// ✅ SIDEBAR - Tout vient du backend
// ============================================================
function openHotelSidebar(hotel) {
    if (!hotel) {
        console.error('openHotelSidebar: hotel est undefined');
        return;
    }

    var id = hotel.id;
    var ci = currentSearchParams.checkin;
    var co = currentSearchParams.checkout;
    var ad = currentSearchParams.adults;
    var cu = currentSearchParams.currency;
    var lang = 'fr';
    
    openSidebar();
    sidebarContent.innerHTML = '<div class="sidebar-loading"><div class="spinner"></div><p>Chargement...</p></div>';

    // ✅ Toutes les données sont déjà dans hotel (venant du backend)
    var sym = { 'EUR': '\u20AC', 'GBP': '\u00A3', 'USD': '$' };
    var symbol = sym[cu] || cu;
    
    var mainImage = hotel.thumbnail || null;
    var facilities = hotel.facilities_list || [];
    var facilitiesList = facilities.slice(0, 12).map(function(f) { return '<li>' + f + '</li>'; }).join('');
    var hasMore = facilities.length > 12;
    var checkinTime = hotel.checkin_time || 'Non specifie';
    var checkoutTime = hotel.checkout_time || 'Non specifie';
    var checkinStart = '';
    var stars = hotel.stars || 0;
    var rating = hotel.rating || null;
    var reviewCount = hotel.reviewCount || 0;
    var cancellationHtml = formatCancellation(hotel.cancellation_policies);
    var galleryHtml = (hotel.images || []).slice(0, 8).map(function(img) {
        return '<img src="' + img.url + '" alt="' + (img.caption || 'Hotel') + '" loading="lazy" onerror="this.style.display=\'none\'" />';
    }).join('');
    var description = hotel.full_description || '';
    var importantInfo = hotel.important_info || '';
    var addressText = [hotel.address, hotel.city, hotel.country].filter(Boolean).join(', ') || 'Adresse non disponible';

    var nights = Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
    var totalPrice = hotel.price || null;
    var pricePerNight = totalPrice ? Math.round(totalPrice / nights) : null;

    var priceDisplay = 'Prix non disponible';
    if (hotel.price) {
        priceDisplay = hotel.price + ' ' + cu;
    }
    var totalDisplay = totalPrice ? symbol + totalPrice.toLocaleString() : null;

    var hotelDeepLink = buildHotelDeepLink(id, ci, co, ad, cu, lang);
    var bookingDeepLink = hotel.offerId ? 'https://luviaplace.com/booking?offerId=' + hotel.offerId + '&currency=' + cu + '&language=' + lang : null;
    var ciFormatted = new Date(ci).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    var coFormatted = new Date(co).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    var starsText = stars > 0 ? '\u2605'.repeat(Math.min(Math.round(stars), 5)) + '\u2606'.repeat(Math.max(0, 5 - Math.round(stars))) : '';
    var mapsLink = (hotel.lat && hotel.lng) ?
        '<a href="https://maps.google.com/?q=' + hotel.lat + ',' + hotel.lng + '" target="_blank" rel="noopener" class="maps-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Google Maps</a>' :
        '';

    sidebarContent.innerHTML =
        '<button class="sidebar-close-btn" onclick="closeSidebar()">&times;</button>' +
        '<div class="sidebar-hero">' +
        (mainImage ?
            '<img src="' + mainImage + '" alt="' + (hotel.name || '') + '" onerror="this.parentElement.innerHTML=\'<div class=sidebar-hero-placeholder><img src=https://ukbekfcjfcjcqrpxfpmq.supabase.co/storage/v1/object/public/logo%20luvia/STAYO%20ICON%20PIN.png alt=STAYO style=width:50px;height:50px;opacity:0.4; /></div>\'" />' :
            '<div class="sidebar-hero-placeholder"><img src="https://ukbekfcjfcjcqrpxfpmq.supabase.co/storage/v1/object/public/logo%20luvia/STAYO%20ICON%20PIN.png" alt="STAYO" style="width:50px;opacity:0.4;" /></div>') +
        '<div class="sidebar-hero-price">' + priceDisplay + '</div>' +
        (totalDisplay ? '<div class="sidebar-hero-subprice">Total: ' + totalDisplay + '</div>' : '') +
        '</div>' +
        '<div class="sidebar-body">' +
        '<h2>' + (hotel.name || 'Hotel') + '</h2>' +
        '<div class="sidebar-address-row"><span class="sidebar-address">' + addressText + '</span>' + mapsLink + '</div>' +
        '<div class="sidebar-badges">' +
        (stars > 0 ? '<span class="sidebar-stars">' + starsText + '</span>' : '') +
        (rating ? '<span class="sidebar-rating">' + rating + ' / 5</span>' : '') +
        (reviewCount > 0 ? '<span class="sidebar-reviews">(' + reviewCount + ' avis)</span>' : '') +
        '</div>' +
        '<a href="' + hotelDeepLink + '" target="_blank" rel="noopener" class="sidebar-book-btn">Reserver maintenant</a>' +
        '<a href="#" onclick="openUberToHotel(' + hotel.lat + ',' + hotel.lng + ',\'' + (hotel.name || 'Hotel') + '\');return false;" class="sidebar-book-btn secondary" style="display:flex;align-items:center;gap:8px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>Commander un Uber</a>' +
        '<a href="#" onclick="openGetYourGuide(' + hotel.lat + ',' + hotel.lng + ',\'' + (hotel.city || hotel.name || '') + '\');return false;" class="sidebar-book-btn secondary" style="display:flex;align-items:center;gap:8px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Activites a proximite</a>' +
        (bookingDeepLink ? '<a href="' + bookingDeepLink + '" target="_blank" rel="noopener" class="sidebar-book-btn secondary">Paiement direct</a>' : '') +
        '<div class="sidebar-section"><h3>Votre sejour</h3><div class="stay-summary"><div class="stay-dates"><span>' + ciFormatted + '</span><span class="stay-arrow">&rarr;</span><span>' + coFormatted + '</span></div><div class="stay-details"><span>' + nights + ' nuit' + (nights > 1 ? 's' : '') + '</span><span>&middot;</span><span>' + ad + ' adulte' + (ad > 1 ? 's' : '') + '</span></div></div></div>' +
        '<div class="sidebar-section"><h3>Detail du prix</h3><div class="price-breakdown">' +
        '<div class="price-row"><span>Prix total</span><span class="price-value">' + priceDisplay + '</span></div>' +
        (pricePerNight ? '<div class="price-row"><span>Par nuit (' + nights + ' nuits)</span><span class="price-value-secondary">' + pricePerNight + ' ' + cu + '</span></div>' : '') +
        (hotel.boardType ? '<div class="price-row"><span>Pension</span><span class="board-badge">' + hotel.boardType + '</span></div>' : '') +
        '</div></div>' +
        (description ? '<div class="sidebar-section"><h3>Description</h3><div class="sidebar-description">' + description.substring(0, 500) + '...</div></div>' : '') +
        (facilitiesList ? '<div class="sidebar-section"><h3>Equipements</h3><ul class="sidebar-facilities">' + facilitiesList + (hasMore ? '<li class="more-facilities">...et ' + (facilities.length - 12) + ' autres</li>' : '') + '</ul></div>' : '') +
        '<div class="sidebar-section"><h3>Horaires</h3><div class="check-times"><div class="check-item"><span class="check-label">Check-in</span><span class="check-value">' + checkinTime + '</span>' + (checkinStart ? '<span class="check-sub">(des ' + checkinStart + ')</span>' : '') + '</div><div class="check-item"><span class="check-label">Check-out</span><span class="check-value">' + checkoutTime + '</span></div></div></div>' +
        '<div class="sidebar-section"><h3>Conditions d\'annulation</h3><div class="sidebar-cancellation">' + cancellationHtml + '</div></div>' +
        (importantInfo ? '<div class="sidebar-section"><h3>Informations importantes</h3><div class="sidebar-important">' + importantInfo + '</div></div>' : '') +
        (galleryHtml ? '<div class="sidebar-section"><h3>Galerie</h3><div class="sidebar-gallery">' + galleryHtml + '</div></div>' : '') +
        '<a href="' + hotelDeepLink + '" target="_blank" rel="noopener" class="sidebar-book-btn" style="margin-top:20px;">Reserver sur STAYO</a>' +
        '</div>';
}

// ========== API ==========
function clearAllMarkers() {
    markersLayer.clearLayers();
    allHotelsData = [];
}

function addHotelMarkers(hotels) {
    clearAllMarkers();
    hotels.forEach(function(h) {
        var nights = Math.max(1, Math.round((new Date(currentSearchParams.checkout) - new Date(currentSearchParams.checkin)) / 86400000));
        var pricePerNight = h.price ? Math.round(h.price / nights) : null;

        var icon = pricePerNight ? createPriceIcon(pricePerNight, h.currency) : createNoPriceIcon();
        var marker = L.marker([h.lat, h.lng], { icon: icon, interactive: true, riseOnHover: true });

        var priceDisplay = pricePerNight ? pricePerNight + ' ' + (h.currency || '€') + '/nuit' : 'Prix non dispo';
        var tooltipContent = '<div class="pin-tooltip">' +
            '<img src="' + (h.thumbnail || 'https://ukbekfcjfcjcqrpxfpmq.supabase.co/storage/v1/object/public/logo%20luvia/STAYO%20ICON%20PIN.png') + '" alt="' + h.name + '" onerror="this.style.display=\'none\'" />' +
            '<div class="pin-tooltip-info">' +
            '<strong>' + h.name + '</strong>' +
            '<div class="pin-tooltip-meta">' +
            (h.stars ? '★'.repeat(Math.min(h.stars, 5)) : '') +
            (h.rating ? ' <span>' + h.rating + '/10</span>' : '') +
            '</div>' +
            '<div class="pin-tooltip-price">' + priceDisplay + '</div>' +
            '</div>' +
            '</div>';

        marker.bindTooltip(tooltipContent, {
            direction: 'top',
            offset: [0, -40],
            opacity: 1,
            className: 'pin-tooltip-wrapper'
        });

        marker.on('click', function() {
            map.setView([h.lat, h.lng], Math.max(map.getZoom(), 15), { animate: true, duration: 0.3 });
            openHotelSidebar(h);
        });
        marker.addTo(markersLayer);
        allHotelsData.push(h);
    });
    showHotelCount(hotels.length);
}

function updateMapFromEngine(hotels) {
    addHotelMarkers(hotels);
}

// ============================================================
// ✅ Détection des dates dans la requête
// ============================================================
function _hasDateInQuery(query) {
    if (!query) return false;
    var q = query.toLowerCase();

    var patterns = [
        /du\s+\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+au\s+\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/,
        /du\s+\d{1,2}\s+au\s+\d{1,2}/,
        /du\s+\d{1,2}\s+\w+\s+au\s+\d{1,2}\s+\w+/,
        /\d{1,2}[-–]\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/,
        /\d{1,2}\s+au\s+\d{1,2}/,
        /du\s+\d{1,2}\/\d{1,2}\s+au\s+\d{1,2}\/\d{1,2}/,
        /\d{1,2}\/\d{1,2}\s*[-–]\s*\d{1,2}\/\d{1,2}/,
        /\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/,
        /du\s+\d{1,2}/
    ];

    for (var i = 0; i < patterns.length; i++) {
        if (patterns[i].test(q)) return true;
    }

    if (/\d+\s+nuit/.test(q) || /\d+\s+nuits/.test(q)) return true;
    return false;
}

// ============================================================
// ✅ callEngine - Appel unique au backend
// ============================================================
async function callEngine(query) {
    if (!query) return;
    var aiSendBtn = document.getElementById('aiSendBtn');
    if (aiSendBtn) aiSendBtn.disabled = true;
    var loadingId = appendMessage('bot', '<div class="spinner" style="width:20px;height:20px;margin:10px;"></div>');
    try {
        var r = await fetch(STAYO_ENGINE_URL + '/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                checkin: currentSearchParams.checkin,
                checkout: currentSearchParams.checkout,
                adults: currentSearchParams.adults,
                currency: currentSearchParams.currency
            })
        });
        if (!r.ok) throw new Error('Engine error');
        var data = await r.json();
        var el = document.getElementById(loadingId);
        if (el) el.remove();

        console.log('[STAYO] Réponse reçue:', data);

        var hasUserDates = _hasDateInQuery(query);

        // Mise à jour des paramètres
        if (data.context) {
            if (data.context.checkin) currentSearchParams.checkin = data.context.checkin;
            if (data.context.checkout) currentSearchParams.checkout = data.context.checkout;
            if (data.context.adults) currentSearchParams.adults = data.context.adults;
            if (data.context.currency) currentSearchParams.currency = data.context.currency;
            ratesCache.clear();
        }

        var nights = Math.max(1, Math.round((new Date(currentSearchParams.checkout) - new Date(currentSearchParams.checkin)) / 86400000));
        var adults = currentSearchParams.adults || 2;
        var children = (data.context && data.context.children) ? parseInt(data.context.children, 10) : 0;
        
        var participants = adults + ' adulte' + (adults > 1 ? 's' : '');
        if (children > 0) {
            participants += ' et ' + children + ' enfant' + (children > 1 ? 's' : '');
        }
        
        var tripInfo = nights + ' nuit' + (nights > 1 ? 's' : '') + ' · ' + participants + ' · ' + currentSearchParams.currency;

        // ✅ Récupérer les hôtels à afficher
        var hotelsToShow = data.recommendations || data.hotels || [];

        console.log('[STAYO] Hôtels à afficher:', hotelsToShow.length);

        if (hotelsToShow.length > 0) {
            // ✅ Afficher le message
            var msg = '<p><strong>' + (data.message || "Voici mes recommandations :") + '</strong></p>';
            msg += '<p style="font-size:11px;color:var(--text-light);background:rgba(0,0,0,0.05);padding:4px 8px;border-radius:4px;display:inline-block;">' + tripInfo + '</p>';

            // ✅ Générer les cartes
            var cardsHtml = hotelsToShow.slice(0, 5).map(function(h, i) {
                // ✅ LOG de chaque hôtel
                console.log('[STAYO] Carte hôtel:', h.name, h.price);
                
                var exp = data.explanations && data.explanations[i] ? data.explanations[i] : null;
                var confHtml = exp ? '<span style="font-size:10px;color:' +
                    (exp.confidence >= 80 ? '#16a34a' : '#d97706') + ';">' + exp.confidence + '%</span>' : '';

                var priceDisplay = '?';
                if (h.price) {
                    if (hasUserDates) {
                        priceDisplay = h.price + ' ' + currentSearchParams.currency;
                    } else {
                        var pricePerNight = Math.round(h.price / nights);
                        priceDisplay = pricePerNight + ' ' + currentSearchParams.currency + '/nuit';
                    }
                }

                return '<div class="ai-hotel-card" onclick="focusHotel(\'' + h.id + '\', ' + h.lat + ', ' + h.lng + ')">' +
                    '<h4>' + h.name + '</h4>' +
                    '<div style="display:flex;justify-content:space-between;">' +
                    '<span>★' + (h.rating || '?') + ' | ' + (h.distance_event_minutes || '?') + ' min</span>' +
                    '<span class="price">' + priceDisplay + ' ' + confHtml + '</span>' +
                    '</div></div>';
            }).join('');

            console.log('[STAYO] Cartes HTML générées:', cardsHtml.length);

            // ✅ Ajouter au chat
            appendMessage('bot', msg + cardsHtml);

            // ✅ Mettre à jour la carte
            if (data.hotels && data.hotels.length > 0) {
                console.log('[STAYO] Mise à jour de la carte avec', data.hotels.length, 'hôtels');
                updateMapFromEngine(data.hotels);
            } else if (hotelsToShow.length > 0) {
                console.log('[STAYO] Mise à jour de la carte avec', hotelsToShow.length, 'recommandations');
                updateMapFromEngine(hotelsToShow);
            }

            // ✅ Activités suggérées
            if (data.context && data.context.suggested_activities && data.context.suggested_activities.length > 0) {
                var activitiesHtml = '<p style="margin-top:8px;font-size:12px;">Activites suggerees :</p><div class="ai-suggestions">' +
                    data.context.suggested_activities.slice(0, 4).map(function(a) {
                        return '<span class="ai-suggestion-chip" onclick="sendQuickReply(\'Activites ' +
                            a + ' a ' + (data.context.event || '') + '\')">' + a + '</span>';
                    }).join('') + '</div>';
                appendMessage('bot', activitiesHtml);
            }
        } else {
            console.log('[STAYO] Aucun hôtel trouvé');
            appendMessage('bot', data.message || "Aucun hotel trouve. Essayez de modifier vos dates ou votre budget.");
        }
    } catch (e) {
        console.error('[STAYO] Erreur:', e);
        var el = document.getElementById(loadingId);
        if (el) el.remove();
        appendMessage('bot', "Le serveur se reveille (hebergement gratuit). Reessayez dans 30 secondes.");
    } finally {
        if (aiSendBtn) aiSendBtn.disabled = false;
    }
    saveSearchToHistory(query);
}

// ========== CHATBOT ==========
var aiChatContainer = document.getElementById('aiChatContainer');
var aiUserInput = document.getElementById('aiUserInput');
var aiSendBtn = document.getElementById('aiSendBtn');

if (aiUserInput) {
    aiUserInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            var q = aiUserInput.value.trim();
            if (!q) return;
            appendMessage('user', q);
            aiUserInput.value = '';
            callEngine(q);
        }
    });
}

var aiSearchInput = document.getElementById('aiSearchInput');
if (aiSearchInput) {
    aiSearchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            var q = aiSearchInput.value.trim();
            if (!q) return;
            appendMessage('user', q);
            aiSearchInput.value = '';
            callEngine(q);
        }
    });
}

function sendQuickReply(t) {
    appendMessage('user', t);
    callEngine(t);
}

if (aiSendBtn) {
    aiSendBtn.addEventListener('click', function() {
        var q = aiUserInput ? aiUserInput.value.trim() : '';
        if (!q) return;
        appendMessage('user', q);
        if (aiUserInput) aiUserInput.value = '';
        callEngine(q);
    });
}

function appendMessage(type, content) {
    var id = 'msg-' + Date.now(),
        div = document.createElement('div');
    div.className = 'ai-message ' + type;
    div.id = id;
    div.innerHTML = type === 'bot' ?
        '<div class="ai-avatar"><img src="https://ukbekfcjfcjcqrpxfpmq.supabase.co/storage/v1/object/public/logo%20luvia/STAYO%20ICON%20PIN.png" alt="AI" /></div><div class="ai-bubble">' + content + '</div>' :
        '<div style="flex:1;"></div><div class="ai-bubble" style="background:var(--primary-light);color:var(--primary-dark);">' + content + '</div>';
    if (aiChatContainer) {
        aiChatContainer.appendChild(div);
        aiChatContainer.scrollTop = aiChatContainer.scrollHeight;
    }
    return id;
}

function focusHotel(id, lat, lng) {
    map.setView([lat, lng], 16, { animate: true });
    var h = allHotelsData.find(function(h) { return h.id === id; });
    if (h) openHotelSidebar(h);
}

function saveSearchToHistory(query) {
    var currentUser = JSON.parse(localStorage.getItem('stayo_user') || 'null');
    if (!currentUser) return;
    var searches = JSON.parse(localStorage.getItem('stayo_searches') || '[]');
    searches.unshift({ query: query, date: new Date().toLocaleDateString('fr-FR') });
    if (searches.length > 20) searches = searches.slice(0, 20);
    localStorage.setItem('stayo_searches', JSON.stringify(searches));
}

// ========== INIT ==========
setTimeout(function() {
    console.log('🏨 STAYO prêt');
    // Charger Paris par défaut
    callEngine("Paris");
}, 500);
