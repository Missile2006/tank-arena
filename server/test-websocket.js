
import { WebSocket } from 'ws';

const URL = 'ws://127.0.0.1:3000/ws';

function testConnection(name, action) {
  return new Promise((resolve) => {
    const socket = new WebSocket(URL);
    let finished = false;

    const timeout = setTimeout(() => {
      console.log(`${name}: timeout`);
      socket.terminate();
      finish();
    }, 7000);

    function finish() {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve();
    }

    socket.on('open', () => {
      action(socket);
    });

    socket.on('close', (code, reason) => {
      console.log(
        `${name}: closed with code ${code}, reason: ${reason}`,
      );
      finish();
    });

    socket.on('error', (error) => {
      console.log(`${name}: ${error.message}`);
      finish();
    });
  });
}

async function runTests() {
  // Тест 1: неправильний JSON
  await testConnection('Invalid JSON', (socket) => {
    socket.send('{invalid json');
  });

  // Тест 2: невідомий тип повідомлення
  await testConnection('Unknown type', (socket) => {
    socket.send(JSON.stringify({
      type: 'unknown',
    }));
  });

  // Тест 3: завелике повідомлення
  await testConnection('Oversized message', (socket) => {
    socket.send('A'.repeat(5000));
  });

  
  // Тест 4: перевищення ліміту після входу в кімнату
  await testConnection('Rate limit', (socket) => {
    socket.send(JSON.stringify({
      type: 'join',
      roomId: 'arena-classic',
      playerName: 'RateLimitTest',
    }));

    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());

      if (message.type === 'joined') {
        // Надсилаємо 30 повідомлень за короткий час
        for (let i = 0; i < 30; i++) {
          socket.send(JSON.stringify({
            type: 'chat',
            text: `Message ${i}`,
          }));
        }
      }
    });
  });


  console.log('\nWebSocket tests finished');
}

runTests();
