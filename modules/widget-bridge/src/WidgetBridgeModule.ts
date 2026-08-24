import { NativeModule, requireNativeModule } from 'expo';
import { Platform } from 'react-native';

type WatchActionEvent = {
  target: string;
  timestamp: number;
  source?: string;
};

type WidgetBridgeNative = NativeModule & {
  setBridge(json: string | null): void;
  setWatchSnapshot(json: string | null): void;
  getPendingActionsJson(): string;
  clearPendingActions(idsJson: string | null): void;
  addListener(eventName: string, listener: (event: WatchActionEvent) => void): { remove: () => void };
  removeListener(eventName: string, listener: (event: WatchActionEvent) => void): void;
};

let native: WidgetBridgeNative | null = null;

if (Platform.OS === 'ios') {
  try {
    native = requireNativeModule<WidgetBridgeNative>('WidgetBridge');
  } catch {
    native = null;
  }
}

export default native;

export function addWatchActionListener(
  listener: (event: WatchActionEvent) => void
): { remove: () => void } {
  if (!native?.addListener) {
    return { remove: () => {} };
  }
  return native.addListener('onWatchAction', listener);
}
