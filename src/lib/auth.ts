import crypto from "crypto";

// Use an environment secret if available, otherwise fallback to a static secret for local development
const SECRET = process.env.SESSION_SECRET || "default_super_secret_minesweeper_key_123456";

// Hash a password using PBKDF2 with SHA-512
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
}

// Generate a random 16-byte salt for passwords
export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

// Create a signed session token containing the username (expires in 7 days)
export function encryptSession(username: string): string {
  const payload = {
    username,
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const str = JSON.stringify(payload);
  const base64 = Buffer.from(str).toString("base64url");
  
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(base64);
  const signature = hmac.digest("base64url");
  
  return `${base64}.${signature}`;
}

// Verify a session token and extract the username
export function decryptSession(token: string): string | null {
  if (!token) return null;
  
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  
  const [base64, signature] = parts;
  
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(base64);
  const expectedSignature = hmac.digest("base64url");
  
  // Timing-safe verification of the signature
  try {
    const isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(signature, "base64url"),
      Buffer.from(expectedSignature, "base64url")
    );
    if (!isSignatureValid) return null;
  } catch {
    return null;
  }
  
  try {
    const str = Buffer.from(base64, "base64url").toString("utf-8");
    const payload = JSON.parse(str);
    if (payload.expires < Date.now()) {
      return null; // Expired session
    }
    return payload.username;
  } catch {
    return null;
  }
}
