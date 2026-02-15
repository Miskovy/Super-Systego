"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.delete_item = exports.modify = exports.create = exports.getById = exports.view = void 0;
const Package_1 = require("../../models/shema/auth/Package");
const Errors_1 = require("../../Errors");
const response_1 = require("../../utils/response");
const view = async (req, res) => {
    const packages = await Package_1.PackageModel.find();
    return (0, response_1.SuccessResponse)(res, { data: packages }, 200);
};
exports.view = view;
// get by id 
const getById = async (req, res) => {
    const id = req.params.id;
    const package_item = await Package_1.PackageModel.findById(id);
    if (!package_item) {
        throw new Errors_1.NotFound('Package not found');
    }
    return (0, response_1.SuccessResponse)(res, { data: package_item }, 200);
};
exports.getById = getById;
const create = async (req, res) => {
    const { name, description, monthly_price, quarterly_price, half_yearly_price, yearly_price, status, } = req.body;
    const new_package = await Package_1.PackageModel.create({
        name,
        description,
        monthly_price,
        quarterly_price,
        half_yearly_price,
        yearly_price,
        status,
    });
    return (0, response_1.SuccessResponse)(res, { message: 'Package created successfully' }, 201);
};
exports.create = create;
const modify = async (req, res) => {
    const id = req.params.id;
    let package_item = await Package_1.PackageModel.findById(id);
    if (!package_item) {
        throw new Errors_1.UnauthorizedError('Package not found');
    }
    const { name, description, monthly_price, quarterly_price, half_yearly_price, yearly_price, status, } = req.body;
    package_item.name = name || package_item.name;
    package_item.description = description || package_item.description;
    package_item.monthly_price = monthly_price || package_item.monthly_price;
    package_item.quarterly_price = quarterly_price || package_item.quarterly_price;
    package_item.half_yearly_price = half_yearly_price || package_item.half_yearly_price;
    package_item.yearly_price = yearly_price || package_item.yearly_price;
    package_item.status = status || package_item.status;
    await package_item.save();
    return (0, response_1.SuccessResponse)(res, { message: 'package updated successfully' }, 200);
};
exports.modify = modify;
const delete_item = async (req, res) => {
    const id = req.params.id;
    const packages = await Package_1.PackageModel.findByIdAndDelete(id);
    if (!packages) {
        throw new Errors_1.NotFound('package not found');
    }
    return (0, response_1.SuccessResponse)(res, { message: 'package deleted successfully' }, 200);
};
exports.delete_item = delete_item;
