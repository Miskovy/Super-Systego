import { Router } from 'express';
import { getAllPaymentMethods, getPaymentMethodById, createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from '../../controller/admin/PaymentMethodController';
import { createPaymentMethodValidator, updatePaymentMethodValidator } from '../../validation/admin/paymentMethodValidator';
import { validate } from '../../middlewares/validation';
 import { authenticated } from '../../middlewares/authenticated';
const router = Router();
router.use(authenticated);

router.get('/', getAllPaymentMethods);
router.get('/:id', getPaymentMethodById);
router.post('/', validate(createPaymentMethodValidator), createPaymentMethod);
router.put('/:id', validate(updatePaymentMethodValidator), updatePaymentMethod);
router.delete('/:id', deletePaymentMethod);

export default router;
