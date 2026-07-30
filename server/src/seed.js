import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { School } from './models/School.js';
import { User } from './models/User.js';
import { SystemSettings } from './models/SystemSettings.js';

async function seed() {
  await connectDb();

  let school = await School.findOne({ code: 'DEMO' });
  if (!school) {
    school = await School.create({
      name: env.defaultSchoolName,
      code: 'DEMO',
      isActive: true,
    });
    console.log('Created school:', school.name);
  }

  let settings = await SystemSettings.findOne({ schoolId: school._id });
  if (!settings) {
    settings = await SystemSettings.create({
      schoolId: school._id,
      teacherCutoffTime: env.teacherCutoffTime,
      currency: 'USD',
      academicYear: '2025-2026',
    });
    console.log('Created system settings');
  }

  const existingAdmin = await User.findOne({
    schoolId: school._id,
    username: env.seedAdmin.username,
  });

  if (!existingAdmin) {
    await User.create({
      schoolId: school._id,
      username: env.seedAdmin.username,
      email: env.seedAdmin.email,
      fullName: 'Super Admin',
      role: 'super_admin',
      status: 'active',
      mustChangePassword: false,
      passwordHash: await User.hashPassword(env.seedAdmin.password),
    });
    console.log('Created super admin:', env.seedAdmin.username);
  } else {
    console.log('Super admin already exists');
  }

  console.log('\nSeed complete.');
  console.log(`Login: ${env.seedAdmin.username} / ${env.seedAdmin.password}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
