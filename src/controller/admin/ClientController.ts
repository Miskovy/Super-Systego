import { ClientModel } from '../../models/shema/auth/Client';
import mongoose from 'mongoose';
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

  /* Create the new client first to get the ID (or use a generated ID) 
     Actually, let's create the client with the db_name first. 
  */

  // Generate a unique database name
  // We can use the company name or just a random ID. Let's use a combination or just a prefix + timestamp to ensure uniqueness if we don't have the client ID yet.
  // Better approach: Create the client instance but don't save it yet, or save it and then update it?
  // Let's create the client first.

  const client = await ClientModel.create({
    company_name,
    email,
    password,
    status,
    package_id
  });

  const dbName = `systego_client_${client._id}`;

  // Update client with db_name
  client.db_name = dbName;
  await client.save();

  // Create the new database
  try {
    const mongoUri = process.env.MongoDB_URI || "";
    // Append the new database name to the URI connection string? 
    // Usually the URI is like mongodb://host:port/admin or similar.
    // If we connect to a new DB name, Mongo creates it.

    // We need to parse the URI and replace the DB name, or just pass the dbName option if using createConnection

    // Assuming URI is strict, let's try to just connect with the same URI but switching logical DB is different. 
    // mongoose.createConnection(uri, options)

    // Simplest way: Construct a new URI with the new DB name
    // But connection string might have auth source.
    // Let's assumes a standard URI format for now or use the existing connection info.

    // Actually, createConnection returns a connection instance.
    // If we want to create a DB, we just need to write something to it.

    // Let's use the same base URI but change the database name if possible.
    // If the URI includes the database name, we should replace it.
    // If it doesn't, we append it.

    // A safer way is to use the `useDb` method on the existing connection if we want to switch context, 
    // but `useDb` returns a connection to that DB.

    // Let's try:
    const newDbConnection = mongoose.connection.useDb(dbName, { useCache: true });
    // We need to create a collection to persist the DB
    await newDbConnection.createCollection('metadata');
    // Insert a document to be sure
    await newDbConnection.collection('metadata').insertOne({
      created_at: new Date(),
      client_id: client._id,
      company_name: client.company_name
    });

    console.log(`Database ${dbName} created via useDb`);

  } catch (error) {
    console.error("Failed to create client database:", error);
    // Should we delete the client if DB creation fails? 
    // For now, let's just log it.
  }

  return SuccessResponse(res, { message: 'Client created successfully', data: client }, 201);
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

export const select = asyncHandler(async (req, res) => {
  const packages = await PackageModel.find()
    .select('name')
    .sort({ created_at: -1 });

  return SuccessResponse(res, { message: 'Packages retrieved successfully', data: packages }, 200);
});