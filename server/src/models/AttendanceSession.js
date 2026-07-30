import mongoose from 'mongoose';

const markSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused', 'truant'],
      required: true,
    },
    note: { type: String, trim: true },
    excusedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    excusedAt: Date,
  },
  { _id: false }
);

const attendanceSessionSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    slot: { type: Number, enum: [1, 2], required: true },
    marks: [markSchema],
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

attendanceSessionSchema.index({ schoolId: 1, classId: 1, date: 1, slot: 1 }, { unique: true });

export const AttendanceSession = mongoose.model('AttendanceSession', attendanceSessionSchema);
