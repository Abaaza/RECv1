import Stripe from 'stripe';
import { logger } from '../utils/logger.js';
import AuditLog from '../models/AuditLog.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';

class PaymentService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16'
    });
    
    this.paymentMethods = {
      CARD: 'card',
      ACH: 'us_bank_account',
      INSURANCE: 'insurance_claim'
    };
    
    this.webhookEndpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  // Create a payment intent for appointment or treatment
  async createPaymentIntent(options) {
    const {
      amount,
      currency = 'usd',
      patientId,
      appointmentId,
      description,
      metadata = {}
    } = options;
    
    try {
      // Get patient for Stripe customer
      const patient = await Patient.findById(patientId);
      if (!patient) {
        throw new Error('Patient not found');
      }
      
      // Create or get Stripe customer
      let customerId = patient.stripeCustomerId;
      if (!customerId) {
        const customer = await this.createCustomer(patient);
        customerId = customer.id;
        patient.stripeCustomerId = customerId;
        await patient.save();
      }
      
      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        customer: customerId,
        description,
        metadata: {
          patientId: patientId.toString(),
          appointmentId: appointmentId?.toString(),
          ...metadata
        },
        automatic_payment_methods: {
          enabled: true
        },
        receipt_email: patient.email
      });
      
      // Log the payment attempt
      await this.logPaymentActivity('PAYMENT_INTENT_CREATED', {
        patientId,
        appointmentId,
        amount,
        paymentIntentId: paymentIntent.id
      });
      
      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency
      };
    } catch (error) {
      logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  // Create a Stripe customer
  async createCustomer(patient) {
    try {
      const customer = await this.stripe.customers.create({
        email: patient.email,
        name: `${patient.firstName} ${patient.lastName}`,
        phone: patient.phoneNumber,
        metadata: {
          patientId: patient._id.toString()
        },
        address: patient.address ? {
          line1: patient.address.street,
          city: patient.address.city,
          state: patient.address.state,
          postal_code: patient.address.zipCode,
          country: 'US'
        } : undefined
      });
      
      return customer;
    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  // Process insurance claim
  async processInsuranceClaim(options) {
    const {
      patientId,
      appointmentId,
      insuranceProvider,
      policyNumber,
      claimAmount,
      procedures
    } = options;
    
    try {
      // Validate insurance information
      const patient = await Patient.findById(patientId);
      if (!patient.insurance || patient.insurance.policyNumber !== policyNumber) {
        throw new Error('Insurance information mismatch');
      }
      
      // Create insurance claim record
      const claim = {
        id: `claim_${Date.now()}`,
        patientId,
        appointmentId,
        provider: insuranceProvider,
        policyNumber,
        claimAmount,
        procedures,
        status: 'pending',
        submittedAt: new Date(),
        estimatedProcessingDays: 14
      };
      
      // In production, this would integrate with insurance API
      // For now, we'll simulate the claim submission
      await this.simulateInsuranceSubmission(claim);
      
      // Update appointment with insurance claim info
      if (appointmentId) {
        await Appointment.findByIdAndUpdate(appointmentId, {
          'billing.insuranceClaim': claim,
          'billing.insuranceStatus': 'pending'
        });
      }
      
      // Log the insurance claim
      await this.logPaymentActivity('INSURANCE_CLAIM_SUBMITTED', {
        patientId,
        appointmentId,
        claimId: claim.id,
        amount: claimAmount
      });
      
      return {
        success: true,
        claimId: claim.id,
        status: claim.status,
        estimatedProcessingDays: claim.estimatedProcessingDays
      };
    } catch (error) {
      logger.error('Error processing insurance claim:', error);
      throw error;
    }
  }

  // Simulate insurance submission (replace with real integration)
  async simulateInsuranceSubmission(claim) {
    return new Promise((resolve) => {
      setTimeout(() => {
        logger.info('Insurance claim submitted:', claim.id);
        resolve(true);
      }, 1000);
    });
  }

  // Create a payment plan
  async createPaymentPlan(options) {
    const {
      patientId,
      totalAmount,
      downPayment,
      numberOfInstallments,
      frequency = 'monthly'
    } = options;
    
    try {
      const installmentAmount = (totalAmount - downPayment) / numberOfInstallments;
      
      // Create subscription for recurring payments
      const subscription = await this.stripe.subscriptions.create({
        customer: await this.getOrCreateCustomerId(patientId),
        items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Dental Treatment Payment Plan',
              description: `${numberOfInstallments} installments of $${installmentAmount.toFixed(2)}`
            },
            unit_amount: Math.round(installmentAmount * 100),
            recurring: {
              interval: frequency === 'monthly' ? 'month' : 'week'
            }
          }
        }],
        metadata: {
          patientId: patientId.toString(),
          type: 'payment_plan'
        }
      });
      
      // Process down payment if required
      let downPaymentIntent;
      if (downPayment > 0) {
        downPaymentIntent = await this.createPaymentIntent({
          amount: downPayment,
          patientId,
          description: 'Payment plan down payment'
        });
      }
      
      // Log payment plan creation
      await this.logPaymentActivity('PAYMENT_PLAN_CREATED', {
        patientId,
        totalAmount,
        downPayment,
        installments: numberOfInstallments,
        subscriptionId: subscription.id
      });
      
      return {
        subscriptionId: subscription.id,
        installmentAmount,
        numberOfInstallments,
        frequency,
        downPaymentIntent,
        nextPaymentDate: new Date(subscription.current_period_end * 1000)
      };
    } catch (error) {
      logger.error('Error creating payment plan:', error);
      throw error;
    }
  }

  // Process refund
  async processRefund(paymentIntentId, amount, reason) {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined, // Partial refund if amount specified
        reason: reason || 'requested_by_customer'
      });
      
      // Log refund
      await this.logPaymentActivity('REFUND_PROCESSED', {
        paymentIntentId,
        refundId: refund.id,
        amount: refund.amount / 100,
        reason
      });
      
      return {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        created: new Date(refund.created * 1000)
      };
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw error;
    }
  }

  // Get payment history for a patient
  async getPaymentHistory(patientId, limit = 10) {
    try {
      const patient = await Patient.findById(patientId);
      if (!patient.stripeCustomerId) {
        return [];
      }
      
      const charges = await this.stripe.charges.list({
        customer: patient.stripeCustomerId,
        limit
      });
      
      return charges.data.map(charge => ({
        id: charge.id,
        amount: charge.amount / 100,
        currency: charge.currency,
        status: charge.status,
        description: charge.description,
        created: new Date(charge.created * 1000),
        refunded: charge.refunded,
        refundedAmount: charge.amount_refunded / 100,
        receiptUrl: charge.receipt_url
      }));
    } catch (error) {
      logger.error('Error fetching payment history:', error);
      throw error;
    }
  }

  // Handle Stripe webhooks
  async handleWebhook(signature, payload) {
    let event;
    
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookEndpointSecret
      );
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      throw new Error('Invalid webhook signature');
    }
    
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object);
        break;
        
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object);
        break;
        
      case 'charge.refunded':
        await this.handleRefundComplete(event.data.object);
        break;
        
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionChange(event.data.object);
        break;
        
      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }
    
    return { received: true };
  }

  // Handle successful payment
  async handlePaymentSuccess(paymentIntent) {
    const { appointmentId, patientId } = paymentIntent.metadata;
    
    // Update appointment payment status
    if (appointmentId) {
      await Appointment.findByIdAndUpdate(appointmentId, {
        'billing.paymentStatus': 'paid',
        'billing.paidAmount': paymentIntent.amount / 100,
        'billing.paymentDate': new Date(),
        'billing.paymentIntentId': paymentIntent.id
      });
    }
    
    // Log successful payment
    await this.logPaymentActivity('PAYMENT_COMPLETED', {
      patientId,
      appointmentId,
      amount: paymentIntent.amount / 100,
      paymentIntentId: paymentIntent.id
    });
    
    // Send confirmation email
    // await emailService.sendPaymentConfirmation(patientId, paymentIntent);
  }

  // Handle failed payment
  async handlePaymentFailure(paymentIntent) {
    const { appointmentId, patientId } = paymentIntent.metadata;
    
    // Update appointment payment status
    if (appointmentId) {
      await Appointment.findByIdAndUpdate(appointmentId, {
        'billing.paymentStatus': 'failed',
        'billing.failureReason': paymentIntent.last_payment_error?.message
      });
    }
    
    // Log failed payment
    await this.logPaymentActivity('PAYMENT_FAILED', {
      patientId,
      appointmentId,
      amount: paymentIntent.amount / 100,
      paymentIntentId: paymentIntent.id,
      error: paymentIntent.last_payment_error?.message
    });
    
    // Send failure notification
    // await emailService.sendPaymentFailure(patientId, paymentIntent);
  }

  // Handle refund completion
  async handleRefundComplete(charge) {
    await this.logPaymentActivity('REFUND_COMPLETED', {
      chargeId: charge.id,
      refundedAmount: charge.amount_refunded / 100,
      customerId: charge.customer
    });
  }

  // Handle subscription changes
  async handleSubscriptionChange(subscription) {
    const { patientId } = subscription.metadata;
    
    await this.logPaymentActivity('SUBSCRIPTION_UPDATED', {
      patientId,
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    });
  }

  // Get or create Stripe customer ID
  async getOrCreateCustomerId(patientId) {
    const patient = await Patient.findById(patientId);
    if (patient.stripeCustomerId) {
      return patient.stripeCustomerId;
    }
    
    const customer = await this.createCustomer(patient);
    patient.stripeCustomerId = customer.id;
    await patient.save();
    
    return customer.id;
  }

  // Log payment activity to audit log
  async logPaymentActivity(action, details) {
    try {
      await AuditLog.create({
        userId: details.patientId || 'system',
        action: 'PAYMENT_PROCESS',
        entityType: 'Payment',
        entityId: details.paymentIntentId || details.subscriptionId || details.claimId,
        metadata: {
          paymentAction: action,
          ...details
        },
        ipAddress: '127.0.0.1', // Should be from request context
        success: !action.includes('FAILED'),
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error logging payment activity:', error);
    }
  }

  // Calculate estimated costs for procedures
  async estimateCosts(procedures, hasInsurance = false) {
    // In production, this would fetch from a pricing database
    const procedureCosts = {
      'cleaning': 150,
      'filling': 250,
      'crown': 1200,
      'root_canal': 1500,
      'extraction': 300,
      'whitening': 500,
      'braces': 5000,
      'implant': 3000,
      'dentures': 2000,
      'bridge': 2500
    };
    
    let totalCost = 0;
    const breakdown = [];
    
    for (const procedure of procedures) {
      const cost = procedureCosts[procedure.type] || 500;
      const quantity = procedure.quantity || 1;
      const subtotal = cost * quantity;
      
      breakdown.push({
        procedure: procedure.type,
        quantity,
        unitCost: cost,
        subtotal
      });
      
      totalCost += subtotal;
    }
    
    // Apply insurance discount if applicable
    const insuranceDiscount = hasInsurance ? totalCost * 0.6 : 0;
    const patientResponsibility = totalCost - insuranceDiscount;
    
    return {
      totalCost,
      breakdown,
      insuranceDiscount,
      patientResponsibility,
      currency: 'usd'
    };
  }
}

// Create singleton instance
const paymentService = new PaymentService();

export default paymentService;