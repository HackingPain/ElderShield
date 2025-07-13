/**
 * SeniorCare Hub Family MDM Portal
 * 
 * Enterprise-grade Mobile Device Management solution for families
 * to remotely manage and monitor SeniorCare Hub tablets.
 */

import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// Types
interface TabletDevice {
  deviceId: string;
  seniorId: string;
  seniorName: string;
  model: string;
  osVersion: string;
  appVersion: string;
  status: 'online' | 'offline' | 'emergency' | 'low_battery' | 'maintenance';
  lastHeartbeat: Date;
  batteryLevel: number;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: Date;
  };
  settings: TabletSettings;
  healthMetrics: HealthMetrics;
}

interface TabletSettings {
  kioskMode: boolean;
  emergencyContacts: EmergencyContact[];
  medicationReminders: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
  accessibility: {
    fontSize: 'normal' | 'large' | 'extra_large';
    highContrast: boolean;
    voiceAssistance: boolean;
    hapticFeedback: boolean;
  };
  restrictions: {
    allowedApps: string[];
    blockedWebsites: string[];
    screenTimeLimit: number; // minutes per day
  };
}

interface HealthMetrics {
  lastCheckIn: Date;
  medicationCompliance: number; // percentage
  dailyActivity: {
    stepsCount?: number;
    exerciseMinutes: number;
    socialInteractions: number;
  };
  vitalSigns: {
    bloodPressure?: { systolic: number; diastolic: number };
    heartRate?: number;
    bloodGlucose?: number;
    weight?: number;
  };
  emergencyAlerts: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  isPrimary: boolean;
  notificationMethods: ('sms' | 'email' | 'push' | 'call')[];
}

interface RemoteCommand {
  id: string;
  deviceId: string;
  type: 'emergency_mode' | 'medication_reminder' | 'family_message' | 
        'update_settings' | 'restart_app' | 'lock_device' | 'locate_device';
  payload: any;
  status: 'pending' | 'sent' | 'acknowledged' | 'completed' | 'failed';
  createdAt: Date;
  executedAt?: Date;
}

// MDM Service Class
class SeniorCareMDMService {
  private devices: Map<string, TabletDevice> = new Map();
  private activeConnections: Map<string, WebSocket> = new Map();
  private commands: Map<string, RemoteCommand> = new Map();

  constructor(private app: express.Application, private wss: WebSocketServer) {
    this.setupRoutes();
    this.setupWebSocketHandlers();
    this.startHeartbeatMonitoring();
  }

  private setupRoutes() {
    // Device enrollment endpoint
    this.app.post('/api/mdm/enroll', async (req, res) => {
      try {
        const { enrollmentCode, deviceInfo } = req.body;
        
        // Validate enrollment code
        const enrollment = await this.validateEnrollmentCode(enrollmentCode);
        if (!enrollment) {
          return res.status(400).json({ error: 'Invalid enrollment code' });
        }

        // Create device record
        const device: TabletDevice = {
          deviceId: deviceInfo.deviceId || uuidv4(),
          seniorId: enrollment.seniorId,
          seniorName: enrollment.seniorName,
          model: deviceInfo.model,
          osVersion: deviceInfo.osVersion,
          appVersion: deviceInfo.appVersion,
          status: 'online',
          lastHeartbeat: new Date(),
          batteryLevel: 100,
          settings: this.getDefaultSettings(enrollment),
          healthMetrics: this.getDefaultHealthMetrics()
        };

        this.devices.set(device.deviceId, device);

        // Generate device certificate
        const deviceCertificate = this.generateDeviceCertificate(device);

        res.json({
          deviceId: device.deviceId,
          certificate: deviceCertificate,
          settings: device.settings,
          serverEndpoints: {
            heartbeat: '/api/mdm/heartbeat',
            commands: '/api/mdm/commands',
            emergency: '/api/mdm/emergency',
            health: '/api/mdm/health'
          }
        });

      } catch (error) {
        console.error('Device enrollment error:', error);
        res.status(500).json({ error: 'Enrollment failed' });
      }
    });

    // Device heartbeat endpoint
    this.app.post('/api/mdm/heartbeat', this.authenticateDevice, async (req, res) => {
      try {
        const { deviceId } = req.device;
        const { batteryLevel, location, status } = req.body;

        const device = this.devices.get(deviceId);
        if (!device) {
          return res.status(404).json({ error: 'Device not found' });
        }

        // Update device status
        device.lastHeartbeat = new Date();
        device.batteryLevel = batteryLevel;
        device.status = status;
        if (location) {
          device.location = {
            ...location,
            timestamp: new Date()
          };
        }

        // Check for pending commands
        const pendingCommands = this.getPendingCommands(deviceId);

        res.json({
          commands: pendingCommands,
          settings: device.settings,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ error: 'Heartbeat failed' });
      }
    });

    // Emergency alert endpoint
    this.app.post('/api/mdm/emergency', this.authenticateDevice, async (req, res) => {
      try {
        const { deviceId } = req.device;
        const { alertType, message, location, vitals } = req.body;

        const device = this.devices.get(deviceId);
        if (!device) {
          return res.status(404).json({ error: 'Device not found' });
        }

        // Update device status
        device.status = 'emergency';
        
        // Create emergency alert
        const emergencyAlert = {
          id: uuidv4(),
          deviceId,
          seniorId: device.seniorId,
          seniorName: device.seniorName,
          alertType,
          message,
          location,
          vitals,
          timestamp: new Date(),
          status: 'active'
        };

        // Notify family members
        await this.notifyFamily(device.seniorId, emergencyAlert);

        // Send to emergency services if critical
        if (alertType === 'critical' || alertType === 'fall_detected') {
          await this.notifyEmergencyServices(emergencyAlert);
        }

        res.json({ 
          acknowledged: true, 
          alertId: emergencyAlert.id,
          emergencyServices: alertType === 'critical'
        });

      } catch (error) {
        console.error('Emergency alert error:', error);
        res.status(500).json({ error: 'Emergency alert failed' });
      }
    });

    // Family portal - Get devices
    this.app.get('/api/family/devices', this.authenticateFamily, async (req, res) => {
      try {
        const { familyId } = req.user;
        
        const familyDevices = Array.from(this.devices.values())
          .filter(device => this.isDeviceInFamily(device, familyId));

        res.json({
          devices: familyDevices.map(device => ({
            ...device,
            // Don't expose sensitive internal data
            settings: {
              kioskMode: device.settings.kioskMode,
              accessibility: device.settings.accessibility,
              quietHours: device.settings.quietHours
            }
          }))
        });

      } catch (error) {
        console.error('Get devices error:', error);
        res.status(500).json({ error: 'Failed to get devices' });
      }
    });

    // Family portal - Send command
    this.app.post('/api/family/devices/:deviceId/command', this.authenticateFamily, async (req, res) => {
      try {
        const { deviceId } = req.params;
        const { type, payload } = req.body;
        const { familyId } = req.user;

        // Verify device belongs to family
        const device = this.devices.get(deviceId);
        if (!device || !this.isDeviceInFamily(device, familyId)) {
          return res.status(404).json({ error: 'Device not found or access denied' });
        }

        // Create command
        const command: RemoteCommand = {
          id: uuidv4(),
          deviceId,
          type,
          payload,
          status: 'pending',
          createdAt: new Date()
        };

        this.commands.set(command.id, command);

        // Send immediately if device is connected
        if (this.activeConnections.has(deviceId)) {
          this.sendCommandToDevice(deviceId, command);
        }

        res.json({ 
          commandId: command.id, 
          status: 'sent',
          message: `Command sent to ${device.seniorName}'s tablet`
        });

      } catch (error) {
        console.error('Send command error:', error);
        res.status(500).json({ error: 'Failed to send command' });
      }
    });

    // Family portal - Update device settings
    this.app.put('/api/family/devices/:deviceId/settings', this.authenticateFamily, async (req, res) => {
      try {
        const { deviceId } = req.params;
        const { settings } = req.body;
        const { familyId } = req.user;

        const device = this.devices.get(deviceId);
        if (!device || !this.isDeviceInFamily(device, familyId)) {
          return res.status(404).json({ error: 'Device not found or access denied' });
        }

        // Validate and update settings
        const updatedSettings = this.validateAndMergeSettings(device.settings, settings);
        device.settings = updatedSettings;

        // Send settings update command
        const command: RemoteCommand = {
          id: uuidv4(),
          deviceId,
          type: 'update_settings',
          payload: { settings: updatedSettings },
          status: 'pending',
          createdAt: new Date()
        };

        this.commands.set(command.id, command);

        if (this.activeConnections.has(deviceId)) {
          this.sendCommandToDevice(deviceId, command);
        }

        res.json({ 
          message: 'Settings updated successfully',
          settings: updatedSettings
        });

      } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
      }
    });

    // Family portal - Get device location
    this.app.get('/api/family/devices/:deviceId/location', this.authenticateFamily, async (req, res) => {
      try {
        const { deviceId } = req.params;
        const { familyId } = req.user;

        const device = this.devices.get(deviceId);
        if (!device || !this.isDeviceInFamily(device, familyId)) {
          return res.status(404).json({ error: 'Device not found or access denied' });
        }

        if (!device.location) {
          return res.status(404).json({ error: 'Location not available' });
        }

        res.json({
          location: device.location,
          seniorName: device.seniorName,
          lastUpdate: device.location.timestamp
        });

      } catch (error) {
        console.error('Get location error:', error);
        res.status(500).json({ error: 'Failed to get location' });
      }
    });

    // Family portal - Emergency command
    this.app.post('/api/family/devices/:deviceId/emergency', this.authenticateFamily, async (req, res) => {
      try {
        const { deviceId } = req.params;
        const { message } = req.body;
        const { familyId, memberName } = req.user;

        const device = this.devices.get(deviceId);
        if (!device || !this.isDeviceInFamily(device, familyId)) {
          return res.status(404).json({ error: 'Device not found or access denied' });
        }

        // Create emergency mode command
        const command: RemoteCommand = {
          id: uuidv4(),
          deviceId,
          type: 'emergency_mode',
          payload: { 
            message: message || `${memberName} needs to reach you urgently`,
            from: memberName,
            timestamp: new Date()
          },
          status: 'pending',
          createdAt: new Date()
        };

        this.commands.set(command.id, command);

        if (this.activeConnections.has(deviceId)) {
          this.sendCommandToDevice(deviceId, command);
        }

        res.json({ 
          message: 'Emergency message sent to tablet',
          commandId: command.id
        });

      } catch (error) {
        console.error('Emergency command error:', error);
        res.status(500).json({ error: 'Failed to send emergency command' });
      }
    });
  }

  private setupWebSocketHandlers() {
    this.wss.on('connection', (ws, req) => {
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          switch (message.type) {
            case 'device_connect':
              this.handleDeviceConnect(ws, message);
              break;
            case 'command_response':
              this.handleCommandResponse(message);
              break;
            case 'health_update':
              this.handleHealthUpdate(message);
              break;
            case 'family_connect':
              this.handleFamilyConnect(ws, message);
              break;
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        // Remove from active connections
        for (const [deviceId, connection] of this.activeConnections.entries()) {
          if (connection === ws) {
            this.activeConnections.delete(deviceId);
            this.updateDeviceStatus(deviceId, 'offline');
            break;
          }
        }
      });
    });
  }

  private handleDeviceConnect(ws: WebSocket, message: any) {
    const { deviceId, authToken } = message;
    
    // Verify device authentication
    if (this.verifyDeviceToken(deviceId, authToken)) {
      this.activeConnections.set(deviceId, ws);
      this.updateDeviceStatus(deviceId, 'online');
      
      ws.send(JSON.stringify({
        type: 'connection_confirmed',
        deviceId,
        timestamp: new Date()
      }));
    } else {
      ws.send(JSON.stringify({
        type: 'connection_rejected',
        reason: 'Invalid authentication'
      }));
      ws.close();
    }
  }

  private handleCommandResponse(message: any) {
    const { commandId, status, result } = message;
    
    const command = this.commands.get(commandId);
    if (command) {
      command.status = status;
      command.executedAt = new Date();
      
      // Notify family of command completion
      this.notifyFamilyOfCommandResult(command, result);
    }
  }

  private handleHealthUpdate(message: any) {
    const { deviceId, healthData } = message;
    
    const device = this.devices.get(deviceId);
    if (device) {
      device.healthMetrics = { ...device.healthMetrics, ...healthData };
      
      // Check for health anomalies
      this.checkHealthAnomalies(device);
    }
  }

  private handleFamilyConnect(ws: WebSocket, message: any) {
    const { familyId, authToken } = message;
    
    // Verify family authentication and setup real-time updates
    if (this.verifyFamilyToken(familyId, authToken)) {
      // Store family connection for real-time updates
      // Implementation depends on family notification requirements
    }
  }

  private sendCommandToDevice(deviceId: string, command: RemoteCommand) {
    const ws = this.activeConnections.get(deviceId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'command',
        command
      }));
      
      command.status = 'sent';
    }
  }

  private getPendingCommands(deviceId: string): RemoteCommand[] {
    return Array.from(this.commands.values())
      .filter(cmd => cmd.deviceId === deviceId && cmd.status === 'pending');
  }

  private startHeartbeatMonitoring() {
    setInterval(() => {
      const now = new Date();
      const offlineThreshold = 5 * 60 * 1000; // 5 minutes

      for (const [deviceId, device] of this.devices.entries()) {
        const timeSinceHeartbeat = now.getTime() - device.lastHeartbeat.getTime();
        
        if (timeSinceHeartbeat > offlineThreshold && device.status !== 'offline') {
          device.status = 'offline';
          this.notifyFamilyOfDeviceOffline(device);
        }
      }
    }, 60000); // Check every minute
  }

  private async notifyFamily(seniorId: string, alert: any) {
    // Implementation for family notifications
    // Email, SMS, push notifications, etc.
  }

  private async notifyEmergencyServices(alert: any) {
    // Implementation for emergency services notification
    // Only for critical alerts with proper verification
  }

  private checkHealthAnomalies(device: TabletDevice) {
    // Implementation for health anomaly detection
    // Alert family if concerning patterns detected
  }

  // Authentication middleware
  private authenticateDevice = (req: any, res: any, next: any) => {
    // Implement device certificate verification
    next();
  };

  private authenticateFamily = (req: any, res: any, next: any) => {
    // Implement family JWT verification
    next();
  };

  // Helper methods
  private validateEnrollmentCode(code: string): Promise<any> {
    // Implementation for enrollment code validation
    return Promise.resolve(null);
  }

  private generateDeviceCertificate(device: TabletDevice): string {
    // Implementation for device certificate generation
    return 'certificate';
  }

  private getDefaultSettings(enrollment: any): TabletSettings {
    return {
      kioskMode: true,
      emergencyContacts: [],
      medicationReminders: true,
      quietHours: {
        enabled: true,
        startTime: '22:00',
        endTime: '07:00'
      },
      accessibility: {
        fontSize: 'large',
        highContrast: false,
        voiceAssistance: false,
        hapticFeedback: true
      },
      restrictions: {
        allowedApps: ['com.seniorcarehub.android'],
        blockedWebsites: [],
        screenTimeLimit: 0 // unlimited
      }
    };
  }

  private getDefaultHealthMetrics(): HealthMetrics {
    return {
      lastCheckIn: new Date(),
      medicationCompliance: 0,
      dailyActivity: {
        exerciseMinutes: 0,
        socialInteractions: 0
      },
      vitalSigns: {},
      emergencyAlerts: {
        today: 0,
        thisWeek: 0,
        thisMonth: 0
      }
    };
  }

  private isDeviceInFamily(device: TabletDevice, familyId: string): boolean {
    // Implementation for family membership verification
    return true;
  }

  private validateAndMergeSettings(current: TabletSettings, updates: Partial<TabletSettings>): TabletSettings {
    // Implementation for settings validation and merging
    return { ...current, ...updates };
  }

  private verifyDeviceToken(deviceId: string, token: string): boolean {
    // Implementation for device token verification
    return true;
  }

  private verifyFamilyToken(familyId: string, token: string): boolean {
    // Implementation for family token verification
    return true;
  }

  private updateDeviceStatus(deviceId: string, status: TabletDevice['status']) {
    const device = this.devices.get(deviceId);
    if (device) {
      device.status = status;
    }
  }

  private notifyFamilyOfCommandResult(command: RemoteCommand, result: any) {
    // Implementation for family notifications
  }

  private notifyFamilyOfDeviceOffline(device: TabletDevice) {
    // Implementation for offline notifications
  }
}

// Express app setup
const app = express();
const server = require('http').createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static('public'));

// Initialize MDM service
const mdmService = new SeniorCareMDMService(app, wss);

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`SeniorCare MDM Portal running on port ${PORT}`);
});

export default SeniorCareMDMService;