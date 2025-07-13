import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

const DailyCheckIn = () => {
  const navigate = useNavigate();
  const { user, showNotification } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    mood_rating: null,
    energy_level: null,
    pain_level: null,
    sleep_quality: null,
    appetite_rating: null,
    hydration_glasses: 0,
    medications_taken: null,
    exercise_minutes: 0,
    social_interaction: null,
    notes: '',
    voice_note_url: null
  });
  const [todayCheckIn, setTodayCheckIn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const totalSteps = 8;

  useEffect(() => {
    checkTodayStatus();
  }, []);

  const checkTodayStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/checkins/today');
      if (response.data.hasCheckedIn) {
        setTodayCheckIn(response.data.checkIn);
        // Pre-fill form with existing data
        const checkIn = response.data.checkIn;
        setFormData({
          mood_rating: checkIn.mood_rating,
          energy_level: checkIn.energy_level,
          pain_level: checkIn.pain_level,
          sleep_quality: checkIn.sleep_quality,
          appetite_rating: checkIn.appetite_rating,
          hydration_glasses: checkIn.hydration_glasses || 0,
          medications_taken: checkIn.medications_taken,
          exercise_minutes: checkIn.exercise_minutes || 0,
          social_interaction: checkIn.social_interaction,
          notes: checkIn.notes || '',
          voice_note_url: checkIn.voice_note_url
        });
      }
    } catch (error) {
      console.error('Error checking today status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      // Validate required fields
      const requiredFields = ['mood_rating', 'energy_level', 'pain_level', 'sleep_quality', 'appetite_rating'];
      const missingFields = requiredFields.filter(field => formData[field] === null);
      
      if (missingFields.length > 0) {
        showNotification('Please complete all health ratings', 'error');
        return;
      }

      const response = await axios.post('/checkins', formData);
      
      showNotification(
        todayCheckIn ? 'Check-in updated successfully!' : 'Daily check-in completed successfully!',
        'success'
      );
      
      // Navigate back to dashboard
      navigate('/dashboard');
      
    } catch (error) {
      console.error('Error submitting check-in:', error);
      showNotification('Failed to submit check-in. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const renderRatingButtons = (currentValue, onChange, options = [1, 2, 3, 4, 5]) => (
    <div className="flex justify-center space-x-3">
      {options.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`w-16 h-16 rounded-full text-xl font-bold transition-all ${
            currentValue === value
              ? 'bg-indigo-600 text-white shadow-lg transform scale-110'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {value}
        </button>
      ))}
    </div>
  );

  const renderBooleanButtons = (currentValue, onChange, labels = { true: 'Yes', false: 'No' }) => (
    <div className="flex justify-center space-x-4">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-8 py-4 rounded-lg text-lg font-medium transition-all ${
          currentValue === true
            ? 'bg-green-600 text-white shadow-lg'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {labels.true}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-8 py-4 rounded-lg text-lg font-medium transition-all ${
          currentValue === false
            ? 'bg-red-600 text-white shadow-lg'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {labels.false}
      </button>
    </div>
  );

  const renderNumberInput = (currentValue, onChange, min = 0, max = 20, label = '') => (
    <div className="flex flex-col items-center space-y-4">
      <div className="flex items-center space-x-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, currentValue - 1))}
          className="w-12 h-12 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 text-xl font-bold"
        >
          -
        </button>
        <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center">
          <span className="text-2xl font-bold text-indigo-600">{currentValue}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, currentValue + 1))}
          className="w-12 h-12 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 text-xl font-bold"
        >
          +
        </button>
      </div>
      {label && <p className="text-sm text-gray-600">{label}</p>}
    </div>
  );

  const steps = [
    {
      title: "How's your mood today?",
      subtitle: "Rate how you're feeling emotionally",
      icon: "😊",
      content: (
        <div className="space-y-6">
          {renderRatingButtons(formData.mood_rating, (value) => updateFormData('mood_rating', value))}
          <div className="flex justify-between text-sm text-gray-600 max-w-md mx-auto">
            <span>😢 Very Low</span>
            <span>😐 Okay</span>
            <span>😊 Great</span>
          </div>
        </div>
      )
    },
    {
      title: "How's your energy level?",
      subtitle: "Rate how energetic you feel",
      icon: "⚡",
      content: (
        <div className="space-y-6">
          {renderRatingButtons(formData.energy_level, (value) => updateFormData('energy_level', value))}
          <div className="flex justify-between text-sm text-gray-600 max-w-md mx-auto">
            <span>😴 Very Tired</span>
            <span>😐 Normal</span>
            <span>⚡ Very Energetic</span>
          </div>
        </div>
      )
    },
    {
      title: "Any pain or discomfort?",
      subtitle: "Rate your overall pain level",
      icon: "🩹",
      content: (
        <div className="space-y-6">
          {renderRatingButtons(formData.pain_level, (value) => updateFormData('pain_level', value))}
          <div className="flex justify-between text-sm text-gray-600 max-w-md mx-auto">
            <span>😌 No Pain</span>
            <span>😐 Mild</span>
            <span>😣 Severe</span>
          </div>
        </div>
      )
    },
    {
      title: "How did you sleep last night?",
      subtitle: "Rate the quality of your sleep",
      icon: "😴",
      content: (
        <div className="space-y-6">
          {renderRatingButtons(formData.sleep_quality, (value) => updateFormData('sleep_quality', value))}
          <div className="flex justify-between text-sm text-gray-600 max-w-md mx-auto">
            <span>😣 Very Poor</span>
            <span>😐 Okay</span>
            <span>😴 Excellent</span>
          </div>
        </div>
      )
    },
    {
      title: "How's your appetite?",
      subtitle: "Rate your appetite and eating",
      icon: "🍽️",
      content: (
        <div className="space-y-6">
          {renderRatingButtons(formData.appetite_rating, (value) => updateFormData('appetite_rating', value))}
          <div className="flex justify-between text-sm text-gray-600 max-w-md mx-auto">
            <span>😔 Very Poor</span>
            <span>😐 Normal</span>
            <span>😋 Excellent</span>
          </div>
        </div>
      )
    },
    {
      title: "How much water did you drink?",
      subtitle: "Count glasses of water (8 oz each)",
      icon: "💧",
      content: renderNumberInput(
        formData.hydration_glasses, 
        (value) => updateFormData('hydration_glasses', value),
        0, 
        20,
        "Aim for 6-8 glasses per day"
      )
    },
    {
      title: "Did you take your medications?",
      subtitle: "All prescribed medications for today",
      icon: "💊",
      content: renderBooleanButtons(
        formData.medications_taken, 
        (value) => updateFormData('medications_taken', value)
      )
    },
    {
      title: "How much did you exercise?",
      subtitle: "Minutes of physical activity",
      icon: "🚶‍♂️",
      content: (
        <div className="space-y-6">
          {renderNumberInput(
            formData.exercise_minutes, 
            (value) => updateFormData('exercise_minutes', value),
            0, 
            480,
            "Walking, stretching, or any physical activity"
          )}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Did you have social interaction today?
            </label>
            {renderBooleanButtons(
              formData.social_interaction, 
              (value) => updateFormData('social_interaction', value),
              { true: 'Yes, I connected with others', false: 'No, I was mostly alone' }
            )}
          </div>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading your check-in...</p>
        </div>
      </div>
    );
  }

  const currentStepData = steps[currentStep - 1];
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className="text-gray-400 hover:text-gray-600"
              >
                ← Back to Dashboard
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Daily Check-in {todayCheckIn && '(Update)'}
                </h1>
                <p className="text-sm text-gray-600">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Step {currentStep} of {totalSteps}</p>
              <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-xl p-8 md:p-12">
          {/* Step Content */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">{currentStepData.icon}</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {currentStepData.title}
            </h2>
            <p className="text-lg text-gray-600">
              {currentStepData.subtitle}
            </p>
          </div>

          <div className="mb-12">
            {currentStepData.content}
          </div>

          {/* Additional Notes (Final Step) */}
          {currentStep === totalSteps && (
            <div className="mb-8">
              <label className="block text-lg font-medium text-gray-700 mb-4">
                Any additional notes? (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateFormData('notes', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="How are you feeling today? Any concerns or highlights you'd like to share with your family?"
              />
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                currentStep === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ← Previous
            </button>

            {currentStep === totalSteps ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? (
                  <div className="flex items-center">
                    <div className="spinner w-5 h-5 mr-2"></div>
                    {todayCheckIn ? 'Updating...' : 'Completing...'}
                  </div>
                ) : (
                  todayCheckIn ? '✓ Update Check-in' : '✓ Complete Check-in'
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all"
              >
                Next →
              </button>
            )}
          </div>

          {/* Skip Option */}
          {currentStep < totalSteps && (
            <div className="text-center mt-6">
              <button
                onClick={() => setCurrentStep(totalSteps)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Skip to final step
              </button>
            </div>
          )}
        </div>

        {/* Today's Status */}
        {todayCheckIn && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-blue-800 text-center">
              ℹ️ You already completed today's check-in. You can update your responses above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyCheckIn;