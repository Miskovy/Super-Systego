import { ClientModel } from '../../models/shema/auth/Client';
import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { NotFound } from '../../Errors/NotFound';
import { SuccessResponse } from '../../utils/response';
import { PackageModel } from '../../models/shema/auth/Package';
import { UniqueConstrainError } from '../../Errors';
import {
  createSubdomain,
  deleteSubdomain,
  sanitizeSubdomainName,
  validateSubdomainName,
} from '../../utils/PleskService';

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
  const { company_name, email, password, status, package_id, subdomain } = req.body;

  // --- Validate package ---
  const existingPackage = await PackageModel.findById(package_id);
  if (!existingPackage) {
    throw new NotFound('Package not found');
  }

  // --- Validate email uniqueness ---
  const existingClient = await ClientModel.findOne({ email });
  if (existingClient) {
    throw new UniqueConstrainError('Client with this email already exists');
  }

  // --- Validate & sanitize subdomain ---
  const validationError = validateSubdomainName(subdomain);
  if (validationError) {
    throw new UniqueConstrainError(validationError);
  }

  const sanitizedSubdomain = sanitizeSubdomainName(subdomain);

  // Check if subdomain is already taken
  const existingSubdomain = await ClientModel.findOne({ subdomain: sanitizedSubdomain });
  if (existingSubdomain) {
    throw new UniqueConstrainError(`Subdomain "${sanitizedSubdomain}.systego.net" is already taken`);
  }

  // --- Create the client record ---
  const client = await ClientModel.create({
    company_name,
    email,
    password,
    status,
    package_id,
    subdomain: sanitizedSubdomain,
  });

  const dbName = `sc_${client._id}`;

  // --- Create the client's MongoDB database ---
  try {
    const newDbConnection = mongoose.connection.useDb(dbName, { useCache: true });
    await newDbConnection.createCollection('metadata');
    await newDbConnection.collection('metadata').insertOne({
      created_at: new Date(),
      client_id: client._id,
      company_name: client.company_name,
    });
    console.log(`Database ${dbName} created via useDb`);
  } catch (error: any) {
    console.error('Failed to create client database:', error);
    // Rollback: delete the client record
    await ClientModel.findByIdAndDelete(client._id);
    throw new Error(`Failed to create client database: ${error.message || error}. Client creation rolled back.`);
  }

  // --- Create the Plesk subdomain ---
  let subdomainUrl: string;
  try {
    subdomainUrl = await createSubdomain(sanitizedSubdomain);
    console.log(`Subdomain ${subdomainUrl} created in Plesk`);
  } catch (error: any) {
    console.error('Failed to create subdomain in Plesk:', error.message);
    // Rollback: delete the client record and database
    await ClientModel.findByIdAndDelete(client._id);
    try {
      await mongoose.connection.useDb(dbName, { useCache: true }).dropDatabase();
    } catch (dbError) {
      console.error('Failed to rollback database:', dbError);
    }
    throw new Error(`Failed to create subdomain in Plesk: ${error.message}`);
  }

  // --- Update client with db_name and subdomain_url ---
  client.db_name = dbName;
  client.subdomain_url = subdomainUrl;
  await client.save();

  return SuccessResponse(res, { message: 'Client created successfully', data: client }, 201);
});

export const updateClient = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const updateData = req.body;

  // Prevent subdomain changes (subdomain is immutable after creation)
  if (updateData.subdomain || updateData.subdomain_url) {
    delete updateData.subdomain;
    delete updateData.subdomain_url;
  }

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
  const client = await ClientModel.findById(id);

  if (!client) {
    throw new NotFound('Client not found');
  }

  // --- Delete the Plesk subdomain ---
  if (client.subdomain) {
    try {
      await deleteSubdomain(client.subdomain);
      console.log(`Subdomain ${client.subdomain_url} deleted from Plesk`);
    } catch (error: any) {
      console.error('Failed to delete subdomain from Plesk:', error.message);
      // Continue with client deletion even if subdomain removal fails
      // The admin can manually clean it up in Plesk if needed
    }
  }

  // --- Drop the client's MongoDB database ---
  if (client.db_name) {
    try {
      await mongoose.connection.useDb(client.db_name, { useCache: true }).dropDatabase();
      console.log(`Database ${client.db_name} dropped`);
    } catch (error) {
      console.error('Failed to drop client database:', error);
    }
  }

  // --- Delete the client record ---
  await ClientModel.findByIdAndDelete(id);

  return SuccessResponse(res, { message: 'Client deleted successfully', data: client }, 200);
});

export const getClientsByStatus = asyncHandler(async (req, res) => {
  const { status } = req.params;
  const clients = await ClientModel.find({ status })
    .sort({ created_at: -1 })
    .populate('package_id');

  return SuccessResponse(res, { message: `Clients with status ${status} retrieved successfully`, data: clients }, 200);
});

export const select = asyncHandler(async (req, res) => {
  const packages = await PackageModel.find()
    .select('name')
    .sort({ created_at: -1 });

  return SuccessResponse(res, { message: 'Packages retrieved successfully', data: packages }, 200);
});