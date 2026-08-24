Pod::Spec.new do |s|
  s.name           = 'AppExit'
  s.version        = '1.0.0'
  s.summary        = 'Force-quit Relaxo after kicking off a native install'
  s.description    = 'Tiny Expo module that terminates the process so a new binary can replace it cleanly.'
  s.author         = 'Relaxo'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
