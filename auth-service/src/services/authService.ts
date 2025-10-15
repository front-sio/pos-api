// src/services/authService.ts
import { Request, Response } from "express";
import { db } from "../db/db";
import { auth_user } from "../db/schema/auth_user";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

// Helper: verify Django PBKDF2-SHA256 password
function verifyDjangoPassword(password: string, djangoHash: string): boolean {
  try {
    const parts = djangoHash.split("$");
    if (parts.length !== 4) return false;

    const [algorithm, iterationsStr, salt, storedHash] = parts;
    if (algorithm !== "pbkdf2_sha256") return false;

    const iterations = parseInt(iterationsStr, 10);
    if (isNaN(iterations)) return false;

    const derivedKey = crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      32, // 256-bit key
      "sha256"
    );

    return derivedKey.toString("base64") === storedHash;
  } catch (err) {
    console.error("PBKDF2 verify error:", err);
    return false;
  }
}

// Register new user (bcrypt)
export async function registerUser(req: Request, res: Response) {
  const { username, password, email, first_name, last_name } = req.body;
  if (!username || !password || !email || !first_name || !last_name) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
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
        date_joined: new Date(),
      })
      .returning({ id: auth_user.id });

    res.status(201).json({ message: "User registered", id: result[0]?.id });
  } catch (err: any) {
    console.error("Register error:", err);
    res.status(500).json({ message: err.message || "Registration failed" });
  }
}

// Login user (bcrypt + Django PBKDF2)
export async function loginUser(req: Request, res: Response) {
  const { email, password } = req.body;

  try {
    const userArr = await db
      .select()
      .from(auth_user)
      .where(eq(auth_user.email, email));

    const user = userArr[0];
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    let valid = false;
    if (user.password.startsWith("pbkdf2_sha256$")) {
      valid = verifyDjangoPassword(password, user.password);
    } else {
      valid = await bcrypt.compare(password, user.password);
    }

    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );

    res.json({
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
    res.status(500).json({ message: err.message || "Login failed" });
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

    const userArr = await db
      .select()
      .from(auth_user)
      .where(eq(auth_user.id, Number(payload.id)));

    const user = userArr[0];
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
}

// List all users
export async function getAllUsers(req: Request, res: Response) {
  const users = await db.select().from(auth_user);
  res.json(
    users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      is_active: u.is_active,
      is_staff: u.is_staff,
      is_superuser: u.is_superuser,
      date_joined: u.date_joined,
    }))
  );
}
