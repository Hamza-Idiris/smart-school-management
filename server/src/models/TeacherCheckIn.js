import mongoose from 'mongoose';

const teacherCheckInSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    clockInAt: { type: Date, required: true },
    isLate: { type: Boolean, default: false },
    cutoffTime: { type: String, required: true },
  },
  { timestamps: true }
);

teacherCheckInSchema.index({ schoolId: 1, teacherId: 1, date: 1 }, { unique: true });

export const TeacherCheckIn = mongoose.model('TeacherCheckIn', teacherCheckInSchema);
