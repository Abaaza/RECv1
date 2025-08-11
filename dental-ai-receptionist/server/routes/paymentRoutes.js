import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import paymentService from '../services/paymentService.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { auditLog } from '../middleware/security.js';
import { catchAsync } from '../middleware/errorHandler.js';
import { aiLimiter } from '../middleware/security.js';

const router = express.Router();

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Create payment intent
router.post('/payment-intent',
  authenticate,
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Invalid amount'),
    body('patientId').isMongoId().withMessage('Invalid patient ID'),
    body('appointmentId').optional().isMongoId().withMessage('Invalid appointment ID'),
    body('description').optional().isString().trim()
  ],
  validateRequest,
  auditLog('PAYMENT_PROCESS', 'Payment'),
  catchAsync(async (req, res) => {
    const result = await paymentService.createPaymentIntent(req.body);
    res.json(result);
  })
);

// Process insurance claim
router.post('/insurance-claim',
  authenticate,
  authorize(['receptionist', 'admin', 'dentist']),
  [
    body('patientId').isMongoId(),
    body('appointmentId').isMongoId(),
    body('insuranceProvider').isString().trim(),
    body('policyNumber').isString().trim(),
    body('claimAmount').isFloat({ min: 0 }),
    body('procedures').isArray()
  ],
  validateRequest,
  auditLog('INSURANCE_CLAIM', 'Payment'),
  catchAsync(async (req, res) => {
    const result = await paymentService.processInsuranceClaim(req.body);
    res.json(result);
  })
);

// Create payment plan
router.post('/payment-plan',
  authenticate,
  [
    body('patientId').isMongoId(),
    body('totalAmount').isFloat({ min: 0 }),
    body('downPayment').isFloat({ min: 0 }),
    body('numberOfInstallments').isInt({ min: 2, max: 24 }),
    body('frequency').optional().isIn(['monthly', 'biweekly'])
  ],
  validateRequest,
  auditLog('PAYMENT_PLAN_CREATE', 'Payment'),
  catchAsync(async (req, res) => {
    const result = await paymentService.createPaymentPlan(req.body);
    res.json(result);
  })
);

// Process refund
router.post('/refund',
  authenticate,
  authorize(['admin', 'receptionist']),
  [
    body('paymentIntentId').isString(),
    body('amount').optional().isFloat({ min: 0 }),
    body('reason').optional().isString()
  ],
  validateRequest,
  auditLog('REFUND_PROCESS', 'Payment'),
  catchAsync(async (req, res) => {
    const { paymentIntentId, amount, reason } = req.body;
    const result = await paymentService.processRefund(paymentIntentId, amount, reason);
    res.json(result);
  })
);

// Get payment history
router.get('/history/:patientId',
  authenticate,
  [
    param('patientId').isMongoId(),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validateRequest,
  catchAsync(async (req, res) => {
    const { patientId } = req.params;
    const { limit = 10 } = req.query;
    
    // Check if user can access this patient's payment history
    if (req.user.role === 'patient' && req.user.patientId !== patientId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const history = await paymentService.getPaymentHistory(patientId, parseInt(limit));
    res.json(history);
  })
);

// Estimate costs
router.post('/estimate',
  authenticate,
  [
    body('procedures').isArray().notEmpty(),
    body('hasInsurance').optional().isBoolean()
  ],
  validateRequest,
  catchAsync(async (req, res) => {
    const { procedures, hasInsurance } = req.body;
    const estimate = await paymentService.estimateCosts(procedures, hasInsurance);
    res.json(estimate);
  })
);

// Stripe webhook endpoint
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  catchAsync(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    const result = await paymentService.handleWebhook(signature, req.body);
    res.json(result);
  })
);

// Get payment methods for a patient
router.get('/payment-methods/:patientId',
  authenticate,
  [
    param('patientId').isMongoId()
  ],
  validateRequest,
  catchAsync(async (req, res) => {
    const { patientId } = req.params;
    
    // Check authorization
    if (req.user.role === 'patient' && req.user.patientId !== patientId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const customerId = await paymentService.getOrCreateCustomerId(patientId);
    const paymentMethods = await paymentService.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });
    
    res.json({
      paymentMethods: paymentMethods.data.map(pm => ({
        id: pm.id,
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year
      }))
    });
  })
);

// Add payment method
router.post('/payment-methods',
  authenticate,
  [
    body('patientId').isMongoId(),
    body('paymentMethodId').isString()
  ],
  validateRequest,
  auditLog('PAYMENT_METHOD_ADD', 'Payment'),
  catchAsync(async (req, res) => {
    const { patientId, paymentMethodId } = req.body;
    
    // Check authorization
    if (req.user.role === 'patient' && req.user.patientId !== patientId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const customerId = await paymentService.getOrCreateCustomerId(patientId);
    
    // Attach payment method to customer
    await paymentService.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });
    
    res.json({ success: true });
  })
);

// Remove payment method
router.delete('/payment-methods/:paymentMethodId',
  authenticate,
  [
    param('paymentMethodId').isString()
  ],
  validateRequest,
  auditLog('PAYMENT_METHOD_REMOVE', 'Payment'),
  catchAsync(async (req, res) => {
    const { paymentMethodId } = req.params;
    
    // Detach payment method
    await paymentService.stripe.paymentMethods.detach(paymentMethodId);
    
    res.json({ success: true });
  })
);

// Get outstanding balance
router.get('/balance/:patientId',
  authenticate,
  [
    param('patientId').isMongoId()
  ],
  validateRequest,
  catchAsync(async (req, res) => {
    const { patientId } = req.params;
    
    // Check authorization
    if (req.user.role === 'patient' && req.user.patientId !== patientId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Calculate outstanding balance from appointments
    const appointments = await Appointment.find({
      patientId,
      'billing.paymentStatus': { $in: ['pending', 'partial'] }
    });
    
    const totalOwed = appointments.reduce((sum, apt) => {
      const owed = apt.billing.totalCost - (apt.billing.paidAmount || 0);
      return sum + owed;
    }, 0);
    
    res.json({
      outstandingBalance: totalOwed,
      unpaidAppointments: appointments.length
    });
  })
);

export default router;