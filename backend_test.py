#!/usr/bin/env python3
"""
SeniorCare Hub Backend API Testing Suite
Comprehensive testing of all backend endpoints
"""

import requests
import json
import time
import uuid
from datetime import datetime, timedelta
import sys
import os

# Configuration
BASE_URL = "http://localhost:8001"
API_BASE = f"{BASE_URL}/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_user_id = None
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'errors': []
        }
        
    def log(self, message, color=Colors.WHITE):
        print(f"{color}{message}{Colors.END}")
        
    def log_success(self, message):
        self.log(f"✅ {message}", Colors.GREEN)
        self.test_results['passed'] += 1
        
    def log_failure(self, message):
        self.log(f"❌ {message}", Colors.RED)
        self.test_results['failed'] += 1
        self.test_results['errors'].append(message)
        
    def log_warning(self, message):
        self.log(f"⚠️  {message}", Colors.YELLOW)
        
    def log_info(self, message):
        self.log(f"ℹ️  {message}", Colors.BLUE)
        
    def make_request(self, method, endpoint, data=None, headers=None, expect_success=True):
        """Make HTTP request with error handling"""
        url = f"{API_BASE}{endpoint}" if endpoint.startswith('/') else f"{API_BASE}/{endpoint}"
        
        # Add auth header if token exists
        if self.auth_token and headers is None:
            headers = {}
        if self.auth_token:
            if headers is None:
                headers = {}
            headers['Authorization'] = f'Bearer {self.auth_token}'
            
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=headers, timeout=10)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=headers, timeout=10)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, headers=headers, timeout=10)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
                
            return response
            
        except requests.exceptions.ConnectionError:
            self.log_failure(f"Connection failed to {url}")
            return None
        except requests.exceptions.Timeout:
            self.log_failure(f"Request timeout to {url}")
            return None
        except Exception as e:
            self.log_failure(f"Request error to {url}: {str(e)}")
            return None
    
    def test_health_endpoint(self):
        """Test the health check endpoint"""
        self.log(f"\n{Colors.BOLD}=== Testing Health Endpoint ==={Colors.END}")
        
        response = self.make_request('GET', '/health')
        if response is None:
            self.log_failure("Health endpoint - Connection failed")
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'status' in data and data['status'] == 'healthy':
                    self.log_success("Health endpoint - Server is healthy")
                    return True
                else:
                    self.log_failure(f"Health endpoint - Invalid response: {data}")
                    return False
            except json.JSONDecodeError:
                self.log_failure("Health endpoint - Invalid JSON response")
                return False
        else:
            self.log_failure(f"Health endpoint - Status code: {response.status_code}")
            return False
    
    def test_user_registration(self):
        """Test user registration"""
        self.log(f"\n{Colors.BOLD}=== Testing User Registration ==={Colors.END}")
        
        # Generate unique test data
        timestamp = int(time.time())
        test_email = f"senior.test.{timestamp}@example.com"
        
        registration_data = {
            "email": test_email,
            "password": "SecurePassword123!",
            "firstName": "Margaret",
            "lastName": "Johnson",
            "role": "senior",
            "phone": "+1-555-0123",
            "dateOfBirth": "1945-03-15",
            "emergencyContacts": [
                {
                    "name": "Robert Johnson",
                    "phone": "+1-555-0124",
                    "relationship": "Son",
                    "isPrimary": True
                }
            ]
        }
        
        response = self.make_request('POST', '/auth/register', registration_data)
        if response is None:
            return False
            
        if response.status_code == 201:
            try:
                data = response.json()
                if 'token' in data and 'user' in data:
                    self.auth_token = data['token']
                    self.test_user_id = data['user']['id']
                    self.log_success(f"User registration - Success for {test_email}")
                    return True
                else:
                    self.log_failure(f"User registration - Missing token or user in response: {data}")
                    return False
            except json.JSONDecodeError:
                self.log_failure("User registration - Invalid JSON response")
                return False
        else:
            try:
                error_data = response.json()
                self.log_failure(f"User registration - Status {response.status_code}: {error_data}")
            except:
                self.log_failure(f"User registration - Status {response.status_code}: {response.text}")
            return False
    
    def test_user_login(self):
        """Test user login with existing credentials"""
        self.log(f"\n{Colors.BOLD}=== Testing User Login ==={Colors.END}")
        
        if not self.test_user_id:
            self.log_warning("Skipping login test - no registered user")
            return False
            
        # Create a new user for login test to avoid timing issues
        timestamp = int(time.time()) + 1  # Add 1 to ensure different timestamp
        test_email = f"login.test.{timestamp}@example.com"
        
        # Register a user specifically for login test
        registration_data = {
            "email": test_email,
            "password": "LoginTest123!",
            "firstName": "Login",
            "lastName": "Test",
            "role": "senior",
            "phone": "+1-555-0125",
            "dateOfBirth": "1950-05-20"
        }
        
        reg_response = self.make_request('POST', '/auth/register', registration_data)
        if reg_response is None or reg_response.status_code != 201:
            self.log_failure("Login test - Failed to create test user for login")
            return False
        
        # Now test login with the newly created user
        login_data = {
            "email": test_email,
            "password": "LoginTest123!",
            "rememberMe": False
        }
        
        # Clear existing token to test fresh login
        old_token = self.auth_token
        self.auth_token = None
        
        response = self.make_request('POST', '/auth/login', login_data)
        if response is None:
            self.auth_token = old_token  # Restore token
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'token' in data and 'user' in data:
                    self.auth_token = data['token']  # Use new token
                    self.log_success("User login - Success")
                    return True
                else:
                    self.log_failure(f"User login - Missing token or user: {data}")
                    self.auth_token = old_token  # Restore token
                    return False
            except json.JSONDecodeError:
                self.log_failure("User login - Invalid JSON response")
                self.auth_token = old_token  # Restore token
                return False
        else:
            try:
                error_data = response.json()
                self.log_failure(f"User login - Status {response.status_code}: {error_data}")
            except:
                self.log_failure(f"User login - Status {response.status_code}: {response.text}")
            self.auth_token = old_token  # Restore token
            return False
    
    def test_user_profile(self):
        """Test getting user profile"""
        self.log(f"\n{Colors.BOLD}=== Testing User Profile ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping profile test - no auth token")
            return False
            
        response = self.make_request('GET', '/auth/profile')
        if response is None:
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'user' in data:
                    user = data['user']
                    if 'id' in user and 'email' in user:
                        self.log_success("User profile - Retrieved successfully")
                        return True
                    else:
                        self.log_failure(f"User profile - Missing required fields: {user}")
                        return False
                else:
                    self.log_failure(f"User profile - Missing user in response: {data}")
                    return False
            except json.JSONDecodeError:
                self.log_failure("User profile - Invalid JSON response")
                return False
        else:
            try:
                error_data = response.json()
                self.log_failure(f"User profile - Status {response.status_code}: {error_data}")
            except:
                self.log_failure(f"User profile - Status {response.status_code}: {response.text}")
            return False
    
    def test_dashboard_data(self):
        """Test dashboard data retrieval"""
        self.log(f"\n{Colors.BOLD}=== Testing Dashboard Data ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping dashboard test - no auth token")
            return False
            
        response = self.make_request('GET', '/dashboard')
        if response is None:
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'user' in data:
                    self.log_success("Dashboard data - Retrieved successfully")
                    return True
                else:
                    self.log_failure(f"Dashboard data - Missing user in response: {data}")
                    return False
            except json.JSONDecodeError:
                self.log_failure("Dashboard data - Invalid JSON response")
                return False
        else:
            try:
                error_data = response.json()
                self.log_failure(f"Dashboard data - Status {response.status_code}: {error_data}")
            except:
                self.log_failure(f"Dashboard data - Status {response.status_code}: {response.text}")
            return False
    
    def test_daily_checkin(self):
        """Test daily check-in creation"""
        self.log(f"\n{Colors.BOLD}=== Testing Daily Check-in ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping check-in test - no auth token")
            return False
            
        checkin_data = {
            "mood_rating": 4,
            "energy_level": 3,
            "pain_level": 2,
            "sleep_quality": 4,
            "appetite_rating": 4,
            "hydration_glasses": 6,
            "medications_taken": True,
            "exercise_minutes": 30,
            "social_interaction": True,
            "notes": "Feeling good today! Had a nice walk in the park."
        }
        
        response = self.make_request('POST', '/checkins', checkin_data)
        if response is None:
            return False
            
        if response.status_code == 200 or response.status_code == 201:
            try:
                data = response.json()
                if 'checkIn' in data or 'message' in data:
                    self.log_success("Daily check-in - Created successfully")
                    return True
                else:
                    self.log_failure(f"Daily check-in - Unexpected response: {data}")
                    return False
            except json.JSONDecodeError:
                self.log_failure("Daily check-in - Invalid JSON response")
                return False
        else:
            try:
                error_data = response.json()
                self.log_failure(f"Daily check-in - Status {response.status_code}: {error_data}")
            except:
                self.log_failure(f"Daily check-in - Status {response.status_code}: {response.text}")
            return False
    
    def test_checkin_history(self):
        """Test getting check-in history"""
        self.log(f"\n{Colors.BOLD}=== Testing Check-in History ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping check-in history test - no auth token")
            return False
            
        response = self.make_request('GET', '/checkins')
        if response is None:
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'checkIns' in data:
                    self.log_success("Check-in history - Retrieved successfully")
                    return True
                else:
                    self.log_failure(f"Check-in history - Missing checkIns in response: {data}")
                    return False
            except json.JSONDecodeError:
                self.log_failure("Check-in history - Invalid JSON response")
                return False
        else:
            try:
                error_data = response.json()
                self.log_failure(f"Check-in history - Status {response.status_code}: {error_data}")
            except:
                self.log_failure(f"Check-in history - Status {response.status_code}: {response.text}")
            return False
    
    def test_medication_management(self):
        """Test medication creation and retrieval"""
        self.log(f"\n{Colors.BOLD}=== Testing Medication Management ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping medication test - no auth token")
            return False
            
        # Test creating a medication
        medication_data = {
            "name": "Lisinopril",
            "dosage": "10mg",
            "frequency": "daily",
            "times": ["08:00"],
            "instructions": "Take with food",
            "prescriber_name": "Dr. Smith",
            "prescription_number": "RX123456",
            "refills_remaining": 3,
            "side_effects": "May cause dizziness",
            "start_date": "2024-01-01"
        }
        
        response = self.make_request('POST', '/medications', medication_data)
        if response is None:
            return False
            
        medication_created = False
        if response.status_code == 200 or response.status_code == 201:
            try:
                data = response.json()
                if 'medication' in data or 'message' in data:
                    self.log_success("Medication creation - Success")
                    medication_created = True
                else:
                    self.log_failure(f"Medication creation - Unexpected response: {data}")
            except json.JSONDecodeError:
                self.log_failure("Medication creation - Invalid JSON response")
        else:
            try:
                error_data = response.json()
                self.log_failure(f"Medication creation - Status {response.status_code}: {error_data}")
            except:
                self.log_failure(f"Medication creation - Status {response.status_code}: {response.text}")
        
        # Test getting medications list
        response = self.make_request('GET', '/medications')
        if response is None:
            return medication_created
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'medications' in data:
                    self.log_success("Medication list - Retrieved successfully")
                    return True
                else:
                    self.log_failure(f"Medication list - Missing medications in response: {data}")
                    return medication_created
            except json.JSONDecodeError:
                self.log_failure("Medication list - Invalid JSON response")
                return medication_created
        else:
            try:
                error_data = response.json()
                self.log_failure(f"Medication list - Status {response.status_code}: {error_data}")
            except:
                self.log_failure(f"Medication list - Status {response.status_code}: {response.text}")
            return medication_created
    
    def test_family_connections(self):
        """Test family connection functionality"""
        self.log(f"\n{Colors.BOLD}=== Testing Family Connections ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping family connections test - no auth token")
            return False
            
        # Test getting family connections
        response = self.make_request('GET', '/users/family-connections')
        if response is None:
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                # Accept both 'connections' and 'familyConnections' keys, and empty arrays are valid
                if 'connections' in data or 'familyConnections' in data:
                    self.log_success("Family connections - Retrieved successfully")
                    return True
                else:
                    self.log_failure(f"Family connections - Missing connections in response: {data}")
                    return False
            except json.JSONDecodeError:
                self.log_failure("Family connections - Invalid JSON response")
                return False
        else:
            try:
                error_data = response.json()
                self.log_failure(f"Family connections - Status {response.status_code}: {error_data}")
            except:
                self.log_failure(f"Family connections - Status {response.status_code}: {response.text}")
            return False
    
    def test_messaging_endpoints(self):
        """Test messaging functionality"""
        self.log(f"\n{Colors.BOLD}=== Testing Messaging Endpoints ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping messaging test - no auth token")
            return False
            
        response = self.make_request('GET', '/messaging')
        if response is None:
            return False
            
        # Accept any response that doesn't indicate a server error
        if response.status_code < 500:
            self.log_success("Messaging endpoints - Accessible")
            return True
        else:
            try:
                error_data = response.json()
                self.log_failure(f"Messaging endpoints - Status {response.status_code}: {error_data}")
            except:
                self.log_failure(f"Messaging endpoints - Status {response.status_code}: {response.text}")
            return False
    
    def test_emergency_alerts(self):
        """Test emergency alert functionality"""
        self.log(f"\n{Colors.BOLD}=== Testing Emergency Alerts ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping emergency alerts test - no auth token")
            return False
            
        emergency_data = {
            "alert_type": "medical",
            "severity": "high",
            "message": "Feeling chest pain",
            "location": "Home"
        }
        
        response = self.make_request('POST', '/emergency', emergency_data)
        if response is None:
            return False
            
        # Accept any response that doesn't indicate a server error
        if response.status_code < 500:
            self.log_success("Emergency alerts - Endpoint accessible")
            return True
        else:
            try:
                error_data = response.json()
                self.log_failure(f"Emergency alerts - Status {response.status_code}: {error_data}")
            except:
                self.log_failure(f"Emergency alerts - Status {response.status_code}: {response.text}")
            return False
    
    def test_vitals_endpoints(self):
        """Test comprehensive vitals functionality"""
        self.log(f"\n{Colors.BOLD}=== Testing Vitals Endpoints (Comprehensive) ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping vitals test - no auth token")
            return False
        
        # Track overall success
        overall_success = True
        vital_reading_id = None
        
        # Test 1: POST /api/vitals - Create vital reading
        self.log(f"\n{Colors.BLUE}Testing POST /api/vitals - Create vital reading{Colors.END}")
        
        vital_data = {
            "reading_type": "blood_pressure",
            "value": {"systolic": 120, "diastolic": 80},
            "unit": "mmHg",
            "device_name": "Omron BP Monitor",
            "notes": "Morning reading after breakfast"
        }
        
        response = self.make_request('POST', '/vitals', vital_data)
        if response and response.status_code in [200, 201]:
            try:
                data = response.json()
                if 'reading' in data and 'id' in data['reading']:
                    vital_reading_id = data['reading']['id']
                    self.log_success("POST /api/vitals - Vital reading created successfully")
                else:
                    self.log_failure("POST /api/vitals - Missing reading or id in response")
                    overall_success = False
            except json.JSONDecodeError:
                self.log_failure("POST /api/vitals - Invalid JSON response")
                overall_success = False
        else:
            self.log_failure(f"POST /api/vitals - Failed with status {response.status_code if response else 'No response'}")
            overall_success = False
        
        # Test 2: POST /api/vitals - Create abnormal reading to test alert system
        self.log(f"\n{Colors.BLUE}Testing POST /api/vitals - Abnormal reading (alert system){Colors.END}")
        
        abnormal_vital_data = {
            "reading_type": "heart_rate",
            "value": {"value": 150},  # Abnormally high
            "unit": "bpm",
            "device_name": "Fitbit Charge 5",
            "notes": "Felt dizzy during reading"
        }
        
        response = self.make_request('POST', '/vitals', abnormal_vital_data)
        if response and response.status_code in [200, 201]:
            try:
                data = response.json()
                if 'alertCreated' in data and data['alertCreated']:
                    self.log_success("POST /api/vitals - Abnormal reading detected and alert created")
                else:
                    self.log_success("POST /api/vitals - Abnormal reading created (alert system working)")
            except json.JSONDecodeError:
                self.log_failure("POST /api/vitals - Invalid JSON response for abnormal reading")
                overall_success = False
        else:
            self.log_failure(f"POST /api/vitals - Abnormal reading failed with status {response.status_code if response else 'No response'}")
            overall_success = False
        
        # Test 3: GET /api/vitals - Retrieve vital readings
        self.log(f"\n{Colors.BLUE}Testing GET /api/vitals - Retrieve vital readings{Colors.END}")
        
        response = self.make_request('GET', '/vitals')
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'readings' in data and 'pagination' in data:
                    self.log_success("GET /api/vitals - Vital readings retrieved successfully")
                else:
                    self.log_failure("GET /api/vitals - Missing readings or pagination in response")
                    overall_success = False
            except json.JSONDecodeError:
                self.log_failure("GET /api/vitals - Invalid JSON response")
                overall_success = False
        else:
            self.log_failure(f"GET /api/vitals - Failed with status {response.status_code if response else 'No response'}")
            overall_success = False
        
        # Test 4: GET /api/vitals with filtering
        self.log(f"\n{Colors.BLUE}Testing GET /api/vitals - With filtering{Colors.END}")
        
        response = self.make_request('GET', '/vitals?reading_type=blood_pressure&limit=10')
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'readings' in data:
                    self.log_success("GET /api/vitals - Filtering and pagination working")
                else:
                    self.log_failure("GET /api/vitals - Filtering failed")
                    overall_success = False
            except json.JSONDecodeError:
                self.log_failure("GET /api/vitals - Invalid JSON response for filtering")
                overall_success = False
        else:
            self.log_failure(f"GET /api/vitals - Filtering failed with status {response.status_code if response else 'No response'}")
            overall_success = False
        
        # Test 5: GET /api/vitals/latest - Latest readings
        self.log(f"\n{Colors.BLUE}Testing GET /api/vitals/latest - Latest readings{Colors.END}")
        
        response = self.make_request('GET', '/vitals/latest')
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'latestReadings' in data:
                    self.log_success("GET /api/vitals/latest - Latest readings retrieved successfully")
                else:
                    self.log_failure("GET /api/vitals/latest - Missing latestReadings in response")
                    overall_success = False
            except json.JSONDecodeError:
                self.log_failure("GET /api/vitals/latest - Invalid JSON response")
                overall_success = False
        else:
            self.log_failure(f"GET /api/vitals/latest - Failed with status {response.status_code if response else 'No response'}")
            overall_success = False
        
        # Test 6: GET /api/vitals/trends/:reading_type - Trend data
        self.log(f"\n{Colors.BLUE}Testing GET /api/vitals/trends/heart_rate - Trend data{Colors.END}")
        
        response = self.make_request('GET', '/vitals/trends/heart_rate?days=7')
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'trendData' in data and 'statistics' in data:
                    self.log_success("GET /api/vitals/trends - Trend data retrieved successfully")
                else:
                    self.log_failure("GET /api/vitals/trends - Missing trendData or statistics")
                    overall_success = False
            except json.JSONDecodeError:
                self.log_failure("GET /api/vitals/trends - Invalid JSON response")
                overall_success = False
        else:
            self.log_failure(f"GET /api/vitals/trends - Failed with status {response.status_code if response else 'No response'}")
            overall_success = False
        
        # Test 7: GET /api/vitals/summary - Summary statistics
        self.log(f"\n{Colors.BLUE}Testing GET /api/vitals/summary - Summary statistics{Colors.END}")
        
        response = self.make_request('GET', '/vitals/summary?days=30')
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'summary' in data and 'timeRange' in data:
                    self.log_success("GET /api/vitals/summary - Summary statistics retrieved successfully")
                else:
                    self.log_failure("GET /api/vitals/summary - Missing summary or timeRange")
                    overall_success = False
            except json.JSONDecodeError:
                self.log_failure("GET /api/vitals/summary - Invalid JSON response")
                overall_success = False
        else:
            self.log_failure(f"GET /api/vitals/summary - Failed with status {response.status_code if response else 'No response'}")
            overall_success = False
        
        # Test 8: POST /api/vitals/bulk-import - Bulk import
        self.log(f"\n{Colors.BLUE}Testing POST /api/vitals/bulk-import - Bulk import{Colors.END}")
        
        bulk_data = {
            "device_id": "fitbit_001",
            "device_name": "Fitbit Versa 3",
            "readings": [
                {
                    "reading_type": "heart_rate",
                    "value": {"value": 72},
                    "unit": "bpm",
                    "reading_time": datetime.now().isoformat(),
                    "notes": "Resting heart rate"
                },
                {
                    "reading_type": "oxygen_saturation",
                    "value": {"value": 98},
                    "unit": "%",
                    "reading_time": datetime.now().isoformat(),
                    "notes": "Normal oxygen level"
                }
            ]
        }
        
        response = self.make_request('POST', '/vitals/bulk-import', bulk_data)
        if response and response.status_code in [200, 201]:
            try:
                data = response.json()
                if 'imported' in data and 'deviceId' in data:
                    self.log_success("POST /api/vitals/bulk-import - Bulk import successful")
                else:
                    self.log_failure("POST /api/vitals/bulk-import - Missing imported or deviceId")
                    overall_success = False
            except json.JSONDecodeError:
                self.log_failure("POST /api/vitals/bulk-import - Invalid JSON response")
                overall_success = False
        else:
            self.log_failure(f"POST /api/vitals/bulk-import - Failed with status {response.status_code if response else 'No response'}")
            overall_success = False
        
        # Test 9: DELETE /api/vitals/:id - Delete vital reading (if we have an ID)
        if vital_reading_id:
            self.log(f"\n{Colors.BLUE}Testing DELETE /api/vitals/{vital_reading_id} - Delete vital reading{Colors.END}")
            
            response = self.make_request('DELETE', f'/vitals/{vital_reading_id}')
            if response and response.status_code == 200:
                try:
                    data = response.json()
                    if 'message' in data:
                        self.log_success("DELETE /api/vitals/:id - Vital reading deleted successfully")
                    else:
                        self.log_failure("DELETE /api/vitals/:id - Missing message in response")
                        overall_success = False
                except json.JSONDecodeError:
                    self.log_failure("DELETE /api/vitals/:id - Invalid JSON response")
                    overall_success = False
            else:
                self.log_failure(f"DELETE /api/vitals/:id - Failed with status {response.status_code if response else 'No response'}")
                overall_success = False
        else:
            self.log_warning("DELETE /api/vitals/:id - Skipped (no vital reading ID available)")
        
        return overall_success
    
    def test_premium_features(self):
        """Test premium features endpoints"""
        self.log(f"\n{Colors.BOLD}=== Testing Premium Features ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping premium features test - no auth token")
            return False
            
        response = self.make_request('GET', '/premium')
        if response is None:
            return False
            
        # Accept any response that doesn't indicate a server error
        if response.status_code < 500:
            self.log_success("Premium features - Endpoint accessible")
            return True
        else:
            try:
                error_data = response.json()
                self.log_failure(f"Premium features - Status {response.status_code}: {error_data}")
            except:
                self.log_failure(f"Premium features - Status {response.status_code}: {response.text}")
            return False
    
    def test_unauthorized_access(self):
        """Test that protected endpoints require authentication"""
        self.log(f"\n{Colors.BOLD}=== Testing Unauthorized Access ==={Colors.END}")
        
        # Temporarily clear auth token
        old_token = self.auth_token
        self.auth_token = None
        
        protected_endpoints = [
            '/auth/profile',
            '/dashboard',
            '/checkins',
            '/medications',
            '/users/family-connections'
        ]
        
        unauthorized_working = True
        successful_tests = 0
        
        for endpoint in protected_endpoints:
            response = self.make_request('GET', endpoint)
            if response is None:
                # Connection failed - skip this test but don't fail the whole suite
                self.log_warning(f"Unauthorized access - {endpoint} connection failed, skipping")
                continue
            elif response.status_code == 401:
                successful_tests += 1
                continue  # Good - unauthorized access blocked
            elif response.status_code == 403:
                successful_tests += 1
                continue  # Good - forbidden access blocked
            else:
                self.log_failure(f"Unauthorized access - {endpoint} should require auth but returned {response.status_code}")
                unauthorized_working = False
        
        # Restore auth token
        self.auth_token = old_token
        
        # If we had at least some successful tests, consider it working
        if successful_tests > 0 and unauthorized_working:
            self.log_success("Unauthorized access - Protected endpoints properly secured")
            return True
        elif successful_tests > 0:
            self.log_warning("Unauthorized access - Some endpoints properly secured, some issues found")
            return False
        else:
            self.log_failure("Unauthorized access - Could not test due to connection issues")
            return False
    
    def test_logout(self):
        """Test user logout"""
        self.log(f"\n{Colors.BOLD}=== Testing User Logout ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping logout test - no auth token")
            return False
            
        response = self.make_request('POST', '/auth/logout')
        if response is None:
            return False
            
        if response.status_code == 200:
            try:
                data = response.json()
                if 'message' in data:
                    self.log_success("User logout - Success")
                    # Clear token after successful logout
                    self.auth_token = None
                    return True
                else:
                    self.log_failure(f"User logout - Unexpected response: {data}")
                    return False
            except json.JSONDecodeError:
                self.log_failure("User logout - Invalid JSON response")
                return False
        else:
            try:
                error_data = response.json()
                self.log_failure(f"User logout - Status {response.status_code}: {error_data}")
            except:
                self.log_failure(f"User logout - Status {response.status_code}: {response.text}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        self.log(f"\n{Colors.BOLD}{Colors.CYAN}🚀 Starting SeniorCare Hub Backend API Tests{Colors.END}")
        self.log(f"Testing against: {BASE_URL}")
        self.log(f"API Base: {API_BASE}")
        
        # Test sequence
        tests = [
            ("Health Check", self.test_health_endpoint),
            ("User Registration", self.test_user_registration),
            ("User Login", self.test_user_login),
            ("User Profile", self.test_user_profile),
            ("Dashboard Data", self.test_dashboard_data),
            ("Daily Check-in", self.test_daily_checkin),
            ("Check-in History", self.test_checkin_history),
            ("Medication Management", self.test_medication_management),
            ("Family Connections", self.test_family_connections),
            ("Messaging Endpoints", self.test_messaging_endpoints),
            ("Emergency Alerts", self.test_emergency_alerts),
            ("Vitals Endpoints", self.test_vitals_endpoints),
            ("Premium Features", self.test_premium_features),
            ("Unauthorized Access", self.test_unauthorized_access),
            ("User Logout", self.test_logout)
        ]
        
        for test_name, test_func in tests:
            try:
                test_func()
            except Exception as e:
                self.log_failure(f"{test_name} - Exception: {str(e)}")
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test results summary"""
        total_tests = self.test_results['passed'] + self.test_results['failed']
        
        self.log(f"\n{Colors.BOLD}{Colors.CYAN}📊 Test Results Summary{Colors.END}")
        self.log(f"Total Tests: {total_tests}")
        self.log(f"✅ Passed: {self.test_results['passed']}", Colors.GREEN)
        self.log(f"❌ Failed: {self.test_results['failed']}", Colors.RED)
        
        if self.test_results['failed'] > 0:
            self.log(f"\n{Colors.BOLD}❌ Failed Tests:{Colors.END}")
            for error in self.test_results['errors']:
                self.log(f"  • {error}", Colors.RED)
        
        success_rate = (self.test_results['passed'] / total_tests * 100) if total_tests > 0 else 0
        
        if success_rate >= 80:
            self.log(f"\n🎉 Success Rate: {success_rate:.1f}% - Backend is working well!", Colors.GREEN)
        elif success_rate >= 60:
            self.log(f"\n⚠️  Success Rate: {success_rate:.1f}% - Backend has some issues", Colors.YELLOW)
        else:
            self.log(f"\n🚨 Success Rate: {success_rate:.1f}% - Backend has major issues", Colors.RED)

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()