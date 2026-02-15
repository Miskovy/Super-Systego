import Joi from 'joi';

export const createPaymentMethodValidator = Joi.object({
  name: Joi.string().trim().min(2).max(50).required()
    .messages({
      'string.empty': 'Payment method name is required',
      'string.min': 'Payment method name must be at least 2 characters long',
      'string.max': 'Payment method name cannot exceed 50 characters',
      'any.required': 'Payment method name is required'
    }),
  
  description: Joi.string().trim().max(500).optional().allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  
  logo: Joi.string().trim().uri().required()
    .messages({
      'string.uri': 'Logo must be a valid URL',
      'string.empty': 'Logo URL is required',
      'any.required': 'Logo URL is required'
    }),
  
  status: Joi.boolean().required()
    .messages({
      'boolean.base': 'Status must be a boolean value (true/false)',
      'any.required': 'Status is required'
    })
});

export const updatePaymentMethodValidator = Joi.object({
  name: Joi.string().trim().min(2).max(50).optional()
    .messages({
      'string.min': 'Payment method name must be at least 2 characters long',
      'string.max': 'Payment method name cannot exceed 50 characters'
    }),
  
  description: Joi.string().trim().max(500).optional().allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  
  logo: Joi.string().trim().uri().optional()
    .messages({
      'string.uri': 'Logo must be a valid URL'
    }),
  
  status: Joi.boolean().optional()
    .messages({
      'boolean.base': 'Status must be a boolean value (true/false)'
    })
}).min(1).messages({
  'object.min': 'At least one field is required to update'
});
