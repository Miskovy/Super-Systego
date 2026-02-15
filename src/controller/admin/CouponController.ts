import { Request, Response } from "express";
import { CouponModel } from "../../models/shema/auth/Coupon";
import { NotFound, UnauthorizedError } from "../../Errors";
import { SuccessResponse } from "../../utils/response";


export const view = async (req: Request, res: Response) => {
  const coupons = await CouponModel.find();
  
  return SuccessResponse(res, { data: coupons }, 200);
};

// get by id 
export const getCouponById = async (req: Request, res: Response) => {
  const id = req.params.id;
  const coupon = await CouponModel.findById(id);
  if (!coupon) {
    throw new NotFound('Coupon not found');
  }
  return SuccessResponse(res, { data: coupon }, 200);
}

export const create = async (req: Request, res: Response) => {
    const {
        code,
        discount_type,
        discount,
        from,
        to,
        status,
    } = req.body;
  
    const coupons = await CouponModel.findOne({ code }).exec();
    if (coupons) {
      throw new UnauthorizedError('Code must be unique');
    }

    const coupon = await CouponModel.create({
        code,
        discount_type,
        discount,
        from,
        to,
        status,
    });
  return SuccessResponse(res, { message: 'Coupon created successfully' }, 201);
};



export const modify = async (req: Request, res: Response) => {
  const id = req.params.id;
  const coupon = await CouponModel.findById(id);

  if (!coupon) {
    throw new UnauthorizedError('Coupon not found');
  }

  const {
    code,
    discount_type,
    discount,
    from,
    to,
    status,
  } = req.body;

  coupon.code = code || coupon.code;
  coupon.discount_type = discount_type || coupon.discount_type;
  coupon.discount = discount || coupon.discount;
  coupon.from = from || coupon.from;
  coupon.to = to || coupon.to;
  coupon.status = status || coupon.status;

  await coupon.save();

  return SuccessResponse(res, { message: 'Coupon updated successfully' }, 200);
};

export const delete_item = async (req: Request, res: Response) => {
  const id = req.params.id;
  const coupon = await CouponModel.findByIdAndDelete(id);
    if (!coupon) {
      throw new NotFound('coupon not found');
    }
  
    return SuccessResponse(res, { message: 'coupon deleted successfully' }, 200);
};
