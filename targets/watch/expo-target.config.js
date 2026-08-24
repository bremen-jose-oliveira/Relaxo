/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'watch',
  name: 'RelaxoWatch',
  displayName: 'Relaxo',
  // Local file so apple-targets generates a watchOS AppIcon (1024 universal).
  icon: './icon.png',
  colors: {
    $accent: '#6B7FBF',
  },
  deploymentTarget: '10.0',
  bundleIdentifier: '.watch',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.joseoliv.relaxo'],
  },
});
