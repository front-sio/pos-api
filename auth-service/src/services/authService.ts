import { Request, Response } from "express";
import { db } from "../db/db";
import { auth_user } from "../db/schema/auth_user";
import { and, eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function verifyDjangoPassword(password: string, djangoHash: string): boolean {
  try {
    const parts = djangoHash.split("$");
    if (parts.length !== 4) return false;

    const [algorithm, iterationsStr, salt, storedHash] = parts;
    if (algorithm !== "pbkdf2_sha256") return false;

    const iterations = parseInt(iterationsStr, 10);
    if (!Number.isFinite(iterations)) return false;

    const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
    const derivedB64 = derivedKey.toString("base64");

    // timing safe comparison
    const a = Buffer.from(derivedB64, "utf8");
    const b = Buffer.from(storedHash, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function normalize(value: string) {
  return value?.toString().trim();
}

function normalizeEmail(value: string) {
  return normalize(value)?.toLowerCase();
}

// Register new user (bcrypt)
export async function registerUser(req: Request, res: Response) {
  const username = normalize(req.body?.username);
  const password = req.body?.password;
  const email = normalizeEmail(req.body?.email);
  const first_name = normalize(req.body?.first_name);
  const last_name = normalize(req.body?.last_name);

  if (!username || !password || !email || !first_name || !last_name) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Pre-check duplicates for clearer 409s
    const existing = await db
      .select({ id: auth_user.id, username: auth_user.username, email: auth_user.email })
      .from(auth_user)
      .where(or(eq(auth_user.username, username), eq(auth_user.email, email)))
      .limit(1);

    if (existing.length > 0) {
      const dup = existing[0];
      const field = dup.username === username ? "username" : "email";
      return res.status(409).json({ message: `A user with this ${field} already exists` });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await db
      .insert(auth_user)
      .values({
        username,
        password: hashedPassword,
        email,
        first_name,
        last_name,
        is_active: true,
        is_staff: false,
        is_superuser: false,
        // last_login left as NULL; date_joined defaults now() on DB side
      })
      .returning({ id: auth_user.id });

    return res.status(201).json({ message: "User registered", id: result[0]?.id });
  } catch (err: any) {
    // Postgres duplicate key
    if (err?.code === "23505") {
      // If DB reveals which constraint, map it
      const msg =
        err?.detail?.includes("username") || err?.constraint?.includes("username")
          ? "A user with this username already exists"
          : err?.detail?.includes("email") || err?.constraint?.includes("email")
          ? "A user with this email already exists"
          : "Duplicate key";
      return res.status(409).json({ message: msg });
    }

    console.error("Register error:", err);
    return res.status(500).json({ message: "Registration failed" });
  }
}

// Login user (bcrypt + Django PBKDF2)
export async function loginUser(req: Request, res: Response) {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const userArr = await db.select().from(auth_user).where(eq(auth_user.email, email)).limit(1);
    const user = userArr[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (!user.is_active) return res.status(403).json({ message: "User is inactive" });

    let valid = false;
    if (user.password.startsWith("pbkdf2_sha256$")) {
      valid = verifyDjangoPassword(password, user.password);
    } else {
      valid = await bcrypt.compare(password, user.password);
    }

    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const secret = process.env.JWT_SECRET || "secret";
    const token = jwt.sign({ id: user.id, username: user.username }, secret, { expiresIn: "1d" });

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Login failed" });
  }
}

// Get current user from JWT
export async function getCurrentUser(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const payload: any = jwt.verify(token, process.env.JWT_SECRET || "secret");

    const userArr = await db.select().from(auth_user).where(eq(auth_user.id, Number(payload.id))).limit(1);
    const user = userArr[0];
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// List all users
export async function getAllUsers(req: Request, res: Response) {
  const users = await db.select().from(auth_user);
  return res.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      is_active: u.is_active,
      is_staff: u.is_staff,
      is_superuser: u.is_superuser,
      date_joined: u.date_joined,
    })),
  );
}