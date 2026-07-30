import dotenv from 'dotenv';

dotenv.config();

const required = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI,
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
  refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  defaultSchoolName: process.env.DEFAULT_SCHOOL_NAME || 'Demo Academy',
  teacherCutoffTime: process.env.TEACHER_CUTOFF_TIME || '07:30',
  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@school.local',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
    username: process.env.SEED_ADMIN_USERNAME || 'admin',
  },
};
