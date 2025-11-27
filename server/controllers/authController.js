const jwt = require("jsonwebtoken");
const { User } = require("../models");
const bcrypt = require("bcrypt");

const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "7d";

const createAccess = (user) =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES,
  });

const createRefresh = (user) =>
  jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES,
  });

module.exports = {
  // -------------------------
  // LOGIN
  // -------------------------
  async login(req, res) {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = createAccess(user);
    const refreshToken = createRefresh(user);

    // HTTP-only cookie in production only
    const secure = process.env.NODE_ENV === "production";

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 3600 * 1000,
    });

    return res.json({ accessToken });
  },

  // -------------------------
  // REFRESH
  // -------------------------
  async refreshToken(req, res) {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      const user = await User.findByPk(decoded.id);

      if (!user) return res.status(401).json({ message: "User not found" });

      const newAccess = createAccess(user);

      return res.json({ accessToken: newAccess });
    } catch (err) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
  },

  // -------------------------
  // LOGOUT
  // -------------------------
  logout(req, res) {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      path: "/",
    });

    return res.json({ message: "Logged out" });
  },

  // -------------------------
  // /ME
  // -------------------------
  authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: "No token" });

    const token = header.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ message: "Invalid token" });
    }
  },

  async me(req, res) {
    return res.json({ userId: req.user.id, email: req.user.email });
  },
};