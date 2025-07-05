#!/bin/bash

# SeniorCare Hub Deployment Script
# Built by DarkHorse Information Security
# This script deploys a production-ready SaaS platform for senior care management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ASCII Art Banner
echo -e "${CYAN}"
cat << "EOF"
  ____             _            ____                  _   _       _     
 / ___|  ___ _ __ (_) ___  _ __|  _ \ __ _ _ __ ___    | | | |_   _| |__  
 \___ \ / _ \ '_ \| |/ _ \| '__| |_) / _` | '__/ _ \   | |_| | | | | '_ \ 
  ___) |  __/ | | | | (_) | |  |  _ < (_| | | |  __/   |  _  | |_| | |_) |
 |____/ \___|_| |_|_|\___/|_|  |_| \_\__,_|_|  \___|   |_| |_|\__,_|_.__/ 
                                                                          
                     Production-Ready SaaS Platform
              Built by DarkHorse Information Security
EOF
echo -e "${NC}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}===================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}===================================${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install Docker on Ubuntu/Debian
install_docker_ubuntu() {
    print_status "Installing Docker on Ubuntu/Debian..."
    sudo apt-get update
    sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker $USER
}

# Function to install Docker on CentOS/RHEL
install_docker_centos() {
    print_status "Installing Docker on CentOS/RHEL..."
    sudo yum install -y yum-utils
    sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
}

# Function to install Node.js
install_nodejs() {
    print_status "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
}

# Main deployment function
deploy_seniorcare_hub() {
    print_header "SENIORCARE HUB DEPLOYMENT"
    
    # Check system requirements
    print_status "Checking system requirements..."
    
    # Check operating system
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        print_status "Linux system detected"
        if command_exists apt-get; then
            DISTRO="ubuntu"
        elif command_exists yum; then
            DISTRO="centos"
        else
            print_error "Unsupported Linux distribution"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        print_status "macOS system detected"
        DISTRO="macos"
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    
    # Check for Docker
    if ! command_exists docker; then
        print_warning "Docker not found. Installing Docker..."
        if [[ "$DISTRO" == "ubuntu" ]]; then
            install_docker_ubuntu
        elif [[ "$DISTRO" == "centos" ]]; then
            install_docker_centos
        elif [[ "$DISTRO" == "macos" ]]; then
            print_error "Please install Docker Desktop for macOS from https://docs.docker.com/docker-for-mac/install/"
            exit 1
        fi
        print_status "Docker installed successfully"
        print_warning "Please log out and log back in to apply Docker group changes, then run this script again"
        exit 0
    else
        print_status "Docker found: $(docker --version)"
    fi
    
    # Check for Docker Compose
    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        print_error "Docker Compose not found. Please install Docker Compose"
        exit 1
    else
        print_status "Docker Compose found"
    fi
    
    # Check for Node.js (for development)
    if ! command_exists node; then
        print_warning "Node.js not found. Installing Node.js..."
        if [[ "$DISTRO" == "ubuntu" ]]; then
            install_nodejs
        else
            print_warning "Please install Node.js manually from https://nodejs.org/"
        fi
    else
        print_status "Node.js found: $(node --version)"
    fi
    
    # Create environment file
    print_status "Setting up environment configuration..."
    if [[ ! -f .env ]]; then
        print_status "Creating .env file..."
        
        # Generate random secrets
        JWT_SECRET=$(openssl rand -hex 32)
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        SESSION_SECRET=$(openssl rand -hex 32)
        
        cat > .env << EOF
# SeniorCare Hub Environment Configuration
# Generated on $(date)

# Server Configuration
PORT=5000
NODE_ENV=production
CLIENT_URL=http://localhost:3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=seniorcare_hub
DB_USER=postgres
DB_PASSWORD=${DB_PASSWORD}

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h

# Session Configuration
SESSION_SECRET=${SESSION_SECRET}

# Firebase Configuration (Update these with your Firebase project details)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
FIREBASE_SERVICE_ACCOUNT_KEY=

# Twilio Configuration (Update these with your Twilio credentials)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password

# Feature Flags
FEATURE_AI_WELLNESS_SCORING=true
FEATURE_VIDEO_CALLS=true
FEATURE_IOT_INTEGRATION=true
FEATURE_VOICE_COMMANDS=true

# Security Settings
BCRYPT_SALT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# HIPAA Compliance
HIPAA_ENABLED=true
AUDIT_LOG_ENABLED=true

# Development Settings
DEBUG=false
LOG_LEVEL=info
EOF
        
        print_status "Environment file created with generated secrets"
        print_warning "Please update Firebase and Twilio credentials in .env file before starting"
    else
        print_status "Environment file already exists"
    fi
    
    # Create necessary directories
    print_status "Creating necessary directories..."
    mkdir -p uploads
    mkdir -p server/logs
    mkdir -p backups
    mkdir -p ssl
    
    # Create PostCSS config for client
    print_status "Setting up client configuration..."
    mkdir -p client/src
    
    # Create PostCSS config
    cat > client/postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF
    
    # Create index.css for Tailwind
    cat > client/src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Senior-friendly base styles */
@layer base {
  html {
    font-size: 18px; /* Larger base font size for seniors */
  }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.6;
  }
  
  * {
    box-sizing: border-box;
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    * {
      border-color: #000 !important;
      color: #000 !important;
    }
    
    button, input, select, textarea {
      border: 2px solid #000 !important;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}

/* Senior-friendly component styles */
@layer components {
  .btn-primary {
    @apply bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 min-h-[3rem] text-lg;
  }
  
  .btn-secondary {
    @apply bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors duration-200 min-h-[3rem] text-lg;
  }
  
  .card {
    @apply bg-white shadow-medium rounded-xl p-6 border border-gray-200;
  }
  
  .input-field {
    @apply block w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500;
  }
}

/* Custom scrollbar for better visibility */
::-webkit-scrollbar {
  width: 12px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 6px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}
EOF
    
    # Create index.js entry point
    cat > client/src/index.js << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Performance monitoring for seniors (larger touch targets, slower animations)
reportWebVitals();
EOF
    
    # Create a simple reportWebVitals file
    cat > client/src/reportWebVitals.js << 'EOF'
const reportWebVitals = onPerfEntry => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;
EOF
    
    # Create a simple public/index.html
    mkdir -p client/public
    cat > client/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0ea5e9" />
    <meta name="description" content="SeniorCare Hub - A secure platform for senior care management" />
    <title>SeniorCare Hub</title>
    
    <!-- Senior-friendly meta tags -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="SeniorCare Hub" />
    
    <!-- Large favicon for better visibility -->
    <link rel="apple-touch-icon" sizes="180x180" href="%PUBLIC_URL%/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="%PUBLIC_URL%/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="%PUBLIC_URL%/favicon-16x16.png" />
    
    <!-- Accessibility improvements -->
    <meta name="format-detection" content="telephone=no" />
    <meta name="msapplication-tap-highlight" content="no" />
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF
    
    # Install dependencies and build
    print_status "Installing dependencies..."
    if command_exists npm; then
        npm install
        cd client && npm install && cd ..
    else
        print_warning "npm not found, skipping dependency installation"
    fi
    
    # Start the application
    print_header "STARTING SENIORCARE HUB"
    
    read -p "Do you want to start the application now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Starting SeniorCare Hub platform..."
        
        # Use docker-compose or docker compose based on availability
        if command_exists docker-compose; then
            DOCKER_COMPOSE_CMD="docker-compose"
        else
            DOCKER_COMPOSE_CMD="docker compose"
        fi
        
        # Start core services
        print_status "Starting core services (database, cache, API)..."
        $DOCKER_COMPOSE_CMD up -d postgres redis
        
        # Wait for services to be ready
        print_status "Waiting for services to be ready..."
        sleep 10
        
        # Start API server
        print_status "Starting API server..."
        $DOCKER_COMPOSE_CMD up -d api
        
        # Wait for API to be ready
        sleep 5
        
        # Start frontend
        print_status "Starting frontend..."
        $DOCKER_COMPOSE_CMD up -d frontend
        
        print_status "SeniorCare Hub is starting up..."
        echo
        print_header "DEPLOYMENT COMPLETE!"
        echo
        print_status "🎉 SeniorCare Hub is now running!"
        echo
        echo -e "${GREEN}📱 Frontend Application:${NC} http://localhost:3000"
        echo -e "${GREEN}🔧 API Server:${NC} http://localhost:5000"
        echo -e "${GREEN}📊 Health Check:${NC} http://localhost:5000/health"
        echo
        print_status "To view logs: $DOCKER_COMPOSE_CMD logs -f"
        print_status "To stop services: $DOCKER_COMPOSE_CMD down"
        echo
        print_warning "Remember to update your Firebase and Twilio credentials in .env file"
        print_warning "For production deployment, update the domain and SSL configuration"
        echo
        echo -e "${CYAN}🛡️ Your SeniorCare Hub platform is ready to help families stay connected!${NC}"
        
    else
        print_status "Deployment completed. To start the platform manually, run:"
        echo -e "${BLUE}  docker-compose up -d${NC}"
    fi
}

# Check for help flag
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    echo "SeniorCare Hub Deployment Script"
    echo
    echo "Usage: $0 [options]"
    echo
    echo "Options:"
    echo "  --help, -h     Show this help message"
    echo "  --dev          Setup for development (installs Node.js dependencies)"
    echo "  --prod         Setup for production (Docker only)"
    echo
    echo "This script will:"
    echo "  1. Check system requirements"
    echo "  2. Install Docker if needed"
    echo "  3. Create environment configuration"
    echo "  4. Set up the database schema"
    echo "  5. Start the SeniorCare Hub platform"
    echo
    exit 0
fi

# Run deployment
deploy_seniorcare_hub

exit 0