// Perfil: vista y edición del perfil del usuario

const profileView = document.getElementById('profileView');
const profileEdit = document.getElementById('profileEdit');
const editForm = document.getElementById('editForm');
const passwordForm = document.getElementById('passwordForm');
const notificationPreferencesForm = document.getElementById('notificationPreferencesForm');
const privacySettingsForm = document.getElementById('privacySettingsForm');
const editProfileBtn = document.getElementById('editProfileBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const logoutBtn = document.getElementById('logoutBtn');
const roleBadge = document.getElementById('roleBadge');
const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
const avatarInput = document.getElementById('avatarInput');
const addSkillBtn = document.getElementById('addSkillBtn');
const skillInput = document.getElementById('skillInput');

let currentUser = null;
let currentSkills = [];

// Mostrar mensaje
function showMessage(elementId, text, type = 'info') {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  el.textContent = text;
  el.style.display = 'block';
  el.style.background = type === 'error' ? 'var(--danger-light)' : 'var(--success-light)';
  el.style.color = type === 'error' ? 'var(--danger)' : 'var(--success)';
  
  setTimeout(() => {
    el.style.display = 'none';
  }, 5000);
}

// Cargar datos del usuario
async function loadProfile() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/vistas/login.html';
      return;
    }

    const res = await fetch('/users/me', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.clear();
        window.location.href = '/vistas/login.html';
        return;
      }
      throw new Error('Error al cargar perfil');
    }

    currentUser = await res.json();
    renderProfile(currentUser);
    await loadStats();
  } catch (err) {
    console.error('Load profile error:', err);
    showMessage('editMessage', 'No se pudo cargar el perfil', 'error');
  }
}

// Renderizar perfil
function renderProfile(user) {
  // Nombre y email
  document.getElementById('profileName').textContent = user.full_name || 'Sin nombre';
  document.getElementById('profileEmail').querySelector('span').textContent = user.email || '-';

  // Avatar (iniciales o imagen)
  const initials = (user.full_name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const avatarEl = document.getElementById('profileAvatar');
  if (user.avatar) {
    avatarEl.innerHTML = `<img src="${user.avatar}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
  } else {
    avatarEl.innerHTML = `<div style="font-size:48px;font-weight:700;color:var(--primary);">${initials}</div>`;
  }

  // Verified badge
  const verifiedBadge = document.getElementById('verifiedBadge');
  if (user.is_verified) {
    verifiedBadge.style.display = 'flex';
  }

  // Role badge
  const roleLabels = {
    visitor: 'Visitante',
    consumer: 'Cliente',
    provider: 'Proveedor',
    both: 'Cliente y Proveedor',
    admin: 'Administrador'
  };
  const roleColors = {
    visitor: 'var(--text-tertiary)',
    consumer: 'var(--info)',
    provider: 'var(--success)',
    both: 'var(--primary)',
    admin: 'var(--danger)'
  };
  const userRole = user.user_type || 'visitor';
  document.getElementById('profileRole').textContent = roleLabels[userRole] || userRole;
  document.getElementById('profileRole').style.background = roleColors[userRole] || 'var(--bg-secondary)';
  
  if (roleBadge) {
    roleBadge.textContent = roleLabels[userRole] || userRole;
    roleBadge.style.background = roleColors[userRole] || 'var(--bg-secondary)';
  }

  // Teléfono
  const phoneEl = document.getElementById('profilePhone');
  if (user.phone) {
    phoneEl.querySelector('span').textContent = user.phone;
    phoneEl.style.display = 'inline-block';
  }

  // Ciudad
  const cityEl = document.getElementById('profileCity');
  if (user.city) {
    cityEl.querySelector('span').textContent = user.city;
    cityEl.style.display = 'inline-block';
  }

  // Bio
  const bioContainer = document.getElementById('profileBioContainer');
  if (user.bio) {
    document.getElementById('profileBio').textContent = user.bio;
    bioContainer.style.display = 'block';
  }

  // Website
  const websiteContainer = document.getElementById('profileWebsiteContainer');
  if (user.website) {
    document.getElementById('profileWebsite').href = user.website;
    document.getElementById('profileWebsite').textContent = user.website;
    websiteContainer.style.display = 'block';
  }

  // Social Links
  const socialLinksContainer = document.getElementById('profileSocialLinks');
  let hasSocialLinks = false;
  if (user.linkedin) {
    document.getElementById('linkedinLink').href = user.linkedin;
    document.getElementById('linkedinLink').style.display = 'inline-flex';
    hasSocialLinks = true;
  }
  if (user.github) {
    document.getElementById('githubLink').href = user.github;
    document.getElementById('githubLink').style.display = 'inline-flex';
    hasSocialLinks = true;
  }
  if (user.twitter) {
    document.getElementById('twitterLink').href = user.twitter;
    document.getElementById('twitterLink').style.display = 'inline-flex';
    hasSocialLinks = true;
  }
  if (user.portfolio) {
    document.getElementById('portfolioLink').href = user.portfolio;
    document.getElementById('portfolioLink').style.display = 'inline-flex';
    hasSocialLinks = true;
  }
  if (hasSocialLinks) {
    socialLinksContainer.style.display = 'block';
  }
}

// Cargar estadísticas
async function loadStats() {
  try {
    const token = localStorage.getItem('token');
    
    // Obtener servicios
    const servicesRes = await fetch('/services', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    if (servicesRes.ok) {
      const services = await servicesRes.json();
      const servicesCount = Array.isArray(services) ? services.length : 0;
      document.getElementById('statsServices').textContent = servicesCount;
      
      // Sumar vistas totales
      const totalViews = Array.isArray(services) ? services.reduce((sum, s) => sum + (s.views_count || 0), 0) : 0;
      document.getElementById('statsViews').textContent = totalViews;
    }

    // Obtener contratos completados
    const contractsRes = await fetch('/contracts', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    if (contractsRes.ok) {
      const contracts = await contractsRes.json();
      const completed = Array.isArray(contracts) ? contracts.filter(c => c.status === 'completed').length : 0;
      document.getElementById('statsContracts').textContent = completed;
    }

    // Rating (obtener de endpoint cuando esté implementado)
    const ratingRes = await fetch('/users/me/rating', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    if (ratingRes.ok) {
      const ratingData = await ratingRes.json();
      if (ratingData.average_rating) {
        document.getElementById('statsRating').textContent = ratingData.average_rating.toFixed(1);
        document.getElementById('statsRatingCount').textContent = `(${ratingData.total_ratings})`;
      } else {
        document.getElementById('statsRating').textContent = 'N/A';
        document.getElementById('statsRatingCount').textContent = '';
      }
    } else {
      document.getElementById('statsRating').textContent = 'N/A';
    }
  } catch (err) {
    console.error('Load stats error:', err);
  }
}

// Cargar skills
async function loadSkills() {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/users/me/skills', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (res.ok) {
      const skills = await res.json();
      currentSkills = Array.isArray(skills) ? skills : [];
      renderSkills();
    }
  } catch (err) {
    console.error('Load skills error:', err);
  }
}

// Renderizar skills en vista
function renderSkills() {
  const skillsList = document.getElementById('skillsList');
  const skillsSection = document.getElementById('skillsSection');
  
  if (currentSkills.length > 0 && (currentUser.user_type === 'provider' || currentUser.user_type === 'both')) {
    skillsList.innerHTML = currentSkills.map(skill => 
      `<span class="badge" style="background: var(--primary); color: white; padding: 6px 12px; border-radius: 16px;">
        ${skill.skill_name}
      </span>`
    ).join('');
    skillsSection.style.display = 'block';
  } else {
    skillsSection.style.display = 'none';
  }
}

// Renderizar skills en edición
function renderEditSkills() {
  const skillsEditList = document.getElementById('skillsEditList');
  skillsEditList.innerHTML = currentSkills.map(skill => 
    `<span class="badge" style="background: var(--primary); color: white; padding: 6px 12px; border-radius: 16px; display: flex; align-items: center; gap: 8px;">
      ${skill.skill_name}
      <button type="button" onclick="removeSkill('${skill.id}')" style="background: none; border: none; color: white; cursor: pointer; padding: 0; font-size: 16px;">
        <i class="fas fa-times"></i>
      </button>
    </span>`
  ).join('');
}

// Agregar skill
async function addSkill() {
  const skillName = skillInput.value.trim();
  if (!skillName) return;

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/users/me/skills', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ skill_name: skillName })
    });

    if (res.ok) {
      const newSkill = await res.json();
      currentSkills.push(newSkill);
      renderEditSkills();
      skillInput.value = '';
    } else {
      const error = await res.json();
      showMessage('editMessage', error.error || 'No se pudo agregar la habilidad', 'error');
    }
  } catch (err) {
    showMessage('editMessage', 'Error al agregar habilidad', 'error');
  }
}

// Eliminar skill
window.removeSkill = async function(skillId) {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`/users/me/skills/${skillId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      currentSkills = currentSkills.filter(s => s.id !== skillId);
      renderEditSkills();
      renderSkills();
    }
  } catch (err) {
    console.error('Remove skill error:', err);
  }
};

// Mostrar formulario de edición
function showEditForm() {
  if (!currentUser) return;

  // Llenar formulario con datos actuales
  document.getElementById('edit_full_name').value = currentUser.full_name || '';
  document.getElementById('edit_user_type').value = currentUser.user_type || 'consumer';
  document.getElementById('edit_phone').value = currentUser.phone || '';
  document.getElementById('edit_city').value = currentUser.city || '';
  document.getElementById('edit_bio').value = currentUser.bio || '';
  document.getElementById('edit_website').value = currentUser.website || '';
  document.getElementById('edit_linkedin').value = currentUser.linkedin || '';
  document.getElementById('edit_github').value = currentUser.github || '';
  document.getElementById('edit_twitter').value = currentUser.twitter || '';
  document.getElementById('edit_portfolio').value = currentUser.portfolio || '';

  // Mostrar sección de skills solo para proveedores
  const userType = document.getElementById('edit_user_type').value;
  const skillsEditSection = document.getElementById('skillsEditSection');
  if (userType === 'provider' || userType === 'both') {
    skillsEditSection.style.display = 'block';
    renderEditSkills();
  } else {
    skillsEditSection.style.display = 'none';
  }

  // Listener para cambio de user_type
  document.getElementById('edit_user_type').addEventListener('change', (e) => {
    if (e.target.value === 'provider' || e.target.value === 'both') {
      skillsEditSection.style.display = 'block';
      renderEditSkills();
    } else {
      skillsEditSection.style.display = 'none';
    }
  });

  profileView.style.display = 'none';
  profileEdit.style.display = 'block';
}

// Cancelar edición
function cancelEdit() {
  profileView.style.display = 'block';
  profileEdit.style.display = 'none';
}

// Guardar cambios del perfil
editForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fullName = document.getElementById('edit_full_name').value.trim();
  const userType = document.getElementById('edit_user_type').value;
  const phone = document.getElementById('edit_phone').value.trim();
  const city = document.getElementById('edit_city').value.trim();
  const bio = document.getElementById('edit_bio').value.trim();
  const website = document.getElementById('edit_website').value.trim();
  const linkedin = document.getElementById('edit_linkedin').value.trim();
  const github = document.getElementById('edit_github').value.trim();
  const twitter = document.getElementById('edit_twitter').value.trim();
  const portfolio = document.getElementById('edit_portfolio').value.trim();

  if (!fullName || fullName.length < 3) {
    showMessage('editMessage', 'El nombre debe tener al menos 3 caracteres', 'error');
    return;
  }

  // Validar URLs
  const urlFields = [
    { value: website, name: 'Sitio Web' },
    { value: linkedin, name: 'LinkedIn' },
    { value: github, name: 'GitHub' },
    { value: twitter, name: 'Twitter' },
    { value: portfolio, name: 'Portfolio' }
  ];

  for (const field of urlFields) {
    if (field.value && !field.value.startsWith('http')) {
      showMessage('editMessage', `${field.name} debe comenzar con http:// o https://`, 'error');
      return;
    }
  }

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/users/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        full_name: fullName,
        user_type: userType,
        phone: phone || null,
        city: city || null,
        bio: bio || null,
        website: website || null,
        linkedin: linkedin || null,
        github: github || null,
        twitter: twitter || null,
        portfolio: portfolio || null
      })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Error al actualizar perfil');
    }

    const updated = await res.json();
    currentUser = updated;
    renderProfile(updated);
    await loadSkills();
    cancelEdit();
    showMessage('editMessage', '¡Perfil actualizado correctamente!', 'success');
  } catch (err) {
    showMessage('editMessage', err.message || 'No se pudo actualizar el perfil', 'error');
  }
});

// Cambiar contraseña
passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const currentPassword = document.getElementById('current_password').value;
  const newPassword = document.getElementById('new_password').value;
  const confirmPassword = document.getElementById('confirm_password').value;

  if (newPassword !== confirmPassword) {
    showMessage('passwordMessage', 'Las contraseñas no coinciden', 'error');
    return;
  }

  if (newPassword.length < 8) {
    showMessage('passwordMessage', 'La nueva contraseña debe tener al menos 8 caracteres', 'error');
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/users/me/password', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword
      })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Error al cambiar contraseña');
    }

    showMessage('passwordMessage', '¡Contraseña actualizada correctamente!', 'success');
    passwordForm.reset();
  } catch (err) {
    showMessage('passwordMessage', err.message || 'No se pudo cambiar la contraseña', 'error');
  }
});

// Avatar upload
if (uploadAvatarBtn) {
  uploadAvatarBtn.addEventListener('click', () => {
    avatarInput.click();
  });
}

if (avatarInput) {
  avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tamaño (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no debe superar 2MB');
      return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/users/me/avatar', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al subir avatar');
      }

      const updated = await res.json();
      currentUser.avatar = updated.avatar;
      renderProfile(currentUser);
      alert('Avatar actualizado correctamente');
    } catch (err) {
      alert(err.message || 'No se pudo actualizar el avatar');
    }
  });
}

// Skills
if (addSkillBtn) {
  addSkillBtn.addEventListener('click', addSkill);
}

if (skillInput) {
  skillInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  });
}

// Notification preferences
if (notificationPreferencesForm) {
  notificationPreferencesForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const preferences = {
      email_transactions: document.getElementById('pref_email_transactions').checked,
      email_messages: document.getElementById('pref_email_messages').checked,
      email_services: document.getElementById('pref_email_services').checked,
      email_marketing: document.getElementById('pref_email_marketing').checked,
      push_enabled: document.getElementById('pref_push_enabled').checked
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/users/me/notification-preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(preferences)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al guardar preferencias');
      }

      showMessage('notificationMessage', '¡Preferencias guardadas correctamente!', 'success');
    } catch (err) {
      showMessage('notificationMessage', err.message || 'No se pudieron guardar las preferencias', 'error');
    }
  });
}

// Privacy settings
if (privacySettingsForm) {
  privacySettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const settings = {
      show_email: document.getElementById('privacy_show_email').checked,
      show_phone: document.getElementById('privacy_show_phone').checked,
      public_profile: document.getElementById('privacy_public_profile').checked
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/users/me/privacy-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al guardar configuración');
      }

      showMessage('privacyMessage', '¡Configuración guardada correctamente!', 'success');
    } catch (err) {
      showMessage('privacyMessage', err.message || 'No se pudo guardar la configuración', 'error');
    }
  });
}

// Load preferences and settings
async function loadPreferences() {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/users/me/notification-preferences', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      const prefs = await res.json();
      document.getElementById('pref_email_transactions').checked = prefs.email_transactions ?? true;
      document.getElementById('pref_email_messages').checked = prefs.email_messages ?? true;
      document.getElementById('pref_email_services').checked = prefs.email_services ?? false;
      document.getElementById('pref_email_marketing').checked = prefs.email_marketing ?? false;
      document.getElementById('pref_push_enabled').checked = prefs.push_enabled ?? true;
    }
  } catch (err) {
    console.error('Load preferences error:', err);
  }
}

async function loadPrivacySettings() {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/users/me/privacy-settings', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      const settings = await res.json();
      document.getElementById('privacy_show_email').checked = settings.show_email ?? false;
      document.getElementById('privacy_show_phone').checked = settings.show_phone ?? false;
      document.getElementById('privacy_public_profile').checked = settings.public_profile ?? true;
    }
  } catch (err) {
    console.error('Load privacy settings error:', err);
  }
}

// Event listeners
if (editProfileBtn) editProfileBtn.addEventListener('click', showEditForm);
if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '/vistas/login.html';
  });
}

// Inicializar
loadProfile();
loadSkills();
loadPreferences();
loadPrivacySettings();
