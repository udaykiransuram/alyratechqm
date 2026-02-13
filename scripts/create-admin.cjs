// scripts/create-admin.cjs
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../lib/db.ts');
const { getTenantModels } = require('../lib/db-tenant.ts');

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