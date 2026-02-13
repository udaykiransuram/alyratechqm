import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../lib/db.ts';
import { getTenantModels } from '../lib/db-tenant.ts';

(async () => {
  await connectDB();
  const schoolKey = 'greenwood_day';
  const { User } = await getTenantModels(schoolKey, ['User']);
  const email = 'udaykiransuram03@gmail.com';
  const password = '6302474005';
  const passwordHash = await bcrypt.hash(password, 10);
  const adminUser = new User({ name: 'Admin User', email, passwordHash, role: 'admin' });
  await adminUser.save();
  console.log('Admin user created successfully');
  await mongoose.disconnect();
})();