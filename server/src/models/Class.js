import mongoose from 'mongoose';

const classSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    name: { type: String, required: true, trim: true },
    gradeLevel: { type: String, trim: true },
    section: { type: String, trim: true },
    academicYear: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

classSchema.index({ schoolId: 1, name: 1, academicYear: 1 }, { unique: true });

export const ClassModel = mongoose.model('Class', classSchema);
