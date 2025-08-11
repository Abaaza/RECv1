import React, { useState, useEffect } from 'react';
import PhoneInterface from './components/PhoneInterface';
import AppointmentCalendar from './components/AppointmentCalendar';
import TraumaGuide from './components/TraumaGuide';
import PatientManagement from './components/PatientManagement';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import NotificationSystem from './components/NotificationSystem';
import TreatmentPlanManager from './components/TreatmentPlanManager';
import InsuranceManager from './components/InsuranceManager';
import AdminSchedulePortal from './components/AdminSchedulePortal';
import Login from './components/Login';
import apiService from './services/apiService';
import { 
  Mic, Calendar, AlertTriangle, Users, 
  BarChart3, Phone, MessageSquare, Clock,
  Activity, TrendingUp, Bell, Settings,
  ChevronRight, Sparkles, Brain, Heart,
  Shield, Award, Zap, HeadphonesIcon, LogOut
} from 'lucide-react';

function App() {
  const [activeView, setActiveView] = useState('assistant');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCallActive, setIsCallActive] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  
  const [stats, setStats] = useState({
    totalCalls: 127,
    todayAppointments: 12,
    avgResponseTime: '0.8s',
    satisfaction: 98,
    activePatients: 1847,
    emergencyHandled: 3
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // Check for existing auth token
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (token && userData) {
      apiService.setAuthToken(token);
      setUser(JSON.parse(userData));
      setIsAuthenticated(true);
    }
    
    return () => clearInterval(timer);
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    apiService.setAuthToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const sidebarItems = [
    { id: 'assistant', label: 'AI Assistant', icon: HeadphonesIcon, color: 'bg-gradient-to-r from-violet-500 to-purple-500' },
    { id: 'appointments', label: 'Appointments', icon: Calendar, color: 'bg-gradient-to-r from-blue-500 to-cyan-500' },
    { id: 'schedule', label: 'Schedule Admin', icon: Clock, color: 'bg-gradient-to-r from-orange-500 to-amber-500' },
    { id: 'patients', label: 'Patients', icon: Users, color: 'bg-gradient-to-r from-emerald-500 to-teal-500' },
    { id: 'treatments', label: 'Treatment Plans', icon: Activity, color: 'bg-gradient-to-r from-purple-500 to-pink-500' },
    { id: 'insurance', label: 'Insurance', icon: Shield, color: 'bg-gradient-to-r from-green-500 to-emerald-500' },
    { id: 'emergency', label: 'Emergency', icon: AlertTriangle, color: 'bg-gradient-to-r from-red-500 to-orange-500' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'bg-gradient-to-r from-indigo-500 to-blue-500' },
  ];

  const quickStats = [
    { label: 'Response Time', value: stats.avgResponseTime, icon: Zap, trend: '-12%', color: 'text-yellow-400' },
    { label: 'Today\'s Calls', value: stats.totalCalls, icon: Phone, trend: '+18%', color: 'text-blue-400' },
    { label: 'Satisfaction', value: `${stats.satisfaction}%`, icon: Heart, trend: '+5%', color: 'text-pink-400' },
    { label: 'Active Patients', value: stats.activePatients.toLocaleString(), icon: Users, trend: '+8%', color: 'text-green-400' },
  ];

  const renderMainContent = () => {
    switch(activeView) {
      case 'assistant':
        return <PhoneInterface onCallStatusChange={setIsCallActive} onConversationUpdate={setConversationHistory} />;
      case 'appointments':
        return <AppointmentCalendar />;
      case 'schedule':
        return <AdminSchedulePortal />;
      case 'patients':
        return <PatientManagement />;
      case 'treatments':
        return <TreatmentPlanManager />;
      case 'insurance':
        return <InsuranceManager />;
      case 'emergency':
        return <TraumaGuide />;
      case 'analytics':
        return <AnalyticsDashboard />;
      default:
        return <PhoneInterface onCallStatusChange={setIsCallActive} onConversationUpdate={setConversationHistory} />;
    }
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Modern animated background */}
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse animation-delay-2000" />
      </div>

      <div className="relative z-10 flex h-screen">
        {/* Modern Sidebar */}
        <div className="w-20 lg:w-64 bg-gray-900/50 backdrop-blur-xl border-r border-gray-800 flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl blur animate-pulse" />
                <div className="relative bg-gradient-to-r from-violet-500 to-purple-500 p-2 rounded-xl">
                  <Brain className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="hidden lg:block">
                <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  DentalCare AI
                </h1>
                <p className="text-xs text-gray-400">Powered by Sarah AI</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl mb-2 transition-all duration-200 group ${
                  activeView === item.id 
                    ? 'bg-gradient-to-r from-violet-600/20 to-purple-600/20 border border-violet-500/30' 
                    : 'hover:bg-gray-800/50'
                }`}
              >
                <div className={`p-2 rounded-lg ${activeView === item.id ? item.color : 'bg-gray-800'}`}>
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <span className="hidden lg:block text-sm font-medium">{item.label}</span>
                {activeView === item.id && (
                  <ChevronRight className="w-4 h-4 ml-auto hidden lg:block" />
                )}
              </button>
            ))}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold">DA</span>
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-medium">Dr. Admin</p>
                <p className="text-xs text-gray-400">Online</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <header className="h-16 bg-gray-900/50 backdrop-blur-xl border-b border-gray-800 flex items-center justify-between px-6">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold capitalize">{activeView.replace('_', ' ')}</h2>
              {isCallActive && activeView === 'assistant' && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-green-500/20 rounded-full border border-green-500/30">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-green-400">Call Active</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <NotificationSystem />
              <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-400">
                  {user?.name || user?.email}
                </span>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-red-900/20 text-red-400 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </header>

          {/* Stats Bar */}
          <div className="px-6 py-4 bg-gray-900/30 backdrop-blur-sm border-b border-gray-800">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {quickStats.map((stat, index) => (
                <div key={index} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <stat.icon className={`w-5 h-5 ${stat.color} mb-1`} />
                      <span className={`text-xs ${stat.trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                        {stat.trend}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto">
              {renderMainContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;