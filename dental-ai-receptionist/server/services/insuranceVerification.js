import axios from 'axios';
import { logger } from '../utils/logger.js';

class InsuranceVerificationService {
  constructor() {
    this.providers = {
      'delta_dental': {
        name: 'Delta Dental',
        api: process.env.DELTA_DENTAL_API || null,
        coverageTypes: ['preventive', 'basic', 'major', 'orthodontics']
      },
      'cigna': {
        name: 'Cigna',
        api: process.env.CIGNA_API || null,
        coverageTypes: ['preventive', 'restorative', 'endodontics', 'periodontics']
      },
      'aetna': {
        name: 'Aetna',
        api: process.env.AETNA_API || null,
        coverageTypes: ['diagnostic', 'preventive', 'basic', 'major']
      },
      'united_healthcare': {
        name: 'United Healthcare',
        api: process.env.UNITED_API || null,
        coverageTypes: ['preventive', 'basic', 'major', 'orthodontics']
      },
      'blue_cross': {
        name: 'Blue Cross Blue Shield',
        api: process.env.BCBS_API || null,
        coverageTypes: ['preventive', 'basic', 'major', 'orthodontics']
      }
    };

    // Mock database for demonstration (replace with actual API calls)
    this.mockCoverageDatabase = {
      'preventive': { coverage: 100, deductible: false },
      'basic': { coverage: 80, deductible: true },
      'major': { coverage: 50, deductible: true },
      'orthodontics': { coverage: 50, deductible: true, lifetime_max: 1500 },
      'diagnostic': { coverage: 100, deductible: false },
      'restorative': { coverage: 70, deductible: true },
      'endodontics': { coverage: 80, deductible: true },
      'periodontics': { coverage: 80, deductible: true }
    };

    this.procedureCodes = {
      'cleaning': { code: 'D1110', category: 'preventive', name: 'Prophylaxis - Adult' },
      'exam': { code: 'D0120', category: 'diagnostic', name: 'Periodic Oral Evaluation' },
      'xray': { code: 'D0210', category: 'diagnostic', name: 'Intraoral X-rays' },
      'filling': { code: 'D2391', category: 'basic', name: 'Composite Filling' },
      'crown': { code: 'D2750', category: 'major', name: 'Porcelain Crown' },
      'root_canal': { code: 'D3310', category: 'endodontics', name: 'Root Canal - Anterior' },
      'extraction': { code: 'D7140', category: 'basic', name: 'Simple Extraction' },
      'implant': { code: 'D6010', category: 'major', name: 'Dental Implant' },
      'braces': { code: 'D8070', category: 'orthodontics', name: 'Comprehensive Orthodontic Treatment' },
      'whitening': { code: 'D9972', category: 'cosmetic', name: 'Teeth Whitening' },
      'deep_cleaning': { code: 'D4341', category: 'periodontics', name: 'Scaling and Root Planing' }
    };
  }

  async verifyInsurance(patientInfo) {
    try {
      const { insuranceProvider, memberId, groupNumber, dateOfBirth } = patientInfo;
      
      // Validate insurance provider
      const provider = this.providers[insuranceProvider.toLowerCase().replace(/\s+/g, '_')];
      if (!provider) {
        return {
          verified: false,
          error: 'Insurance provider not supported',
          supportedProviders: Object.keys(this.providers).map(key => this.providers[key].name)
        };
      }

      // In production, make actual API call to insurance provider
      // For now, simulate verification
      const verification = await this.simulateVerification(memberId, groupNumber, dateOfBirth);
      
      if (verification.success) {
        return {
          verified: true,
          eligibility: {
            status: 'active',
            effectiveDate: verification.effectiveDate,
            terminationDate: verification.terminationDate,
            provider: provider.name,
            memberId: memberId,
            groupNumber: groupNumber,
            coverageDetails: await this.getCoverageDetails(provider, memberId)
          }
        };
      } else {
        return {
          verified: false,
          error: verification.error || 'Unable to verify insurance'
        };
      }
    } catch (error) {
      logger.error('Insurance verification error:', error);
      return {
        verified: false,
        error: 'Verification service temporarily unavailable'
      };
    }
  }

  async simulateVerification(memberId, groupNumber, dateOfBirth) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock validation logic
    if (!memberId || memberId.length < 5) {
      return { success: false, error: 'Invalid member ID' };
    }
    
    if (!groupNumber || groupNumber.length < 3) {
      return { success: false, error: 'Invalid group number' };
    }
    
    // 90% success rate for simulation
    if (Math.random() > 0.1) {
      return {
        success: true,
        effectiveDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        terminationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      };
    } else {
      return { success: false, error: 'Member not found' };
    }
  }

  async getCoverageDetails(provider, memberId) {
    const coverage = {
      deductible: {
        individual: 50,
        family: 150,
        met: Math.random() > 0.5 ? Math.floor(Math.random() * 50) : 0
      },
      annualMaximum: {
        individual: 1500,
        used: Math.floor(Math.random() * 500),
        remaining: 1500 - Math.floor(Math.random() * 500)
      },
      coverageByCategory: {}
    };

    // Add coverage for each category
    provider.coverageTypes.forEach(type => {
      if (this.mockCoverageDatabase[type]) {
        coverage.coverageByCategory[type] = this.mockCoverageDatabase[type];
      }
    });

    return coverage;
  }

  async checkProcedureCoverage(insuranceInfo, procedureType, procedureCost) {
    try {
      const procedure = this.procedureCodes[procedureType];
      if (!procedure) {
        return {
          covered: false,
          error: 'Procedure type not recognized'
        };
      }

      const coverage = insuranceInfo.coverageDetails.coverageByCategory[procedure.category];
      if (!coverage) {
        return {
          covered: false,
          error: 'Procedure not covered by plan',
          procedureCode: procedure.code,
          procedureName: procedure.name
        };
      }

      const deductibleMet = insuranceInfo.coverageDetails.deductible.met >= 
                           insuranceInfo.coverageDetails.deductible.individual;
      
      let patientResponsibility = 0;
      let insurancePayment = 0;

      if (coverage.deductible && !deductibleMet) {
        const remainingDeductible = insuranceInfo.coverageDetails.deductible.individual - 
                                   insuranceInfo.coverageDetails.deductible.met;
        patientResponsibility += Math.min(remainingDeductible, procedureCost);
        procedureCost -= patientResponsibility;
      }

      insurancePayment = procedureCost * (coverage.coverage / 100);
      patientResponsibility += procedureCost - insurancePayment;

      // Check annual maximum
      if (insuranceInfo.coverageDetails.annualMaximum.remaining < insurancePayment) {
        insurancePayment = insuranceInfo.coverageDetails.annualMaximum.remaining;
        patientResponsibility = procedureCost + 
          (coverage.deductible && !deductibleMet ? 
            Math.min(insuranceInfo.coverageDetails.deductible.individual - 
                    insuranceInfo.coverageDetails.deductible.met, procedureCost) : 0) - 
          insurancePayment;
      }

      return {
        covered: true,
        procedureCode: procedure.code,
        procedureName: procedure.name,
        category: procedure.category,
        coveragePercentage: coverage.coverage,
        estimatedInsurancePayment: Math.round(insurancePayment * 100) / 100,
        estimatedPatientResponsibility: Math.round(patientResponsibility * 100) / 100,
        deductibleApplied: coverage.deductible && !deductibleMet,
        annualMaximumRemaining: insuranceInfo.coverageDetails.annualMaximum.remaining - insurancePayment,
        preAuthorizationRequired: procedure.category === 'major' || procedure.category === 'orthodontics'
      };
    } catch (error) {
      logger.error('Coverage check error:', error);
      return {
        covered: false,
        error: 'Unable to determine coverage'
      };
    }
  }

  async submitPreAuthorization(patientInfo, procedureInfo, dentistNotes) {
    try {
      // In production, this would submit to insurance company
      const authRequest = {
        patientInfo,
        procedureInfo,
        dentistNotes,
        submittedAt: new Date().toISOString(),
        requestId: `PA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      // Simulate submission
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock response (70% approval rate for major procedures)
      const approved = Math.random() > 0.3;
      
      return {
        success: true,
        requestId: authRequest.requestId,
        status: approved ? 'approved' : 'pending_review',
        estimatedResponseTime: approved ? 'immediate' : '3-5 business days',
        authorizationNumber: approved ? `AUTH-${Date.now()}` : null,
        notes: approved ? 
          'Pre-authorization approved. Please proceed with treatment.' :
          'Additional documentation required. Insurance will contact provider.',
        expirationDate: approved ? 
          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() : null
      };
    } catch (error) {
      logger.error('Pre-authorization submission error:', error);
      return {
        success: false,
        error: 'Unable to submit pre-authorization request'
      };
    }
  }

  async getEOB(patientId, claimId) {
    // Explanation of Benefits retrieval
    try {
      // In production, fetch from insurance API
      const eob = {
        claimId,
        patientId,
        serviceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        provider: 'SmileCare Dental',
        procedures: [
          {
            code: 'D1110',
            description: 'Cleaning',
            billedAmount: 150,
            allowedAmount: 120,
            insurancePayment: 120,
            patientResponsibility: 0
          },
          {
            code: 'D0120',
            description: 'Exam',
            billedAmount: 75,
            allowedAmount: 60,
            insurancePayment: 60,
            patientResponsibility: 0
          }
        ],
        totalBilled: 225,
        totalAllowed: 180,
        totalInsurancePayment: 180,
        totalPatientResponsibility: 0,
        status: 'processed',
        processedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      };

      return {
        success: true,
        eob
      };
    } catch (error) {
      logger.error('EOB retrieval error:', error);
      return {
        success: false,
        error: 'Unable to retrieve EOB'
      };
    }
  }

  estimateCostWithInsurance(procedures, insuranceInfo) {
    let totalCost = 0;
    let totalInsuranceCoverage = 0;
    let totalPatientResponsibility = 0;
    const breakdown = [];

    procedures.forEach(proc => {
      const procedureInfo = this.procedureCodes[proc.type];
      if (!procedureInfo) {
        breakdown.push({
          procedure: proc.type,
          cost: proc.cost,
          covered: false,
          patientPays: proc.cost
        });
        totalPatientResponsibility += proc.cost;
        totalCost += proc.cost;
        return;
      }

      const coverage = insuranceInfo.coverageDetails.coverageByCategory[procedureInfo.category];
      if (!coverage) {
        breakdown.push({
          procedure: procedureInfo.name,
          code: procedureInfo.code,
          cost: proc.cost,
          covered: false,
          patientPays: proc.cost
        });
        totalPatientResponsibility += proc.cost;
        totalCost += proc.cost;
        return;
      }

      const insurancePays = proc.cost * (coverage.coverage / 100);
      const patientPays = proc.cost - insurancePays;

      breakdown.push({
        procedure: procedureInfo.name,
        code: procedureInfo.code,
        cost: proc.cost,
        coveragePercentage: coverage.coverage,
        insurancePays: Math.round(insurancePays * 100) / 100,
        patientPays: Math.round(patientPays * 100) / 100
      });

      totalCost += proc.cost;
      totalInsuranceCoverage += insurancePays;
      totalPatientResponsibility += patientPays;
    });

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      totalInsuranceCoverage: Math.round(totalInsuranceCoverage * 100) / 100,
      totalPatientResponsibility: Math.round(totalPatientResponsibility * 100) / 100,
      breakdown,
      deductibleRemaining: insuranceInfo.coverageDetails.deductible.individual - 
                          insuranceInfo.coverageDetails.deductible.met,
      annualMaximumRemaining: insuranceInfo.coverageDetails.annualMaximum.remaining
    };
  }
}

export default new InsuranceVerificationService();