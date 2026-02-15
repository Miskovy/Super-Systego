import { PaymentMethodModel } from '../../models/shema/auth/PaymentMethod';
import asyncHandler from 'express-async-handler';
import { NotFound } from '../../Errors/NotFound';
import { UnauthorizedError } from '../../Errors/unauthorizedError';
import { SuccessResponse } from '../../utils/response';
import { saveBase64Image } from '../../utils/handleImages';

export const getAllPaymentMethods = asyncHandler(async (req, res) => {
  const paymentMethods = await PaymentMethodModel.find()
    .sort({ created_at: -1 });

  return SuccessResponse(res, { message: 'Payment methods retrieved successfully', data: paymentMethods }, 200);
});

export const getPaymentMethodById = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const paymentMethod = await PaymentMethodModel.findOne({ _id: id });

  if (!paymentMethod) {
    throw new NotFound('Payment method not found');
  }

  return SuccessResponse(res, { message: 'Payment method retrieved successfully', data: paymentMethod }, 200);
});

export const createPaymentMethod = asyncHandler(async (req, res) => {
  const { name, description, status } = req.body;
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError('User authentication failed');
  }

  const base64 = req.body.logo;
  const folder = 'payment-methods';
  const imageUrl = await saveBase64Image(base64, userId, req, folder);

  const paymentMethod = await PaymentMethodModel.create({
    name,
    description,
    logo: imageUrl,
    status
  });

  return SuccessResponse(res, { message: 'Payment method created successfully', data: paymentMethod }, 201);
});

export const updatePaymentMethod = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const updateData = req.body;

  const paymentMethod = await PaymentMethodModel.findOneAndUpdate(
    { _id: id },
    updateData,
    { new: true, runValidators: true }
  );

  if (!paymentMethod) {
    throw new NotFound('Payment method not found');
  }

  return SuccessResponse(res, { message: 'Payment method updated successfully', data: paymentMethod }, 200);
});

export const deletePaymentMethod = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const paymentMethod = await PaymentMethodModel.findOneAndDelete({ _id: id });

  if (!paymentMethod) {
    throw new NotFound('Payment method not found');
  }

  return SuccessResponse(res, { message: 'Payment method deleted successfully', data: paymentMethod }, 200);
});

export const getActivePaymentMethods = asyncHandler(async (req, res) => {
  const paymentMethods = await PaymentMethodModel.find({ status: true })
    .sort({ created_at: -1 });

  return SuccessResponse(res, { message: 'Active payment methods retrieved successfully', data: paymentMethods }, 200);
});