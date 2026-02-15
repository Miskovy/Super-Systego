import Joi from "joi";

export const signupSchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  imageBase64: Joi.string().optional(),
});
export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

export const verifyEmailSchema = Joi.object({
  userId: Joi.string().required(),
  code: Joi.string().required(),
});

export const sendResetCodeSchema = Joi.object({
  email: Joi.string().email().required(),
}); 

export const checkResetCodeSchema = Joi.object({
  email: Joi.string().required(),
  code: Joi.string().required(),
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().required(),
  code: Joi.string().required(),
  newPassword: Joi.string().min(6).max(30).required(),
}); 

