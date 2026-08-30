import WidgetBridgeModule from './src/WidgetBridgeModule';

export type WidgetBridgePayload = {
  accessToken: string;
  /** Used by widget intents to renew accessToken when expired. */
  refreshToken?: string;
  supabaseUrl: string;
  supabaseKey: string;
  householdId: string;
  babyId: string;
};

export type WidgetPendingAction = {
  id: string;
  source: string;
  target: string;
  at: number;
  sleepEventId?: string | null;
};

export function setWidgetBridge(payload: WidgetBridgePayload | null): void {
  if (!WidgetBridgeModule) return;
  WidgetBridgeModule.setBridge(payload ? JSON.stringify(payload) : null);
}

export function setWatchSnapshot(json: string | null): void {
  if (!WidgetBridgeModule) return;
  WidgetBridgeModule.setWatchSnapshot(json);
}

export { addWatchActionListener } from './src/WidgetBridgeModule';

export function getWidgetPendingActions(): WidgetPendingAction[] {
  if (!WidgetBridgeModule) return [];
  try {
    const raw = WidgetBridgeModule.getPendingActionsJson();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WidgetPendingAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearWidgetPendingActions(ids?: string[]): void {
  if (!WidgetBridgeModule) return;
  WidgetBridgeModule.clearPendingActions(ids ? JSON.stringify(ids) : null);
}

export default WidgetBridgeModule;
