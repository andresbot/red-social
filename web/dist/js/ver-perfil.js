// Ver perfil público de usuario

const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('id');

const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const profileContent = document.getElementById('profileContent');
const logoutBtn = document.getElementById('logoutBtn');
const contactBtn = document.getElementById('contactBtn');
const viewServicesBtn = document.getElementById('viewServicesBtn');

let currentUser = null;
let myUserId = null;

// Obtener mi userId del token
async function getMyUserId() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;

    const res = await fetch('/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      return data.id;
    }
  } catch (err) {
    console.error('Get my user error:', err);
  }
  return null;
}

// Cargar perfil del usuario
async function loadUserProfile() {
  if (!userId) {
    showError('No se especificó un usuario');
    return;
  }

  try {
    myUserId = await getMyUserId();

    // Si es mi propio perfil, redirigir a /perfil
    if (myUserId && userId === myUserId) {
      window.location.href = '/perfil';
      return;
    }

    const token = localStorage.getItem('token');
    const headers = {
      'Accept': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/users/${userId}/profile`, { headers });

    if (!res.ok) {
      if (res.status === 404) {
        showError('Usuario no encontrado');
      } else if (res.status === 403) {
        showError('Este perfil es privado');
      } else {
        showError('No se pudo cargar el perfil');
      }
      return;
    }

    currentUser = await res.json();
    renderProfile(currentUser);
    await loadUserStats();
    await loadUserSkills();
    await loadUserServices();

    loadingState.style.display = 'none';
    profileContent.style.display = 'block';
  } catch (err) {
    console.error('Load profile error:', err);
    showError('Error al cargar el perfil');
  }
}

function showError(message) {
  loadingState.style.display = 'none';
  errorState.style.display = 'block';
  errorMessage.textContent = message;
}

function renderProfile(user) {
  // Nombre
  document.getElementById('userName').textContent = user.full_name || 'Usuario';

  // Email (si la privacidad lo permite)
  const emailEl = document.getElementById('userEmail');
  if (user.show_email && user.email) {
    const emailSpan = emailEl.querySelector('span');
    if (emailSpan) emailSpan.textContent = user.email;
    emailEl.style.display = 'block';
  } else {
    emailEl.style.display = 'none';
  }

  // Avatar
  const initials = (user.full_name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const avatarEl = document.getElementById('userAvatar');
  if (user.avatar) {
    avatarEl.innerHTML = `<img src="${user.avatar}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
  } else {
    avatarEl.innerHTML = `<div style="font-size:48px;font-weight:700;color:var(--primary);">${initials}</div>`;
  }

  // Verified badge
  if (user.is_verified) {
    document.getElementById('verifiedBadge').style.display = 'flex';
  }

  // Role badge
  const roleLabels = {
    consumer: 'Cliente',
    provider: 'Proveedor',
    both: 'Cliente y Proveedor'
  };
  const roleColors = {
    consumer: 'var(--info)',
    provider: 'var(--success)',
    both: 'var(--primary)'
  };
  const userRole = user.user_type || 'consumer';
  document.getElementById('userRole').textContent = roleLabels[userRole] || userRole;
  document.getElementById('userRole').style.background = roleColors[userRole] || 'var(--bg-secondary)';

  // Teléfono (si la privacidad lo permite)
  const phoneEl = document.getElementById('userPhone');
  if (user.show_phone && user.phone) {
    const phoneSpan = phoneEl.querySelector('span');
    if (phoneSpan) phoneSpan.textContent = user.phone;
    phoneEl.style.display = 'inline-block';
  } else {
    phoneEl.style.display = 'none';
  }

  // Ciudad
  const cityEl = document.getElementById('userCity');
  if (user.city) {
    const citySpan = cityEl.querySelector('span');
    if (citySpan) citySpan.textContent = user.city;
    cityEl.style.display = 'inline-block';
  } else {
    cityEl.style.display = 'none';
  }

  // Bio
  const bioEl = document.getElementById('userBio');
  const bioContainer = document.getElementById('userBioContainer');
  if (user.bio && bioEl && bioContainer) {
    bioEl.textContent = user.bio;
    bioContainer.style.display = 'block';
  } else if (bioContainer) {
    bioContainer.style.display = 'none';
  }

  // Website
  const websiteEl = document.getElementById('userWebsite');
  const websiteContainer = document.getElementById('userWebsiteContainer');
  if (user.website && websiteEl && websiteContainer) {
    websiteEl.href = user.website;
    websiteEl.textContent = user.website;
    websiteContainer.style.display = 'block';
  } else if (websiteContainer) {
    websiteContainer.style.display = 'none';
  }

  // Social Links
  const socialLinksContainer = document.getElementById('userSocialLinks');
  let hasSocialLinks = false;
  
  const linkedinLink = document.getElementById('linkedinLink');
  if (user.linkedin && linkedinLink) {
    linkedinLink.href = user.linkedin;
    linkedinLink.style.display = 'inline-flex';
    hasSocialLinks = true;
  } else if (linkedinLink) {
    linkedinLink.style.display = 'none';
  }
  
  const githubLink = document.getElementById('githubLink');
  if (user.github && githubLink) {
    githubLink.href = user.github;
    githubLink.style.display = 'inline-flex';
    hasSocialLinks = true;
  } else if (githubLink) {
    githubLink.style.display = 'none';
  }
  
  const twitterLink = document.getElementById('twitterLink');
  if (user.twitter && twitterLink) {
    twitterLink.href = user.twitter;
    twitterLink.style.display = 'inline-flex';
    hasSocialLinks = true;
  } else if (twitterLink) {
    twitterLink.style.display = 'none';
  }
  
  const portfolioLink = document.getElementById('portfolioLink');
  if (user.portfolio && portfolioLink) {
    portfolioLink.href = user.portfolio;
    portfolioLink.style.display = 'inline-flex';
    hasSocialLinks = true;
  } else if (portfolioLink) {
    portfolioLink.style.display = 'none';
  }
  
  if (socialLinksContainer) {
    socialLinksContainer.style.display = hasSocialLinks ? 'block' : 'none';
  }

  // Botón de ver servicios (solo para proveedores)
  if (viewServicesBtn && (userRole === 'provider' || userRole === 'both')) {
    viewServicesBtn.style.display = 'inline-flex';
  } else if (viewServicesBtn) {
    viewServicesBtn.style.display = 'none';
  }

  // Cargar reseñas realizadas si es consumidor o ambos
  if (userRole === 'consumer' || userRole === 'both') {
    loadUserRatingsGiven();
  }
}

async function loadUserStats() {
  try {
    const token = localStorage.getItem('token');
    const headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Services count
    const servicesRes = await fetch(`/services?user_id=${userId}`, { headers });
    if (servicesRes.ok) {
      const services = await servicesRes.json();
      document.getElementById('statsServices').textContent = Array.isArray(services) ? services.length : 0;
    }

    // Contracts completed
    const contractsRes = await fetch(`/users/${userId}/contracts-stats`, { headers });
    if (contractsRes.ok) {
      const contractsData = await contractsRes.json();
      document.getElementById('statsContracts').textContent = contractsData.total_completed || 0;
    } else {
      document.getElementById('statsContracts').textContent = '0';
    }

    // Rating
    const ratingsAggRes = await fetch(`/ratings/user/${userId}?limit=5&offset=0`, { headers });
    if (ratingsAggRes.ok) {
      const ratingsData = await ratingsAggRes.json();
      const avg = ratingsData.avg ? Number(ratingsData.avg).toFixed(1) : 'N/A';
      const total = ratingsData.total || 0;
      document.getElementById('statsRating').textContent = avg;
      document.getElementById('statsRatingCount').textContent = `(${total})`;
      // Render sección y lista
      renderUserRatings(ratingsData.items || [], avg, total);
    }
  } catch (err) {
    console.error('Load stats error:', err);
  }
}

async function loadUserRatingsGiven() {
  try {
    const token = localStorage.getItem('token');
    const headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/ratings/by-user/${userId}?limit=10&offset=0`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    renderUserRatingsGiven(data.items || [], data.avg ? Number(data.avg).toFixed(1) : 'N/A', data.total || 0);
  } catch (e) {
    // noop
  }
}

function renderUserRatingsGiven(items, avg, total) {
  const section = document.getElementById('ratingsGivenSection');
  const summary = document.getElementById('ratingsGivenSummary');
  const list = document.getElementById('ratingsGivenList');
  if (!section || !summary || !list) return;
  section.style.display = 'block';
  summary.textContent = `Promedio dado: ${avg} (${total} reseñas realizadas)`;
  list.innerHTML = '';

  if (!items || items.length === 0) {
    list.innerHTML = '<div class="helper">Aún no has realizado reseñas.</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach(r => {
    const item = document.createElement('div');
    item.style.borderTop = '1px solid var(--border)';
    item.style.padding = '12px 0';
    const stars = Array.from({ length: 5 }).map((_, i) => `<i class="fas fa-star" style="color:${i < r.rating ? '#f59e0b' : '#cbd5e1'}"></i>`).join(' ');
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;">${stars}<span class="helper">${new Date(r.created_at).toLocaleDateString()}</span></div>
        <a href="/detalle-servicio?id=${r.service_id}" class="helper" style="text-decoration:none;">${r.title || 'Ver servicio'}</a>
      </div>
      ${r.comment ? `<div style="color:var(--text-secondary);margin-top:6px;">${r.comment}</div>` : ''}
    `;
    frag.appendChild(item);
  });
  list.appendChild(frag);
}

function renderUserRatings(items, avg, total) {
  const section = document.getElementById('ratingsSection');
  const summary = document.getElementById('ratingsSummary');
  const list = document.getElementById('ratingsList');
  if (!section || !summary || !list) return;
  section.style.display = 'block';
  summary.textContent = `Promedio: ${avg} (${total} reseñas)`;
  list.innerHTML = '';

  if (!items || items.length === 0) {
    list.innerHTML = '<div class="helper">Aún no hay reseñas para este proveedor.</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach(r => {
    const item = document.createElement('div');
    item.style.borderTop = '1px solid var(--border)';
    item.style.padding = '12px 0';
    const stars = Array.from({ length: 5 }).map((_, i) => `<i class="fas fa-star" style="color:${i < r.rating ? '#f59e0b' : '#cbd5e1'}"></i>`).join(' ');
    item.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;">${stars}<span class="helper">${new Date(r.created_at).toLocaleDateString()}</span></div>
        <a href="/detalle-servicio?id=${r.service_id}" class="helper" style="text-decoration:none;">${r.title || 'Ver servicio'}</a>
      </div>
      ${r.comment ? `<div style="color:var(--text-secondary);margin-top:6px;">${r.comment}</div>` : ''}
    `;
    frag.appendChild(item);
  });
  list.appendChild(frag);
}

async function loadUserSkills() {
  try {
    const token = localStorage.getItem('token');
    const headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/users/${userId}/skills`, { headers });
    if (res.ok) {
      const skills = await res.json();
      if (Array.isArray(skills) && skills.length > 0) {
        const skillsList = document.getElementById('skillsList');
        skillsList.innerHTML = skills.map(skill => 
          `<span class="badge" style="background: var(--primary); color: white; padding: 6px 12px; border-radius: 16px;">
            ${skill.skill_name}
          </span>`
        ).join('');
        document.getElementById('skillsSection').style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Load skills error:', err);
  }
}

async function loadUserServices() {
  try {
    const token = localStorage.getItem('token');
    const headers = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/services?user_id=${userId}`, { headers });
    if (res.ok) {
      const services = await res.json();
      if (Array.isArray(services) && services.length > 0) {
        const servicesList = document.getElementById('servicesList');
        // Render con promedio de rating
        const parts = await Promise.all(services.map(async service => {
          const price = (service.price_qz_halves / 2).toFixed(1);
          let ratingAvg = null;
          let ratingCount = null;
          try {
            const rres = await fetch(`/ratings/service/${service.id}?limit=0`);
            if (rres.ok) {
              const rdata = await rres.json();
              ratingAvg = rdata.avg ? Number(rdata.avg.toFixed(1)) : null;
              ratingCount = rdata.total ?? null;
            }
          } catch {}
          return `
            <div class="service-card" onclick="window.location.href='/detalle-servicio?id=${service.id}'" style="cursor:pointer;">
              <div class="service-image" style="background-image: url('${service.image_url || ''}'); background-size: cover; background-position: center; height: 150px; border-radius: 8px 8px 0 0;"></div>
              <div class="service-content" style="padding: 12px;">
                <h3 style="font-size: 16px; margin-bottom: 8px;">${service.title}</h3>
                <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 12px;">${(service.description || '').substring(0, 100)}...</p>
                ${ratingAvg !== null ? `<div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                  <i class="fas fa-star" style="color:#f59e0b;"></i>
                  <span style="font-size: 13px; color: var(--text-secondary);">${ratingAvg} (${ratingCount} reseñas)</span>
                </div>` : ''}
                <div class="service-meta" style="display: flex; justify-content: space-between; align-items: center;">
                  <span class="service-price" style="font-weight: 700; color: var(--primary); font-size: 18px;">${price} QZ</span>
                  <span class="service-category" style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 8px; font-size: 12px; text-transform: capitalize;">${service.category}</span>
                </div>
              </div>
            </div>
          `;
        }));
        servicesList.innerHTML = parts.join('');
        document.getElementById('servicesSection').style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Load services error:', err);
  }
}

// Event listeners
if (contactBtn) {
  contactBtn.addEventListener('click', async () => {
    if (!myUserId || !userId || myUserId === userId) {
      alert('No puedes contactar a este usuario.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/messaging/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          otherUserId: userId
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'No se pudo iniciar la conversación');
      }

      const { conversationId } = await res.json();
      window.location.href = `/vistas/mensajes.html?conversationId=${conversationId}`;
    } catch (err) {
      console.error('Error al contactar:', err);
      alert('No se pudo iniciar la conversación. Intenta más tarde.');
    }
  });
}

if (viewServicesBtn) {
  viewServicesBtn.addEventListener('click', () => {
    document.getElementById('servicesSection').scrollIntoView({ behavior: 'smooth' });
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '/vistas/login.html';
  });
}

// Inicializar
loadUserProfile();
