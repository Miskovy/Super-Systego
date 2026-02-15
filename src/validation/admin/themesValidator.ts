import Joi from 'joi';

export const createThemeValidator = Joi.object({
  name: Joi.string().trim().min(2).max(100).required()
    .messages({
      'string.empty': 'Theme name is required',
      'string.min': 'Theme name must be at least 2 characters long',
      'string.max': 'Theme name cannot exceed 100 characters',
      'any.required': 'Theme name is required'
    }),
  
  description: Joi.string().trim().max(500).optional().allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  
  theme: Joi.string().trim().required()
    .messages({
      'string.empty': 'Theme value is required',
      'any.required': 'Theme value is required'
    })
});

export const updateThemeValidator = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional()
    .messages({
      'string.min': 'Theme name must be at least 2 characters long',
      'string.max': 'Theme name cannot exceed 100 characters'
    }),
  
  description: Joi.string().trim().max(500).optional().allow('')
    .messages({
      'string.max': 'Description cannot exceed 500 characters'
    }),
  
  theme: Joi.string().trim().optional()
    .messages({
      'string.empty': 'Theme value cannot be empty'
    })
}).min(1).messages({
  'object.min': 'At least one field is required to update'
});
