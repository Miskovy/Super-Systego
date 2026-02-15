"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const joi_1 = __importDefault(require("joi"));
function gatherFiles(req) {
    const files = [];
    if (req.file)
        files.push(req.file);
    if (req.files) {
        if (Array.isArray(req.files)) {
            files.push(...req.files);
        }
        else {
            Object.values(req.files)
                .flat()
                .forEach((file) => {
                files.push(file);
            });
        }
    }
    return files;
}
const validate = (schema, target = "body") => {
    return async (req, res, next) => {
        try {
            await schema.validateAsync(req[target], { abortEarly: false });
            next();
        }
        catch (error) {
            if (error instanceof joi_1.default.ValidationError) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 400,
                        message: error.message,
                        details: error.details.map((d) => d.message),
                    },
                });
            }
            next(error);
        }
    };
};
exports.validate = validate;
