"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.delete_item = exports.modify = exports.create = exports.getCouponById = exports.view = void 0;
const Coupon_1 = require("../../models/shema/auth/Coupon");
const Errors_1 = require("../../Errors");
const response_1 = require("../../utils/response");
const view = async (req, res) => {
    const coupons = await Coupon_1.CouponModel.find();
    return (0, response_1.SuccessResponse)(res, { data: coupons }, 200);
};
exports.view = view;
// get by id 
const getCouponById = async (req, res) => {
    const id = req.params.id;
    const coupon = await Coupon_1.CouponModel.findById(id);
    if (!coupon) {
        throw new Errors_1.NotFound('Coupon not found');
    }
    return (0, response_1.SuccessResponse)(res, { data: coupon }, 200);
};
exports.getCouponById = getCouponById;
const create = async (req, res) => {
    const { code, discount_type, discount, from, to, status, } = req.body;
    const coupons = await Coupon_1.CouponModel.findOne({ code }).exec();
    if (coupons) {
        throw new Errors_1.UnauthorizedError('Code must be unique');
    }
    const coupon = await Coupon_1.CouponModel.create({
        code,
        discount_type,
        discount,
        from,
        to,
        status,
    });
    return (0, response_1.SuccessResponse)(res, { message: 'Coupon created successfully' }, 201);
};
exports.create = create;
const modify = async (req, res) => {
    const id = req.params.id;
    const coupon = await Coupon_1.CouponModel.findById(id);
    if (!coupon) {
        throw new Errors_1.UnauthorizedError('Coupon not found');
    }
    const { code, discount_type, discount, from, to, status, } = req.body;
    coupon.code = code || coupon.code;
    coupon.discount_type = discount_type || coupon.discount_type;
    coupon.discount = discount || coupon.discount;
    coupon.from = from || coupon.from;
    coupon.to = to || coupon.to;
    coupon.status = status || coupon.status;
    await coupon.save();
    return (0, response_1.SuccessResponse)(res, { message: 'Coupon updated successfully' }, 200);
};
exports.modify = modify;
const delete_item = async (req, res) => {
    const id = req.params.id;
    const coupon = await Coupon_1.CouponModel.findByIdAndDelete(id);
    if (!coupon) {
        throw new Errors_1.NotFound('coupon not found');
    }
    return (0, response_1.SuccessResponse)(res, { message: 'coupon deleted successfully' }, 200);
};
exports.delete_item = delete_item;
