import Joi from 'joi';

export const createClientValidator = Joi.object({
  company_name: Joi.string().trim().min(2).max(100).required()
    .messages({
      'string.empty': 'Company name is required',
      'string.min': 'Company name must be at least 2 characters long',
      'string.max': 'Company name cannot exceed 100 characters',
      'any.required': 'Company name is required'
    }),
  
  email: Joi.string().email().lowercase().trim().required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string().min(6).required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.empty': 'Password is required',
      'any.required': 'Password is required'
    }),
  
  status: Joi.string().valid('active', 'inactive', 'suspended').default('active')
    .messages({
      'any.only': 'Status must be one of: active, inactive, suspended'
    }),
  
  package_id: Joi.string().hex().length(24).optional()
    .messages({
      'string.hex': 'Package ID must be a valid hexadecimal string',
      'string.length': 'Package ID must be exactly 24 characters long'
    })
});

export const updateClientValidator = Joi.object({
  company_name: Joi.string().trim().min(2).max(100).optional()
    .messages({
      'string.min': 'Company name must be at least 2 characters long',
      'string.max': 'Company name cannot exceed 100 characters'
    }),
  
  email: Joi.string().email().lowercase().trim().optional()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  
  password: Joi.string().min(6).optional()
    .messages({
      'string.min': 'Password must be at least 6 characters long'
    }),
  
  status: Joi.string().valid('active', 'inactive', 'suspended').optional()
    .messages({
      'any.only': 'Status must be one of: active, inactive, suspended'
    }),
  
  package_id: Joi.string().hex().length(24).optional()
    .messages({
      'string.hex': 'Package ID must be a valid hexadecimal string',
      'string.length': 'Package ID must be exactly 24 characters long'
    })
}).min(1).messages({
  'object.min': 'At least one field is required to update'
});
