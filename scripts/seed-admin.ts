/**
 * Create (or reset the password of) an Ops admin.
 *   npm run seed:admin -- you@mentiq.ai "a-strong-password" "Your Name"
 * The email must also be listed in ADMIN_EMAILS, or the role is reset at next login.
 */
import mongoose from "mongoose";
import { db } from "@/lib/db";
import { User } from "@/lib/models";
import bcrypt from "bcryptjs";

const [email, password, name = ""] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run seed:admin -- <email> <password> ["Name"]');
  process.exit(1);
}

await db();
const passwordHash = await bcrypt.hash(password, 11);
await User.updateOne({ email: email.toLowerCase() }, { $set: { passwordHash, role: "admin", name }, $setOnInsert: { email: email.toLowerCase() } }, { upsert: true });
console.log(`✓ Admin ready: ${email}`);
if (!(process.env.ADMIN_EMAILS ?? "").toLowerCase().includes(email.toLowerCase())) console.warn("  ⚠ Add this email to ADMIN_EMAILS in .env");
await mongoose.disconnect();
