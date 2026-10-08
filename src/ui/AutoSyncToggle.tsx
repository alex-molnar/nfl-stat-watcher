import { autoSyncStore } from '../storage/autoSync';
import { useStore } from '../storage/useStore';

/** The "Sync public leagues automatically" setting where it is used. Unlike on the Settings page it applies at once, with no Save. */
export function AutoSyncToggle() {
  const on = useStore(autoSyncStore);
  return (
    <label className="check-row auto-sync-toggle">
      <input type="checkbox" checked={on} onChange={(event) => autoSyncStore.set(event.target.checked)} />
      Sync public leagues automatically
    </label>
  );
}
