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
    const ratingRes = await fetch(`/users/${userId}/rating`, { headers });
    if (ratingRes.ok) {
      const ratingData = await ratingRes.json();
      if (ratingData.average_rating) {
        document.getElementById('statsRating').textContent = ratingData.average_rating.toFixed(1);
        document.getElementById('statsRatingCount').textContent = `(${ratingData.total_ratings})`;
      } else {
        document.getElementById('statsRating').textContent = 'N/A';
      }
    }
  } catch (err) {
    console.error('Load stats error:', err);
  }
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
        servicesList.innerHTML = services.map(service => {
          const price = (service.price_qz_halves / 2).toFixed(1);
          return `
            <div class="service-card" onclick="window.location.href='/detalle-servicio?id=${service.id}'" style="cursor:pointer;">
              <div class="service-image" style="background-image: url('${service.image_url || ''}'); background-size: cover; background-position: center; height: 150px; border-radius: 8px 8px 0 0;"></div>
              <div class="service-content" style="padding: 12px;">
                <h3 style="font-size: 16px; margin-bottom: 8px;">${service.title}</h3>
                <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 12px;">${(service.description || '').substring(0, 100)}...</p>
                <div class="service-meta" style="display: flex; justify-content: space-between; align-items: center;">
                  <span class="service-price" style="font-weight: 700; color: var(--primary); font-size: 18px;">${price} QZ</span>
                  <span class="service-category" style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 8px; font-size: 12px; text-transform: capitalize;">${service.category}</span>
                </div>
              </div>
            </div>
          `;
        }).join('');
        document.getElementById('servicesSection').style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Load services error:', err);
  }
}

// Event listeners
if (contactBtn) {
  contactBtn.addEventListener('click', () => {
    // TODO: Implementar sistema de mensajería
    alert('Sistema de mensajería próximamente');
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
