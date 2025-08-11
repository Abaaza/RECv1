import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Users, Calendar, DollarSign, 
  Clock, Phone, Activity, Award, AlertTriangle,
  BarChart3, PieChart, ArrowUp, ArrowDown
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import apiService from '../services/apiService';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    totalRevenue: 0,
    averageWaitTime: 0,
    patientSatisfaction: 0,
    emergenciesHandled: 0,
    callsAnswered: 0,
    appointmentCompletion: 0,
    newPatientsThisMonth: 0,
    weeklyTrends: [],
    serviceDistribution: [],
    peakHours: []
  });

  const [timeRange, setTimeRange] = useState('today');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await apiService.getStats();
      setStats({
        totalPatients: data.totalPatients || 0,
        todayAppointments: data.todayAppointments || 0,
        totalRevenue: data.totalRevenue || 0,
        averageWaitTime: data.averageWaitTime || 0,
        patientSatisfaction: data.patientSatisfaction || 0,
        emergenciesHandled: data.emergenciesHandled || 0,
        callsAnswered: data.callsAnswered || 0,
        appointmentCompletion: data.appointmentCompletion || 0,
        newPatientsThisMonth: data.newPatientsThisMonth || 0,
        weeklyTrends: data.weeklyTrends || [],
        serviceDistribution: data.serviceDistribution || [],
        peakHours: data.peakHours || []
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };


  const StatCard = ({ icon: Icon, title, value, change, color, trend }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          {change && (
            <div className="flex items-center mt-2">
              {trend === 'up' ? (
                <ArrowUp className="w-4 h-4 text-green-500 mr-1" />
              ) : (
                <ArrowDown className="w-4 h-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                {change}%
              </span>
              <span className="text-xs text-gray-500 ml-1">vs last week</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  );

  if (loading && stats.totalPatients === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's your practice overview.</p>
      </div>

      {/* Time Range Selector */}
      <div className="mb-6 flex space-x-2">
        {['today', 'week', 'month', 'year'].map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg capitalize ${
              timeRange === range
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Users}
          title="Total Patients"
          value={stats.totalPatients}
          color="bg-blue-500"
        />
        <StatCard
          icon={Calendar}
          title="Today's Appointments"
          value={stats.todayAppointments}
          color="bg-green-500"
        />
        <StatCard
          icon={DollarSign}
          title="Revenue This Month"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          color="bg-purple-500"
        />
        <StatCard
          icon={Clock}
          title="Avg Wait Time"
          value={`${stats.averageWaitTime} min`}
          color="bg-orange-500"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Appointment Trends */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Weekly Appointment Trends
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={stats.weeklyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="appointments" 
                stroke="#3B82F6" 
                fill="#3B82F6" 
                fillOpacity={0.3}
              />
              <Area 
                type="monotone" 
                dataKey="cancellations" 
                stroke="#EF4444" 
                fill="#EF4444" 
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Service Distribution */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Service Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <RePieChart>
              <Pie
                data={stats.serviceDistribution}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label
              >
                {stats.serviceDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </RePieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Peak Hours Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-lg p-6 mb-8"
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Peak Hours Analysis
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={stats.peakHours}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="calls" fill="#3B82F6" />
            <Bar dataKey="appointments" fill="#10B981" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Performance</h3>
            <Award className="w-6 h-6 text-yellow-500" />
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Patient Satisfaction</span>
                <span className="font-medium">{stats.patientSatisfaction}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${stats.patientSatisfaction}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Appointment Completion</span>
                <span className="font-medium">{stats.appointmentCompletion}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${stats.appointmentCompletion}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Today's Activity</h3>
            <Activity className="w-6 h-6 text-blue-500" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Calls Answered</span>
              <span className="font-medium">{stats.callsAnswered}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Emergencies</span>
              <span className="font-medium text-red-500">{stats.emergenciesHandled}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">New Patients</span>
              <span className="font-medium text-green-500">{stats.newPatientsThisMonth}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Alerts</h3>
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
          </div>
          <div className="space-y-2">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">Low inventory: Dental floss</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">3 pending follow-ups</p>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">All systems operational</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;