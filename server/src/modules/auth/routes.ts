import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../../models";
import { config } from "../../config";
import { HttpError } from "../../shared/errors";
import { authenticate } from "../../middleware/auth";

export const authRouter = Router();

const loginBody = z.object({ email: z.string().email(), password: z.string().min(1) });

function signAccess(user: any) {
  return jwt.sign({ sub: String(user._id), tv: user.tokenVersion }, config.jwtSecret, { expiresIn: config.accessTtl as any });
}

authRouter.post("/login", async (req, res) => {
  const { email, password } = loginBody.parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !user.active) throw new HttpError(401, "Invalid email or password");
  if (user.lockedUntil && user.lockedUntil > new Date()) throw new HttpError(423, "Account locked, try again later");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    user.failedLogins += 1;
    if (user.failedLogins >= 5) {
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      user.failedLogins = 0;
    }
    await user.save();
    throw new HttpError(401, "Invalid email or password");
  }
  user.failedLogins = 0;
  await user.save();
  const token = signAccess(user);
  res.cookie("access", token, { httpOnly: true, sameSite: "lax", maxAge: 15 * 60 * 1000 });
  res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, entityId: user.entityId } });
});

authRouter.post("/logout", authenticate, async (req, res) => {
  await User.updateOne({ _id: req.actor.id }, { $inc: { tokenVersion: 1 } });
  res.clearCookie("access");
  res.json({ ok: true });
});

authRouter.get("/me", authenticate, async (req, res) => {
  const user = await User.findById(req.actor.id).select("-passwordHash").lean();
  res.json(user);
});
