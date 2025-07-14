import { useEffect, useState } from 'react';

/**
 * Device Detection and Platform Service
 * Determines the best interface for the current device/platform
 */

export const DeviceType = {
  MOBILE_PHONE: 'mobile_phone',
  TABLET: 'tablet', 
  DESKTOP: 'desktop',
  KIOSK_TABLET: 'kiosk_tablet'
};

export const Platform = {
  WEB: 'web',
  PWA: 'pwa',
  NATIVE_ANDROID: 'native_android',
  NATIVE_IOS: 'native_ios',
  KIOSK: 'kiosk'
};

class DevicePlatformService {
  constructor() {
    this.deviceType = this.detectDeviceType();
    this.platform = this.detectPlatform();
    this.isKioskMode = this.detectKioskMode();
    this.capabilities = this.detectCapabilities();
  }

  detectDeviceType() {
    const userAgent = navigator.userAgent;
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const pixelRatio = window.devicePixelRatio || 1;

    // Check for tablet first (including iPad)
    const isTablet = (
      /iPad|Android(?!.*Mobile)|Tablet/i.test(userAgent) ||
      (screenWidth >= 768 && screenHeight >= 1024) ||
      (screenWidth >= 1024 && screenHeight >= 768)
    );

    // Check for mobile phone
    const isMobile = (
      /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
      (screenWidth < 768 && !isTablet)
    );

    if (isTablet) {
      // Check if this might be a kiosk tablet
      const isLargeTablet = (screenWidth >= 1024 || screenHeight >= 1024);
      const isLandscape = screenWidth > screenHeight;
      
      // Heuristics for kiosk mode detection
      if (isLargeTablet && isLandscape && this.detectKioskMode()) {
        return DeviceType.KIOSK_TABLET;
      }
      return DeviceType.TABLET;
    }

    if (isMobile) {
      return DeviceType.MOBILE_PHONE;
    }

    return DeviceType.DESKTOP;
  }

  detectPlatform() {
    const userAgent = navigator.userAgent;
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if launched as PWA
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true ||
        urlParams.get('source') === 'pwa') {
      return Platform.PWA;
    }

    // Check for kiosk mode indicators
    if (this.detectKioskMode()) {
      return Platform.KIOSK;
    }

    // Check for native app user agents (for future React Native apps)
    if (userAgent.includes('SeniorCareHub-Android')) {
      return Platform.NATIVE_ANDROID;
    }
    
    if (userAgent.includes('SeniorCareHub-iOS')) {
      return Platform.NATIVE_IOS;
    }

    return Platform.WEB;
  }

  detectKioskMode() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check URL parameters
    if (urlParams.get('kiosk') === 'true' || 
        urlParams.get('mode') === 'kiosk' ||
        urlParams.get('tablet_mode') === 'true') {
      return true;
    }

    // Check localStorage for kiosk preference
    if (localStorage.getItem('seniorcare_kiosk_mode') === 'true') {
      return true;
    }

    // Check if launched from tablet launcher
    if (document.referrer.includes('launcher') || 
        navigator.userAgent.includes('SeniorCareHub-Tablet')) {
      return true;
    }

    // Check for fullscreen mode (often indicates kiosk)
    if (window.screen.height === window.innerHeight && 
        window.screen.width === window.innerWidth) {
      return true;
    }

    return false;
  }

  detectCapabilities() {
    return {
      hasCamera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      hasGeolocation: !!navigator.geolocation,
      hasPushNotifications: 'serviceWorker' in navigator && 'PushManager' in window,
      hasVibration: !!navigator.vibrate,
      hasBiometrics: !!(navigator.credentials && navigator.credentials.create),
      hasVoiceRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      hasDeviceOrientation: !!window.DeviceOrientationEvent,
      hasInstallPrompt: false, // Will be set when PWA install prompt is available
      isOnline: navigator.onLine,
      isTouchDevice: 'ontouchstart' in window,
      supportsWebShare: !!navigator.share,
      supportsPaymentRequest: !!window.PaymentRequest
    };
  }

  // Interface Configuration Methods
  getUIConfig() {
    const config = {
      showBottomNavigation: false,
      showSidebar: false,
      emergencyButtonPosition: 'floating',
      textSize: 'normal',
      buttonSize: 'normal',
      spacing: 'normal',
      headerStyle: 'full'
    };

    switch (this.deviceType) {
      case DeviceType.MOBILE_PHONE:
        return {
          ...config,
          showBottomNavigation: true,
          emergencyButtonPosition: 'bottom-nav',
          textSize: 'small',
          buttonSize: 'medium',
          spacing: 'compact',
          headerStyle: 'minimal'
        };

      case DeviceType.TABLET:
        return {
          ...config,
          showSidebar: true,
          emergencyButtonPosition: 'floating',
          textSize: 'medium',
          buttonSize: 'large',
          spacing: 'comfortable'
        };

      case DeviceType.KIOSK_TABLET:
        return {
          ...config,
          showSidebar: false,
          emergencyButtonPosition: 'always-visible',
          textSize: 'large',
          buttonSize: 'extra-large',
          spacing: 'spacious',
          headerStyle: 'simple',
          hideComplexFeatures: true,
          enableVoiceCommands: true,
          autoLogout: false
        };

      case DeviceType.DESKTOP:
        return {
          ...config,
          showSidebar: true,
          emergencyButtonPosition: 'sidebar',
          textSize: 'normal',
          buttonSize: 'normal',
          spacing: 'normal'
        };

      default:
        return config;
    }
  }

  // Platform-specific features
  canInstallPWA() {
    return this.platform === Platform.WEB && this.capabilities.hasInstallPrompt;
  }

  shouldShowInstallPrompt() {
    return this.platform === Platform.WEB && 
           this.deviceType === DeviceType.MOBILE_PHONE &&
           !this.hasBeenPromptedToInstall();
  }

  hasBeenPromptedToInstall() {
    return localStorage.getItem('pwa_install_prompted') === 'true';
  }

  markInstallPrompted() {
    localStorage.setItem('pwa_install_prompted', 'true');
  }

  // Emergency features based on platform
  getEmergencyFeatures() {
    const features = {
      canCall911: false,
      canSendSMS: false,
      canGetLocation: this.capabilities.hasGeolocation,
      canVibrate: this.capabilities.hasVibration,
      canTakePhoto: this.capabilities.hasCamera,
      canRecordVoice: this.capabilities.hasVoiceRecognition
    };

    if (this.platform === Platform.NATIVE_ANDROID || 
        this.platform === Platform.NATIVE_IOS) {
      features.canCall911 = true;
      features.canSendSMS = true;
    } else if (this.platform === Platform.KIOSK) {
      features.canCall911 = true; // Kiosk tablets often have calling capability
    }

    return features;
  }

  // Analytics and tracking
  getAnalyticsContext() {
    return {
      deviceType: this.deviceType,
      platform: this.platform,
      isKioskMode: this.isKioskMode,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      pixelRatio: window.devicePixelRatio || 1,
      userAgent: navigator.userAgent,
      capabilities: this.capabilities
    };
  }
}

// Singleton instance
const devicePlatformService = new DevicePlatformService();

// React hook for using device/platform detection
export const useDevicePlatform = () => {
  const [service] = useState(devicePlatformService);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      service.capabilities.hasInstallPrompt = true;
      
      // Store the event for later use
      window.deferredPrompt = e;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [service]);

  return {
    ...service,
    capabilities: { ...service.capabilities, isOnline },
    uiConfig: service.getUIConfig(),
    emergencyFeatures: service.getEmergencyFeatures(),
    analyticsContext: service.getAnalyticsContext()
  };
};

// Helper functions for specific platform checks
export const isMobilePhone = () => devicePlatformService.deviceType === DeviceType.MOBILE_PHONE;
export const isTablet = () => devicePlatformService.deviceType === DeviceType.TABLET;
export const isKioskTablet = () => devicePlatformService.deviceType === DeviceType.KIOSK_TABLET;
export const isDesktop = () => devicePlatformService.deviceType === DeviceType.DESKTOP;

export const isPWA = () => devicePlatformService.platform === Platform.PWA;
export const isNativeApp = () => [Platform.NATIVE_ANDROID, Platform.NATIVE_IOS].includes(devicePlatformService.platform);
export const isKioskMode = () => devicePlatformService.platform === Platform.KIOSK || devicePlatformService.isKioskMode;

export default devicePlatformService;