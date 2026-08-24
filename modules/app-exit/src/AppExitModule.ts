import { NativeModule, requireNativeModule } from 'expo';

declare class AppExitModule extends NativeModule<{
  exitApp(): void;
}> {}

export default requireNativeModule<AppExitModule>('AppExit');
