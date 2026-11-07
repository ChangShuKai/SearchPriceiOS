import { useSyncExternalStore } from 'react';

import { getSyncState, subscribeSync } from '@/lib/sync';

export function useSyncState() {
  return useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
}
