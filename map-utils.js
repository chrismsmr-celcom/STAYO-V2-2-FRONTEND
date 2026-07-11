// ==========================
// map-utils.js - STAYO Leaflet Premium
// ==========================

const map = L.map('map', {
    center: [48.8566, 2.3522],
    zoom: 13,
    zoomControl: false,
    attributionControl: false
});

L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

var markersLayer = L.layerGroup().addTo(map);
var routeLayer = L.layerGroup().addTo(map);

// ========== MARKERS ==========
function createPriceIcon(price, currency) {
    var symbols = { 'EUR': '€', 'GBP': '£', 'USD': '$' };
    var sym = symbols[currency] || currency;
    var dp = price >= 1000 ? (price / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : Math.round(price);
    var color = price < 100 ? '#16a34a' : price < 200 ? '#d97706' : price < 400 ? '#ea580c' : '#ad0053';
    return L.divIcon({
        className: 'price-icon',
        html: '<div class="price-marker" style="border-color:' + color + ';color:' + color + ';">' + sym + dp + '</div>',
        iconSize: [65, 36], iconAnchor: [32, 36], popupAnchor: [0, -36]
    });
}

function createNoPriceIcon() {
    return L.divIcon({
        className: 'price-icon',
        html: '<div class="price-marker no-price">—</div>',
        iconSize: [45, 36], iconAnchor: [22, 36], popupAnchor: [0, -36]
    });
}

function addHotelMarkers(hotels) {
    markersLayer.clearLayers();
    hotels.forEach(function(h) {
        var icon = h.price ? createPriceIcon(h.price, h.currency) : createNoPriceIcon();
        var marker = L.marker([h.lat, h.lng], { icon: icon, interactive: true, riseOnHover: true });
        var tooltipContent = '<div class="pin-tooltip">' +
            '<img src="' + (h.thumbnail || 'https://ukbekfcjfcjcqrpxfpmq.supabase.co/storage/v1/object/public/logo%20luvia/STAYO%20ICON%20PIN.png') + '" alt="' + h.name + '" onerror="this.style.display=\'none\'" />' +
            '<div class="pin-tooltip-info"><strong>' + h.name + '</strong>' +
            '<div class="pin-tooltip-meta">' + (h.stars ? '★'.repeat(Math.min(h.stars, 5)) : '') + (h.rating ? ' <span>' + h.rating + '/10</span>' : '') + '</div>' +
            '<div class="pin-tooltip-price">' + (h.price ? h.price + ' ' + (h.currency || '€') : '—') + '</div></div></div>';
        marker.bindTooltip(tooltipContent, { direction: 'top', offset: [0, -40], opacity: 1, className: 'pin-tooltip-wrapper' });
        marker.on('click', function() {
            map.setView([h.lat, h.lng], Math.max(map.getZoom(), 15), { animate: true, duration: 0.3 });
            if (typeof openHotelSidebar === 'function') openHotelSidebar(h);
        });
        marker.addTo(markersLayer);
    });
}
// Créer deux groupes : un pour zoom proche, un pour zoom éloigné
var closeZoomGroup = L.layerGroup();
var farZoomGroup = L.layerGroup();

map.on('zoomend', function() {
    var zoom = map.getZoom();
    if (zoom <= 10) {
        map.removeLayer(markersLayer);
    } else {
        map.addLayer(markersLayer);
    }
});
// ========== GÉOLOC + ITINÉRAIRE ==========
var userMarker = null;
var userPosition = null;

function goToMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            userPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            var userIcon = L.divIcon({
                className: 'user-location-icon',
                html: '<div class="user-dot"></div><div class="user-pulse"></div>',
                iconSize: [30, 30], iconAnchor: [15, 15]
            });
            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.marker([userPosition.lat, userPosition.lng], { icon: userIcon, zIndexOffset: 1000, interactive: true }).addTo(map);
            userMarker.on('click', function() { showNearestHotelRoute(); });
            map.setView([userPosition.lat, userPosition.lng], 15, { animate: true });
            if (typeof findNearestHotel === 'function') findNearestHotel(userPosition.lat, userPosition.lng);
        },
        function() { showToast('Impossible de vous localiser.', true); },
        { enableHighAccuracy: true }
    );
}

function showNearestHotelRoute() {
    if (!userPosition) return showToast('Activez d\'abord votre position.', true);
    var nearest = null;
    var minDist = Infinity;
    allHotelsData.forEach(function(h) {
        var d = haversineMeters(userPosition, { lat: h.lat, lng: h.lng });
        if (d < minDist) { minDist = d; nearest = h; }
    });
    if (!nearest) return showToast('Aucun hotel trouve.', true);
    drawRoute(userPosition.lat, userPosition.lng, nearest.lat, nearest.lng, nearest);
}

function drawRoute(fromLat, fromLng, toLat, toLng, hotel) {
    routeLayer.clearLayers();
    var url = 'https://router.project-osrm.org/route/v1/foot/' + fromLng + ',' + fromLat + ';' + toLng + ',' + toLat + '?geometries=geojson&overview=full';
    fetch(url).then(function(r) { return r.json(); }).then(function(data) {
        if (!data.routes || !data.routes.length) return;
        var route = data.routes[0];
        var coords = route.geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
        var line = L.polyline(coords, { color: '#ad0053', weight: 4, opacity: 0.8, dashArray: '10, 6' }).addTo(routeLayer);
        map.fitBounds(line.getBounds(), { padding: [50, 50] });
        var dist = (route.distance / 1000).toFixed(1);
        var dur = Math.round(route.duration / 60);
        showRouteModal(hotel, dist, dur);
    }).catch(function() { showToast('Impossible de tracer l\'itineraire.', true); });
}

// ========== ROUTE MODAL ==========
function showRouteModal(hotel, dist, dur) {
    var existing = document.getElementById('routeModal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'routeModal';
    modal.className = 'route-modal';
    modal.innerHTML = 
        '<div class="route-modal-handle"></div>' +
        '<button class="route-modal-close" onclick="this.parentElement.remove()">&times;</button>' +
        '<div class="route-modal-hero">' +
            '<img src="' + (hotel.thumbnail || 'https://ukbekfcjfcjcqrpxfpmq.supabase.co/storage/v1/object/public/logo%20luvia/STAYO%20ICON%20PIN.png') + '" alt="' + hotel.name + '" />' +
            '<div class="route-modal-distance">' + dist + ' km — ' + dur + ' min a pied</div>' +
        '</div>' +
        '<div class="route-modal-body">' +
            '<h3>' + hotel.name + '</h3>' +
            '<p class="route-modal-address">' + (hotel.location || hotel.address || '') + '</p>' +
            '<div class="route-modal-badges">' +
                (hotel.stars ? '<span>' + '★'.repeat(Math.min(hotel.stars, 5)) + '</span>' : '') +
                (hotel.rating ? '<span class="route-modal-rating">' + hotel.rating + '/10</span>' : '') +
                (hotel.price ? '<span class="route-modal-price">' + hotel.price + ' ' + (hotel.currency || '€') + '</span>' : '') +
            '</div>' +
            '<button class="route-modal-btn" onclick="openHotelSidebarFromModal(\'' + hotel.id + '\')">Voir les details</button>' +
            '<button class="route-modal-btn secondary" onclick="openUberToHotel(' + hotel.lat + ',' + hotel.lng + ',\'' + (hotel.name || 'Hotel') + '\')">Commander un Uber</button>' +
        '</div>';
    document.body.appendChild(modal);
    setTimeout(function() { modal.classList.add('open'); }, 10);
    
    modal.querySelector('.route-modal-close').addEventListener('click', function() { modal.remove(); });
    modal.querySelector('.route-modal-handle').addEventListener('click', function() { modal.remove(); });
}

function openHotelSidebarFromModal(id) {
    var h = allHotelsData.find(function(h) { return h.id === id; });
    if (h) openHotelSidebar(h);
    var modal = document.getElementById('routeModal');
    if (modal) modal.remove();
}

function haversineMeters(a, b) {
    var R = 6371000, toRad = function(d) { return d * Math.PI / 180; };
    var dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    var lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    return 2 * R * Math.asin(Math.sqrt(Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)*Math.sin(dLng/2)));
}
// ========== MENU ==========
function toggleMenu() {
    document.getElementById('menuPanel').classList.toggle('open');
    document.getElementById('menuOverlay').classList.toggle('open');
}

function selectCurrency(el) {
    document.querySelectorAll('.currency-chip').forEach(function(c) { c.classList.remove('active'); });
    el.classList.add('active');
    var currency = el.getAttribute('data-currency');
    if (typeof currentSearchParams !== 'undefined') {
        currentSearchParams.currency = currency;
        ratesCache.clear();
        if (typeof loadHotelsForViewport === 'function') loadHotelsForViewport();
    }
    showToast('Devise : ' + currency);
}

function selectLanguage(el) {
    document.querySelectorAll('.lang-chip').forEach(function(c) { c.classList.remove('active'); });
    el.classList.add('active');
    var lang = el.getAttribute('data-lang');
    localStorage.setItem('stayo_lang', lang);
    showToast('Langue : ' + lang);
}
// ========== TOAST ==========
var toast = document.getElementById('toast');
function showToast(msg, err) {
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast' + (err ? ' error' : '');
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, 3500);
}

var counterTimeout;
function showHotelCount(count) {
    var el = document.getElementById('hotelCount');
    var info = document.getElementById('resultsInfo');
    if (el) el.textContent = String(count);
    if (info) {
        info.classList.add('show');
        clearTimeout(counterTimeout);
        counterTimeout = setTimeout(function() { info.classList.remove('show'); }, 2500);
    }
}

function toggleFilters() { var f = document.getElementById('quickFilters'); if (f) f.style.display = f.style.display === 'none' ? 'flex' : 'none'; }
function updateSearch(t) { var i = document.getElementById('aiSearchInput'); if (i) i.value = t; }
window.addEventListener('resize', function() { map.invalidateSize(); });
