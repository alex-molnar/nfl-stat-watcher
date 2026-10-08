import { createCollectorServer } from './server.ts';

const server = createCollectorServer();
server.listen(Number(process.env.PORT ?? 9100));

// As PID 1 in a container Node ignores SIGTERM unless told otherwise, which would make every rollout wait for the kill timeout.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close();
    server.closeAllConnections();
  });
}
