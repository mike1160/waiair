Pod::Spec.new do |s|
  s.name           = 'WalletPass'
  s.version        = '1.0.0'
  s.summary        = 'Apple Wallet for WaiAir: PKAddPassButton and the add-pass sheet'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'WaiAir'
  s.homepage       = 'https://waiair.app'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PassKit'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
