
export function createChatUI(gameSocket) {
  const container = document.createElement('div');
  container.id = 'gameChat';

  Object.assign(container.style, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    width: '280px',
    maxWidth: 'calc(100vw - 32px)',
    boxSizing: 'border-box',
    background: '#1f2937',
    border: '2px solid #22c55e',
    borderRadius: '10px',
    padding: '12px',
    color: '#ffffff',
    fontFamily: 'Arial, sans-serif',
    zIndex: '1000',
    display: 'none',
  });

  const title = document.createElement('h3');
  title.textContent = 'ROOM CHAT';
  title.style.margin = '0 0 10px';
  title.style.color = '#22c55e';
  
  const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.textContent = '−';
    toggleButton.title = 'Згорнути чат';

    Object.assign(toggleButton.style, {
        position: 'absolute',
        top: '8px',
        right: '10px',
        background: 'transparent',
        border: 'none',
        color: '#22c55e',
        fontSize: '24px',
        cursor: 'pointer',
    });

  const messages = document.createElement('div');

  Object.assign(messages.style, {
    height: '180px',
    overflowY: 'auto',
    background: '#111827',
    padding: '8px',
    borderRadius: '6px',
    marginBottom: '10px',
    fontSize: '13px',
  });

  const form = document.createElement('form');
  form.style.display = 'flex';
  form.style.gap = '6px';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type a message...';
  input.maxLength = 500;
  input.required = true;

  Object.assign(input.style, {
    flex: '1',
    minWidth: '0',
    padding: '8px',
    borderRadius: '5px',
    border: 'none',
  });

  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = 'Send';

  Object.assign(button.style, {
    padding: '8px 12px',
    background: '#22c55e',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
  });

  form.append(input, button);
  container.append(title, toggleButton, messages, form);

  let collapsed = false;

  toggleButton.addEventListener('click', () => {
  collapsed = !collapsed;

  messages.style.display = collapsed ? 'none' : 'block';
  form.style.display = collapsed ? 'none' : 'flex';

  toggleButton.textContent = collapsed ? '+' : '−';
  toggleButton.title = collapsed
      ? 'Розгорнути чат'
      : 'Згорнути чат';
  });

  document.body.appendChild(container);

  function addMessage(playerName, text) {
    const message = document.createElement('div');
    message.style.marginBottom = '6px';

    // textContent захищає від виконання HTML у чаті
    message.textContent = `${playerName}: ${text}`;

    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const text = input.value.trim();

    if (!text) {
      return;
    }

    gameSocket.send({
      type: 'chat',
      text,
    });

    input.value = '';
  });

  return {
    show() {
      container.style.display = 'block';
    },

    hide() {
      container.style.display = 'none';
    },

    addMessage,

    clear() {
      messages.replaceChildren();
    },
  };
}
