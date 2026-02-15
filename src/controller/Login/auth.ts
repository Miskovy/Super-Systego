import { Request, Response } from "express";
import { AdminModel } from "../../models/shema/auth/Admin";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../../Errors";
import { SuccessResponse } from "../../utils/response";


export const login_admin = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new UnauthorizedError("Email and password are required");
  }

  const admin = await AdminModel.findOne({ email });
  if (!admin) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(password, admin.password);
  if (!isPasswordValid) {
    throw new UnauthorizedError("Invalid email or password");
  }

 
  // توليد التوكن
  const token = jwt.sign(
    {
      sub: admin._id.toString(),
      name: admin.name,
      email: admin.email,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "1d" }
  );

  return SuccessResponse(
    res,
    {
      message: "Login successful",
      token,
      admin: {
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
      },
    },
    200
  );
};


