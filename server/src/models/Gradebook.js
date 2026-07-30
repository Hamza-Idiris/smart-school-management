import mongoose from 'mongoose';

const entrySchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    score: { type: Number, min: 0 },
    maxScore: { type: Number, default: 100 },
    remark: { type: String, trim: true },
  },
  { _id: false }
);

const gradebookSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    term: { type: String, required: true },
    academicYear: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    entries: [entrySchema],
    status: {
      type: String,
      enum: ['draft', 'locked', 'released'],
      default: 'draft',
      index: true,
    },
    submittedAt: Date,
    releasedAt: Date,
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

gradebookSchema.index(
  { schoolId: 1, classId: 1, subjectId: 1, term: 1, academicYear: 1, title: 1 },
  { unique: true }
);

export const Gradebook = mongoose.model('Gradebook', gradebookSchema);
