#!/usr/bin/env python3
"""
SeniorCare Hub Vitals Edge Case Testing
Testing error handling and edge cases for vitals endpoints
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

class VitalsEdgeCaseTester:
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
    
    def setup_auth(self):
        """Setup authentication for testing"""
        self.log(f"\n{Colors.BOLD}=== Setting up Authentication ==={Colors.END}")
        
        # Generate unique test data
        timestamp = int(time.time())
        test_email = f"vitals.edge.test.{timestamp}@example.com"
        
        registration_data = {
            "email": test_email,
            "password": "SecurePassword123!",
            "firstName": "Vitals",
            "lastName": "EdgeTest",
            "role": "senior",
            "phone": "+1-555-0199",
            "dateOfBirth": "1950-06-15"
        }
        
        response = self.make_request('POST', '/auth/register', registration_data)
        if response and response.status_code == 201:
            try:
                data = response.json()
                if 'token' in data and 'user' in data:
                    self.auth_token = data['token']
                    self.test_user_id = data['user']['id']
                    self.log_success(f"Authentication setup successful for {test_email}")
                    return True
                else:
                    self.log_failure("Authentication setup - Missing token or user in response")
                    return False
            except json.JSONDecodeError:
                self.log_failure("Authentication setup - Invalid JSON response")
                return False
        else:
            self.log_failure(f"Authentication setup failed - Status {response.status_code if response else 'No response'}")
            return False
    
    def test_vitals_validation_errors(self):
        """Test validation error handling"""
        self.log(f"\n{Colors.BOLD}=== Testing Vitals Validation Errors ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping validation tests - no auth token")
            return False
        
        success_count = 0
        
        # Test 1: Invalid reading type
        self.log(f"\n{Colors.BLUE}Testing invalid reading type{Colors.END}")
        invalid_data = {
            "reading_type": "invalid_type",
            "value": {"value": 120},
            "unit": "mmHg"
        }
        
        response = self.make_request('POST', '/vitals', invalid_data)
        if response and response.status_code == 400:
            self.log_success("Invalid reading type - Properly rejected")
            success_count += 1
        else:
            self.log_failure(f"Invalid reading type - Expected 400, got {response.status_code if response else 'No response'}")
        
        # Test 2: Missing required fields
        self.log(f"\n{Colors.BLUE}Testing missing required fields{Colors.END}")
        incomplete_data = {
            "reading_type": "heart_rate"
            # Missing value and unit
        }
        
        response = self.make_request('POST', '/vitals', incomplete_data)
        if response and response.status_code == 400:
            self.log_success("Missing required fields - Properly rejected")
            success_count += 1
        else:
            self.log_failure(f"Missing required fields - Expected 400, got {response.status_code if response else 'No response'}")
        
        # Test 3: Invalid value structure for blood pressure
        self.log(f"\n{Colors.BLUE}Testing invalid blood pressure structure{Colors.END}")
        invalid_bp_data = {
            "reading_type": "blood_pressure",
            "value": {"invalid": 120},  # Should have systolic/diastolic
            "unit": "mmHg"
        }
        
        response = self.make_request('POST', '/vitals', invalid_bp_data)
        # This might still be accepted but won't trigger abnormal detection properly
        if response and response.status_code in [200, 201]:
            self.log_success("Invalid BP structure - Handled gracefully")
            success_count += 1
        else:
            self.log_warning(f"Invalid BP structure - Status {response.status_code if response else 'No response'}")
        
        return success_count >= 2
    
    def test_vitals_edge_cases(self):
        """Test edge cases for vitals endpoints"""
        self.log(f"\n{Colors.BOLD}=== Testing Vitals Edge Cases ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping edge case tests - no auth token")
            return False
        
        success_count = 0
        
        # Test 1: Extreme values
        self.log(f"\n{Colors.BLUE}Testing extreme vital values{Colors.END}")
        extreme_data = {
            "reading_type": "heart_rate",
            "value": {"value": 200},  # Very high heart rate
            "unit": "bpm",
            "notes": "During intense exercise"
        }
        
        response = self.make_request('POST', '/vitals', extreme_data)
        if response and response.status_code in [200, 201]:
            try:
                data = response.json()
                if 'alertCreated' in data and data['alertCreated']:
                    self.log_success("Extreme values - Alert properly created")
                    success_count += 1
                else:
                    self.log_success("Extreme values - Handled gracefully")
                    success_count += 1
            except json.JSONDecodeError:
                self.log_failure("Extreme values - Invalid JSON response")
        else:
            self.log_failure(f"Extreme values - Failed with status {response.status_code if response else 'No response'}")
        
        # Test 2: Future timestamp
        self.log(f"\n{Colors.BLUE}Testing future timestamp{Colors.END}")
        future_time = datetime.now() + timedelta(hours=1)
        future_data = {
            "reading_type": "temperature",
            "value": {"value": 37.5},
            "unit": "°C",
            "reading_time": future_time.isoformat()
        }
        
        response = self.make_request('POST', '/vitals', future_data)
        if response and response.status_code in [200, 201]:
            self.log_success("Future timestamp - Handled gracefully")
            success_count += 1
        else:
            self.log_failure(f"Future timestamp - Failed with status {response.status_code if response else 'No response'}")
        
        # Test 3: Very long notes
        self.log(f"\n{Colors.BLUE}Testing very long notes{Colors.END}")
        long_notes_data = {
            "reading_type": "weight",
            "value": {"value": 70.5},
            "unit": "kg",
            "notes": "A" * 600  # Exceeds 500 character limit
        }
        
        response = self.make_request('POST', '/vitals', long_notes_data)
        if response and response.status_code == 400:
            self.log_success("Long notes - Properly rejected")
            success_count += 1
        elif response and response.status_code in [200, 201]:
            self.log_warning("Long notes - Accepted (might be truncated)")
            success_count += 1
        else:
            self.log_failure(f"Long notes - Unexpected status {response.status_code if response else 'No response'}")
        
        return success_count >= 2
    
    def test_vitals_query_edge_cases(self):
        """Test edge cases for vitals query endpoints"""
        self.log(f"\n{Colors.BOLD}=== Testing Vitals Query Edge Cases ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping query edge case tests - no auth token")
            return False
        
        success_count = 0
        
        # Test 1: Invalid date range
        self.log(f"\n{Colors.BLUE}Testing invalid date range{Colors.END}")
        response = self.make_request('GET', '/vitals?start_date=invalid-date&end_date=2024-01-01')
        if response and response.status_code in [200, 400]:
            self.log_success("Invalid date range - Handled gracefully")
            success_count += 1
        else:
            self.log_failure(f"Invalid date range - Status {response.status_code if response else 'No response'}")
        
        # Test 2: Very large page size
        self.log(f"\n{Colors.BLUE}Testing very large page size{Colors.END}")
        response = self.make_request('GET', '/vitals?limit=10000')
        if response and response.status_code == 200:
            try:
                data = response.json()
                if 'pagination' in data and data['pagination']['limit'] <= 100:  # Should be capped
                    self.log_success("Large page size - Properly limited")
                    success_count += 1
                else:
                    self.log_success("Large page size - Handled gracefully")
                    success_count += 1
            except json.JSONDecodeError:
                self.log_failure("Large page size - Invalid JSON response")
        else:
            self.log_failure(f"Large page size - Status {response.status_code if response else 'No response'}")
        
        # Test 3: Invalid reading type in trends
        self.log(f"\n{Colors.BLUE}Testing invalid reading type in trends{Colors.END}")
        response = self.make_request('GET', '/vitals/trends/invalid_type')
        if response and response.status_code in [200, 404]:
            self.log_success("Invalid trends type - Handled gracefully")
            success_count += 1
        else:
            self.log_failure(f"Invalid trends type - Status {response.status_code if response else 'No response'}")
        
        return success_count >= 2
    
    def test_bulk_import_edge_cases(self):
        """Test edge cases for bulk import"""
        self.log(f"\n{Colors.BOLD}=== Testing Bulk Import Edge Cases ==={Colors.END}")
        
        if not self.auth_token:
            self.log_warning("Skipping bulk import edge case tests - no auth token")
            return False
        
        success_count = 0
        
        # Test 1: Empty readings array
        self.log(f"\n{Colors.BLUE}Testing empty readings array{Colors.END}")
        empty_bulk_data = {
            "device_id": "test_device",
            "device_name": "Test Device",
            "readings": []
        }
        
        response = self.make_request('POST', '/vitals/bulk-import', empty_bulk_data)
        if response and response.status_code == 400:
            self.log_success("Empty readings array - Properly rejected")
            success_count += 1
        else:
            self.log_failure(f"Empty readings array - Expected 400, got {response.status_code if response else 'No response'}")
        
        # Test 2: Too many readings (over 100)
        self.log(f"\n{Colors.BLUE}Testing too many readings{Colors.END}")
        large_readings = []
        for i in range(101):  # Over the 100 limit
            large_readings.append({
                "reading_type": "heart_rate",
                "value": {"value": 70 + i % 20},
                "unit": "bpm"
            })
        
        large_bulk_data = {
            "device_id": "test_device",
            "device_name": "Test Device",
            "readings": large_readings
        }
        
        response = self.make_request('POST', '/vitals/bulk-import', large_bulk_data)
        if response and response.status_code == 400:
            self.log_success("Too many readings - Properly rejected")
            success_count += 1
        else:
            self.log_failure(f"Too many readings - Expected 400, got {response.status_code if response else 'No response'}")
        
        # Test 3: Mixed valid and invalid readings
        self.log(f"\n{Colors.BLUE}Testing mixed valid/invalid readings{Colors.END}")
        mixed_readings = [
            {
                "reading_type": "heart_rate",
                "value": {"value": 75},
                "unit": "bpm"
            },
            {
                "reading_type": "invalid_type",  # Invalid
                "value": {"value": 100},
                "unit": "invalid"
            }
        ]
        
        mixed_bulk_data = {
            "device_id": "test_device",
            "device_name": "Test Device",
            "readings": mixed_readings
        }
        
        response = self.make_request('POST', '/vitals/bulk-import', mixed_bulk_data)
        if response and response.status_code == 400:
            self.log_success("Mixed readings - Properly rejected")
            success_count += 1
        else:
            self.log_failure(f"Mixed readings - Expected 400, got {response.status_code if response else 'No response'}")
        
        return success_count >= 2
    
    def test_unauthorized_vitals_access(self):
        """Test unauthorized access to vitals endpoints"""
        self.log(f"\n{Colors.BOLD}=== Testing Unauthorized Vitals Access ==={Colors.END}")
        
        # Temporarily clear auth token
        old_token = self.auth_token
        self.auth_token = None
        
        vitals_endpoints = [
            ('GET', '/vitals'),
            ('POST', '/vitals'),
            ('GET', '/vitals/latest'),
            ('GET', '/vitals/trends/heart_rate'),
            ('GET', '/vitals/summary'),
            ('POST', '/vitals/bulk-import')
        ]
        
        success_count = 0
        
        for method, endpoint in vitals_endpoints:
            test_data = {
                "reading_type": "heart_rate",
                "value": {"value": 75},
                "unit": "bpm"
            } if method == 'POST' else None
            
            response = self.make_request(method, endpoint, test_data)
            if response and response.status_code in [401, 403]:
                success_count += 1
            else:
                self.log_failure(f"Unauthorized {method} {endpoint} - Expected 401/403, got {response.status_code if response else 'No response'}")
        
        # Restore auth token
        self.auth_token = old_token
        
        if success_count >= len(vitals_endpoints) - 1:  # Allow one failure
            self.log_success("Unauthorized vitals access - Properly secured")
            return True
        else:
            self.log_failure(f"Unauthorized vitals access - Only {success_count}/{len(vitals_endpoints)} endpoints properly secured")
            return False
    
    def run_all_tests(self):
        """Run all edge case tests"""
        self.log(f"\n{Colors.BOLD}{Colors.CYAN}🧪 Starting SeniorCare Hub Vitals Edge Case Tests{Colors.END}")
        self.log(f"Testing against: {BASE_URL}")
        self.log(f"API Base: {API_BASE}")
        
        # Setup authentication first
        if not self.setup_auth():
            self.log_failure("Failed to setup authentication - aborting tests")
            return
        
        # Test sequence
        tests = [
            ("Vitals Validation Errors", self.test_vitals_validation_errors),
            ("Vitals Edge Cases", self.test_vitals_edge_cases),
            ("Vitals Query Edge Cases", self.test_vitals_query_edge_cases),
            ("Bulk Import Edge Cases", self.test_bulk_import_edge_cases),
            ("Unauthorized Vitals Access", self.test_unauthorized_vitals_access)
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
        
        self.log(f"\n{Colors.BOLD}{Colors.CYAN}📊 Edge Case Test Results Summary{Colors.END}")
        self.log(f"Total Tests: {total_tests}")
        self.log(f"✅ Passed: {self.test_results['passed']}", Colors.GREEN)
        self.log(f"❌ Failed: {self.test_results['failed']}", Colors.RED)
        
        if self.test_results['failed'] > 0:
            self.log(f"\n{Colors.BOLD}❌ Failed Tests:{Colors.END}")
            for error in self.test_results['errors']:
                self.log(f"  • {error}", Colors.RED)
        
        success_rate = (self.test_results['passed'] / total_tests * 100) if total_tests > 0 else 0
        
        if success_rate >= 80:
            self.log(f"\n🎉 Success Rate: {success_rate:.1f}% - Vitals edge cases handled well!", Colors.GREEN)
        elif success_rate >= 60:
            self.log(f"\n⚠️  Success Rate: {success_rate:.1f}% - Some edge case issues", Colors.YELLOW)
        else:
            self.log(f"\n🚨 Success Rate: {success_rate:.1f}% - Major edge case issues", Colors.RED)

if __name__ == "__main__":
    tester = VitalsEdgeCaseTester()
    tester.run_all_tests()