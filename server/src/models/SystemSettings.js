import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, unique: true },
    teacherCutoffTime: { type: String, default: '07:30' },
    currency: { type: String, default: 'USD' },
    academicYear: { type: String, default: '2025-2026' },
  },
  { timestamps: true }
);

export const SystemSettings = mongoose.model('SystemSettings', settingsSchema);
