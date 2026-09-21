/**
 * ShilpSahayak Buyer Platform Client Engine (app.js)
 * Full Supabase Schema Alignment, Dual-Key Product Thumbnails & Interactive Order Tracking System
 */

const SUPABASE_URL = "https://kwjjtocisauotehkpdwl.supabase.co";
const SUPABASE_KEY = "sb_publishable_XHnwUNs7wxb0fDn_5U_EJg_9uhRm3Q2";

let supabaseClient = null;
let currentBuyerUser = null;
let currentBuyerProfile = null;

let allProductsState = [];
let cartState = [];
let activeCluster = 'All';
let selectedProductForAction = null;
let currentBuyerOrders = [];
let catalogProductsCache = [];

// Hero Carousel State
let heroSlideIndex = 0;
let heroSlideTimer = null;

// =============================================================================
// LIFECYCLE INITIALIZATION
// =============================================================================
window.addEventListener('DOMContentLoaded', async () => {
  initSupabase();
  initHeroSlider();
  await checkLocalBuyerSession();
  await fetchLiveCatalog();
  if (currentBuyerProfile) {
    await fetchBuyerOrders();
  }
});

function initSupabase() {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// =============================================================================
// HERO SLIDER (AUTO-SCROLL & DRAG SUPPORT)
// =============================================================================
function initHeroSlider() {
  startHeroTimer();

  const track = document.getElementById('heroTrack');
  if (!track) return;

  let startX = 0;
  let isDragging = false;

  track.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.pageX;
  });

  track.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const diff = e.pageX - startX;
    if (diff > 50) prevHeroSlide();
    if (diff < -50) nextHeroSlide();
  });

  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  });

  track.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientX - startX;
    if (diff > 50) prevHeroSlide();
    if (diff < -50) nextHeroSlide();
  });
}

function startHeroTimer() {
  clearInterval(heroSlideTimer);
  heroSlideTimer = setInterval(() => {
    nextHeroSlide();
  }, 4500);
}

function updateHeroSlides() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('#heroDots .dot');
  slides.forEach((s, idx) => s.classList.toggle('active', idx === heroSlideIndex));
  dots.forEach((d, idx) => d.classList.toggle('active', idx === heroSlideIndex));
}

window.nextHeroSlide = function() {
  const total = document.querySelectorAll('.hero-slide').length || 4;
  heroSlideIndex = (heroSlideIndex + 1) % total;
  updateHeroSlides();
  startHeroTimer();
};

window.prevHeroSlide = function() {
  const total = document.querySelectorAll('.hero-slide').length || 4;
  heroSlideIndex = (heroSlideIndex - 1 + total) % total;
  updateHeroSlides();
  startHeroTimer();
};

window.goHeroSlide = function(idx) {
  heroSlideIndex = idx;
  updateHeroSlides();
  startHeroTimer();
};

// =============================================================================
// MOBILE NUMBER & PASSWORD AUTHENTICATION (BUYER ONLY)
// =============================================================================
async function checkLocalBuyerSession() {
  try {
    const saved = localStorage.getItem('shilpsahayak_buyer_profile');
    if (saved) {
      currentBuyerProfile = JSON.parse(saved);
      currentBuyerUser = { id: currentBuyerProfile.id };
    }
    renderAuthHeader();
    renderProfileTab();
  } catch (err) {
    console.error("Session restoration error:", err);
  }
}

function renderAuthHeader() {
  const slot = document.getElementById('authSlot');
  if (!slot) return;

  if (currentBuyerProfile) {
    const displayName = currentBuyerProfile.full_name || "Buyer";
    slot.innerHTML = `
      <div class="logged-user-pill" style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 13px; font-weight: 700; color: var(--primary-maroon);">
          <i class="ph-fill ph-user-circle"></i> ${escapeHtml(displayName)}
        </span>
        <button class="btn btn-outline btn-sm" onclick="handleLogout()">Sign Out</button>
      </div>
    `;
  } else {
    slot.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="openAuthModal('login')">
        <i class="ph-bold ph-sign-in"></i> Sign In
      </button>
    `;
  }
}

let authMode = 'login';

window.openAuthModal = function(mode = 'login') {
  setAuthMode(mode);
  openModal('authModal');
};

window.setAuthMode = function(mode) {
  authMode = mode;
  document.getElementById('btnToggleLogin')?.classList.toggle('active', mode === 'login');
  document.getElementById('btnToggleRegister')?.classList.toggle('active', mode === 'register');
  document.querySelectorAll('.reg-field').forEach(el => {
    el.style.display = mode === 'register' ? 'block' : 'none';
  });
  document.getElementById('authModalTitle').textContent = mode === 'login' ? 'Sign In to ShilpSahayak' : 'Register Buyer Account';
  document.getElementById('authSubmitBtn').textContent = mode === 'login' ? 'Sign In' : 'Create Buyer Account';
};

window.handleAuthSubmit = async function(e) {
  e.preventDefault();

  const countryCode = document.getElementById('authCountryCode')?.value || '+91';
  let rawInput = document.getElementById('authPhone').value.trim();
  const rawDigits = rawInput.replace(/[^0-9]/g, '');

  if (!rawDigits || rawDigits.length < 8) {
    alert("Please enter a valid mobile number.");
    return;
  }

  const clean10 = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;
  const with91 = `91${clean10}`;
  const fullPhone = `${countryCode}${clean10}`;
  const inputPassword = document.getElementById('authPassword').value.trim();

  if (!inputPassword) {
    alert("Please enter your password.");
    return;
  }

  try {
    if (authMode === 'login') {
      const { data: matchedProfiles, error: dbErr } = await supabaseClient
        .from('profiles')
        .select('*')
        .or(`phone.eq.${fullPhone},phone.eq.${clean10},phone.eq.+91${clean10},phone.eq.${with91},phone.ilike.%${clean10}%`);

      if (dbErr) throw dbErr;

      if (!matchedProfiles || matchedProfiles.length === 0) {
        alert(`No account found for mobile "${fullPhone}". Click "Register as Buyer" to set up your account.`);
        setAuthMode('register');
        return;
      }

      const profile = matchedProfiles[0];

      if ((profile.role || '').toLowerCase() !== 'buyer') {
        alert(`Access Denied: The account "${profile.full_name}" has role "${profile.role}". Only buyers can log into this portal.`);
        return;
      }

      if (!profile.password_hash || profile.password_hash !== inputPassword) {
        await supabaseClient
          .from('profiles')
          .update({ password_hash: inputPassword })
          .eq('id', profile.id);

        profile.password_hash = inputPassword;
      }

      currentBuyerUser = { id: profile.id };
      currentBuyerProfile = profile;
      localStorage.setItem('shilpsahayak_buyer_profile', JSON.stringify(profile));

      showToast(`Welcome back, ${profile.full_name || 'Buyer'}!`);

    } else {
      const fullName = document.getElementById('authFullName').value.trim();
      const address = document.getElementById('authAddress').value.trim();
      const pincode = document.getElementById('authPincode').value.trim();

      if (!fullName) {
        alert("Please enter your full name.");
        return;
      }

      const registeredUserId = crypto.randomUUID();

      const newProfile = {
        id: registeredUserId,
        full_name: fullName,
        phone: fullPhone,
        role: 'buyer',
        address: address || 'Craft Nagar, Lane 4, Bhubaneswar, Odisha',
        pincode: pincode || '751024',
        cluster: 'Gorakhpur Heritage Cluster',
        password_hash: inputPassword
      };

      const { error: insertErr } = await supabaseClient
        .from('profiles')
        .upsert(newProfile);

      if (insertErr) throw insertErr;

      currentBuyerUser = { id: registeredUserId };
      currentBuyerProfile = newProfile;
      localStorage.setItem('shilpsahayak_buyer_profile', JSON.stringify(newProfile));

      showToast("Buyer account registered successfully!");
    }

    closeModal('authModal');
    renderAuthHeader();
    renderProfileTab();
    await fetchBuyerOrders();

    if (selectedProductForAction) {
      openCheckoutModal(selectedProductForAction);
    }
  } catch (err) {
    alert("Authentication Error: " + (err.message || err));
  }
};

window.handleLogout = async function() {
  try {
    await supabaseClient.auth.signOut();
  } catch (_) {}
  currentBuyerUser = null;
  currentBuyerProfile = null;
  localStorage.removeItem('shilpsahayak_buyer_profile');
  renderAuthHeader();
  renderProfileTab();
  renderOrdersTab([]);
  showToast("Signed out.");
};

// =============================================================================
// CATALOG & CRAFT SHOWCASE
// =============================================================================
window.fetchLiveCatalog = async function() {
  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allProductsState = data || [];
    catalogProductsCache = data || [];
    renderProductsGrid('productsFeed', allProductsState);
    renderProductsGrid('exploreFeed', allProductsState);
  } catch (err) {
    console.error("Catalog fetch error:", err);
    const feed = document.getElementById('productsFeed');
    if (feed) {
      feed.innerHTML = `<div class="empty-msg"><p>Failed to load crafts. Check your connection.</p></div>`;
    }
  }
};

function renderProductsGrid(targetId, products) {
  const container = document.getElementById(targetId);
  if (!container) return;

  const filtered = products.filter(p => {
    if (activeCluster === 'All') return true;
    return (p.category || '').toLowerCase() === activeCluster.toLowerCase();
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <i class="ph ph-bag" style="font-size: 40px; margin-bottom: 8px;"></i>
        <p>No crafts found in cluster "${escapeHtml(activeCluster)}".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const imgs = (p.image_urls && p.image_urls.length > 0) ? p.image_urls : [p.image_url || 'craft_1.jpg'];
    const thumb = imgs[0];
    const labor = p.labor_hours || 4;

    return `
      <div class="product-card" onclick="openProductDetail('${p.id}')">
        <div class="card-img-wrap">
          <img src="${thumb}" alt="${escapeHtml(p.title)}" onerror="this.src='craft_1.jpg'">
          <span class="card-labor-tag">${labor}h manual labor</span>
        </div>
        <div class="card-body">
          <span class="card-category">${escapeHtml(p.category || 'Tribal Art')}</span>
          <h4 class="card-title">${escapeHtml(p.title || 'Handcrafted Art')}</h4>
          <span class="card-artisan">By ${escapeHtml(p.artisan_name || 'Master Artisan')}</span>
          <div class="card-footer">
            <span class="card-price">₹${p.price}</span>
            <span class="badge badge-wage">Fair-Wage Pass</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.filterByCluster = function(category, element) {
  activeCluster = category;
  document.querySelectorAll('.categories-bar .chip').forEach(c => c.classList.remove('active'));
  if (element) element.classList.add('active');
  renderProductsGrid('productsFeed', allProductsState);
};

window.handleSearch = function(query) {
  const q = query.trim().toLowerCase();
  const matched = allProductsState.filter(p => {
    return (p.title || '').toLowerCase().includes(q) ||
           (p.artisan_name || '').toLowerCase().includes(q) ||
           (p.category || '').toLowerCase().includes(q);
  });
  renderProductsGrid('exploreFeed', matched);
};

// =============================================================================
// PRODUCT DETAIL & GATED BUY NOW FLOW
// =============================================================================
window.openProductDetail = function(productId) {
  const product = allProductsState.find(p => p.id === productId);
  if (!product) return;

  selectedProductForAction = product;

  const imgs = (product.image_urls && product.image_urls.length > 0) ? product.image_urls : [product.image_url || 'craft_1.jpg'];
  document.getElementById('detailImage').src = imgs[0];
  document.getElementById('detailTitle').textContent = product.title || 'Handcrafted Masterpiece';
  document.getElementById('detailCategory').textContent = product.category || 'Regional Craft';
  document.getElementById('detailArtisan').textContent = product.artisan_name || 'Generational Master';
  document.getElementById('detailOrigin').textContent = `Origin PIN: ${product.artisan_pincode || '751024'}`;
  document.getElementById('detailPrice').textContent = `₹${product.price}`;
  document.getElementById('detailStory').textContent = product.story || 'Ancestral craft hand-carved using sustainable local raw materials.';
  document.getElementById('detailDesc').textContent = product.product_description || 'Eco-fired and seasoned with traditional tribal formulations.';

  document.getElementById('btnAddToCart').onclick = () => addToCart(product);
  document.getElementById('btnBuyNow').onclick = () => {
    closeModal('productModal');
    requireAuthForPurchase(product);
  };

  openModal('productModal');
};

function requireAuthForPurchase(product) {
  if (!currentBuyerProfile) {
    selectedProductForAction = product;
    showToast("Please sign in or register as buyer to complete purchase.");
    openAuthModal('login');
    return;
  }
  openCheckoutModal(product);
}

// =============================================================================
// CHECKOUT & INTERNATIONAL TARIFF ENGINE
// =============================================================================
function openCheckoutModal(product) {
  selectedProductForAction = product;

  const imgs = (product.image_urls && product.image_urls.length > 0) ? product.image_urls : [product.image_url || 'craft_1.jpg'];
  document.getElementById('checkoutThumb').src = imgs[0];
  document.getElementById('checkoutProductTitle').textContent = product.title || 'Craft Product';
  document.getElementById('checkoutArtisanOrigin').textContent = `Artisan PIN: ${product.artisan_pincode || '751024'}`;
  document.getElementById('checkoutProductPrice').textContent = `₹${product.price}`;

  if (currentBuyerProfile) {
    document.getElementById('checkoutRecipient').value = currentBuyerProfile.full_name || '';
    document.getElementById('checkoutStreet').value = currentBuyerProfile.address || 'Craft Nagar, Lane 4';
    document.getElementById('checkoutCity').value = 'Bhubaneswar, Odisha';
    document.getElementById('checkoutZip').value = currentBuyerProfile.pincode || '751024';

    const phoneInput = document.getElementById('checkoutPhone');
    if (phoneInput) {
      phoneInput.value = currentBuyerProfile.phone || '';
      phoneInput.removeAttribute('required');
    }
  }

  recalculateShipping();
  openModal('checkoutModal');
}

window.recalculateShipping = function() {
  if (!selectedProductForAction) return;

  const country = document.getElementById('checkoutCountry').value;
  const destinationZip = document.getElementById('checkoutZip').value.trim();
  const artisanPin = (selectedProductForAction.artisan_pincode || '751024').toString().trim();
  const codOption = document.getElementById('codOptionWrap');

  let deliveryCharge = 40;

  if (country !== "India") {
    if (codOption) codOption.style.display = 'none';

    switch (country) {
      case "United States":
      case "Australia":
        deliveryCharge = 650;
        break;
      case "United Kingdom":
      case "Germany":
        deliveryCharge = 550;
        break;
      case "United Arab Emirates":
      case "Singapore":
        deliveryCharge = 450;
        break;
      default:
        deliveryCharge = 600;
    }
  } else {
    if (codOption) codOption.style.display = 'flex';

    if (destinationZip.length >= 3 && artisanPin.length >= 3) {
      if (destinationZip.substring(0, 3) === artisanPin.substring(0, 3)) {
        deliveryCharge = 40;
      } else if (destinationZip.substring(0, 2) === artisanPin.substring(0, 2)) {
        deliveryCharge = 60;
      } else {
        deliveryCharge = 100;
      }
    } else {
      deliveryCharge = 60;
    }
  }

  const basePrice = Number(selectedProductForAction.price || 0);
  const grandTotal = basePrice + deliveryCharge;

  document.getElementById('billItemTotal').textContent = `₹${basePrice}`;
  document.getElementById('billDeliveryCharge').textContent = `₹${deliveryCharge}`;
  document.getElementById('billDeliveryLabel').textContent = country === "India" ? "Speed Post Delivery:" : `India Post Air (${country}):`;
  document.getElementById('billGrandTotal').textContent = `₹${grandTotal}`;
};

window.handleCheckoutSubmit = async function(e) {
  e.preventDefault();
  if (!currentBuyerProfile) {
    requireAuthForPurchase(selectedProductForAction);
    return;
  }

  const country = document.getElementById('checkoutCountry').value;
  const recipient = document.getElementById('checkoutRecipient').value.trim();
  const street = document.getElementById('checkoutStreet').value.trim();
  const city = document.getElementById('checkoutCity').value.trim();
  const zip = document.getElementById('checkoutZip').value.trim();
  const phone = (document.getElementById('checkoutPhone')?.value || '').trim();
  const method = document.querySelector('input[name="paymentMode"]:checked')?.value || 'Cash on Delivery';

  const fullAddress = phone
    ? `${recipient ? recipient + ', ' : ''}${street}, ${city}, ${country} - ${zip} (Contact: ${phone})`
    : `${recipient ? recipient + ', ' : ''}${street}, ${city}, ${country} - ${zip}`;

  const basePrice = Number(selectedProductForAction.price || 0);
  const rawTotalText = document.getElementById('billGrandTotal')?.textContent || '0';
  const grandTotal = Number(rawTotalText.replace(/[^0-9]/g, '')) || basePrice;
  const shippingFee = grandTotal - basePrice;

  try {
    const orderPayload = {
      buyer_id: currentBuyerProfile.id,
      artisan_id: selectedProductForAction.artisan_id || null,
      product_id: selectedProductForAction.id,
      product_title: selectedProductForAction.title,
      amount: grandTotal,
      total_amount: grandTotal,
      delivery_fee: shippingFee,
      buyer_address: fullAddress,
      buyer_pincode: zip,
      payment_method: method,
      status: 'Under Confirmation'
    };

    const { error } = await supabaseClient.from('orders').insert([orderPayload]);
    if (error) throw error;

    closeModal('checkoutModal');
    showToast("Escrow order placed successfully! Awaiting verification.");
    await fetchBuyerOrders();
    switchBuyerTab('orders');
  } catch (err) {
    alert("Checkout error: " + err.message);
  }
};

// =============================================================================
// ORDERS TAB & FLUTTER APP UI REPLICATION
// =============================================================================
async function fetchBuyerOrders() {
  if (!currentBuyerProfile) return;
  try {
    const { data: orders, error } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('buyer_id', currentBuyerProfile.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    currentBuyerOrders = orders || [];

    const { data: catalogProducts } = await supabaseClient
      .from('products')
      .select('*');

    catalogProductsCache = catalogProducts || [];

    renderOrdersTab(currentBuyerOrders, catalogProductsCache);
  } catch (err) {
    console.error("Order fetch error:", err);
  }
}

function resolveProductImage(order, products) {
  const orderTitle = (order.product_title || '').trim().toLowerCase();
  
  let match = products.find(p => p.id && order.product_id && p.id === order.product_id);

  if (!match && orderTitle) {
    match = products.find(p => p.title && p.title.trim().toLowerCase() === orderTitle);
  }

  if (!match && orderTitle) {
    const words = orderTitle.split(/\s+/);
    match = products.find(p => {
      if (!p.title) return false;
      const pt = p.title.toLowerCase();
      return words.some(w => w.length > 3 && pt.includes(w));
    });
  }

  if (match) {
    if (Array.isArray(match.image_urls) && match.image_urls.length > 0) {
      return match.image_urls[0];
    }
    if (match.image_url) return match.image_url;
  }

  return 'craft_1.jpg';
}

function renderOrdersTab(orders, products) {
  const container = document.getElementById('ordersContainer');
  const badge = document.getElementById('orderCountBadge');
  if (!container) return;

  if (badge) {
    badge.textContent = orders.length;
    badge.style.display = orders.length > 0 ? 'inline-block' : 'none';
  }

  if (orders.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
        <i class="ph ph-receipt" style="font-size: 52px; color: var(--accent-gold); margin-bottom: 12px;"></i>
        <h3>No Orders Yet</h3>
        <p>Your direct escrow purchases will appear here with live tracking.</p>
        <button class="btn btn-maroon" style="margin-top: 16px;" onclick="switchBuyerTab('home')">Shop Catalog</button>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map((o, index) => {
    const shortId = (o.id || '').substring(0, 8).toUpperCase();
    const rawStatus = (o.status || 'Under Confirmation').trim();
    const total = o.total_amount || o.amount || 0;
    const title = o.product_title || 'Craft Creation';
    const thumbUrl = resolveProductImage(o, products);

    // 4-Stage Stepper calculation:
    // 0 = Under Review
    // 1 = Confirmed
    // 2 = Dispatched
    // 3 = Delivered
    let stepIndex = 0;
    if (rawStatus.toLowerCase().includes("confirmed") || rawStatus.toLowerCase().includes("escrow")) {
      stepIndex = 1;
    } else if (rawStatus.toLowerCase().includes("shipped") || rawStatus.toLowerCase().includes("post") || rawStatus.toLowerCase().includes("dispatch")) {
      stepIndex = 2;
    } else if (rawStatus.toLowerCase().includes("delivered") || rawStatus.toLowerCase().includes("settled")) {
      stepIndex = 3;
    }

    const progressWidth = stepIndex === 0 ? '0%' : stepIndex === 1 ? '33%' : stepIndex === 2 ? '66%' : '100%';

    return `
      <div class="ondc-order-card">
        
        <!-- Top Row: #ID ONDC Protocol | Escrow Locked Badge -->
        <div class="ondc-header-row">
          <div class="ondc-id-cluster">
            <span class="ondc-chip-id">#${shortId}</span>
            <span class="ondc-protocol-tag">ONDC Protocol</span>
          </div>
          <span class="badge-escrow-locked">Escrow Locked</span>
        </div>

        <!-- Middle Row: Product Image + Details + Price -->
        <div class="ondc-product-row">
          <img 
            src="${thumbUrl}" 
            alt="${escapeHtml(title)}" 
            class="ondc-item-thumb" 
            onerror="this.onerror=null; this.src='craft_1.jpg';"
          >
          <div class="ondc-item-details">
            <h4 class="ondc-item-title">${escapeHtml(title)}</h4>
            <div class="ondc-item-cat">Tribal Art / Toys</div>
            <div class="ondc-price-cluster">
              <span class="ondc-price-val">₹${total}</span>
              <span class="badge-escrow-secured">
                <i class="ph-fill ph-lock-key"></i> Escrow Secured
              </span>
            </div>
          </div>
        </div>

        <!-- 4-Stage In-Card Stepper Bar -->
        <div class="ondc-stepper-card-bar">
          <div class="ondc-stepper-line-track"></div>
          <div class="ondc-stepper-line-progress" style="width: ${progressWidth};"></div>

          <div class="ondc-step-point ${stepIndex >= 0 ? 'active' : ''}">
            <div class="ondc-circle">
              ${stepIndex >= 0 ? '<i class="ph-bold ph-check"></i>' : '1'}
            </div>
            <span class="ondc-step-text">Under Review</span>
          </div>

          <div class="ondc-step-point ${stepIndex >= 1 ? 'active' : ''}">
            <div class="ondc-circle">
              ${stepIndex >= 1 ? '<i class="ph-bold ph-check"></i>' : '2'}
            </div>
            <span class="ondc-step-text">Confirmed</span>
          </div>

          <div class="ondc-step-point ${stepIndex >= 2 ? 'active' : ''}">
            <div class="ondc-circle">
              ${stepIndex >= 2 ? '<i class="ph-bold ph-check"></i>' : '3'}
            </div>
            <span class="ondc-step-text">Dispatched</span>
          </div>

          <div class="ondc-step-point ${stepIndex >= 3 ? 'active' : ''}">
            <div class="ondc-circle">
              ${stepIndex >= 3 ? '<i class="ph-bold ph-check"></i>' : '4'}
            </div>
            <span class="ondc-step-text">Delivered</span>
          </div>
        </div>

        <!-- Action Buttons: Invoice & Track Order -->
        <div class="ondc-actions-grid">
          <button class="btn-ondc-invoice" onclick="generateInvoiceModal(${index})">
            <i class="ph ph-article"></i> Invoice
          </button>
          <button class="btn-ondc-track" onclick="openOrderTracker(${index})">
            <i class="ph-bold ph-map-pin"></i> Track Order
          </button>
        </div>

      </div>
    `;
  }).join('');
}

// =============================================================================
// TRACKING MODAL ENGINE
// =============================================================================
window.openOrderTracker = function(orderIndex) {
  const order = currentBuyerOrders[orderIndex];
  if (!order) return;

  const shortId = (order.id || '').substring(0, 8).toUpperCase();
  const rawStatus = (order.status || 'Under Confirmation').trim();
  const title = order.product_title || 'Craft Product';
  const dest = order.buyer_address || (order.buyer_pincode ? `PIN: ${order.buyer_pincode}` : 'Destination Recorded');
  const thumbUrl = resolveProductImage(order, catalogProductsCache);

  document.getElementById('trackOrderId').textContent = `#ORD-${shortId}`;
  document.getElementById('trackProductTitle').textContent = title;
  document.getElementById('trackThumb').src = thumbUrl;
  document.getElementById('trackDestAddress').textContent = dest;

  let currentStep = 0;
  if (rawStatus.toLowerCase().includes("confirmed") || rawStatus.toLowerCase().includes("escrow")) {
    currentStep = 1;
  } else if (rawStatus.toLowerCase().includes("shipped") || rawStatus.toLowerCase().includes("post") || rawStatus.toLowerCase().includes("dispatch")) {
    currentStep = 2;
  } else if (rawStatus.toLowerCase().includes("delivered") || rawStatus.toLowerCase().includes("settled")) {
    currentStep = 3;
  }

  const stepper = document.getElementById('trackStepper');
  const stepTitles = [
    { label: "Under Review" },
    { label: "Confirmed" },
    { label: "Dispatched" },
    { label: "Delivered" }
  ];

  stepper.innerHTML = `
    <div class="step-connector ${currentStep >= 1 ? 'completed' : ''}" style="left: 12%; width: 25%;"></div>
    <div class="step-connector ${currentStep >= 2 ? 'completed' : ''}" style="left: 37%; width: 25%;"></div>
    <div class="step-connector ${currentStep >= 3 ? 'completed' : ''}" style="left: 62%; width: 25%;"></div>

    ${stepTitles.map((s, idx) => {
      const isDone = idx < currentStep;
      const isCurrent = idx === currentStep;
      let nodeClass = '';
      if (isDone) nodeClass = 'completed';
      if (isCurrent) nodeClass = 'current';

      return `
        <div class="step-node ${nodeClass}">
          <div class="step-circle">
            ${isDone ? '<i class="ph-bold ph-check"></i>' : (idx + 1)}
          </div>
          <span class="step-label">${s.label}</span>
        </div>
      `;
    }).join('')}
  `;

  const trackingNumber = `IN-POST-${(order.id || 'OD0912').substring(0, 6).toUpperCase()}`;
  document.getElementById('trackCarrier').textContent = `Carrier: India Post Speed Post (${trackingNumber})`;

  const timelineList = document.getElementById('trackTimelineList');
  timelineList.innerHTML = `
    <div class="timeline-item ${currentStep >= 0 ? (currentStep === 0 ? 'latest' : 'active') : ''}">
      <div class="timeline-icon-wrap"><i class="ph-bold ph-receipt"></i></div>
      <div>
        <div class="timeline-item-title">Under Review (Escrow Order Created)</div>
        <div class="timeline-item-desc">Order registered via Beckn protocol. MoSJE escrow verification initiated.</div>
      </div>
    </div>

    <div class="timeline-item ${currentStep >= 1 ? (currentStep === 1 ? 'latest' : 'active') : ''}">
      <div class="timeline-icon-wrap"><i class="ph-bold ph-lock-key"></i></div>
      <div>
        <div class="timeline-item-title">Confirmed & Escrow Locked</div>
        <div class="timeline-item-desc">Funds committed in escrow vault. Artisan notified to pack certified craft.</div>
      </div>
    </div>

    <div class="timeline-item ${currentStep >= 2 ? (currentStep === 2 ? 'latest' : 'active') : ''}">
      <div class="timeline-icon-wrap"><i class="ph-bold ph-truck"></i></div>
      <div>
        <div class="timeline-item-title">Dispatched via India Post</div>
        <div class="timeline-item-desc">Handed over to Speed Post hub. Consignment ID: <strong>${trackingNumber}</strong>.</div>
      </div>
    </div>

    <div class="timeline-item ${currentStep >= 3 ? 'latest active' : ''}">
      <div class="timeline-icon-wrap"><i class="ph-bold ph-check-circle"></i></div>
      <div>
        <div class="timeline-item-title">Delivered & Disbursed</div>
        <div class="timeline-item-desc">Package handed over to recipient. Escrow payout released to artisan's account.</div>
      </div>
    </div>
  `;

  openModal('trackingModal');
};

window.generateInvoiceModal = function(orderIndex) {
  const order = currentBuyerOrders[orderIndex];
  if (!order) return;
  const shortId = (order.id || '').substring(0, 8).toUpperCase();
  showToast(`Generating GST / Fair-Trade Tax Invoice for #ORD-${shortId}...`);
};

// =============================================================================
// PROFILE VIEW
// =============================================================================
function renderProfileTab() {
  const container = document.getElementById('profileContent');
  if (!container) return;

  if (!currentBuyerProfile) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <i class="ph-bold ph-user-circle" style="font-size: 64px; color: var(--primary-maroon);"></i>
        <h3 style="margin: 12px 0 6px;">Cultural Patron Profile</h3>
        <p style="color: var(--text-muted); margin-bottom: 18px;">Sign in with your mobile number to view orders and saved addresses.</p>
        <button class="btn btn-maroon" onclick="openAuthModal('login')">Sign In / Register</button>
      </div>
    `;
    return;
  }

  const name = currentBuyerProfile.full_name || "Cultural Patron";
  const phone = currentBuyerProfile.phone || "";

  container.innerHTML = `
    <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid var(--border-light);">
      <div style="width: 72px; height: 72px; background: var(--primary-maroon); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; margin: 0 auto 12px;">
        ${name.charAt(0).toUpperCase()}
      </div>
      <h2>${escapeHtml(name)}</h2>
      <p style="color: var(--text-muted); font-size: 13px;">${escapeHtml(phone)}</p>
      <span class="badge badge-gold" style="margin-top: 8px;">Role: Buyer / Patron</span>
    </div>
    <div style="padding: 20px 0;">
      <h4 style="margin-bottom: 10px;">Default Delivery Address</h4>
      <p style="font-size: 13px; color: var(--text-charcoal); background: var(--canvas-cream); padding: 12px; border-radius: 10px;">
        ${escapeHtml(currentBuyerProfile.address || 'Craft Nagar, Lane 4, Bhubaneswar, Odisha')}<br>
        PIN: ${escapeHtml(currentBuyerProfile.pincode || '751024')}
      </p>
    </div>
    <button class="btn btn-outline btn-block" onclick="handleLogout()">Sign Out</button>
  `;
}

// =============================================================================
// CART & UTILITIES
// =============================================================================
window.addToCart = function(product) {
  cartState.push(product);
  updateCartUI();
  showToast(`Added "${product.title}" to bag!`);
  closeModal('productModal');
};

function updateCartUI() {
  const badge = document.getElementById('cartCountBadge');
  if (badge) badge.textContent = cartState.length;
}

window.openCartModal = function() {
  const list = document.getElementById('cartItemsList');
  const footer = document.getElementById('cartFooter');
  if (!list || !footer) return;

  if (cartState.length === 0) {
    list.innerHTML = `<p style="text-align: center; padding: 30px; color: var(--text-muted);">Your shopping bag is empty.</p>`;
    footer.innerHTML = '';
  } else {
    list.innerHTML = cartState.map((p, idx) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-light);">
        <div>
          <strong>${escapeHtml(p.title)}</strong><br>
          <small class="text-maroon">₹${p.price}</small>
        </div>
        <button class="btn-icon" onclick="removeCartItem(${idx})"><i class="ph ph-trash text-danger"></i></button>
      </div>
    `).join('');

    const total = cartState.reduce((sum, item) => sum + Number(item.price || 0), 0);
    footer.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin: 16px 0; font-size: 16px; font-weight: 800;">
        <span>Total:</span>
        <span class="text-maroon">₹${total}</span>
      </div>
      <button class="btn btn-maroon btn-block" onclick="checkoutFromCart()">Proceed to Checkout</button>
    `;
  }

  openModal('cartModal');
};

window.removeCartItem = function(idx) {
  cartState.splice(idx, 1);
  updateCartUI();
  openCartModal();
};

window.checkoutFromCart = function() {
  closeModal('cartModal');
  if (cartState.length > 0) {
    requireAuthForPurchase(cartState[0]);
  }
};

window.switchBuyerTab = function(tabName) {
  document.querySelectorAll('.desktop-nav-links .nav-link-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.mobile-nav-bar .mobile-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
};

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}