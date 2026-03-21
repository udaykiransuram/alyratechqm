// lib/db.ts
import mongoose from 'mongoose';

// Import all your models here to register them with Mongoose
import './../models/Subject.ts';
import './../models/Tag.ts';
import './../models/TagType.ts';
import './../models/CompanyAdmin.ts';
import './../models/CompanyAuditLog.ts';
// Assuming you have this model as well

const MONGODB_URI = process.env.MONGODB_URI!;

// Avoid running index creation work during normal request handling.
// Indexes are provisioned explicitly via the existing scripts/routes instead.
mongoose.set('autoIndex', false);

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 20000,
      family: 4
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
