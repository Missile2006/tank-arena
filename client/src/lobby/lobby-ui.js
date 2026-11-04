
export function createLobbyUI(lobby) {
  const container = document.createElement('div');
  container.id = 'gameLobby';

  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(11, 16, 32, 0.96)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '1000',
    fontFamily: 'Arial, sans-serif',
  });

  const panel = document.createElement('div');

  Object.assign(panel.style, {
    background: '#1f2937',
    color: '#ffffff',
    padding: '35px',
    borderRadius: '15px',
    width: '380px',
    maxWidth: '90vw',
    boxSizing: 'border-box',
    textAlign: 'center',
    border: '2px solid #22c55e',
  });

  const title = document.createElement('h1');
  title.textContent = 'TANK ARENA';
  title.style.color = '#4ade80';

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Multiplayer Game Lobby';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Enter player name';
  nameInput.maxLength = 20;

  const roomSelect = document.createElement('select');

  const joinButton = document.createElement('button');
  joinButton.textContent = 'JOIN GAME';
  joinButton.disabled = true;

  const status = document.createElement('p');
  status.textContent = 'Loading rooms...';

  for (const element of [nameInput, roomSelect, joinButton]) {
    Object.assign(element.style, {
      width: '100%',
      padding: '12px',
      marginTop: '15px',
      borderRadius: '7px',
      boxSizing: 'border-box',
      fontSize: '16px',
    });
  }

  Object.assign(joinButton.style, {
    background: '#22c55e',
    color: '#052e16',
    border: 'none',
    fontWeight: 'bold',
    cursor: 'pointer',
  });

  panel.append(
    title,
    subtitle,
    nameInput,
    roomSelect,
    joinButton,
    status,
  );

  container.appendChild(panel);
  document.body.appendChild(container);

  // Оновлення списку кімнат
  lobby.addEventListener('roomsUpdated', (event) => {
    const rooms = event.detail.rooms;

    roomSelect.replaceChildren();

    for (const room of rooms) {
      const option = document.createElement('option');

      option.value = room.id;
      option.textContent =
        `${room.name} (${room.players}/${room.maxPlayers}) — ` +
        `${room.config.asteroidCount} asteroids`;

      option.disabled = room.players >= room.maxPlayers;

      roomSelect.appendChild(option);
    }

    const firstAvailable = [...roomSelect.options].find(
      (option) => !option.disabled,
    );

    if (firstAvailable) {
      roomSelect.value = firstAvailable.value;
    }

    joinButton.disabled = !firstAvailable;
    status.textContent = `${rooms.length} rooms available`;
  });

  // Повідомлення про помилки завантаження
  lobby.addEventListener('error', (event) => {
    status.textContent = `Error: ${event.detail.message}`;
    joinButton.disabled = true;
  });

  // Натискання Join
  joinButton.addEventListener('click', () => {
    try {
      lobby.join(nameInput.value, roomSelect.value);
    } catch (error) {
      status.textContent = error.message;
    }
  });

  return {
    show() {
      container.style.display = 'flex';
      lobby.show();
    },

    hide() {
      container.style.display = 'none';
      lobby.hide();
    },
  };
}
