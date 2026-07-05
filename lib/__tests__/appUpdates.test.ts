import {
  getAppVersionInfo,
  getBuildPageUrl,
  getExpoBuildsUrl,
  getExpoProjectMeta,
  getIosItmsInstallUrl,
  getLatestPreviewBuildForPlatform,
} from '../appUpdates';

describe('appUpdates', () => {
  it('builds expo project builds url from config', () => {
    expect(getExpoBuildsUrl()).toContain('expo.dev/accounts/');
    expect(getExpoBuildsUrl()).toContain('/projects/relaxo/builds');
  });

  it('returns version info shape', () => {
    const info = getAppVersionInfo();
    expect(info).toHaveProperty('appVersion');
    expect(info).toHaveProperty('updatesSupported');
  });

  it('builds iOS itms install url like the EAS QR code', () => {
    const { projectId } = getExpoProjectMeta();
    const url = getIosItmsInstallUrl(projectId, 'abc-123');
    expect(url).toContain('itms-services://');
    expect(url).toContain(encodeURIComponent(`projects/${projectId}/builds/abc-123/manifest.plist`));
  });

  it('builds a direct build page url', () => {
    expect(getBuildPageUrl('abc-123')).toContain('/builds/abc-123');
  });

  it('reads synced preview build metadata', () => {
    const ios = getLatestPreviewBuildForPlatform('ios');
    expect(ios?.buildId).toBeTruthy();
  });
});
