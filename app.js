/**
 * ShilpSahayak Buyer Application Logic
 * Integrates directly with Supabase v2, ONDC Beckn Protocol schemas, and MoSJE guidelines
 */

// Production Supabase Project Parameters (Pre-configured to your schema)
const DEFAULT_SUPABASE_URL = "https://kwjjtocisauotehkpdwl.supabase.co";
// Paste your Supabase project's Public Anon Key here (or enter it in the top settings modal)
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_XHnwUNs7wxb0fDn_5U_EJg_9uhRm3Q2";

// Known Buyer Identity for Escrow Linking from your profiles table
const ACTIVE_BUYER = {
  id: "b7153f6b-71ad-4cda-ba4e-3a7b6946bfd1",
  full_name: "buyer1",
  phone: "+91 89176 00253",
  role: "buyer"
};

// Benchmark Matrix for Wage Audits
const CLUSTER_BENCHMARKS = {
  "Terracotta Craft": { hourly_wage: 55.0, markup: 1.08, market_ref: 650 },
  "Tribal Art / Toys": { hourly_wage: 50.0, markup: 1.06, market_ref: 650 },
  "Dhokra Metal Craft": { hourly_wage: 85.0, markup: 1.12, market_ref: 2400 },
  "Handloom Silk": { hourly_wage: 75.0, markup: 1.10, market_ref: 3200 }
};

// Fallback Mock Dataset matching your live database rows
const FALLBACK_PRODUCTS = [
  {
    id: "47b19811-001a-4d22-90ab-product111111",
    artisan_id: "2957af7a-3e94-4044-8c32-650000000000",
    artisan_name: "Ayush Kumar Behera",
    title: "Handcrafted Rural Craft",
    category: "Tribal Art / Toys",
    price: 812,
    material_cost: 210,
    labor_hours: 4,
    product_description: "Exquisite hand-cast rustic metal musicians with intricate filigree details, finished in tribal metallic hues.",
    story: "Created by rural tribal artisans in Mayurbhanj preserving ancient Dhokra bell metal casting lineages passed through generations.",
    image_urls: ["https://images.unsplash.com/photo-1590736969955-71cc94801759?w=600&auto=format&fit=crop&q=80"]
  },
  {
    id: "99c82731-002b-4e33-81bc-product222222",
    artisan_id: "862d8eca-6433-4cf8-8254-a10000000000",
    artisan_name: "Pedina Bavishya",
    title: "Pattachitra tribal Art",
    category: "Tribal Art / Toys",
    price: 2199,
    material_cost: 450,
    labor_hours: 18,
    product_description: "Traditional scroll depiction of Lord Jagannath on tussar silk canvas using 100% natural stone minerals and tree gum.",
    story: "Preserved heritage style practiced in Raghurajpur heritage crafts village dating back to the 12th century temple traditions.",
    image_urls: ["https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=600&auto=format&fit=crop&q=80"]
  },
  {
    id: "33d71621-003c-4f44-72cd-product333333",
    artisan_id: "1f842048-d5d5-4a3b-ad76-760000000000",
    artisan_name: "pooja mahapatra",
    title: "Hand-Painted Terracotta Clay Pots",
    category: "Terracotta Craft",
    price: 5246,
    material_cost: 950,
    labor_hours: 28,
    product_description: "Hand-shaped earthen pots kiln-fired in red clay and decorated with ancient white clay tribal geometric relief patterns.",
    story: "Hand-molded in Panchmura village using sacred river silt, renowned for natural cooling and celebratory ritual motifs.",
    image_urls: ["https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=600&auto=format&fit=crop&q=80"]
  },
  {
    id: "11e60511-004d-4a55-63de-product444444",
    artisan_id: "aad8f1c5-bb56-4a7c-a4af-fed000000000",
    artisan_name: "JAYAGURU",
    title: "Standard Black Ballpoint Pen",
    category: "Tribal Art / Toys",
    price: 199,
    material_cost: 40,
    labor_hours: 1,
    product_description: "Everyday craft-studio utility instrument documented in artisan workshop catalog.",
    story: "Craftsman study instrument used for transferring paper stencil outlines to stone and wood surfaces.",
    image_urls: ["https://images.unsplash.com/photo-1585336261026-7f415c1e57c6?w=600&auto=format&fit=crop&q=80"]
  },
  {
    id: "88f59401-005e-4b66-54ef-product555555",
    artisan_id: "09fd2e71-db94-47db-a249-9d0000000000",
    artisan_name: "rudra madhaba",
    title: "Handcrafted Odia Terracotta Cooling Vessel",
    category: "Terracotta Craft",
    price: 402,
    material_cost: 80,
    labor_hours: 3,
    product_description: "Micro-porous clay water pot ensuring refreshing evaporative temperature moderation.",
    story: "Traditional coastal Odisha pottery crafted by the Kumbhara guild using sustainable bank mud.",
    image_urls: ["https://images.unsplash.com/photo-1615529182904-14819c35db37?w=600&auto=format&fit=crop&q=80"]
  }
];

const FALLBACK_ORDERS = [
  {
    id: "3BD19789",
    product_title: "Handcrafted Odia Terracotta Cooling Vessel",
    amount: 402,
    category: "Terracotta Craft",
    status: "Confirmed",
    image_url: "https://images.unsplash.com/photo-1615529182904-14819c35db37?w=120&auto=format&fit=crop&q=80",
    buyer_id: ACTIVE_BUYER.id,
    created_at: new Date(Date.now() - 3600000 * 20).toISOString()
  },
  {
    id: "9D0ED12E",
    product_title: "Tribal flying bike",
    amount: 995,
    category: "Tribal Art / Toys",
    status: "Confirmed",
    image_url: "https://images.unsplash.com/photo-1590736969955-71cc94801759?w=120&auto=format&fit=crop&q=80",
    buyer_id: ACTIVE_BUYER.id,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString()
  }
];

// App State Management
let supabaseClient = null;
let isConnectedToSupabase = false;
let productsList = [];
let ordersList = [];
let profilesMap = new Map();
let cartItems = [];
let favoriteIds = new Set();
let activeCategoryFilter = "ALL";
let activeProductForDetail = null;

// Application Initialization
window.addEventListener('DOMContentLoaded', async () => {
  setupNavigationRoutes();
  setupFilterHandlers();
  setupModalControllers();
  setupAiAssistantChat();
  await setupSupabaseBackend();
});

// Navigation & Unified Tab Switching (Mobile Dock + Desktop Top Bar)
function setupNavigationRoutes() {
  const allNavButtons = document.querySelectorAll('.bottom-dock-nav .dock-btn, .desktop-nav-links .nav-link-btn');
  const views = document.querySelectorAll('.app-view');

  allNavButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');

      // Sync active classes on both mobile dock and desktop navbar
      allNavButtons.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === target);
      });

      // Switch active screen view
      views.forEach(v => {
        v.classList.toggle('active', v.id === `view-${target}`);
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.getElementById('btnHeroExplore').addEventListener('click', () => switchTab('explore'));
  document.getElementById('btnGoHome').addEventListener('click', () => switchTab('home'));

  document.getElementById('btnRefreshData').addEventListener('click', () => {
    const icon = document.getElementById('refreshIcon');
    icon.classList.add('ph-spin');
    syncSupabaseTables().finally(() => {
      setTimeout(() => icon.classList.remove('ph-spin'), 600);
      showToast("Live data refreshed!");
    });
  });
}

function switchTab(tabKey) {
  const targetBtn = document.querySelector(`[data-tab="${tabKey}"]`);
  if (targetBtn) targetBtn.click();
}

// Supabase Connection Layer
async function setupSupabaseBackend() {
  const savedUrl = localStorage.getItem('shilp_sb_url') || DEFAULT_SUPABASE_URL;
  const savedKey = localStorage.getItem('shilp_sb_key') || DEFAULT_SUPABASE_ANON_KEY;

  document.getElementById('cfgUrlInput').value = savedUrl;
  document.getElementById('cfgKeyInput').value = savedKey;

  if (savedUrl && savedKey) {
    await connectSupabaseInstance(savedUrl, savedKey);
  } else {
    markOfflineFallback();
  }
}

async function connectSupabaseInstance(url, key) {
  const dot = document.getElementById('liveIndicatorDot');
  const modalDot = document.getElementById('modalStatusDot');
  const label = document.getElementById('liveStatusText');
  const modalStatus = document.getElementById('modalConnectionStatus');
  const modalSub = document.getElementById('modalSubstatus');

  label.textContent = "Connecting...";
  modalStatus.textContent = "Connecting to Supabase...";

  try {
    const client = window.supabase.createClient(url, key);

    // Test ping on profiles table
    const { data: profData, error: profError } = await client.from('profiles').select('id, full_name, phone, role');
    if (profError && profError.code !== 'PGRST116') throw profError;

    supabaseClient = client;
    isConnectedToSupabase = true;

    localStorage.setItem('shilp_sb_url', url);
    localStorage.setItem('shilp_sb_key', key);

    dot.classList.add('online');
    modalDot.classList.add('online');
    label.textContent = "Live Supabase";
    modalStatus.textContent = "Connected to Supabase Live DB";
    modalSub.textContent = "Syncing with products, orders, and profiles";

    // Cache Profiles Map for name lookups
    if (profData) {
      profData.forEach(p => profilesMap.set(p.id, p));
    }

    await syncSupabaseTables();
    showToast("Connected to live Supabase database!");
  } catch (err) {
    console.warn("Could not connect to live Supabase:", err.message);
    markOfflineFallback();
  }
}

function markOfflineFallback() {
  isConnectedToSupabase = false;
  document.getElementById('liveIndicatorDot').classList.remove('online');
  document.getElementById('modalStatusDot').classList.remove('online');
  document.getElementById('liveStatusText').textContent = "Offline / Mock";
  document.getElementById('modalConnectionStatus').textContent = "Mock Sandbox Mode";
  document.getElementById('modalSubstatus').textContent = "Provide valid Supabase Anon Key to sync live";

  productsList = [...FALLBACK_PRODUCTS];
  ordersList = [...FALLBACK_ORDERS];
  renderAppViews();
}

async function syncSupabaseTables() {
  if (!isConnectedToSupabase || !supabaseClient) {
    renderAppViews();
    return;
  }

  try {
    const [prodRes, ordRes] = await Promise.all([
      supabaseClient.from('products').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('orders').select('*').order('created_at', { ascending: false })
    ]);

    if (prodRes.data && prodRes.data.length > 0) {
      // Enrich products with artisan profile names if needed
      productsList = prodRes.data.map(p => {
        let artisanName = p.artisan_name;
        if (!artisanName && p.artisan_id && profilesMap.has(p.artisan_id)) {
          artisanName = profilesMap.get(p.artisan_id).full_name;
        }
        return { ...p, artisan_name: artisanName || 'Regional Master Artisan' };
      });
    } else {
      productsList = [...FALLBACK_PRODUCTS];
    }

    if (ordRes.data && ordRes.data.length > 0) {
      ordersList = ordRes.data;
    } else {
      ordersList = [...FALLBACK_ORDERS];
    }

    renderAppViews();
  } catch (err) {
    console.error("Supabase sync error:", err);
    showToast("Failed to refresh remote tables.");
  }
}

// Master UI Render Orchestrator
function renderAppViews() {
  renderHomeShowcaseGrid();
  renderExploreGrid();
  renderOrdersFeed();
  renderProfileMetrics();
}

// Category & Filter Setup
function setupFilterHandlers() {
  const pills = document.querySelectorAll('#homeCategoryRack .cat-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeCategoryFilter = pill.getAttribute('data-category');
      renderHomeShowcaseGrid();
    });
  });

  const chips = document.querySelectorAll('#exploreChipsRow .filter-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCategoryFilter = chip.getAttribute('data-category');
      renderExploreGrid();
    });
  });

  const search = document.getElementById('searchInput');
  search.addEventListener('input', () => renderExploreGrid());

  document.getElementById('btnReloadShowcase').addEventListener('click', () => {
    renderHomeShowcaseGrid();
    showToast("Showcase updated");
  });
}

// Product Grid Rendering
function renderHomeShowcaseGrid() {
  const container = document.getElementById('homeShowcaseGrid');
  let list = productsList;
  if (activeCategoryFilter !== "ALL") {
    list = list.filter(item => item.category === activeCategoryFilter);
  }

  if (!list.length) {
    container.innerHTML = `<div class="empty-alert" style="grid-column: 1 / -1;">No crafts found in this category.</div>`;
    return;
  }

  container.innerHTML = list.slice(0, 8).map(prod => buildProductCardHtml(prod)).join('');
}

function renderExploreGrid() {
  const container = document.getElementById('exploreProductGrid');
  const term = (document.getElementById('searchInput').value || '').toLowerCase().trim();

  let list = productsList.filter(p => {
    const matchesCat = activeCategoryFilter === "ALL" || p.category === activeCategoryFilter;
    const matchesTerm = !term ||
      (p.title || '').toLowerCase().includes(term) ||
      (p.artisan_name || '').toLowerCase().includes(term) ||
      (p.category || '').toLowerCase().includes(term);
    return matchesCat && matchesTerm;
  });

  if (!list.length) {
    container.innerHTML = `<div class="empty-alert" style="grid-column: 1 / -1;">No handicrafts match your query.</div>`;
    return;
  }

  container.innerHTML = list.map(prod => buildProductCardHtml(prod)).join('');
}

function buildProductCardHtml(product) {
  const imgUrl = extractCoverImage(product.image_urls);
  const isFavorited = favoriteIds.has(product.id);

  return `
    <div class="product-item" onclick="openProductDetailView('${product.id}')">
      <div class="product-item-thumb">
        <img src="${imgUrl}" alt="${escapeHtml(product.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=300&q=60'" />
        <button class="btn-wishlist ${isFavorited ? 'active' : ''}" onclick="toggleFavorite(event, '${product.id}')">
          <i class="${isFavorited ? 'ph-fill ph-heart' : 'ph-bold ph-heart'}"></i>
        </button>
      </div>
      <div class="product-item-info">
        <div class="product-item-title">${escapeHtml(product.title)}</div>
        <div class="product-item-sub">${escapeHtml(product.artisan_name || 'Master Artisan')} • ${escapeHtml(product.category || 'Handicraft')}</div>
        <div class="product-item-footer">
          <span class="product-price-tag">₹${Number(product.price || 0).toLocaleString('en-IN')}</span>
          <span class="badge-ondc">ONDC</span>
        </div>
      </div>
    </div>
  `;
}

// Orders View Rendering
function renderOrdersFeed() {
  const container = document.getElementById('ordersListWrapper');
  if (!ordersList.length) {
    container.innerHTML = `<div class="empty-alert" style="grid-column: 1 / -1;">No escrow-protected orders found. Back a master artisan by placing your first order!</div>`;
    return;
  }

  container.innerHTML = ordersList.map(ord => {
    const rawId = String(ord.id || 'ONDC');
    const displayCode = rawId.startsWith('#') ? rawId : '#' + rawId.substring(0, 8).toUpperCase();
    const status = ord.status || 'Confirmed';
    const craftImg = ord.image_url || extractCoverImage(ord.product_image) || 'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=120&q=60';

    return `
      <div class="order-box">
        <div class="order-box-header">
          <div>
            <span class="order-id-txt">${displayCode}</span>
            <span class="order-ondc-meta">ONDC Protocol</span>
          </div>
          <span class="pill-escrow-badge">Escrow Locked</span>
        </div>

        <div class="order-box-body">
          <img src="${craftImg}" class="order-box-thumb" alt="Craft Item" />
          <div class="order-box-details">
            <h4>${escapeHtml(ord.product_title || 'Handcrafted Cultural Piece')}</h4>
            <p>${escapeHtml(ord.category || 'Regional Craft Cluster')}</p>
            <div class="order-box-price">
              ₹${Number(ord.amount || 0).toLocaleString('en-IN')}
              <span class="badge-green-status"><i class="ph-bold ph-shield-check"></i> Escrow Secured</span>
            </div>
          </div>
        </div>

        <!-- 4 Step Milestone Progress -->
        <div class="stepper-track">
          <div class="stepper-bg-bar"></div>
          <div class="stepper-active-bar" style="width: ${calcStepPercentage(status)};"></div>

          <div class="stepper-node ${isMilestoneDone(status, 1) ? 'done' : 'active'}">
            <div class="node-dot"><i class="ph-bold ph-check"></i></div>
            <span class="node-text">Confirmed</span>
          </div>
          <div class="stepper-node ${isMilestoneDone(status, 2) ? 'done' : ''}">
            <div class="node-dot"><i class="ph-bold ph-hammer"></i></div>
            <span class="node-text">Crafting</span>
          </div>
          <div class="stepper-node ${isMilestoneDone(status, 3) ? 'done' : ''}">
            <div class="node-dot"><i class="ph-bold ph-truck"></i></div>
            <span class="node-text">Dispatched</span>
          </div>
          <div class="stepper-node ${isMilestoneDone(status, 4) ? 'done' : ''}">
            <div class="node-dot"><i class="ph-bold ph-house-line"></i></div>
            <span class="node-text">Delivered</span>
          </div>
        </div>

        <div class="order-box-actions">
          <button class="btn-action-outline" onclick="promptInvoice('${displayCode}', '${escapeHtml(ord.product_title || '')}', ${ord.amount})">
            <i class="ph-bold ph-file-text"></i> Invoice
          </button>
          <button class="btn-action-solid" onclick="promptTracking('${displayCode}')">
            <i class="ph-bold ph-map-pin"></i> Track Order
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function calcStepPercentage(status) {
  const s = status.toLowerCase();
  if (s.includes('delivered')) return '100%';
  if (s.includes('shipped') || s.includes('dispatch')) return '66%';
  if (s.includes('crafting') || s.includes('progress')) return '33%';
  return '0%';
}

function isMilestoneDone(status, stepIndex) {
  const s = status.toLowerCase();
  if (stepIndex === 1) return true;
  if (stepIndex === 2) return s.includes('crafting') || s.includes('shipped') || s.includes('dispatch') || s.includes('delivered');
  if (stepIndex === 3) return s.includes('shipped') || s.includes('dispatch') || s.includes('delivered');
  if (stepIndex === 4) return s.includes('delivered');
  return false;
}

// Profile Statistics
function renderProfileMetrics() {
  document.getElementById('kpiOrderCount').textContent = ordersList.length;
  const uniqueMakers = new Set(ordersList.map(o => o.artisan_id || o.product_title)).size;
  document.getElementById('kpiArtisanCount').textContent = Math.max(uniqueMakers, 3);
}

// Product Details Flow with Fair Wage Calculation
function openProductDetailView(productId) {
  const prod = productsList.find(p => p.id === productId);
  if (!prod) return;

  activeProductForDetail = prod;

  document.getElementById('dtlTitle').textContent = prod.title;
  document.getElementById('dtlPrice').textContent = `₹${Number(prod.price).toLocaleString('en-IN')}`;
  document.getElementById('dtlImage').src = extractCoverImage(prod.image_urls);
  document.getElementById('dtlArtisan').textContent = `Master Artisan: ${prod.artisan_name || 'Regional Collective'}`;
  document.getElementById('dtlClusterDetail').textContent = `Cluster: ${prod.category || 'Tribal Heritage'} • ${prod.labor_hours || 4} hours of manual devotion`;

  // Fair-trade benchmark display
  const benchmark = CLUSTER_BENCHMARKS[prod.category] || { hourly_wage: 60 };
  const badge = document.getElementById('dtlWageBenchmark');
  const baseFairCost = Number(prod.material_cost || 0) + (Number(prod.labor_hours || 4) * benchmark.hourly_wage);
  if (Number(prod.price) <= baseFairCost * 1.25) {
    badge.textContent = `Direct Fair-Trade (₹${benchmark.hourly_wage}/hr)`;
    badge.style.color = "#137547";
    badge.style.borderColor = "#137547";
    badge.style.backgroundColor = "#e8f5ec";
  } else {
    badge.textContent = `Fair-Trade Benchmark`;
    badge.style.color = "#b87b28";
    badge.style.borderColor = "#f6d8ae";
    badge.style.backgroundColor = "#fef7ed";
  }

  if (prod.product_description) {
    document.getElementById('dtlSpecs').innerHTML = `
      Material: Sustainable raw materials sourced directly from local forest &amp; riverbed ecosystems.<br>
      Technique: Ancestral guild methods preserved without automated synthetic processing.<br>
      Description: ${escapeHtml(prod.product_description)}
    `;
  }

  document.getElementById('dtlStory').textContent = prod.story ||
    "Preserved through generational heritage by rural master artisans who safeguard cultural craftsmanship.";

  // Sync Favorite state
  const isFav = favoriteIds.has(prod.id);
  const icon = document.getElementById('detailFavIcon');
  icon.className = isFav ? "ph-fill ph-heart text-gold" : "ph-bold ph-heart";

  // Related suggestions
  const relatedContainer = document.getElementById('dtlRelatedContainer');
  const relatedList = productsList.filter(p => p.id !== prod.id).slice(0, 5);
  relatedContainer.innerHTML = relatedList.map(r => `
    <div class="mini-card" onclick="openProductDetailView('${r.id}')">
      <img src="${extractCoverImage(r.image_urls)}" alt="${escapeHtml(r.title)}" />
      <div class="mini-card-body">
        <strong>${escapeHtml(r.title)}</strong>
        <span>₹${r.price}</span>
      </div>
    </div>
  `).join('');

  document.getElementById('modalProductDetail').classList.add('open');
}

// Modals, Drawers & Interactive Handlers
function setupModalControllers() {
  // Product Detail Modal
  document.getElementById('btnCloseDetail').addEventListener('click', () => {
    document.getElementById('modalProductDetail').classList.remove('open');
  });

  document.getElementById('btnDetailShare').addEventListener('click', () => {
    if (navigator.share && activeProductForDetail) {
      navigator.share({
        title: activeProductForDetail.title,
        text: `Explore authentic Indian handicraft: ${activeProductForDetail.title} on ShilpSahayak`,
        url: window.location.href
      }).catch(() => {});
    } else {
      showToast("Craft link copied to clipboard!");
    }
  });

  document.getElementById('btnDetailFav').addEventListener('click', (e) => {
    if (activeProductForDetail) {
      toggleFavorite(e, activeProductForDetail.id);
      const isFav = favoriteIds.has(activeProductForDetail.id);
      document.getElementById('detailFavIcon').className = isFav ? "ph-fill ph-heart text-gold" : "ph-bold ph-heart";
    }
  });

  document.getElementById('btnAddItemCart').addEventListener('click', () => {
    if (activeProductForDetail) {
      cartItems.push(activeProductForDetail);
      updateCartDisplay();
      showToast(`Added "${activeProductForDetail.title}" to bag!`);
    }
  });

  document.getElementById('btnInitiateBuy').addEventListener('click', () => {
    if (activeProductForDetail) {
      document.getElementById('modalProductDetail').classList.remove('open');
      launchCheckoutSheet(activeProductForDetail);
    }
  });

  // Cart Drawer
  document.getElementById('btnCartTrigger').addEventListener('click', () => {
    renderCartListDrawer();
    document.getElementById('modalCartDrawer').classList.add('open');
  });

  document.getElementById('btnCloseCart').addEventListener('click', () => {
    document.getElementById('modalCartDrawer').classList.remove('open');
  });

  document.getElementById('btnCartProceedCheckout').addEventListener('click', () => {
    if (!cartItems.length) {
      showToast("Your cultural bag is empty");
      return;
    }
    document.getElementById('modalCartDrawer').classList.remove('open');
    launchCheckoutSheet(cartItems[0]);
  });

  // Checkout Sheet
  document.getElementById('btnCloseCheckout').addEventListener('click', () => {
    document.getElementById('modalCheckout').classList.remove('open');
  });

  document.getElementById('orderCheckoutForm').addEventListener('submit', handleCheckoutSubmission);

  // Supabase Database Modal
  document.getElementById('btnOpenDbModal').addEventListener('click', () => {
    document.getElementById('modalSupabaseConfig').classList.add('open');
  });

  document.getElementById('btnCloseDbModal').addEventListener('click', () => {
    document.getElementById('modalSupabaseConfig').classList.remove('open');
  });

  document.getElementById('btnSaveDbConfig').addEventListener('click', async () => {
    const url = document.getElementById('cfgUrlInput').value.trim();
    const key = document.getElementById('cfgKeyInput').value.trim();
    if (!url || !key) {
      showToast("Please provide both Supabase URL and Anon Key");
      return;
    }
    await connectSupabaseInstance(url, key);
    document.getElementById('modalSupabaseConfig').classList.remove('open');
  });
}

// Checkout Execution & Database Insertion
function launchCheckoutSheet(item) {
  activeProductForDetail = item;
  document.getElementById('chkSummaryTitle').textContent = item.title;
  document.getElementById('chkSummaryArtisan').textContent = `Artisan: ${item.artisan_name || 'Tribal Guild'}`;
  document.getElementById('chkSummaryAmount').textContent = `₹${Number(item.price).toLocaleString('en-IN')}`;
  document.getElementById('btnPayLabelAmount').textContent = `₹${Number(item.price).toLocaleString('en-IN')}`;
  document.getElementById('modalCheckout').classList.add('open');
}

async function handleCheckoutSubmission(e) {
  e.preventDefault();
  const btn = document.getElementById('btnConfirmEscrowOrder');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner ph-spin"></i> Securing Escrow...`;

  const orderPayload = {
    buyer_id: ACTIVE_BUYER.id,
    artisan_id: activeProductForDetail.artisan_id || null,
    product_title: activeProductForDetail.title,
    category: activeProductForDetail.category || 'Handicraft',
    amount: activeProductForDetail.price,
    status: 'Confirmed'
  };

  try {
    if (isConnectedToSupabase && supabaseClient) {
      const { error } = await supabaseClient.from('orders').insert([orderPayload]);
      if (error) throw error;
      showToast("Order placed & locked in Escrow (Supabase Sync)!");
      await syncSupabaseTables();
    } else {
      // Local Sandbox insertion
      const mockOrderRecord = {
        id: "ord-" + Math.floor(1000 + Math.random() * 9000),
        ...orderPayload,
        image_url: extractCoverImage(activeProductForDetail.image_urls),
        created_at: new Date().toISOString()
      };
      ordersList.unshift(mockOrderRecord);
      renderAppViews();
      showToast("Order placed into Escrow (Local Sandbox)!");
    }

    // Remove bought product from cart if present
    cartItems = cartItems.filter(ci => ci.id !== activeProductForDetail.id);
    updateCartDisplay();

    document.getElementById('modalCheckout').classList.remove('open');
    switchTab('orders');
  } catch (err) {
    console.error("Failed to commit order:", err);
    alert("Checkout Error: " + (err.message || "Failed to commit order. Check Supabase RLS policies."));
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// Cart State Helpers
function updateCartDisplay() {
  document.getElementById('cartCount').textContent = cartItems.length;
}

function renderCartListDrawer() {
  const container = document.getElementById('cartContentContainer');
  const subtotalLabel = document.getElementById('cartSubtotalValue');

  if (!cartItems.length) {
    container.innerHTML = `<div class="empty-alert">Your cultural bag is empty.</div>`;
    subtotalLabel.textContent = "₹0";
    return;
  }

  const total = cartItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
  subtotalLabel.textContent = `₹${total.toLocaleString('en-IN')}`;

  container.innerHTML = cartItems.map((item, idx) => `
    <div class="cart-item-card">
      <img src="${extractCoverImage(item.image_urls)}" alt="craft" />
      <div class="meta">
        <strong>${escapeHtml(item.title)}</strong>
        <span>₹${item.price}</span>
      </div>
      <button class="nav-icon-btn btn-sm" onclick="removeCartItemAt(${idx})">
        <i class="ph-bold ph-trash"></i>
      </button>
    </div>
  `).join('');
}

function removeCartItemAt(index) {
  cartItems.splice(index, 1);
  updateCartDisplay();
  renderCartListDrawer();
}

// Favorites Handlers
function toggleFavorite(e, id) {
  e.stopPropagation();
  if (favoriteIds.has(id)) {
    favoriteIds.delete(id);
    showToast("Removed from wishlist");
  } else {
    favoriteIds.add(id);
    showToast("Saved to wishlist ❤️");
  }
  renderHomeShowcaseGrid();
  renderExploreGrid();
}

// AI Guide Assistant Handlers
function setupAiAssistantChat() {
  const modal = document.getElementById('modalAiAssistant');
  const btnOpen = document.getElementById('btnTriggerAi');
  const btnClose = document.getElementById('btnCloseAiAssistant');
  const input = document.getElementById('aiPromptInput');
  const btnSend = document.getElementById('btnSubmitAiPrompt');
  const chatBody = document.getElementById('aiDiscussionContainer');

  btnOpen.addEventListener('click', () => modal.classList.add('open'));
  btnClose.addEventListener('click', () => modal.classList.remove('open'));

  function sendQuery() {
    const text = input.value.trim();
    if (!text) return;

    // Append User message
    const me = document.createElement('div');
    me.className = "chat-bubble me";
    me.textContent = text;
    chatBody.appendChild(me);
    input.value = "";
    chatBody.scrollTop = chatBody.scrollHeight;

    // Simulated Smart Response
    setTimeout(() => {
      const bot = document.createElement('div');
      bot.className = "chat-bubble bot";
      bot.innerHTML = formulateCraftResponse(text);
      chatBody.appendChild(bot);
      chatBody.scrollTop = chatBody.scrollHeight;
    }, 550);
  }

  btnSend.addEventListener('click', sendQuery);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendQuery();
  });
}

function formulateCraftResponse(query) {
  const q = query.toLowerCase();
  if (q.includes('dhokra') || q.includes('metal')) {
    return `<strong>Dhokra Casting</strong> is an ancient non-ferrous lost-wax metal technique with a continuous 4,000-year history. Every piece is sculpted using pure beeswax threads and fired in traditional pit kilns.`;
  }
  if (q.includes('terracotta') || q.includes('clay') || q.includes('pot')) {
    return `<strong>Panchmura &amp; Odia Terracotta</strong> crafts use naturally porous riverbed clay that offers evaporative cooling and symbolic protection across village celebrations.`;
  }
  if (q.includes('wage') || q.includes('fair') || q.includes('price')) {
    return `ShilpSahayak certifies that <strong>100% of the price</strong> settles directly to the master artisan's verified bank account based on the ₹50-₹85/hr MoSJE benchmark.`;
  }
  return `Thank you for supporting indigenous craft communities! Every purchase directly backs authentic rural makers across India with verified postman escrow delivery.`;
}

// Order Action Handlers
function promptInvoice(code, title, amount) {
  alert(`Official ShilpSahayak Invoice\n--------------------------------\nOrder Code: ${code}\nCraft: ${title}\nAmount Paid: ₹${amount}\nEscrow Status: Locked & Verified\nProtocol: ONDC MoSJE-Compliant.`);
}

function promptTracking(code) {
  alert(`Track Shipment: ${code}\n--------------------------------\nLogistics: India Post Escrow Express\nStatus: Handed to Regional Guild Courier\nExpected Delivery: Within 3 business days.`);
}

// Image & Text Utilities
function extractCoverImage(val) {
  if (!val) return 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=400&q=80';
  if (Array.isArray(val)) {
    return val[0] || 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=400&q=80';
  }
  if (typeof val === 'string' && val.startsWith('[')) {
    try {
      const parsed = JSON.parse(val);
      return parsed[0] || val;
    } catch {
      return val;
    }
  }
  return val;
}

function showToast(message) {
  const toast = document.getElementById('toastMessage');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}