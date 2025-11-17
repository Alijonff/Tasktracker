import bcrypt from "bcrypt";
import { type IStorage } from "./storage";
import { type User, type Login } from "@shared/schema";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function createAdminUser(storage: IStorage): Promise<User | null> {
  const existingAdmin = await storage.getUserByUsername("admin");
  if (existingAdmin) {
    console.log("Админ уже существует");
    return existingAdmin;
  }

  const passwordHash = await hashPassword("qwerty");
  const admin = await storage.createUser(
    "admin",
    passwordHash,
    "Администратор",
    "admin@system.local",
    "admin",
    "A",
    null,
    null,
    null,
    null,
    false
  );
  console.log("Админ создан: username=admin, password=qwerty");
  return admin;
}

export async function authenticateUser(storage: IStorage, credentials: Login): Promise<User | null> {
  const user = await storage.getUserByUsername(credentials.username);
  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(credentials.password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return user;
}
