import Joi from "joi";

export const couponSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  monthly_price: Joi.number().required(),
  quarterly_price: Joi.number().required(),
  half_yearly_price: Joi.number().required(),
  yearly_price: Joi.number().required(),
  status: Joi.boolean().required(),
});
