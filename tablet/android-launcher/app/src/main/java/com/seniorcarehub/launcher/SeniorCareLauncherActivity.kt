package com.seniorcarehub.launcher

import android.annotation.SuppressLint
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.seniorcarehub.launcher.databinding.ActivitySeniorCareLauncherBinding
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.Executor

/**
 * SeniorCare Hub Launcher Activity
 * 
 * This launcher replaces the default Android home screen and provides:
 * - Direct boot to SeniorCare Hub web interface
 * - Kiosk mode with restricted access to other apps
 * - Emergency button always visible
 * - Family remote management capabilities
 * - Senior-friendly accessibility features
 */
class SeniorCareLauncherActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivitySeniorCareLauncherBinding
    private lateinit var webView: WebView
    private lateinit var sharedPreferences: SharedPreferences
    private lateinit var devicePolicyManager: DevicePolicyManager
    private lateinit var adminComponent: ComponentName
    private lateinit var executor: Executor
    private lateinit var biometricPrompt: BiometricPrompt
    
    private var isKioskModeEnabled = true
    private var emergencyModeActive = false
    private var caregiverAccessGranted = false
    
    companion object {
        const val PREF_NAME = "SeniorCareLauncher"
        const val PREF_SENIOR_NAME = "senior_name"
        const val PREF_FAMILY_ID = "family_id"
        const val PREF_TABLET_ID = "tablet_id"
        const val PREF_SERVER_URL = "server_url"
        const val PREF_OFFLINE_MODE = "offline_mode"
        const val PREF_EMERGENCY_CONTACTS = "emergency_contacts"
        const val PREF_CAREGIVER_PIN = "caregiver_pin"
        
        const val DEFAULT_SERVER_URL = "http://localhost:3000"
        const val TABLET_USER_AGENT = "SeniorCareHub-Tablet/1.0"
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Initialize binding
        binding = ActivitySeniorCareLauncherBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        // Initialize components
        initializeComponents()
        
        // Setup device as launcher
        setAsDefaultLauncher()
        
        // Enable kiosk mode
        enableKioskMode()
        
        // Initialize WebView for SeniorCare Hub
        initializeSeniorCareWebView()
        
        // Setup emergency button overlay
        setupEmergencyOverlay()
        
        // Setup biometric authentication for caregiver access
        setupBiometricAuth()
        
        // Start health monitoring
        startDeviceHealthMonitoring()
        
        // Check for remote commands
        checkForRemoteCommands()
    }
    
    private fun initializeComponents() {
        sharedPreferences = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        devicePolicyManager = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        adminComponent = ComponentName(this, SeniorCareDeviceAdmin::class.java)
        executor = ContextCompat.getMainExecutor(this)
    }
    
    private fun setAsDefaultLauncher() {
        // Request to be set as default launcher
        val intent = Intent(Intent.ACTION_MAIN)
        intent.addCategory(Intent.CATEGORY_HOME)
        startActivity(Intent.createChooser(intent, "Select Launcher"))
    }
    
    @SuppressLint("SetJavaScriptEnabled")
    private fun initializeSeniorCareWebView() {
        webView = binding.seniorCareWebView
        
        // Configure WebView settings for optimal senior experience
        val webSettings: WebSettings = webView.settings
        webSettings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            
            // Senior-friendly text sizing
            textZoom = 120 // 20% larger text
            minimumFontSize = 18
            
            // Security settings
            allowFileAccess = false
            allowContentAccess = false
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
            
            // Performance optimization
            setRenderPriority(WebSettings.RenderPriority.HIGH)
            cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
            
            // User agent for tablet identification
            userAgentString = "$userAgentString $TABLET_USER_AGENT"
        }
        
        // WebView client for handling navigation
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                // Keep navigation within SeniorCare Hub domain
                return if (url?.contains("seniorcarehub.com") == true) {
                    false // Allow navigation
                } else {
                    true // Block external navigation
                }
            }
            
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                
                // Inject tablet-specific CSS and JavaScript
                injectTabletOptimizations()
                
                // Hide loading screen
                binding.loadingScreen.visibility = View.GONE
                binding.seniorCareWebView.visibility = View.VISIBLE
            }
            
            override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                super.onReceivedError(view, errorCode, description, failingUrl)
                
                // Show offline mode if server unavailable
                showOfflineMode()
            }
        }
        
        // Add JavaScript interface for tablet-specific functions
        webView.addJavascriptInterface(TabletInterface(), "TabletInterface")
        
        // Load SeniorCare Hub
        val serverUrl = sharedPreferences.getString(PREF_SERVER_URL, DEFAULT_SERVER_URL)
        val tabletUrl = "$serverUrl/tablet?device_id=${getTabletId()}&family_id=${getFamilyId()}"
        
        webView.loadUrl(tabletUrl)
    }
    
    private fun injectTabletOptimizations() {
        // Inject CSS for tablet-specific styling
        val tabletCSS = """
            javascript:(function(){
                var style = document.createElement('style');
                style.innerHTML = `
                    /* Tablet-specific optimizations */
                    body { 
                        font-size: 1.2rem !important;
                        line-height: 1.6 !important;
                    }
                    
                    .btn, button, input[type="button"] {
                        min-height: 60px !important;
                        min-width: 120px !important;
                        font-size: 1.1rem !important;
                        padding: 15px 20px !important;
                    }
                    
                    .emergency-fab {
                        width: 80px !important;
                        height: 80px !important;
                        font-size: 2rem !important;
                        bottom: 30px !important;
                        right: 30px !important;
                    }
                    
                    /* High contrast mode for seniors */
                    .tablet-high-contrast {
                        filter: contrast(150%) brightness(110%);
                    }
                    
                    /* Hide elements not needed on tablet */
                    .mobile-only, .desktop-only {
                        display: none !important;
                    }
                `;
                document.head.appendChild(style);
                
                // Add tablet class to body
                document.body.classList.add('tablet-mode');
                
                // Enable high contrast if preference set
                if (TabletInterface.isHighContrastEnabled()) {
                    document.body.classList.add('tablet-high-contrast');
                }
                
                // Setup tablet-specific event handlers
                setupTabletEventHandlers();
            })();
        """.trimIndent()
        
        webView.evaluateJavascript(tabletCSS, null)
    }
    
    private fun setupEmergencyOverlay() {
        binding.emergencyButton.setOnClickListener {
            showEmergencyDialog()
        }
        
        // Long press for immediate emergency call
        binding.emergencyButton.setOnLongClickListener {
            initiateEmergencyCall()
            true
        }
        
        // Hardware volume buttons for emergency (accessibility)
        setupVolumeButtonEmergency()
    }
    
    private fun showEmergencyDialog() {
        val dialog = EmergencyDialog(this) { action ->
            when (action) {
                EmergencyAction.CALL_911 -> initiateEmergencyCall()
                EmergencyAction.NOTIFY_FAMILY -> notifyFamilyEmergency()
                EmergencyAction.MEDICAL_INFO -> showMedicalInfo()
                EmergencyAction.CANCEL -> {} // Do nothing
            }
        }
        dialog.show()
    }
    
    private fun initiateEmergencyCall() {
        emergencyModeActive = true
        
        // Enable emergency mode UI
        binding.emergencyOverlay.visibility = View.VISIBLE
        
        // Call emergency services
        val intent = Intent(Intent.ACTION_CALL).apply {
            data = android.net.Uri.parse("tel:911")
        }
        
        if (intent.resolveActivity(packageManager) != null) {
            startActivity(intent)
        }
        
        // Also notify family
        notifyFamilyEmergency()
        
        // Log emergency event
        logEmergencyEvent("911_call_initiated")
    }
    
    private fun notifyFamilyEmergency() {
        lifecycleScope.launch {
            try {
                val emergencyData = EmergencyData(
                    seniorName = getSeniorName(),
                    timestamp = System.currentTimeMillis(),
                    location = getCurrentLocation(),
                    deviceId = getTabletId(),
                    type = "manual_emergency"
                )
                
                // Send to server
                EmergencyNotificationService.sendEmergencyAlert(emergencyData)
                
                // Show confirmation
                showEmergencyConfirmation("Family has been notified")
                
            } catch (e: Exception) {
                // Fallback to SMS if internet unavailable
                sendEmergencySMS()
            }
        }
    }
    
    private fun setupBiometricAuth() {
        val biometricManager = BiometricManager.from(this)
        
        when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)) {
            BiometricManager.BIOMETRIC_SUCCESS -> {
                setupBiometricPrompt()
            }
            else -> {
                // Fallback to PIN authentication
                setupPINAuth()
            }
        }
    }
    
    private fun setupBiometricPrompt() {
        biometricPrompt = BiometricPrompt(this, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    grantCaregiverAccess()
                }
                
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    showAuthenticationError(errString.toString())
                }
            }
        )
    }
    
    private fun grantCaregiverAccess() {
        caregiverAccessGranted = true
        
        // Temporarily disable kiosk mode
        disableKioskMode()
        
        // Show caregiver interface
        showCaregiverInterface()
        
        // Auto-return to senior mode after 10 minutes
        lifecycleScope.launch {
            delay(10 * 60 * 1000) // 10 minutes
            returnToSeniorMode()
        }
    }
    
    private fun showCaregiverInterface() {
        binding.caregiverPanel.visibility = View.VISIBLE
        
        // Setup caregiver controls
        binding.btnReturnToSeniorMode.setOnClickListener {
            returnToSeniorMode()
        }
        
        binding.btnAccessSettings.setOnClickListener {
            openSystemSettings()
        }
        
        binding.btnViewOtherApps.setOnClickListener {
            showInstalledApps()
        }
        
        binding.btnEmergencySettings.setOnClickListener {
            openEmergencySettings()
        }
    }
    
    private fun returnToSeniorMode() {
        caregiverAccessGranted = false
        binding.caregiverPanel.visibility = View.GONE
        enableKioskMode()
        
        // Refresh SeniorCare Hub
        webView.reload()
    }
    
    private fun enableKioskMode() {
        if (!isKioskModeEnabled) return
        
        // Hide system UI
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )
        
        // Prevent task switching
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        
        // Disable recent apps button
        try {
            val activityManager = getSystemService(Context.ACTIVITY_SERVICE)
            // Implementation depends on device admin permissions
        } catch (e: Exception) {
            // Handle gracefully if permissions not available
        }
    }
    
    private fun disableKioskMode() {
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
    
    private fun showOfflineMode() {
        binding.offlineMode.visibility = View.VISIBLE
        binding.seniorCareWebView.visibility = View.GONE
        
        // Load offline functionality
        loadOfflineInterface()
    }
    
    private fun loadOfflineInterface() {
        // Basic offline functionality for emergencies
        val offlineHTML = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>SeniorCare Hub - Offline Mode</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        font-size: 1.5rem; 
                        text-align: center; 
                        padding: 40px; 
                        background: #f0f4f8;
                    }
                    .emergency-btn { 
                        background: #dc2626; 
                        color: white; 
                        padding: 20px 40px; 
                        border: none; 
                        border-radius: 10px; 
                        font-size: 1.5rem; 
                        margin: 20px;
                        min-width: 200px;
                        min-height: 80px;
                    }
                    .offline-message {
                        background: #fef3c7;
                        padding: 20px;
                        border-radius: 10px;
                        margin: 20px 0;
                        border: 2px solid #f59e0b;
                    }
                </style>
            </head>
            <body>
                <h1>🛡️ SeniorCare Hub</h1>
                <div class="offline-message">
                    <h2>📡 Offline Mode</h2>
                    <p>Trying to reconnect to the internet...</p>
                </div>
                
                <button class="emergency-btn" onclick="callEmergency()">
                    🚨 Emergency Call
                </button>
                
                <button class="emergency-btn" onclick="contactFamily()">
                    👨‍👩‍👧‍👦 Contact Family
                </button>
                
                <script>
                    function callEmergency() {
                        window.location.href = 'tel:911';
                    }
                    
                    function contactFamily() {
                        TabletInterface.notifyFamilyOffline();
                    }
                    
                    // Try to reconnect every 30 seconds
                    setInterval(function() {
                        fetch('/api/health-check')
                            .then(() => {
                                location.reload();
                            })
                            .catch(() => {
                                console.log('Still offline...');
                            });
                    }, 30000);
                </script>
            </body>
            </html>
        """.trimIndent()
        
        binding.offlineWebView.loadDataWithBaseURL(null, offlineHTML, "text/html", "UTF-8", null)
    }
    
    private fun startDeviceHealthMonitoring() {
        lifecycleScope.launch {
            while (true) {
                // Monitor device health every 5 minutes
                delay(5 * 60 * 1000)
                
                val healthData = DeviceHealthData(
                    batteryLevel = getBatteryLevel(),
                    memoryUsage = getMemoryUsage(),
                    storageSpace = getStorageSpace(),
                    networkStatus = getNetworkStatus(),
                    lastActivity = System.currentTimeMillis(),
                    emergencyButtonFunctional = testEmergencyButton()
                )
                
                // Send to server for family monitoring
                try {
                    DeviceHealthService.reportHealth(getTabletId(), healthData)
                } catch (e: Exception) {
                    // Store locally if offline
                    storeHealthDataLocally(healthData)
                }
            }
        }
    }
    
    private fun checkForRemoteCommands() {
        lifecycleScope.launch {
            while (true) {
                // Check for remote commands every minute
                delay(60 * 1000)
                
                try {
                    val commands = RemoteCommandService.getCommands(getTabletId())
                    commands.forEach { command ->
                        executeRemoteCommand(command)
                    }
                } catch (e: Exception) {
                    // Handle offline gracefully
                }
            }
        }
    }
    
    private fun executeRemoteCommand(command: RemoteCommand) {
        when (command.type) {
            "emergency_mode" -> {
                emergencyModeActive = true
                showEmergencyInterface()
            }
            "medication_reminder" -> {
                showMedicationReminder(command.data)
            }
            "family_message" -> {
                showFamilyMessage(command.data)
            }
            "update_settings" -> {
                updateTabletSettings(command.data)
            }
            "restart_app" -> {
                restartApplication()
            }
        }
    }
    
    // Helper methods
    private fun getTabletId(): String = sharedPreferences.getString(PREF_TABLET_ID, "") ?: ""
    private fun getFamilyId(): String = sharedPreferences.getString(PREF_FAMILY_ID, "") ?: ""
    private fun getSeniorName(): String = sharedPreferences.getString(PREF_SENIOR_NAME, "Senior") ?: "Senior"
    
    // Override back button to prevent exiting
    override fun onBackPressed() {
        if (emergencyModeActive || !caregiverAccessGranted) {
            // Ignore back button in kiosk mode unless caregiver access granted
            return
        }
        super.onBackPressed()
    }
    
    // Override home button
    override fun onUserLeaveHint() {
        if (!caregiverAccessGranted) {
            // Return to launcher immediately
            val intent = Intent(this, SeniorCareLauncherActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
        }
    }
    
    /**
     * JavaScript Interface for tablet-specific functions
     */
    inner class TabletInterface {
        @android.webkit.JavascriptInterface
        fun isHighContrastEnabled(): Boolean {
            return sharedPreferences.getBoolean("high_contrast", false)
        }
        
        @android.webkit.JavascriptInterface
        fun triggerEmergency() {
            runOnUiThread {
                initiateEmergencyCall()
            }
        }
        
        @android.webkit.JavascriptInterface
        fun requestCaregiverAccess() {
            runOnUiThread {
                if (::biometricPrompt.isInitialized) {
                    val promptInfo = BiometricPrompt.PromptInfo.Builder()
                        .setTitle("Caregiver Access")
                        .setSubtitle("Authenticate to access system settings")
                        .setNegativeButtonText("Cancel")
                        .build()
                    
                    biometricPrompt.authenticate(promptInfo)
                }
            }
        }
        
        @android.webkit.JavascriptInterface
        fun notifyFamilyOffline() {
            // Implement offline family notification (SMS fallback)
            sendEmergencySMS()
        }
        
        @android.webkit.JavascriptInterface
        fun getDeviceInfo(): String {
            val deviceInfo = mapOf(
                "deviceId" to getTabletId(),
                "batteryLevel" to getBatteryLevel(),
                "networkStatus" to getNetworkStatus(),
                "orientation" to getScreenOrientation()
            )
            return com.google.gson.Gson().toJson(deviceInfo)
        }
    }
    
    // Implement other helper methods...
    private fun getBatteryLevel(): Int = 0 // Implementation needed
    private fun getMemoryUsage(): Float = 0f // Implementation needed
    private fun getStorageSpace(): Long = 0L // Implementation needed
    private fun getNetworkStatus(): String = "unknown" // Implementation needed
    private fun getScreenOrientation(): String = "portrait" // Implementation needed
    private fun testEmergencyButton(): Boolean = true // Implementation needed
    private fun getCurrentLocation(): String = "" // Implementation needed
    private fun sendEmergencySMS() {} // Implementation needed
    private fun showEmergencyConfirmation(message: String) {} // Implementation needed
    private fun logEmergencyEvent(event: String) {} // Implementation needed
    private fun setupVolumeButtonEmergency() {} // Implementation needed
    private fun setupPINAuth() {} // Implementation needed
    private fun showAuthenticationError(error: String) {} // Implementation needed
    private fun openSystemSettings() {} // Implementation needed
    private fun showInstalledApps() {} // Implementation needed
    private fun openEmergencySettings() {} // Implementation needed
    private fun showEmergencyInterface() {} // Implementation needed
    private fun showMedicationReminder(data: Any) {} // Implementation needed
    private fun showFamilyMessage(data: Any) {} // Implementation needed
    private fun updateTabletSettings(data: Any) {} // Implementation needed
    private fun restartApplication() {} // Implementation needed
    private fun storeHealthDataLocally(data: DeviceHealthData) {} // Implementation needed
    private fun showMedicalInfo() {} // Implementation needed
}