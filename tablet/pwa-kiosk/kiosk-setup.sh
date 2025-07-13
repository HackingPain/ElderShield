#!/bin/bash

# SeniorCare Hub PWA Kiosk Setup Script
# Automatically configures any tablet for kiosk mode with SeniorCare Hub

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SENIORCARE_URL="https://seniorcarehub.com/tablet"
KIOSK_USER="seniorcare"
CHROME_FLAGS="--kiosk --no-first-run --disable-restore-session-state --disable-infobars --disable-translate --disable-session-crashed-bubble --disable-dev-shm-usage --no-sandbox --touch-events=enabled --enable-pinch"

echo -e "${BLUE}🛡️  SeniorCare Hub Tablet Kiosk Setup${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should not be run as root${NC}"
   echo "Please run as a regular user with sudo privileges"
   exit 1
fi

# Detect operating system
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    echo -e "${GREEN}✅ Detected Linux OS${NC}"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    echo -e "${GREEN}✅ Detected macOS${NC}"
else
    echo -e "${RED}❌ Unsupported operating system: $OSTYPE${NC}"
    exit 1
fi

# Function to install Chrome on Linux
install_chrome_linux() {
    echo -e "${YELLOW}📦 Installing Google Chrome...${NC}"
    
    # Add Google's signing key
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
    
    # Add Chrome repository
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
    
    # Update package list and install Chrome
    sudo apt-get update
    sudo apt-get install -y google-chrome-stable
    
    echo -e "${GREEN}✅ Chrome installed successfully${NC}"
}

# Function to install Chrome on macOS
install_chrome_macos() {
    echo -e "${YELLOW}📦 Installing Google Chrome...${NC}"
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo -e "${YELLOW}Installing Homebrew first...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    # Install Chrome using Homebrew
    brew install --cask google-chrome
    
    echo -e "${GREEN}✅ Chrome installed successfully${NC}"
}

# Function to create kiosk user
create_kiosk_user() {
    echo -e "${YELLOW}👤 Creating kiosk user...${NC}"
    
    if id "$KIOSK_USER" &>/dev/null; then
        echo -e "${YELLOW}User $KIOSK_USER already exists${NC}"
    else
        if [[ "$OS" == "linux" ]]; then
            sudo adduser --disabled-password --gecos "" $KIOSK_USER
            # Add to necessary groups
            sudo usermod -a -G audio,video,input,netdev $KIOSK_USER
        elif [[ "$OS" == "macos" ]]; then
            sudo dscl . -create /Users/$KIOSK_USER
            sudo dscl . -create /Users/$KIOSK_USER UserShell /bin/bash
            sudo dscl . -create /Users/$KIOSK_USER RealName "SeniorCare Kiosk"
            sudo dscl . -create /Users/$KIOSK_USER UniqueID 1001
            sudo dscl . -create /Users/$KIOSK_USER PrimaryGroupID 1000
            sudo dscl . -create /Users/$KIOSK_USER NFSHomeDirectory /Users/$KIOSK_USER
            sudo createhomedir -c -u $KIOSK_USER
        fi
        echo -e "${GREEN}✅ Kiosk user created${NC}"
    fi
}

# Function to setup kiosk environment
setup_kiosk_environment() {
    echo -e "${YELLOW}🏠 Setting up kiosk environment...${NC}"
    
    # Create kiosk directories
    sudo mkdir -p /home/$KIOSK_USER/{.config/autostart,.local/share/applications}
    
    # Create Chrome kiosk launcher script
    cat > /tmp/seniorcare-kiosk.sh << EOF
#!/bin/bash
export DISPLAY=:0

# Wait for X server to be ready
while ! xset q &>/dev/null; do
    sleep 1
done

# Hide cursor after 3 seconds of inactivity
unclutter -idle 3 -root &

# Start Chrome in kiosk mode
google-chrome-stable \\
    $CHROME_FLAGS \\
    --user-data-dir=/home/$KIOSK_USER/.chrome-kiosk \\
    --app="$SENIORCARE_URL"
EOF

    sudo mv /tmp/seniorcare-kiosk.sh /home/$KIOSK_USER/seniorcare-kiosk.sh
    sudo chmod +x /home/$KIOSK_USER/seniorcare-kiosk.sh
    sudo chown $KIOSK_USER:$KIOSK_USER /home/$KIOSK_USER/seniorcare-kiosk.sh

    # Create autostart entry
    cat > /tmp/seniorcare-kiosk.desktop << EOF
[Desktop Entry]
Type=Application
Name=SeniorCare Hub Kiosk
Exec=/home/$KIOSK_USER/seniorcare-kiosk.sh
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

    sudo mv /tmp/seniorcare-kiosk.desktop /home/$KIOSK_USER/.config/autostart/
    sudo chown $KIOSK_USER:$KIOSK_USER /home/$KIOSK_USER/.config/autostart/seniorcare-kiosk.desktop

    echo -e "${GREEN}✅ Kiosk environment configured${NC}"
}

# Function to configure auto-login
configure_auto_login() {
    echo -e "${YELLOW}🔐 Configuring auto-login...${NC}"
    
    if [[ "$OS" == "linux" ]]; then
        # Configure LightDM for auto-login
        if [ -f /etc/lightdm/lightdm.conf ]; then
            sudo bash -c "cat > /etc/lightdm/lightdm.conf << EOF
[Seat:*]
autologin-user=$KIOSK_USER
autologin-user-timeout=0
user-session=ubuntu
greeter-session=unity-greeter
EOF"
        fi
        
        # Configure GDM for auto-login (if using GNOME)
        if [ -f /etc/gdm3/custom.conf ]; then
            sudo bash -c "cat >> /etc/gdm3/custom.conf << EOF

[daemon]
AutomaticLoginEnable=true
AutomaticLogin=$KIOSK_USER
EOF"
        fi
    fi
    
    echo -e "${GREEN}✅ Auto-login configured${NC}"
}

# Function to install dependencies
install_dependencies() {
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    
    if [[ "$OS" == "linux" ]]; then
        sudo apt-get update
        sudo apt-get install -y \
            xorg \
            openbox \
            unclutter \
            curl \
            wget \
            systemd
            
        # Install Chrome
        install_chrome_linux
        
    elif [[ "$OS" == "macos" ]]; then
        install_chrome_macos
    fi
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Function to create emergency access script
create_emergency_access() {
    echo -e "${YELLOW}🚨 Setting up emergency access...${NC}"
    
    cat > /tmp/emergency-exit.sh << EOF
#!/bin/bash
# Emergency exit from kiosk mode
# Usage: Ctrl+Alt+E to exit kiosk

echo "Emergency exit from SeniorCare Kiosk mode"
echo "This will close the kiosk and return to desktop"
read -p "Are you sure? (y/N): " -n 1 -r
echo
if [[ \$REPLY =~ ^[Yy]\$ ]]; then
    pkill -f chrome
    pkill -f seniorcare-kiosk
    echo "Kiosk mode exited. Run 'sudo systemctl restart lightdm' to restart"
fi
EOF

    sudo mv /tmp/emergency-exit.sh /usr/local/bin/emergency-exit
    sudo chmod +x /usr/local/bin/emergency-exit
    
    # Create keyboard shortcut for emergency exit
    mkdir -p /home/$KIOSK_USER/.config/openbox
    cat > /tmp/rc.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <keyboard>
    <keybind key="C-A-e">
      <action name="Execute">
        <command>/usr/local/bin/emergency-exit</command>
      </action>
    </keybind>
    <keybind key="A-F4">
      <action name="Execute">
        <command>true</command>
      </action>
    </keybind>
  </keyboard>
  <applications>
    <application name="Google-chrome">
      <fullscreen>yes</fullscreen>
      <maximized>yes</maximized>
    </application>
  </applications>
</openbox_config>
EOF

    sudo mv /tmp/rc.xml /home/$KIOSK_USER/.config/openbox/
    sudo chown -R $KIOSK_USER:$KIOSK_USER /home/$KIOSK_USER/.config
    
    echo -e "${GREEN}✅ Emergency access configured (Ctrl+Alt+E)${NC}"
}

# Function to setup remote management
setup_remote_management() {
    echo -e "${YELLOW}🌐 Setting up remote management...${NC}"
    
    # Create remote management service
    cat > /tmp/seniorcare-remote.service << EOF
[Unit]
Description=SeniorCare Remote Management
After=network.target

[Service]
Type=simple
User=$KIOSK_USER
ExecStart=/home/$KIOSK_USER/remote-management.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    sudo mv /tmp/seniorcare-remote.service /etc/systemd/system/
    
    # Create remote management script
    cat > /tmp/remote-management.sh << EOF
#!/bin/bash
# SeniorCare Remote Management Agent

DEVICE_ID=\$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)
MANAGEMENT_SERVER="wss://api.seniorcarehub.com/mdm"

echo "Starting SeniorCare Remote Management Agent"
echo "Device ID: \$DEVICE_ID"

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Create remote management client
cat > /tmp/remote-client.js << 'EOFJS'
const WebSocket = require('ws');
const { exec } = require('child_process');
const fs = require('fs');

class SeniorCareRemoteClient {
    constructor(deviceId, serverUrl) {
        this.deviceId = deviceId;
        this.serverUrl = serverUrl;
        this.ws = null;
        this.connect();
    }
    
    connect() {
        console.log('Connecting to remote management server...');
        this.ws = new WebSocket(this.serverUrl);
        
        this.ws.on('open', () => {
            console.log('Connected to remote management');
            this.authenticate();
            this.startHeartbeat();
        });
        
        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Message parse error:', error);
            }
        });
        
        this.ws.on('close', () => {
            console.log('Connection closed, reconnecting in 30 seconds...');
            setTimeout(() => this.connect(), 30000);
        });
        
        this.ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    }
    
    authenticate() {
        this.send({
            type: 'device_connect',
            deviceId: this.deviceId,
            authToken: 'device-token', // In production, use proper authentication
            deviceInfo: {
                os: process.platform,
                version: '1.0.0'
            }
        });
    }
    
    startHeartbeat() {
        setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.send({
                    type: 'heartbeat',
                    deviceId: this.deviceId,
                    timestamp: new Date().toISOString(),
                    status: 'online'
                });
            }
        }, 60000); // Every minute
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'command':
                this.executeCommand(message.command);
                break;
            case 'settings_update':
                this.updateSettings(message.settings);
                break;
            case 'emergency_mode':
                this.enableEmergencyMode(message.data);
                break;
        }
    }
    
    executeCommand(command) {
        console.log('Executing command:', command.type);
        
        switch (command.type) {
            case 'restart_app':
                exec('pkill -f chrome && /home/$KIOSK_USER/seniorcare-kiosk.sh');
                break;
            case 'locate_device':
                // Return current location if available
                this.send({
                    type: 'command_response',
                    commandId: command.id,
                    status: 'completed',
                    result: { location: 'Location not available on this device' }
                });
                break;
            case 'family_message':
                this.showFamilyMessage(command.payload.message);
                break;
        }
    }
    
    showFamilyMessage(message) {
        // Inject message into Chrome using JavaScript
        exec(\`echo "window.postMessage({type: 'family_message', message: '\${message}'}, '*');" | google-chrome-stable --remote-debugging-port=9222\`);
    }
    
    send(data) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
}

const deviceId = process.env.DEVICE_ID || 'tablet-\${Math.random().toString(36).substr(2, 9)}';
const client = new SeniorCareRemoteClient(deviceId, '\$MANAGEMENT_SERVER');
EOFJS

node /tmp/remote-client.js
EOF

    sudo mv /tmp/remote-management.sh /home/$KIOSK_USER/
    sudo chmod +x /home/$KIOSK_USER/remote-management.sh
    sudo chown $KIOSK_USER:$KIOSK_USER /home/$KIOSK_USER/remote-management.sh
    
    # Enable the service
    sudo systemctl enable seniorcare-remote.service
    
    echo -e "${GREEN}✅ Remote management configured${NC}"
}

# Function to configure tablet optimizations
configure_tablet_optimizations() {
    echo -e "${YELLOW}📱 Configuring tablet optimizations...${NC}"
    
    # Create tablet-specific Chrome preferences
    mkdir -p /home/$KIOSK_USER/.chrome-kiosk/Default
    cat > /tmp/Preferences << EOF
{
   "profile": {
      "default_zoom_level": 1.2,
      "default_content_setting_values": {
         "notifications": 1
      }
   },
   "browser": {
      "show_home_button": false,
      "show_bookmark_bar": false
   },
   "bookmark_bar": {
      "show_on_all_tabs": false
   }
}
EOF

    sudo mv /tmp/Preferences /home/$KIOSK_USER/.chrome-kiosk/Default/
    sudo chown -R $KIOSK_USER:$KIOSK_USER /home/$KIOSK_USER/.chrome-kiosk
    
    # Configure touchscreen optimizations
    if [[ "$OS" == "linux" ]]; then
        # Create xorg.conf for touch optimization
        sudo bash -c 'cat > /etc/X11/xorg.conf.d/99-tablet.conf << EOF
Section "InputClass"
    Identifier "Tablet touch"
    MatchIsTouchscreen "on"
    Option "AccelProfile" "flat"
    Option "AccelSpeed" "0"
EndSection
EOF'
    fi
    
    echo -e "${GREEN}✅ Tablet optimizations configured${NC}"
}

# Function to create family setup QR code
create_qr_setup() {
    echo -e "${YELLOW}📱 Creating family setup information...${NC}"
    
    # Generate device ID and setup info
    DEVICE_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)
    
    cat > /home/$KIOSK_USER/setup-info.txt << EOF
=================================
🛡️  SeniorCare Hub Tablet Setup
=================================

Device ID: $DEVICE_ID
Setup URL: https://seniorcarehub.com/setup?device=$DEVICE_ID

Family Setup Instructions:
1. Visit the setup URL above on your phone or computer
2. Create or log into your SeniorCare Hub account
3. Follow the device enrollment process
4. Configure emergency contacts and preferences

Emergency Access:
- Press Ctrl+Alt+E to exit kiosk mode
- Run 'sudo systemctl restart lightdm' to restart kiosk

Remote Management:
This tablet will automatically connect to SeniorCare Hub servers
for remote monitoring and management by authorized family members.

For support: support@seniorcarehub.com
=================================
EOF

    sudo chown $KIOSK_USER:$KIOSK_USER /home/$KIOSK_USER/setup-info.txt
    
    echo -e "${GREEN}✅ Setup information created at /home/$KIOSK_USER/setup-info.txt${NC}"
}

# Function to start kiosk mode
start_kiosk() {
    echo -e "${YELLOW}🚀 Starting SeniorCare Kiosk...${NC}"
    
    # Stop display manager temporarily
    sudo systemctl stop lightdm 2>/dev/null || true
    sudo systemctl stop gdm3 2>/dev/null || true
    
    # Start kiosk mode
    sudo systemctl start seniorcare-remote.service
    
    # Restart display manager with new configuration
    sudo systemctl start lightdm 2>/dev/null || sudo systemctl start gdm3 2>/dev/null || true
    
    echo -e "${GREEN}✅ SeniorCare Kiosk started${NC}"
    echo -e "${BLUE}The tablet will now boot directly into SeniorCare Hub${NC}"
}

# Function to show completion message
show_completion() {
    echo ""
    echo -e "${GREEN}🎉 SeniorCare Hub Tablet Kiosk Setup Complete!${NC}"
    echo -e "${GREEN}=============================================${NC}"
    echo ""
    echo -e "${BLUE}What happens next:${NC}"
    echo "1. The tablet will automatically boot into SeniorCare Hub"
    echo "2. Family members can visit https://seniorcarehub.com/setup to enroll this device"
    echo "3. Emergency exit is available with Ctrl+Alt+E"
    echo ""
    echo -e "${BLUE}Setup Information:${NC}"
    echo "• Device ID: $(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)"
    echo "• Configuration file: /home/$KIOSK_USER/setup-info.txt"
    echo "• Emergency access: Ctrl+Alt+E"
    echo ""
    echo -e "${YELLOW}⚠️  Important:${NC}"
    echo "• Save the setup information for family enrollment"
    echo "• Test the emergency exit procedure"
    echo "• Ensure the tablet is connected to Wi-Fi"
    echo ""
    echo -e "${BLUE}For support: support@seniorcarehub.com${NC}"
    echo ""
}

# Main execution
main() {
    echo "Starting SeniorCare Hub tablet kiosk setup..."
    echo ""
    
    # Check for internet connectivity
    if ! ping -c 1 google.com &> /dev/null; then
        echo -e "${YELLOW}⚠️  Warning: No internet connection detected${NC}"
        echo "Some features may not work properly without internet"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Run setup steps
    install_dependencies
    create_kiosk_user
    setup_kiosk_environment
    configure_auto_login
    create_emergency_access
    setup_remote_management
    configure_tablet_optimizations
    create_qr_setup
    
    # Ask before starting kiosk
    echo ""
    read -p "Setup complete. Start kiosk mode now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_kiosk
    else
        echo -e "${YELLOW}Kiosk setup complete but not started${NC}"
        echo "Run 'sudo systemctl restart lightdm' to start kiosk mode"
    fi
    
    show_completion
}

# Run main function
main "$@"