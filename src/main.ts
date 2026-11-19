import './style.css';
import { createMathRng } from './domain/rng';
import { AvailabilityTracker } from './infra/availability';
import { systemClock } from './infra/clock';
import { NameStore, type KeyValueStorage } from './infra/name-store';
import { createRankingClient } from './infra/ranking-client';
import { RegistrationController } from './infra/registration';
import { AppController } from './ui/app-controller';

/** localStorage が使えない環境(プライベートモード等)では null を返す。 */
function getStorage(): KeyValueStorage | null {
  try {
    const s = window.localStorage;
    const probe = '__machi_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function bootstrap(): void {
  const root = document.getElementById('app');
  if (!root) return;

  // AvailabilityTracker と RegistrationController は AppController より先に作るため、遅延束縛にする。
  let controller: AppController | null = null;

  const rankingClient = createRankingClient();
  const nameStore = new NameStore(getStorage());
  const availability = new AvailabilityTracker(rankingClient, (a) => controller?.onAvailabilityChange(a));
  const registration = new RegistrationController(rankingClient, nameStore, (s) =>
    controller?.onRegistrationStatus(s),
  );

  controller = new AppController({
    root,
    clock: systemClock,
    rng: createMathRng(),
    nameStore,
    rankingClient,
    availability,
    registration,
  });
  controller.start();
}

bootstrap();
