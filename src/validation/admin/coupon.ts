import Joi from "joi";

export const couponSchema = Joi.object({
  code: Joi.string().required(),
  discount_type: Joi.string().valid("value", "percentage").required(),
  discount: Joi.number().required(),
  from: Joi.date().required(),
  to: Joi.date().required(),
  status: Joi.boolean().required(),
});
