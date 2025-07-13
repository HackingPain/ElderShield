import React from 'react';

// Simple dashboard for testing
function Dashboard() {
  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#2563eb', marginBottom: '30px' }}>🛡️ SeniorCare Hub Dashboard</h1>
      
      {/* Hero Section */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '40px',
        borderRadius: '12px',
        marginBottom: '30px',
        textAlign: 'center'
      }}>
        <h2 style={{ margin: '0 0 15px 0', fontSize: '2rem' }}>Welcome to Your Family Care Hub</h2>
        <p style={{ margin: '0', fontSize: '1.2rem', opacity: 0.9 }}>
          Secure, user-friendly platform to help families monitor, manage, and support aging loved ones
        </p>
      </div>

      {/* Feature Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '20px',
        marginBottom: '30px'
      }}>
        
        {/* Daily Check-ins Card */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e5e7eb', 
          borderRadius: '12px', 
          padding: '25px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontSize: '2rem', marginRight: '15px' }}>📝</span>
            <h3 style={{ margin: 0, color: '#1f2937' }}>Daily Check-ins</h3>
          </div>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>
            One-tap responses for mood, meals, medications, hydration, and mobility
          </p>
          <button style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '500',
            cursor: 'pointer',
            width: '100%'
          }}>
            Complete Today's Check-in
          </button>
        </div>

        {/* Medication Reminders Card */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e5e7eb', 
          borderRadius: '12px', 
          padding: '25px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontSize: '2rem', marginRight: '15px' }}>💊</span>
            <h3 style={{ margin: 0, color: '#1f2937' }}>Medications</h3>
          </div>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>
            Smart reminders with photo confirmation and prescription tracking
          </p>
          <button style={{
            backgroundColor: '#059669',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '500',
            cursor: 'pointer',
            width: '100%'
          }}>
            View Medications
          </button>
        </div>

        {/* Family Messages Card */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e5e7eb', 
          borderRadius: '12px', 
          padding: '25px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontSize: '2rem', marginRight: '15px' }}>💬</span>
            <h3 style={{ margin: 0, color: '#1f2937' }}>Family Messages</h3>
          </div>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>
            Secure HIPAA-compliant messaging with voice-to-text support
          </p>
          <button style={{
            backgroundColor: '#7c3aed',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '500',
            cursor: 'pointer',
            width: '100%'
          }}>
            View Messages
          </button>
        </div>

        {/* Emergency Button Card */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e5e7eb', 
          borderRadius: '12px', 
          padding: '25px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontSize: '2rem', marginRight: '15px' }}>🚨</span>
            <h3 style={{ margin: 0, color: '#1f2937' }}>Emergency Alert</h3>
          </div>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>
            One-button emergency contact activation with location sharing
          </p>
          <button style={{
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            width: '100%'
          }}>
            Emergency Contact
          </button>
        </div>

        {/* Wellness Score Card (Premium) */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e5e7eb', 
          borderRadius: '12px', 
          padding: '25px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: '#fbbf24',
            color: '#92400e',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}>
            PREMIUM
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontSize: '2rem', marginRight: '15px' }}>📊</span>
            <h3 style={{ margin: 0, color: '#1f2937' }}>AI Wellness Score</h3>
          </div>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>
            AI-powered anomaly detection with wellness trends and insights
          </p>
          <button style={{
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '500',
            cursor: 'pointer',
            width: '100%'
          }}>
            View Wellness Score
          </button>
        </div>

        {/* Video Calls Card (Premium) */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e5e7eb', 
          borderRadius: '12px', 
          padding: '25px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: '#fbbf24',
            color: '#92400e',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}>
            PREMIUM
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontSize: '2rem', marginRight: '15px' }}>📹</span>
            <h3 style={{ margin: 0, color: '#1f2937' }}>Video Calls</h3>
          </div>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>
            One-tap family calls with large-button UI and captions
          </p>
          <button style={{
            backgroundColor: '#8b5cf6',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '500',
            cursor: 'pointer',
            width: '100%'
          }}>
            Start Video Call
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div style={{ 
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '25px',
        marginBottom: '30px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#1f2937' }}>📈 Your Health Overview</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '20px' 
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '600', color: '#059669' }}>7</div>
            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Day Check-in Streak</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '600', color: '#3b82f6' }}>95%</div>
            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Medication Adherence</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '600', color: '#8b5cf6' }}>3</div>
            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Family Members</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: '600', color: '#f59e0b' }}>85</div>
            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Wellness Score</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        textAlign: 'center', 
        padding: '20px', 
        color: '#6b7280',
        borderTop: '1px solid #e5e7eb'
      }}>
        <p style={{ margin: 0 }}>
          Built with ❤️ for seniors and their families by DarkHorse Information Security
        </p>
        <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem' }}>
          HIPAA Compliant • SOC2 Type II • ADA Accessible
        </p>
      </div>
    </div>
  );
}

// Main App Component
function App() {
  return (
    <div className="App">
      <Dashboard />
    </div>
  );
}

export default App;