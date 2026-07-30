import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['super_admin', 'staff', 'teacher', 'cashier', 'student'];

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    username: { type: String, required: true, trim: true, lowercase: true },
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true, index: true },
    status: { type: String, enum: ['active', 'deactivated'], default: 'active', index: true },
    mustChangePassword: { type: Boolean, default: true },
    phone: { type: String, trim: true },
    studentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    refreshTokens: [refreshTokenSchema],
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.index({ schoolId: 1, username: 1 }, { unique: true });
userSchema.index({ schoolId: 1, email: 1 }, { unique: true, sparse: true });

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

export const User = mongoose.model('User', userSchema);
