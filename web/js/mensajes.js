// Mensajes: chat en tiempo real con Socket.IO
import { API } from './api.js';
import { AppState } from './state.js';

const conversationsList = document.getElementById('conversationsList');
const conversationsMessage = document.getElementById('conversationsMessage');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const chatHeader = document.getElementById('chatHeader');
const chatTitle = document.getElementById('chatTitle');
const chatInputArea = document.getElementById('chatInputArea');
const selectConversationMessage = document.getElementById('selectConversationMessage');

let currentConversationId = null;
let socket = null;

// Inicializar Socket.IO
function initSocket() {
 if (!AppState.token) return;

  // Conectar al WebSocket
  socket = io('/', {
    auth: { token: AppState.token },
    transports: ['websocket'] // fuerza WebSocket puro
  });

  socket.on('connect', () => {
    console.log('Conectado al chat');
  });

  socket.on('new_message', (msg) => {
  if (msg.conversation_id === currentConversationId) {
    appendMessage(msg); 
  }
});

  socket.on('message_sent', (data) => {
    // Opcional: confirmación visual
  });

  socket.on('error', (err) => {
    alert('Error en el chat: ' + err.message);
  });

  socket.on('disconnect', () => {
    console.log('Desconectado del chat');
  });

  socket.on('conversation_updated', (update) => {
  // Actualizar la conversación en la lista
  const convItem = document.querySelector(`[data-conversation-id="${update.conversationId}"]`);
  if (convItem) {
    // Actualizar el preview y la hora
    const previewEl = convItem.querySelector('.helper');
    const timeEl = convItem.querySelector('div[style*="text-align:right"]');
    if (previewEl) {
      previewEl.textContent = update.lastMessagePreview;
    }
    if (timeEl) {
      timeEl.textContent = new Date(update.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }
});
}

function showMessage(el, text, type = 'info') {
  el.textContent = text;
  el.style.display = 'block';
  el.className = `helper ${type === 'error' ? 'error' : ''}`;
}

function renderConversationItem(conv) {
  const isUser1 = conv.user1_id === currentUserId;
  const otherUser = {
    id: isUser1 ? conv.user2_id : conv.user1_id,
    name: isUser1 ? conv.user2_name : conv.user1_name,
    avatar: isUser1 ? conv.user2_avatar : conv.user1_avatar
  };

  const container = document.createElement('div');
  container.className = 'card';
  container.style.marginBottom = '8px';
  container.style.cursor = 'pointer';
  container.setAttribute('data-conversation-id', conv.id);
  container.onclick = () => openConversation(conv.id, otherUser.name);
  container.setAttribute('data-conversation-id', conv.id);

  const content = document.createElement('div');
  content.style.padding = '12px';
  content.style.display = 'flex';
  content.style.alignItems = 'center';
  content.style.gap = '12px';

  const avatar = otherUser.avatar 
    ? `<img src="${otherUser.avatar}" alt="Avatar" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" />`
    : `<div style="width:40px;height:40px;border-radius:50%;background: var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;">
         ${otherUser.name.charAt(0)}
       </div>`;

  content.innerHTML = `
    ${avatar}
    <div style="flex:1;">
      <div style="font-weight:600;">${otherUser.name}</div>
      <div class="helper" style="font-size:12px;color:var(--text-secondary);">${conv.last_message_preview || 'Ningún mensaje'}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:var(--text-tertiary);">
      ${new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </div>
  `;

  container.appendChild(content);
  return container;
}

async function fetchConversations() {
  conversationsList.innerHTML = '';
  try {
    const data = await API.get('/messaging/conversations');
    if (!Array.isArray(data) || data.length === 0) {
      showMessage(conversationsMessage, 'No tienes conversaciones aún.');
      return;
    }
    const frag = document.createDocumentFragment();
    data.forEach(conv => frag.appendChild(renderConversationItem(conv)));
    conversationsList.appendChild(frag);
  } catch (err) {
    showMessage(conversationsMessage, 'No se pudieron cargar las conversaciones.', 'error');
  }
}

function openConversation(conversationId, title) {
  currentConversationId = conversationId;
  chatTitle.textContent = title;
  chatHeader.style.display = 'block';
  messagesContainer.style.display = 'block';
  chatInputArea.style.display = 'flex';
  selectConversationMessage.style.display = 'none';
  loadMessages(conversationId);
}

async function loadMessages(conversationId) {
  messagesContainer.innerHTML = '';
  try {
    const messages = await API.get(`/messaging/conversations/${conversationId}/messages`);
    if (Array.isArray(messages)) {
      messages.forEach(msg => appendMessage(msg)); // ✅
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  } catch (err) {
    console.error('Error al cargar mensajes:', err);
  }
}

function appendMessage(msg) {
const isSent = msg.sender_id === currentUserId; 

  const msgEl = document.createElement('div');
  msgEl.style.display = 'flex';
  msgEl.style.justifyContent = isSent ? 'flex-end' : 'flex-start'; 
  msgEl.style.marginBottom = '12px';

  const bubble = document.createElement('div');
  bubble.style.maxWidth = '70%';
  bubble.style.padding = '10px 14px';
  bubble.style.borderRadius = '18px';
  bubble.style.wordBreak = 'break-word';
  bubble.style.fontSize = '14px';

  if (isSent) {
    bubble.style.backgroundColor = 'var(--primary)';
    bubble.style.color = 'white';
    bubble.style.borderBottomRightRadius = '4px';
  } else {
    bubble.style.backgroundColor = 'var(--bg-secondary)';
    bubble.style.color = 'var(--text)';
    bubble.style.borderBottomLeftRadius = '4px';
  }

  bubble.textContent = msg.message;
  msgEl.appendChild(bubble);
  messagesContainer.appendChild(msgEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
  const content = messageInput.value.trim();
  if (!content || !currentConversationId) return;

  if (socket && socket.connected) {
    socket.emit('send_message', {
      conversationId: currentConversationId,
      content: content,
      type: 'text'
    });
  }

  // Limpiar input y scroll
  messageInput.value = '';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Event listeners
if (sendMessageBtn) {
  sendMessageBtn.addEventListener('click', sendMessage);
}

if (messageInput) {
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// Logout
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '/vistas/login.html';
  });
}

// Inicializar
let currentUserId = null;

async function initApp() {
  if (!AppState.token) {
    window.location.href = '/vistas/login.html';
    return;
  }
  const token = AppState.token;
  

  // Obtener el ID del usuario logueado
  try {
    const res = await fetch('/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const user = await res.json();
      currentUserId = user.id;
    } else {
      window.location.href = '/vistas/login.html';
      return;
    }
  } catch (err) {
    console.error('Error al obtener perfil:', err);
    window.location.href = '/vistas/login.html';
    return;
  }

  initSocket();
  fetchConversations();

  // Manejo de URL con conversationId (opcional pero útil)
  const urlParams = new URLSearchParams(window.location.search);
  const conversationIdFromUrl = urlParams.get('conversationId');
  if (conversationIdFromUrl) {
    // Puedes cargar la conversación aquí si lo deseas
  }

  // En mensajes.js, dentro de initApp(), después de initSocket()
  if (typeof window.initNotifications === 'function' && socket) {
      window.initNotifications(currentUserId, socket);
  }

// Escuchar notificaciones en tiempo real
  socket.on('new_notification', (notif) => {
    if (typeof window.handleNewNotification === 'function') {
      window.handleNewNotification(notif);
    }
  });
}

initApp();