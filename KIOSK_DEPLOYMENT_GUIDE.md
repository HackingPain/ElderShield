# SeniorCare Hub - Kiosk Tablet Deployment Guide

## Overview

This guide provides multiple deployment options for converting Android tablets into dedicated SeniorCare Hub kiosk devices, making the tablet boot directly into the SeniorCare Hub dashboard with no access to other applications.

## 🎯 Deployment Options

### Option 1: Custom Android Launcher (Recommended)
**Best for: Technology-illiterate seniors, maximum security**

Located in: `/app/tablet/android-launcher/`

**Features:**
- ✅ Replaces Android home screen entirely
- ✅ Boots directly into SeniorCare Hub web interface
- ✅ Emergency button always visible
- ✅ Biometric caregiver access for settings
- ✅ Offline mode with basic emergency functions
- ✅ Device health monitoring
- ✅ Remote family management
- ✅ Senior-friendly large fonts and buttons

**Installation:**
1. Enable Developer Options on tablet
2. Enable USB Debugging
3. Install via ADB: `adb install seniorcare-launcher.apk`
4. Set as default launcher when prompted
5. Grant device admin permissions for full kiosk mode

**Setup:**
```bash
# Build the Android APK
cd /app/tablet/android-launcher/
./gradlew assembleDebug

# Install on tablet
adb install app/build/outputs/apk/debug/app-debug.apk

# Set as default launcher
adb shell cmd package set-home-activity com.seniorcarehub.launcher/.SeniorCareLauncherActivity
```

### Option 2: Progressive Web App (PWA) Kiosk
**Best for: Quick setup, existing tablets**

Located in: `/app/tablet/pwa-kiosk/`

**Features:**
- ✅ No Android development required
- ✅ Uses Chrome's kiosk mode
- ✅ Fullscreen web app experience
- ✅ Offline support via service workers
- ✅ Easy updates via web deployment

**Installation Script:**
```bash
#!/bin/bash
# Run: chmod +x /app/tablet/pwa-kiosk/kiosk-setup.sh && ./kiosk-setup.sh

# Install Chrome (if not present)
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt update && apt install -y google-chrome-stable

# Setup kiosk mode
cat > /home/android/kiosk-start.sh << 'EOF'
#!/bin/bash
export DISPLAY=:0
chromium-browser \
  --kiosk \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  --no-first-run \
  --fast \
  --fast-start \
  --disable-infobars \
  --disable-features=TranslateUI \
  --disk-cache-dir=/dev/null \
  --overscroll-history-navigation=0 \
  --disable-pinch \
  "http://localhost:3000"
EOF

chmod +x /home/android/kiosk-start.sh

# Auto-start on boot
cat > /etc/systemd/system/kiosk.service << 'EOF'
[Unit]
Description=SeniorCare Hub Kiosk
After=graphical-session.target

[Service]
Type=simple
User=android
Environment=DISPLAY=:0
ExecStart=/home/android/kiosk-start.sh
Restart=always

[Install]
WantedBy=graphical-session.target
EOF

systemctl enable kiosk.service
systemctl start kiosk.service

echo "✅ PWA Kiosk setup complete! Tablet will boot into SeniorCare Hub."
```

### Option 3: Mobile Device Management (MDM)
**Best for: Multiple tablets, enterprise deployment**

Located in: `/app/tablet/mdm-solution/`

**Features:**
- ✅ Centralized management of multiple devices
- ✅ Remote configuration and updates
- ✅ App whitelisting and restrictions
- ✅ Usage analytics and monitoring
- ✅ Compliance reporting

**Setup with popular MDM solutions:**

#### Android Enterprise (Google)
```javascript
// Device Policy Configuration
{
  "applications": [
    {
      "packageName": "com.seniorcarehub.launcher",
      "installType": "FORCE_INSTALLED",
      "lockTaskAllowed": true,
      "defaultPermissionPolicy": "GRANT"
    }
  ],
  "kioskCustomization": {
    "deviceSettings": "SETTINGS_ACCESS_DISABLED",
    "powerButtonActions": "POWER_BUTTON_ACTIONS_DISABLED",
    "statusBar": "STATUS_BAR_DISABLED",
    "systemNavigation": "SYSTEM_NAVIGATION_DISABLED",
    "systemErrorWarnings": "ERROR_AND_WARNINGS_DISABLED"
  },
  "persistentPreferredActivities": [
    {
      "receiverActivity": "com.seniorcarehub.launcher/.SeniorCareLauncherActivity",
      "actions": ["android.intent.action.MAIN"],
      "categories": ["android.intent.category.HOME", "android.intent.category.DEFAULT"]
    }
  ]
}
```

#### Microsoft Intune
```xml
<!-- Intune Configuration Profile -->
<MobileApplicationManagement>
  <Application packageName="com.seniorcarehub.launcher">
    <KioskMode enabled="true">
      <AllowedApps>
        <App>com.seniorcarehub.launcher</App>
      </AllowedApps>
    </KioskMode>
    <Restrictions>
      <SystemApps blocked="true" />
      <AppInstall blocked="true" />
      <FactoryReset blocked="true" />
    </Restrictions>
  </Application>
</MobileApplicationManagement>
```

## 🛠️ Complete Setup Instructions

### Prerequisites
- Android 8.0+ tablet (recommended: 10" screen)
- WiFi network access
- SeniorCare Hub backend running (http://localhost:8001)
- SeniorCare Hub frontend running (http://localhost:3000)

### Step 1: Prepare the Tablet

1. **Factory Reset** (optional but recommended)
2. **Skip Google Account Setup** (for dedicated use)
3. **Enable Developer Options:**
   - Settings → About Tablet → Tap "Build Number" 7 times
4. **Enable USB Debugging:**
   - Settings → Developer Options → USB Debugging
5. **Connect to WiFi**

### Step 2: Choose Deployment Method

#### For Custom Launcher (Recommended):
```bash
# 1. Connect tablet via USB
adb devices

# 2. Install SeniorCare Launcher
adb install /app/tablet/android-launcher/app/build/outputs/apk/debug/app-debug.apk

# 3. Set as default launcher
adb shell cmd package set-home-activity com.seniorcarehub.launcher/.SeniorCareLauncherActivity

# 4. Configure tablet settings
adb shell settings put secure location_mode 3  # Enable location for emergency
adb shell settings put system screen_off_timeout 1800000  # 30-minute screen timeout
adb shell settings put system screen_brightness 200  # Senior-friendly brightness
```

#### For PWA Kiosk:
```bash
# Run the setup script
cd /app/tablet/pwa-kiosk/
chmod +x kiosk-setup.sh
./kiosk-setup.sh
```

### Step 3: Configure for Senior Use

1. **Accessibility Settings:**
   - Large text size
   - High contrast
   - Touch sensitivity adjustment
   - Voice feedback enabled

2. **Network Configuration:**
   - Set static IP (optional)
   - Configure automatic WiFi reconnection
   - Set DNS to 8.8.8.8 for reliability

3. **Security Settings:**
   - Disable app installation from unknown sources
   - Enable device encryption
   - Set up automatic screen lock (extended timeout)

### Step 4: Test and Validate

1. **Emergency Functions:**
   - Test emergency button
   - Verify 911 calling works
   - Test family notification system

2. **Core Features:**
   - Daily check-in form
   - Medication reminders
   - Dashboard navigation
   - Offline mode functionality

3. **Caregiver Access:**
   - Test biometric authentication
   - Verify settings access
   - Confirm return to senior mode

## 📱 Hardware Recommendations

### Recommended Tablets:
1. **Samsung Galaxy Tab A7 Lite** - Budget-friendly, good performance
2. **Amazon Fire HD 10** - Very affordable, needs custom launcher
3. **iPad (9th gen)** - Premium option, requires different setup
4. **Lenovo Tab M10** - Good mid-range option

### Minimum Requirements:
- Screen: 10" minimum (better visibility for seniors)
- RAM: 3GB minimum
- Storage: 32GB minimum
- Battery: 6000mAh+ (all-day use)
- WiFi: 802.11n or better
- Camera: Front camera for video calls

### Recommended Accessories:
- **Protective Case with Stand** - Prevents damage, proper viewing angle
- **Screen Protector** - Anti-glare for better visibility
- **Stylus** - Easier interaction for seniors with dexterity issues
- **Charging Dock** - Always charged and ready

## 🔒 Security Features

### Built-in Security:
- Kiosk mode prevents access to other apps
- Encrypted data storage
- Secure authentication for caregiver access
- HTTPS-only communication with backend
- Automatic security updates

### Privacy Features:
- No data collection beyond health metrics
- Local data storage with cloud backup
- HIPAA-compliant data handling
- Family-controlled data sharing

## 🚨 Emergency Features

### Always Available:
- Hardware emergency button
- Volume button emergency trigger
- Voice-activated emergency ("Hey SeniorCare, Emergency!")
- Automatic fall detection (with compatible sensors)

### Emergency Actions:
1. **Immediate 911 Call**
2. **Family Notification** with location
3. **Medical Information Display** (allergies, medications, conditions)
4. **Emergency Contact Auto-Dial**

## 📊 Remote Monitoring

### Family Dashboard Features:
- Real-time device status
- Daily check-in history
- Medication adherence tracking
- Emergency alert history
- Device health monitoring
- Usage analytics

### Device Health Monitoring:
- Battery level and charging status
- Network connectivity
- App performance metrics
- Emergency button functionality tests
- Screen time and usage patterns

## 🔧 Troubleshooting

### Common Issues:

1. **Tablet Won't Boot to SeniorCare Hub:**
   ```bash
   # Reset default launcher
   adb shell cmd package set-home-activity com.android.launcher3/.Launcher
   # Then reinstall and reconfigure
   ```

2. **WiFi Connectivity Issues:**
   ```bash
   # Forget and reconnect to WiFi
   adb shell cmd wifi forget-network "NetworkName"
   adb shell cmd wifi connect-network "NetworkName" "password"
   ```

3. **Emergency Button Not Working:**
   - Check app permissions in Settings → Apps → SeniorCare Launcher
   - Verify phone app permissions for emergency calling

4. **App Performance Issues:**
   ```bash
   # Clear app cache
   adb shell pm clear com.seniorcarehub.launcher
   # Restart app
   adb shell am start com.seniorcarehub.launcher/.SeniorCareLauncherActivity
   ```

### Support Commands:
```bash
# View app logs
adb logcat | grep SeniorCare

# Check app status
adb shell dumpsys package com.seniorcarehub.launcher

# Restart in safe mode
adb shell am start-activity -n com.seniorcarehub.launcher/.SeniorCareLauncherActivity --ez safe_mode true
```

## 📚 Additional Resources

### Documentation:
- Android Kiosk Mode Guide: `/app/tablet/docs/android-kiosk-guide.md`
- PWA Setup Guide: `/app/tablet/docs/pwa-setup-guide.md`
- MDM Configuration: `/app/tablet/docs/mdm-configuration.md`

### Support Tools:
- Device Diagnostics: `/app/tablet/tools/diagnostics.sh`
- Bulk Deployment Script: `/app/tablet/tools/bulk-deploy.sh`
- Configuration Backup: `/app/tablet/tools/backup-config.sh`

### Testing:
- Emergency Function Tests: `/app/tablet/tests/emergency-tests.md`
- Accessibility Tests: `/app/tablet/tests/accessibility-tests.md`
- Performance Benchmarks: `/app/tablet/tests/performance-tests.md`

---

## 🎉 Deployment Complete!

Once configured, the tablet will:
- ✅ Boot directly into SeniorCare Hub
- ✅ Prevent access to other applications
- ✅ Provide emergency features always accessible
- ✅ Enable family remote monitoring
- ✅ Work offline for essential functions
- ✅ Update automatically when online

The senior can now use their tablet safely and simply, with family members able to monitor and assist remotely through the SeniorCare Hub web interface.