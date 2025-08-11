import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, Edit, Trash2, CheckCircle, Clock,
  AlertCircle, Calendar, DollarSign, User, Target,
  TrendingUp, Package, AlertTriangle, ChevronRight,
  Download, Upload, Share2, Printer, Filter,
  BarChart3, PieChart, Activity, Shield, CreditCard
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import apiService from '../services/apiService';

const TreatmentPlanManager = () => {
  const [treatmentPlans, setTreatmentPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [statistics, setStatistics] = useState({
    totalPlans: 0,
    activePlans: 0,
    completedPlans: 0,
    totalValue: 0,
    averageProgress: 0,
    insuranceCoverage: 0
  });

  const [newPlan, setNewPlan] = useState({
    patientId: '',
    patientName: '',
    title: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    estimatedEndDate: '',
    priority: 'medium',
    procedures: [],
    totalCost: 0,
    insuranceCoverage: 0,
    patientCost: 0,
    status: 'draft'
  });

  const procedureTemplates = [
    { name: 'Comprehensive Exam', code: 'D0150', cost: 150, duration: 60 },
    { name: 'Prophylaxis (Cleaning)', code: 'D1110', cost: 120, duration: 45 },
    { name: 'Fluoride Treatment', code: 'D1206', cost: 50, duration: 15 },
    { name: 'Bitewing X-rays', code: 'D0274', cost: 80, duration: 20 },
    { name: 'Filling (1 surface)', code: 'D2391', cost: 200, duration: 30 },
    { name: 'Filling (2 surfaces)', code: 'D2392', cost: 250, duration: 45 },
    { name: 'Crown', code: 'D2750', cost: 1200, duration: 90 },
    { name: 'Root Canal (Anterior)', code: 'D3310', cost: 900, duration: 90 },
    { name: 'Root Canal (Molar)', code: 'D3330', cost: 1400, duration: 120 },
    { name: 'Extraction', code: 'D7140', cost: 250, duration: 30 },
    { name: 'Dental Implant', code: 'D6010', cost: 3500, duration: 120 },
    { name: 'Denture (Complete)', code: 'D5110', cost: 2000, duration: 180 },
    { name: 'Orthodontic Treatment', code: 'D8080', cost: 5000, duration: 30 },
    { name: 'Periodontal Scaling', code: 'D4341', cost: 300, duration: 60 },
    { name: 'Whitening', code: 'D9972', cost: 400, duration: 60 }
  ];

  useEffect(() => {
    loadTreatmentPlans();
    loadStatistics();
  }, [filter, searchTerm]);

  const loadTreatmentPlans = async () => {
    setLoading(true);
    try {
      const response = await apiService.getTreatmentPlans({ 
        status: filter, 
        search: searchTerm 
      });
      setTreatmentPlans(response.plans || []);
    } catch (error) {
      console.error('Failed to load treatment plans:', error);
      setTreatmentPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await apiService.getTreatmentPlanStats();
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const handleCreatePlan = async () => {
    try {
      const planData = {
        ...newPlan,
        procedures: newPlan.procedures.map(proc => ({
          ...proc,
          id: Date.now().toString() + Math.random()
        }))
      };
      
      await apiService.createTreatmentPlan(planData);
      await loadTreatmentPlans();
      setShowCreateModal(false);
      resetNewPlan();
      alert('Treatment plan created successfully!');
    } catch (error) {
      console.error('Failed to create treatment plan:', error);
      alert('Failed to create treatment plan');
    }
  };

  const resetNewPlan = () => {
    setNewPlan({
      patientId: '',
      patientName: '',
      title: '',
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      estimatedEndDate: '',
      priority: 'medium',
      procedures: [],
      totalCost: 0,
      insuranceCoverage: 0,
      patientCost: 0,
      status: 'draft'
    });
  };

  const addProcedure = (template) => {
    const newProcedure = {
      ...template,
      id: Date.now().toString(),
      status: 'pending',
      scheduledDate: null,
      completedDate: null,
      notes: '',
      toothNumbers: [],
      insuranceCovered: true,
      insuranceAmount: template.cost * 0.8
    };

    setNewPlan(prev => {
      const procedures = [...prev.procedures, newProcedure];
      const totalCost = procedures.reduce((sum, p) => sum + p.cost, 0);
      const insuranceCoverage = procedures.reduce((sum, p) => 
        sum + (p.insuranceCovered ? p.insuranceAmount : 0), 0
      );
      
      return {
        ...prev,
        procedures,
        totalCost,
        insuranceCoverage,
        patientCost: totalCost - insuranceCoverage
      };
    });
  };

  const removeProcedure = (procedureId) => {
    setNewPlan(prev => {
      const procedures = prev.procedures.filter(p => p.id !== procedureId);
      const totalCost = procedures.reduce((sum, p) => sum + p.cost, 0);
      const insuranceCoverage = procedures.reduce((sum, p) => 
        sum + (p.insuranceCovered ? p.insuranceAmount : 0), 0
      );
      
      return {
        ...prev,
        procedures,
        totalCost,
        insuranceCoverage,
        patientCost: totalCost - insuranceCoverage
      };
    });
  };

  const updateProcedureStatus = async (planId, procedureId, status) => {
    try {
      await apiService.updateProcedureStatus(planId, procedureId, status);
      await loadTreatmentPlans();
    } catch (error) {
      console.error('Failed to update procedure status:', error);
    }
  };

  const calculateProgress = (plan) => {
    if (!plan.procedures || plan.procedures.length === 0) return 0;
    const completed = plan.procedures.filter(p => p.status === 'completed').length;
    return Math.round((completed / plan.procedures.length) * 100);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in_progress': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const exportPlan = (plan) => {
    const dataStr = JSON.stringify(plan, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportName = `treatment-plan-${plan.patientName}-${format(new Date(), 'yyyy-MM-dd')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
  };

  const printPlan = (plan) => {
    window.print();
  };

  const TreatmentPlanCard = ({ plan }) => {
    const progress = calculateProgress(plan);
    const daysRemaining = plan.estimatedEndDate 
      ? differenceInDays(new Date(plan.estimatedEndDate), new Date())
      : null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{plan.title}</h3>
            <p className="text-sm text-gray-600">{plan.patientName}</p>
          </div>
          <div className="flex space-x-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(plan.priority)}`}>
              {plan.priority}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
              {plan.status}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <p className="text-gray-500">Total Procedures</p>
            <p className="font-semibold">{plan.procedures?.length || 0}</p>
          </div>
          <div>
            <p className="text-gray-500">Completed</p>
            <p className="font-semibold">
              {plan.procedures?.filter(p => p.status === 'completed').length || 0}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Total Cost</p>
            <p className="font-semibold">${plan.totalCost?.toLocaleString() || 0}</p>
          </div>
          <div>
            <p className="text-gray-500">Patient Cost</p>
            <p className="font-semibold">${plan.patientCost?.toLocaleString() || 0}</p>
          </div>
        </div>

        {daysRemaining !== null && (
          <div className={`mb-4 p-2 rounded-lg ${
            daysRemaining < 0 ? 'bg-red-50 text-red-700' :
            daysRemaining < 30 ? 'bg-yellow-50 text-yellow-700' :
            'bg-green-50 text-green-700'
          }`}>
            <p className="text-sm flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {daysRemaining < 0 
                ? `Overdue by ${Math.abs(daysRemaining)} days`
                : `${daysRemaining} days remaining`
              }
            </p>
          </div>
        )}

        <div className="flex space-x-2">
          <button
            onClick={() => {
              setSelectedPlan(plan);
              setShowDetailsModal(true);
            }}
            className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
          >
            <FileText className="w-4 h-4 mr-1" />
            View Details
          </button>
          <button
            onClick={() => exportPlan(plan)}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Treatment Plans</h1>
        <p className="text-gray-600 mt-2">Manage and track patient treatment plans</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Plans</p>
              <p className="text-2xl font-bold text-gray-800">{statistics.totalPlans}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-800">{statistics.activePlans}</p>
            </div>
            <Activity className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-800">{statistics.completedPlans}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-800">
                ${statistics.totalValue?.toLocaleString() || 0}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Progress</p>
              <p className="text-2xl font-bold text-gray-800">{statistics.averageProgress}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-indigo-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Insurance</p>
              <p className="text-2xl font-bold text-gray-800">
                ${statistics.insuranceCoverage?.toLocaleString() || 0}
              </p>
            </div>
            <Shield className="w-8 h-8 text-teal-500" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by patient name or plan title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Plans</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft</option>
            </select>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Plan
            </button>
          </div>
        </div>
      </div>

      {/* Treatment Plans Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : treatmentPlans.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No treatment plans found</h3>
          <p className="text-gray-600 mb-4">Create your first treatment plan to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Create Treatment Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {treatmentPlans.map((plan) => (
            <TreatmentPlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}

      {/* Create Treatment Plan Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b">
                <h2 className="text-2xl font-bold text-gray-800">Create Treatment Plan</h2>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Patient Name
                    </label>
                    <input
                      type="text"
                      value={newPlan.patientName}
                      onChange={(e) => setNewPlan({ ...newPlan, patientName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plan Title
                    </label>
                    <input
                      type="text"
                      value={newPlan.title}
                      onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Comprehensive Dental Treatment"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newPlan.description}
                    onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Treatment plan details and objectives..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={newPlan.startDate}
                      onChange={(e) => setNewPlan({ ...newPlan, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated End Date
                    </label>
                    <input
                      type="date"
                      value={newPlan.estimatedEndDate}
                      onChange={(e) => setNewPlan({ ...newPlan, estimatedEndDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={newPlan.priority}
                      onChange={(e) => setNewPlan({ ...newPlan, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Add Procedures</h3>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {procedureTemplates.map((template) => (
                      <button
                        key={template.code}
                        onClick={() => addProcedure(template)}
                        className="text-left p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <p className="text-sm font-medium">{template.name}</p>
                        <p className="text-xs text-gray-500">
                          {template.code} • ${template.cost} • {template.duration}min
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {newPlan.procedures.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Selected Procedures</h3>
                    <div className="space-y-2">
                      {newPlan.procedures.map((proc) => (
                        <div key={proc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{proc.name}</p>
                            <p className="text-xs text-gray-500">{proc.code}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">${proc.cost}</span>
                            <button
                              onClick={() => removeProcedure(proc.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total Cost</p>
                      <p className="text-xl font-bold text-gray-800">
                        ${newPlan.totalCost.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Insurance Coverage</p>
                      <p className="text-xl font-bold text-green-600">
                        ${newPlan.insuranceCoverage.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Patient Cost</p>
                      <p className="text-xl font-bold text-blue-600">
                        ${newPlan.patientCost.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetNewPlan();
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePlan}
                  disabled={!newPlan.patientName || !newPlan.title || newPlan.procedures.length === 0}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Plan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TreatmentPlanManager;