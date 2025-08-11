import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Users, Calendar, DollarSign,
  Clock, Phone, Activity, Award, AlertTriangle,
  BarChart3, PieChart, ArrowUp, ArrowDown, Download,
  Filter, ChevronDown, Eye, FileText, Printer,
  Mail, Share2, Settings, RefreshCw, CheckCircle,
  XCircle, AlertCircle, UserPlus, Star, Target,
  TrendingUp as TrendIcon, CreditCard, Shield,
  Brain, MessageSquare, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart as RePieChart, Pie, Cell, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Scatter,
  RadialBarChart, RadialBar, Treemap, Funnel, FunnelChart
} from 'recharts';
import apiService from '../services/apiService';

const AnalyticsDashboard = () => {
  const [timeRange, setTimeRange] = useState('month');
  const [department, setDepartment] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState('revenue');
  const [showExportModal, setShowExportModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000);

  const [data, setData] = useState({
    overview: {
      totalPatients: 0,
      activePatients: 0,
      newPatients: 0,
      returningPatients: 0,
      totalRevenue: 0,
      averageRevenue: 0,
      totalAppointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      averageWaitTime: 0,
      patientSatisfaction: 0,
      nps: 0,
      onlineBookings: 0,
      phoneBookings: 0
    },
    trends: [],
    performance: [],
    services: [],
    demographics: [],
    financials: [],
    aiMetrics: {
      totalCalls: 0,
      aiHandledCalls: 0,
      transferredCalls: 0,
      averageCallDuration: 0,
      resolvedQueries: 0,
      appointmentsBooked: 0,
      emergenciesDetected: 0,
      sentimentScore: 0,
      accuracyRate: 0
    }
  });

  const [filters, setFilters] = useState({
    provider: 'all',
    service: 'all',
    location: 'all',
    paymentType: 'all',
    ageGroup: 'all'
  });

  useEffect(() => {
    fetchAnalyticsData();
    if (autoRefresh) {
      const interval = setInterval(fetchAnalyticsData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [timeRange, department, filters, autoRefresh, refreshInterval]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAnalytics({
        timeRange,
        department,
        ...filters
      });
      
      setData({
        overview: response.overview || data.overview,
        trends: Array.isArray(response.trends) ? response.trends : [],
        performance: Array.isArray(response.performance) ? response.performance : [],
        services: Array.isArray(response.services) ? response.services : [],
        demographics: Array.isArray(response.demographics) ? response.demographics : [],
        financials: Array.isArray(response.financials) ? response.financials : [],
        aiMetrics: response.aiMetrics || data.aiMetrics
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      // Keep existing data if API fails
      console.error('Using cached data due to API error');
    } finally {
      setLoading(false);
    }
  };

  // Removed mockup data generator

  // Removed mockup data generator

  // Removed mockup data generator

  // Removed mockup data generator

  // Removed mockup data generator

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

  const MetricCard = ({ icon: Icon, title, value, change, trend, color, subtitle }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white rounded-xl shadow-lg p-6 border border-gray-100"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            {trend && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                trend > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </motion.div>
  );

  const exportData = (format) => {
    const exportFormats = {
      pdf: () => console.log('Exporting to PDF...'),
      excel: () => console.log('Exporting to Excel...'),
      csv: () => console.log('Exporting to CSV...'),
      json: () => {
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `analytics_${new Date().toISOString()}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
      }
    };
    exportFormats[format]();
    setShowExportModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics & Reporting</h1>
              <p className="text-sm text-gray-500 mt-1">
                Comprehensive insights into your practice performance
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-2 rounded-lg transition-colors ${
                  autoRefresh ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <RefreshCw className={`w-5 h-5 ${autoRefresh ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mt-4">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {['today', 'week', 'month', 'quarter', 'year'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
                    timeRange === range
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Departments</option>
              <option value="general">General Dentistry</option>
              <option value="orthodontics">Orthodontics</option>
              <option value="surgery">Oral Surgery</option>
              <option value="pediatric">Pediatric</option>
            </select>

            <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              <Filter className="w-4 h-4" />
              More Filters
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            icon={DollarSign}
            title="Total Revenue"
            value={`$${data.overview.totalRevenue.toLocaleString()}`}
            trend={12.5}
            color="bg-green-500"
            subtitle="Average: $186 per patient"
          />
          <MetricCard
            icon={Users}
            title="Total Patients"
            value={data.overview.totalPatients.toLocaleString()}
            trend={8.3}
            color="bg-blue-500"
            subtitle={`${data.overview.newPatients} new this month`}
          />
          <MetricCard
            icon={Calendar}
            title="Appointments"
            value={data.overview.totalAppointments.toLocaleString()}
            trend={-2.1}
            color="bg-purple-500"
            subtitle={`${data.overview.completedAppointments} completed`}
          />
          <MetricCard
            icon={Star}
            title="Satisfaction"
            value={`${data.overview.patientSatisfaction}%`}
            trend={3.2}
            color="bg-yellow-500"
            subtitle={`NPS: ${data.overview.nps}`}
          />
        </div>

        {/* AI Metrics Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">AI Receptionist Performance</h2>
            <Brain className="w-5 h-5 text-purple-500" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Calls</p>
              <p className="text-xl font-bold text-gray-900">{data.aiMetrics.totalCalls}</p>
              <p className="text-xs text-green-600">71% AI handled</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Call Duration</p>
              <p className="text-xl font-bold text-gray-900">{data.aiMetrics.averageCallDuration}m</p>
              <p className="text-xs text-blue-600">-18% vs human</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Resolved Queries</p>
              <p className="text-xl font-bold text-gray-900">{data.aiMetrics.resolvedQueries}</p>
              <p className="text-xs text-green-600">93% success rate</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Appointments Booked</p>
              <p className="text-xl font-bold text-gray-900">{data.aiMetrics.appointmentsBooked}</p>
              <p className="text-xs text-purple-600">+24% conversion</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Accuracy Rate</p>
              <p className="text-xl font-bold text-gray-900">{data.aiMetrics.accuracyRate}%</p>
              <p className="text-xs text-green-600">Above target</p>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue Trends */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Revenue Trends</h3>
              <select className="text-sm border border-gray-300 rounded-lg px-2 py-1">
                <option>Monthly</option>
                <option>Weekly</option>
                <option>Daily</option>
              </select>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data.trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" fill="#3B82F6" />
                <Line yAxisId="right" type="monotone" dataKey="satisfaction" stroke="#10B981" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Service Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={data.services}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.services.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Provider Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Provider Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Provider</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Appointments</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Revenue</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Rating</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Efficiency</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Patients</th>
                </tr>
              </thead>
              <tbody>
                {data.performance.map((provider, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{provider.provider}</td>
                    <td className="text-center py-3 px-4 text-sm text-gray-600">{provider.appointments}</td>
                    <td className="text-center py-3 px-4 text-sm text-gray-600">
                      ${provider.revenue.toLocaleString()}
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="text-sm font-medium">{provider.rating}</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="flex items-center justify-center">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${provider.efficiency}%` }}
                          />
                        </div>
                        <span className="ml-2 text-sm text-gray-600">{provider.efficiency}%</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-4 text-sm text-gray-600">{provider.patients}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Demographics & Financial Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Patient Demographics */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Demographics</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.demographics} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" />
                <YAxis dataKey="ageGroup" type="category" />
                <Tooltip />
                <Bar dataKey="patients" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Financial Overview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Overview</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={Array.isArray(data.financials) ? data.financials.slice(-7) : []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                <Area type="monotone" dataKey="profit" stackId="2" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowExportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-xl shadow-xl p-6 w-96"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Analytics</h3>
              <div className="space-y-2">
                <button
                  onClick={() => exportData('pdf')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FileText className="w-5 h-5 text-red-500" />
                  <span className="text-gray-700">Export as PDF</span>
                </button>
                <button
                  onClick={() => exportData('excel')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <BarChart3 className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Export as Excel</span>
                </button>
                <button
                  onClick={() => exportData('csv')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FileText className="w-5 h-5 text-blue-500" />
                  <span className="text-gray-700">Export as CSV</span>
                </button>
                <button
                  onClick={() => exportData('json')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Share2 className="w-5 h-5 text-purple-500" />
                  <span className="text-gray-700">Export as JSON</span>
                </button>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="w-full mt-4 px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AnalyticsDashboard;