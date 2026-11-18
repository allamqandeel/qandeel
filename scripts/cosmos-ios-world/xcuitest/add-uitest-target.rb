# COSMOS-INT-01 Slice E (PO, 2026-11-18): add ONE native UI-test target to the generated (CNG) iOS project, after
# `prebuild` and `pod install`, in this ephemeral checkout only. Nothing in the repository's app changes.
#
# The target `QandeelWorldUITests` holds CosmosWorldGestureUITests.swift. Its shared scheme of the same name builds the
# app and the tests together, so ONE `xcodebuild build-for-testing` yields both the app (installed for the Maestro
# World gate) and the test runner (run by `test-without-building`): no second build of the app.
#
# UITESTS_ONLY=1: the target does not depend on the app and its scheme builds the tests alone, so a pass whose app is
# unchanged rebuilds only the test runner and reuses an app built earlier (copied into the products directory).
#
# usage: [UITESTS_ONLY=1] ruby add-uitest-target.rb <apps/mobile/ios> <CosmosWorldGestureUITests.swift>
require 'fileutils'
require 'xcodeproj'

ios_dir, swift = ARGV
abort 'usage: add-uitest-target.rb <ios dir> <swift file>' if ios_dir.nil? || swift.nil?
project_path = Dir.glob(File.join(ios_dir, '*.xcodeproj')).reject { |p| p.include?('Pods') }.first
abort "no .xcodeproj in #{ios_dir}" if project_path.nil?
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |t| t.product_type == 'com.apple.product-type.application' }
abort 'no application target' if app.nil?

name = 'QandeelWorldUITests'
tests_only = ENV['UITESTS_ONLY'] == '1'
abort "#{name} already exists" if project.targets.any? { |t| t.name == name }
deployment = app.build_configurations.map { |c| c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] }.compact.first || '15.1'

dir = File.join(ios_dir, name)
FileUtils.mkdir_p(dir)
FileUtils.cp(swift, File.join(dir, File.basename(swift)))

target = project.new_target(:ui_test_bundle, name, :ios, deployment, nil, :swift)
group = project.main_group.new_group(name, name)
target.add_file_references([group.new_reference(File.basename(swift))])
target.add_dependency(app) unless tests_only
target.build_configurations.each do |config|
  s = config.build_settings
  s['TEST_TARGET_NAME'] = app.name
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.qandeel.mobile.worlduitests'
  s['PRODUCT_NAME'] = name
  s['SWIFT_VERSION'] = '5.0'
  s['GENERATE_INFOPLIST_FILE'] = 'YES'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = deployment
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  s['CODE_SIGN_STYLE'] = 'Manual'
  s['DEVELOPMENT_TEAM'] = ''
end
project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app) unless tests_only
scheme.add_test_target(target)
scheme.set_launch_target(app)
scheme.save_as(project_path, name, true)
puts "#{name}#{tests_only ? ' (tests only)' : ''}: added to #{File.basename(project_path)} (app target #{app.name}, iOS #{deployment}); shared scheme #{name}"
