import { ClientModel } from '../../models/shema/auth/Client';
import asyncHandler from 'express-async-handler';
import { NotFound } from '../../Errors/NotFound';
import { SuccessResponse } from '../../utils/response';
import { PackageModel } from '../../models/shema/auth/Package';
import { UniqueConstrainError } from '../../Errors';

export const getAllClients = asyncHandler(async (req, res) => {
  const clients = await ClientModel.find()
    .select('-password')
    .sort({ created_at: -1 })
    .populate('package_id');

  return SuccessResponse(res, { message: 'Clients retrieved successfully', data: clients }, 200);
});

export const getClientById = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const client = await ClientModel.findOne({ _id: id })
    .populate('package_id');

  if (!client) {
    throw new NotFound('Client not found');
  }

  return SuccessResponse(res, { message: 'Client retrieved successfully', data: client }, 200);
});

export const createClient = asyncHandler(async (req, res) => {
  const { company_name, email, password, status, package_id } = req.body;

  // check package_id exists
  const existingPackage = await PackageModel.findById(package_id);
  if (!existingPackage) {
    throw new NotFound('Package not found');
  }

  //check if client email already exists
    const existingClient = await ClientModel.findOne({ email });
    if (existingClient) {
        throw new UniqueConstrainError('Client with this email already exists');
    }
  
  const client = await ClientModel.create({
    company_name,
    email,
    password,
    status,
    package_id
  });

  return SuccessResponse(res, { message: 'Client created successfully' }, 201);
});

export const updateClient = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const updateData = req.body;

  const client = await ClientModel.findOneAndUpdate(
    { _id: id },
    updateData,
    { new: true, runValidators: true }
  ).populate('package_id');

  if (!client) {
    throw new NotFound('Client not found');
  }

  return SuccessResponse(res, { message: 'Client updated successfully', data: client }, 200);
});

export const deleteClient = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const client = await ClientModel.findOneAndDelete({ _id: id });

  if (!client) {
    throw new NotFound('Client not found');
  }

  return SuccessResponse(res, { message: 'Client deleted successfully', data: client }, 200);
});

export const getClientsByStatus = asyncHandler(async (req, res) => {
  const { status } = req.params;
  const clients = await ClientModel.find({ status })
    .sort({ created_at: -1 })
    .populate('package_id');

  return SuccessResponse(res, { message: `Clients with status ${status} retrieved successfully`, data: clients }, 200);
});