Pod::Spec.new do |s|
  s.name           = 'WidgetBridge'
  s.version        = '1.0.0'
  s.summary        = 'App Group bridge for Relaxo widget pending actions'
  s.description    = 'Read/write App Group queue and auth bridge for widget intents'
  s.license        = 'MIT'
  s.author         = 'Relaxo'
  s.homepage       = 'https://github.com/joseoliv/relaxo'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
