import mongoose from 'mongoose';

const parentSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    primaryPhone: { type: String, required: true, trim: true },
    secondaryPhone: { type: String, trim: true },
    whatsappNumber: { type: String, trim: true },
    relationship: { type: String, trim: true, default: 'Parent' },
  },
  { _id: false }
);

const studentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    studentId: { type: String, required: true, trim: true, uppercase: true },
    fullName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    parent: parentSchema,
    feeTag: {
      type: String,
      enum: ['standard', 'scholarship', 'discounted'],
      default: 'standard',
      required: true,
    },
    discountType: { type: String, enum: ['percent', 'amount', null], default: null },
    discountValue: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive', 'graduated'], default: 'active' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

studentSchema.index({ schoolId: 1, studentId: 1 }, { unique: true });

export const Student = mongoose.model('Student', studentSchema);
