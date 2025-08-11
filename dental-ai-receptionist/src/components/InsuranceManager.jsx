import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, FileText, DollarSign, CheckCircle, XCircle,
  AlertCircle, Clock, Search, Upload, Download,
  RefreshCw, Send, User, Calendar, CreditCard,
  Activity, TrendingUp, AlertTriangle, Printer,
  Phone, Mail, Building, Hash, ChevronRight,
  Edit, Trash2, Plus, Filter, BarChart3
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import apiService from '../services/apiService';

const InsuranceManager = () => {
  const [activeTab, setActiveTab] = useState('verification');
  const [insuranceData, setInsuranceData] = useState({
    verifications: [],
    claims: [],
    providers: [],
    statistics: {
      totalClaims: 0,
      pendingClaims: 0,
      approvedClaims: 0,
      deniedClaims: 0,
      totalClaimValue: 0,
      averageProcessingTime: 0,
      approvalRate: 0
    }
  });
  const [loading, setLoading] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [newVerification, setNewVerification] = useState({
    patientName: '',
    patientId: '',
    insuranceProvider: '',
    policyNumber: '',
    groupNumber: '',
    subscriberName: '',
    subscriberDOB: '',
    relationship: 'self',
    effectiveDate: '',
    terminationDate: '',
    verificationType: 'eligibility'
  });

  const [newClaim, setNewClaim] = useState({
    patientName: '',
    patientId: '',
    claimNumber: '',
    dateOfService: '',
    provider: '',
    procedures: [],
    totalAmount: 0,
    insuranceAmount: 0,
    patientAmount: 0,
    status: 'pending',
    attachments: []
  });

  const insuranceProviders = [
    { id: '1', name: 'Delta Dental', code: 'DELTA', phone: '1-800-765-6003' },
    { id: '2', name: 'Cigna Dental', code: 'CIGNA', phone: '1-800-244-6224' },
    { id: '3', name: 'MetLife Dental', code: 'METLIFE', phone: '1-800-942-0854' },
    { id: '4', name: 'Aetna Dental', code: 'AETNA', phone: '1-877-238-6200' },
    { id: '5', name: 'United Healthcare Dental', code: 'UHC', phone: '1-877-816-3596' },
    { id: '6', name: 'Humana Dental', code: 'HUMANA', phone: '1-800-233-4013' },
    { id: '7', name: 'Guardian Dental', code: 'GUARDIAN', phone: '1-888-600-1600' },
    { id: '8', name: 'Anthem Blue Cross', code: 'ANTHEM', phone: '1-855-383-7247' }
  ];

  const claimStatuses = [
    { value: 'pending', label: 'Pending', color: 'yellow' },
    { value: 'submitted', label: 'Submitted', color: 'blue' },
    { value: 'processing', label: 'Processing', color: 'indigo' },
    { value: 'approved', label: 'Approved', color: 'green' },
    { value: 'partial', label: 'Partially Approved', color: 'orange' },
    { value: 'denied', label: 'Denied', color: 'red' },
    { value: 'appealed', label: 'Appealed', color: 'purple' },
    { value: 'paid', label: 'Paid', color: 'teal' }
  ];

  useEffect(() => {
    loadInsuranceData();
    const interval = setInterval(loadInsuranceData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [filter, searchTerm]);

  const loadInsuranceData = async () => {
    setLoading(true);
    try {
      const [verifications, claims, statistics] = await Promise.all([
        apiService.getInsuranceVerifications({ status: filter, search: searchTerm }),
        apiService.getInsuranceClaims({ status: filter, search: searchTerm }),
        apiService.getInsuranceStatistics()
      ]);

      setInsuranceData({
        verifications: verifications || [],
        claims: claims || [],
        providers: insuranceProviders,
        statistics: statistics || insuranceData.statistics
      });
    } catch (error) {
      console.error('Failed to load insurance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyInsurance = async () => {
    try {
      setLoading(true);
      // Simulate API call to insurance verification service
      const verificationResult = await apiService.verifyInsurance(newVerification);
      
      // Update local state
      setInsuranceData(prev => ({
        ...prev,
        verifications: [verificationResult, ...prev.verifications]
      }));

      setShowVerificationModal(false);
      resetVerificationForm();
      alert('Insurance verification completed successfully!');
    } catch (error) {
      console.error('Insurance verification failed:', error);
      alert('Failed to verify insurance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClaim = async () => {
    try {
      setLoading(true);
      const claimData = {
        ...newClaim,
        claimNumber: `CLM-${Date.now()}`,
        submittedDate: new Date().toISOString(),
        status: 'submitted'
      };

      const result = await apiService.submitInsuranceClaim(claimData);
      
      setInsuranceData(prev => ({
        ...prev,
        claims: [result, ...prev.claims]
      }));

      setShowClaimModal(false);
      resetClaimForm();
      alert('Insurance claim submitted successfully!');
    } catch (error) {
      console.error('Failed to submit claim:', error);
      alert('Failed to submit insurance claim. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetVerificationForm = () => {
    setNewVerification({
      patientName: '',
      patientId: '',
      insuranceProvider: '',
      policyNumber: '',
      groupNumber: '',
      subscriberName: '',
      subscriberDOB: '',
      relationship: 'self',
      effectiveDate: '',
      terminationDate: '',
      verificationType: 'eligibility'
    });
  };

  const resetClaimForm = () => {
    setNewClaim({
      patientName: '',
      patientId: '',
      claimNumber: '',
      dateOfService: '',
      provider: '',
      procedures: [],
      totalAmount: 0,
      insuranceAmount: 0,
      patientAmount: 0,
      status: 'pending',
      attachments: []
    });
  };

  const getStatusColor = (status) => {
    const statusConfig = claimStatuses.find(s => s.value === status);
    return statusConfig ? statusConfig.color : 'gray';
  };

  const addProcedureToClaim = (procedure) => {
    setNewClaim(prev => {
      const procedures = [...prev.procedures, procedure];
      const totalAmount = procedures.reduce((sum, p) => sum + p.amount, 0);
      const insuranceAmount = procedures.reduce((sum, p) => sum + (p.insuranceCovered || 0), 0);
      
      return {
        ...prev,
        procedures,
        totalAmount,
        insuranceAmount,
        patientAmount: totalAmount - insuranceAmount
      };
    });
  };

  const VerificationCard = ({ verification }) => {
    const isExpired = verification.terminationDate && 
      new Date(verification.terminationDate) < new Date();
    const daysUntilExpiry = verification.terminationDate ?
      differenceInDays(new Date(verification.terminationDate), new Date()) : null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{verification.patientName}</h3>
            <p className="text-sm text-gray-600">{verification.insuranceProvider}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isExpired ? 'bg-red-100 text-red-700' :
            daysUntilExpiry && daysUntilExpiry < 30 ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }`}>
            {isExpired ? 'Expired' :
             daysUntilExpiry && daysUntilExpiry < 30 ? `Expires in ${daysUntilExpiry} days` :
             'Active'}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Policy Number:</span>
            <span className="font-medium">{verification.policyNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Group Number:</span>
            <span className="font-medium">{verification.groupNumber || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Effective Date:</span>
            <span className="font-medium">
              {format(new Date(verification.effectiveDate), 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Coverage Type:</span>
            <span className="font-medium">{verification.coverageType || 'Standard'}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t flex justify-between">
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center">
            <RefreshCw className="w-4 h-4 mr-1" />
            Reverify
          </button>
          <button className="text-gray-600 hover:text-gray-700 text-sm font-medium flex items-center">
            <FileText className="w-4 h-4 mr-1" />
            View Details
          </button>
        </div>
      </motion.div>
    );
  };

  const ClaimCard = ({ claim }) => {
    const statusColor = getStatusColor(claim.status);
    const processingDays = claim.submittedDate ?
      differenceInDays(new Date(), new Date(claim.submittedDate)) : 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Claim #{claim.claimNumber}
            </h3>
            <p className="text-sm text-gray-600">{claim.patientName}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${statusColor}-100 text-${statusColor}-700`}>
            {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
          </span>
        </div>

        <div className="space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-gray-500">Date of Service:</span>
            <span className="font-medium">
              {format(new Date(claim.dateOfService), 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Amount:</span>
            <span className="font-medium">${claim.totalAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Insurance Portion:</span>
            <span className="font-medium text-green-600">
              ${claim.insuranceAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Patient Portion:</span>
            <span className="font-medium text-blue-600">
              ${claim.patientAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {claim.status === 'processing' && (
          <div className="mb-4 p-2 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700 flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              Processing for {processingDays} days
            </p>
          </div>
        )}

        <div className="flex space-x-2">
          <button
            onClick={() => {
              setSelectedClaim(claim);
              setShowClaimModal(true);
            }}
            className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm flex items-center justify-center"
          >
            <Eye className="w-4 h-4 mr-1" />
            View Details
          </button>
          {claim.status === 'denied' && (
            <button className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm">
              Appeal
            </button>
          )}
          {claim.status === 'approved' && (
            <button className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm">
              Process Payment
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Insurance Management</h1>
        <p className="text-gray-600 mt-2">Verify coverage and process insurance claims</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Claims</p>
              <p className="text-2xl font-bold text-gray-800">
                {insuranceData.statistics.totalClaims}
              </p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {insuranceData.statistics.pendingClaims}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">
                {insuranceData.statistics.approvedClaims}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approval Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {insuranceData.statistics.approvalRate}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b">
          <div className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('verification')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'verification'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Shield className="w-5 h-5 inline mr-2" />
              Insurance Verification
            </button>
            <button
              onClick={() => setActiveTab('claims')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'claims'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <FileText className="w-5 h-5 inline mr-2" />
              Claims Processing
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              className={`py-4 px-2 border-b-2 transition-colors ${
                activeTab === 'providers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <Building className="w-5 h-5 inline mr-2" />
              Insurance Providers
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by patient name, claim number, or policy..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              {activeTab === 'claims' && (
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Claims</option>
                  <option value="pending">Pending</option>
                  <option value="submitted">Submitted</option>
                  <option value="processing">Processing</option>
                  <option value="approved">Approved</option>
                  <option value="denied">Denied</option>
                  <option value="paid">Paid</option>
                </select>
              )}
              <button
                onClick={() => {
                  if (activeTab === 'verification') {
                    setShowVerificationModal(true);
                  } else if (activeTab === 'claims') {
                    setShowClaimModal(true);
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                {activeTab === 'verification' ? 'Verify Insurance' : 'Submit Claim'}
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {activeTab === 'verification' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {insuranceData.verifications.length === 0 ? (
                    <div className="col-span-full text-center py-12">
                      <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No insurance verifications found
                      </h3>
                      <p className="text-gray-600">
                        Start by verifying patient insurance coverage
                      </p>
                    </div>
                  ) : (
                    insuranceData.verifications.map((verification) => (
                      <VerificationCard key={verification.id} verification={verification} />
                    ))
                  )}
                </div>
              )}

              {activeTab === 'claims' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {insuranceData.claims.length === 0 ? (
                    <div className="col-span-full text-center py-12">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No insurance claims found
                      </h3>
                      <p className="text-gray-600">
                        Submit your first insurance claim to get started
                      </p>
                    </div>
                  ) : (
                    insuranceData.claims.map((claim) => (
                      <ClaimCard key={claim.id} claim={claim} />
                    ))
                  )}
                </div>
              )}

              {activeTab === 'providers' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {insuranceProviders.map((provider) => (
                    <motion.div
                      key={provider.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {provider.name}
                          </h3>
                          <p className="text-sm text-gray-600">Code: {provider.code}</p>
                        </div>
                        <Building className="w-8 h-8 text-blue-500" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="w-4 h-4 mr-2" />
                          {provider.phone}
                        </div>
                        <button className="w-full mt-4 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm">
                          Contact Provider
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Verification Modal */}
      <AnimatePresence>
        {showVerificationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowVerificationModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b">
                <h2 className="text-2xl font-bold text-gray-800">Verify Insurance</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Patient Name
                    </label>
                    <input
                      type="text"
                      value={newVerification.patientName}
                      onChange={(e) => setNewVerification({
                        ...newVerification,
                        patientName: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Insurance Provider
                    </label>
                    <select
                      value={newVerification.insuranceProvider}
                      onChange={(e) => setNewVerification({
                        ...newVerification,
                        insuranceProvider: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Provider</option>
                      {insuranceProviders.map(provider => (
                        <option key={provider.id} value={provider.name}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Policy Number
                    </label>
                    <input
                      type="text"
                      value={newVerification.policyNumber}
                      onChange={(e) => setNewVerification({
                        ...newVerification,
                        policyNumber: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Group Number
                    </label>
                    <input
                      type="text"
                      value={newVerification.groupNumber}
                      onChange={(e) => setNewVerification({
                        ...newVerification,
                        groupNumber: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowVerificationModal(false);
                      resetVerificationForm();
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerifyInsurance}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Verify Insurance
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InsuranceManager;