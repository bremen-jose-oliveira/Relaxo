/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'watch-widget',
  name: 'RelaxoWatchWidget',
  displayName: 'Relaxo Sleep',
  // Do NOT set `icon` here: apple-targets generates an iPhone AppIcon for
  // non-`watch` types, which breaks the watchOS widget build
  // ("AppIcon did not have any applicable content").
  colors: {
    $accent: '#6B7FBF',
    $widgetBackground: '#0A122E',
  },
  deploymentTarget: '10.0',
  // Must be under the Watch app ID (Apple requires prefix com…relaxo.watch.).
  bundleIdentifier: '.watch.widget',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.joseoliv.relaxo'],
  },
});
